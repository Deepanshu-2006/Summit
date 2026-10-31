package auth

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgconn"
)

// DBExecutor executes SQL statements without returning rows.
type DBExecutor interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// UpsertUser performs an idempotent upsert of a user record from verified claims.
// This fulfills spec 6.1 (idempotent authenticated Go API upsert strategy).
func UpsertUser(ctx context.Context, db DBExecutor, p Principal) error {
	if db == nil {
		return nil
	}

	avatarURL, _ := p.Claims["avatar_url"].(string)
	if avatarURL == "" {
		if meta, ok := p.Claims["user_metadata"].(map[string]any); ok {
			avatarURL, _ = meta["avatar_url"].(string)
		}
	}

	query := `
		INSERT INTO users (id, email, name, avatar_url, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (id) DO UPDATE SET
			email = COALESCE(EXCLUDED.email, users.email),
			name = COALESCE(NULLIF(EXCLUDED.name, ''), users.name),
			avatar_url = COALESCE(NULLIF(EXCLUDED.avatar_url, ''), users.avatar_url),
			updated_at = now()
	`
	_, err := db.Exec(ctx, query, p.UserID, p.Email, p.Name, avatarURL)
	if err != nil {
		return fmt.Errorf("upserting user %s: %w", p.UserID, err)
	}
	return nil
}
