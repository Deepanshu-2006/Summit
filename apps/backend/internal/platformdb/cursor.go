package platformdb

import (
	"encoding/base64"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Pagination limits.
const (
	DefaultPageLimit = 20
	MaxPageLimit     = 100
)

// ListParams carries keyset pagination input. Limit <= 0 means DefaultPageLimit;
// values above MaxPageLimit are clamped. Cursor is the opaque NextCursor of a
// previous page ("" for the first page).
type ListParams struct {
	Limit  int
	Cursor string
}

// Page is one page of results. NextCursor is empty on the last page.
type Page[T any] struct {
	Items      []T
	NextCursor string
}

func (p ListParams) limit() int {
	switch {
	case p.Limit <= 0:
		return DefaultPageLimit
	case p.Limit > MaxPageLimit:
		return MaxPageLimit
	default:
		return p.Limit
	}
}

const cursorVersion = "v1"

// EncodeCursor builds an opaque cursor for the (created_at, id) keyset.
// Timestamps are truncated to microseconds, matching Postgres precision.
func EncodeCursor(createdAt time.Time, id uuid.UUID) string {
	raw := cursorVersion + "|" + strconv.FormatInt(createdAt.UnixMicro(), 10) + "|" + id.String()
	return base64.RawURLEncoding.EncodeToString([]byte(raw))
}

// DecodeCursor parses a cursor produced by EncodeCursor. Any malformed input
// yields ErrInvalidArgument.
func DecodeCursor(cursor string) (time.Time, uuid.UUID, error) {
	b, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, uuid.Nil, invalidArg("malformed cursor")
	}
	parts := strings.Split(string(b), "|")
	if len(parts) != 3 || parts[0] != cursorVersion {
		return time.Time{}, uuid.Nil, invalidArg("malformed cursor")
	}
	micros, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return time.Time{}, uuid.Nil, invalidArg("malformed cursor")
	}
	id, err := uuid.Parse(parts[2])
	if err != nil {
		return time.Time{}, uuid.Nil, invalidArg("malformed cursor")
	}
	return time.UnixMicro(micros).UTC(), id, nil
}

// decodeOptionalCursor returns (nil, nil) for an empty cursor.
func decodeOptionalCursor(cursor string) (*time.Time, *uuid.UUID, error) {
	if cursor == "" {
		return nil, nil, nil
	}
	t, id, err := DecodeCursor(cursor)
	if err != nil {
		return nil, nil, err
	}
	return &t, &id, nil
}

// pageOf trims an over-fetched slice (limit+1 rows) and computes NextCursor.
func pageOf[T any](rows []T, limit int, key func(T) (time.Time, uuid.UUID)) Page[T] {
	if len(rows) <= limit {
		return Page[T]{Items: rows}
	}
	rows = rows[:limit]
	t, id := key(rows[limit-1])
	return Page[T]{Items: rows, NextCursor: EncodeCursor(t, id)}
}
