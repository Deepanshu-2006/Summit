package db

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// MigrationStatus represents a migration and whether it has been applied.
type MigrationStatus struct {
	Version   string
	Applied   bool
	AppliedAt *time.Time
}

// Migrate runs all pending SQL migrations against the database.
// It uses an advisory lock to prevent concurrent migration runs.
// Each migration is run in its own transaction.
// Migrations are sorted lexicographically by filename.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	return MigrateWithLogger(ctx, pool, slog.Default())
}

// MigrateWithLogger runs migrations with a provided logger.
func MigrateWithLogger(ctx context.Context, pool *pgxpool.Pool, logger *slog.Logger) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquiring connection: %w", err)
	}
	defer conn.Release()

	// Acquire advisory lock to prevent concurrent migrations.
	// The lock ID is an arbitrary but stable constant.
	const advisoryLockID = 0x7265736368656d61 // "rschema" in hex-like
	_, err = conn.Exec(ctx, "SELECT pg_advisory_lock($1)", advisoryLockID)
	if err != nil {
		return fmt.Errorf("acquiring advisory lock: %w", err)
	}
	defer func() {
		unlockCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.Exec(unlockCtx, "SELECT pg_advisory_unlock($1)", advisoryLockID)
	}()

	// Ensure schema_migrations table exists
	_, err = conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return fmt.Errorf("creating schema_migrations table: %w", err)
	}

	// Load applied migrations
	applied, err := loadApplied(ctx, conn.Conn())
	if err != nil {
		return fmt.Errorf("loading applied migrations: %w", err)
	}

	// Read migration files
	migrations, err := readMigrations()
	if err != nil {
		return fmt.Errorf("reading migrations: %w", err)
	}

	for _, m := range migrations {
		if applied[m.version] {
			logger.Debug("migration already applied", "version", m.version)
			continue
		}

		logger.Info("applying migration", "version", m.version)

		tx, err := conn.Begin(ctx)
		if err != nil {
			return fmt.Errorf("beginning transaction for %s: %w", m.version, err)
		}

		_, err = tx.Exec(ctx, m.sql)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("executing migration %s: %w", m.version, err)
		}

		_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", m.version)
		if err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("recording migration %s: %w", m.version, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("committing migration %s: %w", m.version, err)
		}

		logger.Info("migration applied", "version", m.version)
	}

	return nil
}

// Status returns the status of all migrations (applied and pending).
func Status(ctx context.Context, pool *pgxpool.Pool) ([]MigrationStatus, error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquiring connection: %w", err)
	}
	defer conn.Release()

	// Ensure schema_migrations table exists
	_, err = conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("creating schema_migrations table: %w", err)
	}

	applied, err := loadAppliedWithTime(ctx, conn.Conn())
	if err != nil {
		return nil, fmt.Errorf("loading applied migrations: %w", err)
	}

	migrations, err := readMigrations()
	if err != nil {
		return nil, fmt.Errorf("reading migrations: %w", err)
	}

	var statuses []MigrationStatus
	for _, m := range migrations {
		status := MigrationStatus{
			Version: m.version,
			Applied: false,
		}
		if at, ok := applied[m.version]; ok {
			status.Applied = true
			status.AppliedAt = &at
		}
		statuses = append(statuses, status)
	}

	return statuses, nil
}

type migration struct {
	version string
	sql     string
}

func readMigrations() ([]migration, error) {
	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("reading migrations directory: %w", err)
	}

	var migrations []migration
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasSuffix(name, ".up.sql") {
			continue
		}

		content, err := fs.ReadFile(migrationsFS, "migrations/"+name)
		if err != nil {
			return nil, fmt.Errorf("reading migration %s: %w", name, err)
		}

		version := strings.TrimSuffix(name, ".up.sql")
		migrations = append(migrations, migration{
			version: version,
			sql:     string(content),
		})
	}

	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].version < migrations[j].version
	})

	return migrations, nil
}

func loadApplied(ctx context.Context, conn *pgx.Conn) (map[string]bool, error) {
	rows, err := conn.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}
	return applied, rows.Err()
}

func loadAppliedWithTime(ctx context.Context, conn *pgx.Conn) (map[string]time.Time, error) {
	rows, err := conn.Query(ctx, "SELECT version, applied_at FROM schema_migrations ORDER BY version")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]time.Time)
	for rows.Next() {
		var version string
		var appliedAt time.Time
		if err := rows.Scan(&version, &appliedAt); err != nil {
			return nil, err
		}
		applied[version] = appliedAt
	}
	return applied, rows.Err()
}
