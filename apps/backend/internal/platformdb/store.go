package platformdb

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Typed errors returned by the Store. Use errors.Is to test for them; the
// returned errors may wrap extra detail.
var (
	// ErrNotFound means the row does not exist or is not visible to the caller
	// (wrong owner, soft-deleted). Callers cannot distinguish the two on purpose.
	ErrNotFound = errors.New("platformdb: not found")
	// ErrConflict means a uniqueness rule was violated (project slug, service
	// name, secret key, idempotency key reused for a different service) or a
	// different terminal build result was already recorded.
	ErrConflict = errors.New("platformdb: conflict")
	// ErrInvalidTransition means a compare-and-set did not match: the row is
	// not in one of the expected states.
	ErrInvalidTransition = errors.New("platformdb: invalid transition")
	// ErrInvalidArgument means the input failed validation before touching the database.
	ErrInvalidArgument = errors.New("platformdb: invalid argument")
	// ErrSourceNotConfigured means the service has no service_sources row.
	ErrSourceNotConfigured = errors.New("platformdb: service source not configured")
	// ErrSourceInactive means the service source or its GitHub installation is
	// not in the 'active' state, so no build can be requested.
	ErrSourceInactive = errors.New("platformdb: service source or installation not active")
)

// DBTX is the subset of pgx used by the Store. It is satisfied by
// *pgxpool.Pool, *pgxpool.Conn and pgx.Tx.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// beginner starts a transaction (or a savepoint when called on a pgx.Tx).
type beginner interface {
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Store is the concrete platform database access layer. It is safe for
// concurrent use when built on a pool; a Store handed to a WithTx callback is
// bound to that single transaction and must not be used concurrently or after
// the callback returns.
type Store struct {
	db DBTX
	tx beginner
}

// New returns a Store backed by pool.
func New(pool *pgxpool.Pool) *Store {
	return &Store{db: pool, tx: pool}
}

// WithTx runs fn inside a transaction. The *Store passed to fn is bound to the
// transaction. If fn returns an error or panics, the transaction is rolled
// back; otherwise it is committed. Calling WithTx on a transaction-bound Store
// nests using a savepoint.
func (s *Store) WithTx(ctx context.Context, fn func(*Store) error) (err error) {
	if s.tx == nil {
		return errors.New("platformdb: store cannot start transactions")
	}
	tx, err := s.tx.Begin(ctx)
	if err != nil {
		return fmt.Errorf("platformdb: begin tx: %w", err)
	}
	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
			panic(p)
		}
		if err != nil {
			_ = tx.Rollback(context.WithoutCancel(ctx))
		}
	}()
	if err = fn(&Store{db: tx, tx: tx}); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("platformdb: commit tx: %w", err)
	}
	return nil
}

// Ping verifies the database is reachable.
func (s *Store) Ping(ctx context.Context) error {
	var one int
	if err := s.db.QueryRow(ctx, "SELECT 1").Scan(&one); err != nil {
		return fmt.Errorf("platformdb: ping: %w", err)
	}
	return nil
}

// PostgreSQL SQLSTATE codes handled by the Store.
const (
	pgUniqueViolation     = "23505"
	pgForeignKeyViolation = "23503"
)

func pgErrCode(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

func isUniqueViolation(err error) bool { return pgErrCode(err) == pgUniqueViolation }
func isFKViolation(err error) bool     { return pgErrCode(err) == pgForeignKeyViolation }

// notFoundIfNoRows maps pgx.ErrNoRows to ErrNotFound.
func notFoundIfNoRows(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func invalidArg(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidArgument, fmt.Sprintf(format, a...))
}

// truncateString shortens s to at most max bytes without splitting a UTF-8
// sequence, appending a marker when it cut something.
func truncateString(s string, max int) string {
	const marker = "...[truncated]"
	if max <= 0 || len(s) <= max {
		return s
	}
	cut := max - len(marker)
	if cut < 0 {
		cut = 0
	}
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut] + marker
}

// sanitizeText strips NUL bytes (rejected by Postgres text) and invalid UTF-8.
func sanitizeText(s string) string {
	if strings.IndexByte(s, 0) >= 0 {
		s = strings.ReplaceAll(s, "\x00", "")
	}
	if !utf8.ValidString(s) {
		s = strings.ToValidUTF8(s, "�")
	}
	return s
}

func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
