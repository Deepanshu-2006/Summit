package queue

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DBTX is the minimal database interface required for queue operations.
// It is directly satisfied by *pgxpool.Pool, *pgx.Conn, and pgx.Tx.
type DBTX interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// scanEventRecord scans an EventRecord from a row scanner.
func scanEventRecord(row pgx.Row) (*EventRecord, error) {
	var rec EventRecord
	err := row.Scan(
		&rec.ID,
		&rec.AggregateType,
		&rec.AggregateID,
		&rec.EventType,
		&rec.Payload,
		&rec.Status,
		&rec.Attempts,
		&rec.MaxRetries,
		&rec.AvailableAt,
		&rec.LockedUntil,
		&rec.LockedBy,
		&rec.LastError,
		&rec.CreatedAt,
		&rec.UpdatedAt,
		&rec.PublishedAt,
		&rec.ProcessedAt,
	)
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

// scanEventRecords scans multiple EventRecord rows.
func scanEventRecords(rows pgx.Rows) ([]*EventRecord, error) {
	defer rows.Close()
	var records []*EventRecord
	for rows.Next() {
		var rec EventRecord
		err := rows.Scan(
			&rec.ID,
			&rec.AggregateType,
			&rec.AggregateID,
			&rec.EventType,
			&rec.Payload,
			&rec.Status,
			&rec.Attempts,
			&rec.MaxRetries,
			&rec.AvailableAt,
			&rec.LockedUntil,
			&rec.LockedBy,
			&rec.LastError,
			&rec.CreatedAt,
			&rec.UpdatedAt,
			&rec.PublishedAt,
			&rec.ProcessedAt,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, &rec)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return records, nil
}
