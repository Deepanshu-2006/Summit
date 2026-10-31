package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockBuildJob struct {
	ID           uuid.UUID
	DeploymentID uuid.UUID
	Status       string
	ErrorMessage *string
	DispatchedAt *time.Time
	StartedAt    *time.Time
	CompletedAt  *time.Time
}

type mockDB struct {
	mu           sync.RWMutex
	outboxEvents map[uuid.UUID]*EventRecord
	buildJobs    map[uuid.UUID]*mockBuildJob
}

func newMockDB() *mockDB {
	return &mockDB{
		outboxEvents: make(map[uuid.UUID]*EventRecord),
		buildJobs:    make(map[uuid.UUID]*mockBuildJob),
	}
}

func normSQL(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func (m *mockDB) insertOutboxEvent(rec *EventRecord) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if rec.ID == uuid.Nil {
		rec.ID = uuid.New()
	}
	if rec.Status == "" {
		rec.Status = StatusPending
	}
	if rec.MaxRetries == 0 {
		rec.MaxRetries = 5
	}
	now := time.Now().UTC()
	if rec.CreatedAt.IsZero() {
		rec.CreatedAt = now
	}
	if rec.UpdatedAt.IsZero() {
		rec.UpdatedAt = now
	}
	if rec.AvailableAt.IsZero() {
		rec.AvailableAt = now
	}
	copyRec := *rec
	m.outboxEvents[rec.ID] = &copyRec
}

func (m *mockDB) insertBuildJob(job *mockBuildJob) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if job.ID == uuid.Nil {
		job.ID = uuid.New()
	}
	if job.Status == "" {
		job.Status = BuildJobStatusQueued
	}
	copyJob := *job
	m.buildJobs[job.ID] = &copyJob
}

func (m *mockDB) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cleanSQL := normSQL(sql)

	// UPDATE outbox_events SET status = 'failed' ... WHERE id = $1
	if strings.Contains(cleanSQL, "UPDATE outbox_events") && strings.Contains(cleanSQL, "status = 'failed'") {
		eventID := arguments[0].(uuid.UUID)
		errMsg := arguments[1].(string)
		if ev, ok := m.outboxEvents[eventID]; ok {
			ev.Status = StatusFailed
			ev.LastError = &errMsg
			ev.LockedBy = nil
			ev.LockedUntil = nil
			now := time.Now().UTC()
			ev.ProcessedAt = &now
			ev.UpdatedAt = now
			return pgconn.NewCommandTag("UPDATE 1"), nil
		}
		return pgconn.NewCommandTag("UPDATE 0"), nil
	}

	// UPDATE outbox_events SET status = 'pending' ... WHERE id = $1
	if strings.Contains(cleanSQL, "UPDATE outbox_events") && strings.Contains(cleanSQL, "status = 'pending'") {
		eventID := arguments[0].(uuid.UUID)
		errMsg := arguments[1].(string)
		intervalStr := arguments[2].(string)
		var delayMillis int64
		_, _ = fmt.Sscanf(intervalStr, "%d milliseconds", &delayMillis)

		if ev, ok := m.outboxEvents[eventID]; ok {
			ev.Status = StatusPending
			ev.LastError = &errMsg
			ev.LockedBy = nil
			ev.LockedUntil = nil
			ev.AvailableAt = time.Now().UTC().Add(time.Duration(delayMillis) * time.Millisecond)
			ev.UpdatedAt = time.Now().UTC()
			return pgconn.NewCommandTag("UPDATE 1"), nil
		}
		return pgconn.NewCommandTag("UPDATE 0"), nil
	}

	// UPDATE outbox_events SET status = 'completed' ... WHERE id = $1
	if strings.Contains(cleanSQL, "UPDATE outbox_events") && strings.Contains(cleanSQL, "status = 'completed'") {
		eventID := arguments[0].(uuid.UUID)
		workerID, hasWorker := "", len(arguments) > 1
		if hasWorker {
			workerID = arguments[1].(string)
		}
		if ev, ok := m.outboxEvents[eventID]; ok && ev.Status == StatusClaimed && hasWorker && ev.LockedBy != nil && *ev.LockedBy == workerID {
			ev.Status = StatusCompleted
			ev.LockedBy = nil
			ev.LockedUntil = nil
			now := time.Now().UTC()
			ev.ProcessedAt = &now
			ev.UpdatedAt = now
			return pgconn.NewCommandTag("UPDATE 1"), nil
		}
		return pgconn.NewCommandTag("UPDATE 0"), nil
	}

	// UPDATE build_jobs SET status = ... WHERE deployment_id = ...
	if strings.Contains(cleanSQL, "UPDATE build_jobs") {
		now := time.Now().UTC()
		updated := 0

		// Case 1: UPDATE build_jobs SET status = 'failed', error_message = $2 ... WHERE deployment_id = $1
		if strings.Contains(cleanSQL, "status = 'failed'") {
			depID := arguments[0].(uuid.UUID)
			errMsg := arguments[1].(string)
			for _, job := range m.buildJobs {
				if job.DeploymentID == depID {
					job.Status = BuildJobStatusFailed
					job.ErrorMessage = &errMsg
					if job.CompletedAt == nil {
						job.CompletedAt = &now
					}
					updated++
				}
			}
			return pgconn.NewCommandTag(fmt.Sprintf("UPDATE %d", updated)), nil
		}

		// Case 2: UPDATE build_jobs SET status = $1 ... WHERE deployment_id = $2
		status := arguments[0].(string)
		depID := arguments[1].(uuid.UUID)
		for _, job := range m.buildJobs {
			if job.DeploymentID == depID {
				job.Status = status
				if len(arguments) > 2 {
					if errStr, ok := arguments[2].(string); ok {
						job.ErrorMessage = &errStr
					}
				}
				if status == BuildJobStatusDispatched && job.DispatchedAt == nil {
					job.DispatchedAt = &now
				}
				if status == BuildJobStatusRunning && job.StartedAt == nil {
					job.StartedAt = &now
				}
				if (status == BuildJobStatusSucceeded || status == BuildJobStatusFailed || status == BuildJobStatusCancelled) && job.CompletedAt == nil {
					job.CompletedAt = &now
				}
				updated++
			}
		}
		return pgconn.NewCommandTag(fmt.Sprintf("UPDATE %d", updated)), nil
	}

	return pgconn.NewCommandTag("UPDATE 0"), nil
}

func (m *mockDB) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	cleanSQL := normSQL(sql)

	// Claim CTE query: WITH next_events AS (...) UPDATE outbox_events ... RETURNING ...
	if strings.Contains(cleanSQL, "WITH next_events AS") {
		limit := args[0].(int)
		workerID := args[1].(string)
		intervalStr := args[2].(string)
		var delayMillis int64
		_, _ = fmt.Sscanf(intervalStr, "%d milliseconds", &delayMillis)
		leaseDuration := time.Duration(delayMillis) * time.Millisecond
		if leaseDuration <= 0 {
			leaseDuration = 30 * time.Second
		}

		now := time.Now().UTC()

		// Find candidates: pending or expired claimed
		var candidates []*EventRecord
		for _, ev := range m.outboxEvents {
			if ev.Attempts >= ev.MaxRetries {
				continue
			}
			if ev.Status == StatusPending && !ev.AvailableAt.After(now) {
				candidates = append(candidates, ev)
			} else if ev.Status == StatusClaimed && ev.LockedUntil != nil && ev.LockedUntil.Before(now) {
				candidates = append(candidates, ev)
			}
		}

		// Sort by AvailableAt ASC, CreatedAt ASC
		for i := 0; i < len(candidates); i++ {
			for j := i + 1; j < len(candidates); j++ {
				if candidates[j].AvailableAt.Before(candidates[i].AvailableAt) ||
					(candidates[j].AvailableAt.Equal(candidates[i].AvailableAt) && candidates[j].CreatedAt.Before(candidates[i].CreatedAt)) {
					candidates[i], candidates[j] = candidates[j], candidates[i]
				}
			}
		}

		if len(candidates) > limit {
			candidates = candidates[:limit]
		}

		var claimedRows [][]any
		for _, ev := range candidates {
			ev.Status = StatusClaimed
			ev.LockedBy = &workerID
			lockUntil := now.Add(leaseDuration)
			ev.LockedUntil = &lockUntil
			ev.Attempts++
			ev.UpdatedAt = now

			claimedRows = append(claimedRows, eventToValues(ev))
		}

		return &mockRows{rows: claimedRows}, nil
	}

	return &mockRows{}, nil
}

func (m *mockDB) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	m.mu.Lock()
	defer m.mu.Unlock()

	cleanSQL := normSQL(sql)

	if strings.Contains(cleanSQL, "WITH exhausted AS") {
		now := time.Now().UTC()
		var exhausted []*EventRecord
		for _, ev := range m.outboxEvents {
			eligible := ev.Attempts >= ev.MaxRetries && (ev.Status == StatusPending ||
				(ev.Status == StatusClaimed && (ev.LockedUntil == nil || ev.LockedUntil.Before(now))))
			if eligible {
				ev.Status = StatusFailed
				ev.LockedBy = nil
				ev.LockedUntil = nil
				msg := "outbox event exhausted its retry budget"
				ev.LastError = &msg
				ev.ProcessedAt = &now
				ev.UpdatedAt = now
				exhausted = append(exhausted, ev)
			}
		}
		for _, ev := range exhausted {
			for _, job := range m.buildJobs {
				if job.DeploymentID == ev.AggregateID && job.Status != BuildJobStatusSucceeded && job.Status != BuildJobStatusFailed && job.Status != BuildJobStatusCancelled {
					job.Status = BuildJobStatusFailed
					job.ErrorMessage = ev.LastError
					job.CompletedAt = &now
				}
			}
		}
		return &mockRow{values: []any{int64(len(exhausted))}}
	}

	if strings.Contains(cleanSQL, "WITH failed_event AS") {
		eventID := args[0].(uuid.UUID)
		errMsg := args[1].(string)
		workerID := args[2].(string)
		if ev, ok := m.outboxEvents[eventID]; ok && ev.Status == StatusClaimed && ev.LockedBy != nil && *ev.LockedBy == workerID {
			now := time.Now().UTC()
			ev.Status = StatusFailed
			ev.LockedBy = nil
			ev.LockedUntil = nil
			ev.ProcessedAt = &now
			ev.UpdatedAt = now
			ev.LastError = &errMsg
			for _, job := range m.buildJobs {
				if job.DeploymentID == ev.AggregateID && job.Status != BuildJobStatusSucceeded && job.Status != BuildJobStatusFailed && job.Status != BuildJobStatusCancelled {
					job.Status = BuildJobStatusFailed
					job.ErrorMessage = &errMsg
					job.CompletedAt = &now
				}
			}
			return &mockRow{values: []any{ev.AggregateID}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// RenewLease query
	if strings.Contains(cleanSQL, "WHERE id = $2") && strings.Contains(cleanSQL, "status = 'claimed'") && strings.Contains(cleanSQL, "locked_by = $3") {
		intervalStr := args[0].(string)
		eventID := args[1].(uuid.UUID)
		workerID := args[2].(string)

		var delayMillis int64
		_, _ = fmt.Sscanf(intervalStr, "%d milliseconds", &delayMillis)
		ext := time.Duration(delayMillis) * time.Millisecond

		if ev, ok := m.outboxEvents[eventID]; ok {
			now := time.Now().UTC()
			if ev.Status == StatusClaimed && ev.LockedBy != nil && *ev.LockedBy == workerID {
				newLockedUntil := now.Add(ext)
				ev.LockedUntil = &newLockedUntil
				ev.UpdatedAt = now
				return &mockRow{values: []any{ev.ID}}
			}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// ClaimByID query
	if strings.Contains(cleanSQL, "UPDATE outbox_events") && strings.Contains(cleanSQL, "WHERE id = $1") && strings.Contains(cleanSQL, "SET status = 'claimed'") {
		eventID := args[0].(uuid.UUID)
		workerID := args[1].(string)
		intervalStr := args[2].(string)

		var delayMillis int64
		_, _ = fmt.Sscanf(intervalStr, "%d milliseconds", &delayMillis)
		leaseDuration := time.Duration(delayMillis) * time.Millisecond

		if ev, ok := m.outboxEvents[eventID]; ok {
			now := time.Now().UTC()
			eligible := ((ev.Status == StatusPending && !ev.AvailableAt.After(now)) ||
				(ev.Status == StatusClaimed && (ev.LockedUntil == nil || ev.LockedUntil.Before(now)))) && ev.Attempts < ev.MaxRetries
			if eligible {
				ev.Status = StatusClaimed
				ev.LockedBy = &workerID
				lockUntil := now.Add(leaseDuration)
				ev.LockedUntil = &lockUntil
				ev.Attempts++
				ev.UpdatedAt = now
				return &mockRow{values: eventToValues(ev)}
			}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Atomic CompleteDeploymentJob query
	if strings.Contains(cleanSQL, "WITH completed_event AS") {
		eventID := args[0].(uuid.UUID)
		workerID := args[1].(string)
		jobStatus := args[2].(string)
		deploymentID := args[3].(uuid.UUID)
		if ev, ok := m.outboxEvents[eventID]; ok && ev.Status == StatusClaimed && ev.LockedBy != nil && *ev.LockedBy == workerID {
			now := time.Now().UTC()
			ev.Status = StatusCompleted
			ev.LockedBy = nil
			ev.LockedUntil = nil
			ev.ProcessedAt = &now
			ev.UpdatedAt = now
			if deploymentID != uuid.Nil {
				for _, job := range m.buildJobs {
					if job.DeploymentID != deploymentID {
						continue
					}
					job.Status = jobStatus
					switch jobStatus {
					case BuildJobStatusDispatched:
						job.DispatchedAt = &now
					case BuildJobStatusRunning:
						job.StartedAt = &now
					case BuildJobStatusSucceeded, BuildJobStatusFailed, BuildJobStatusCancelled:
						job.CompletedAt = &now
					}
				}
			}
			return &mockRow{values: []any{ev.ID}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Complete query
	if strings.Contains(cleanSQL, "UPDATE outbox_events") && strings.Contains(cleanSQL, "SET status = 'completed'") && strings.Contains(cleanSQL, "WHERE id = $1") && strings.Contains(cleanSQL, "locked_by = $2") {
		eventID := args[0].(uuid.UUID)
		workerID := args[1].(string)
		if ev, ok := m.outboxEvents[eventID]; ok {
			if ev.Status == StatusClaimed && ev.LockedBy != nil && *ev.LockedBy == workerID {
				ev.Status = StatusCompleted
				ev.LockedBy = nil
				ev.LockedUntil = nil
				now := time.Now().UTC()
				ev.ProcessedAt = &now
				ev.UpdatedAt = now
				return &mockRow{values: []any{ev.ID}}
			}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Fetch attempts query: SELECT attempts, max_retries, aggregate_type, aggregate_id FROM outbox_events WHERE id = $1
	if strings.Contains(cleanSQL, "SELECT attempts, max_retries, aggregate_type, aggregate_id FROM outbox_events WHERE id = $1") {
		eventID := args[0].(uuid.UUID)
		if ev, ok := m.outboxEvents[eventID]; ok {
			return &mockRow{values: []any{ev.Attempts, ev.MaxRetries, ev.AggregateType, ev.AggregateID}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Status and locked_until check: SELECT status, locked_until FROM outbox_events WHERE id = $1
	if strings.Contains(cleanSQL, "SELECT status, locked_until FROM outbox_events WHERE id = $1") {
		eventID := args[0].(uuid.UUID)
		if ev, ok := m.outboxEvents[eventID]; ok {
			return &mockRow{values: []any{ev.Status, ev.LockedUntil}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Status and locked_by check: SELECT status, locked_by FROM outbox_events WHERE id = $1
	if strings.Contains(cleanSQL, "SELECT status, locked_by FROM outbox_events WHERE id = $1") {
		eventID := args[0].(uuid.UUID)
		if ev, ok := m.outboxEvents[eventID]; ok {
			return &mockRow{values: []any{ev.Status, ev.LockedBy}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Status only: SELECT status FROM outbox_events WHERE id = $1
	if strings.Contains(cleanSQL, "SELECT status FROM outbox_events WHERE id = $1") {
		eventID := args[0].(uuid.UUID)
		if ev, ok := m.outboxEvents[eventID]; ok {
			return &mockRow{values: []any{ev.Status}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Aggregate type and id query: SELECT aggregate_type, aggregate_id FROM outbox_events WHERE id = $1
	if strings.Contains(cleanSQL, "SELECT aggregate_type, aggregate_id FROM outbox_events WHERE id = $1") {
		eventID := args[0].(uuid.UUID)
		if ev, ok := m.outboxEvents[eventID]; ok {
			return &mockRow{values: []any{ev.AggregateType, ev.AggregateID}}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Query build_jobs for duplicate check: SELECT id, status FROM build_jobs WHERE deployment_id = $1
	if strings.Contains(cleanSQL, "SELECT id, status FROM build_jobs WHERE deployment_id = $1") {
		depID := args[0].(uuid.UUID)
		for _, job := range m.buildJobs {
			if job.DeploymentID == depID {
				return &mockRow{values: []any{job.ID, job.Status}}
			}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	// Prior completed outbox event query is scoped to the same event type and build run.
	if strings.Contains(cleanSQL, "SELECT id FROM outbox_events WHERE aggregate_type = $1 AND aggregate_id = $2 AND event_type = $3 AND payload->>'build_run_id' = $4 AND id != $5 AND status = 'completed'") {
		aggType := args[0].(string)
		aggID := args[1].(uuid.UUID)
		eventType := args[2].(string)
		buildRunID := args[3].(string)
		excludeID := args[4].(uuid.UUID)
		for _, ev := range m.outboxEvents {
			if ev.AggregateType == aggType && ev.AggregateID == aggID && ev.EventType == eventType && buildRunIDFromPayload(ev.Payload) == buildRunID && ev.ID != excludeID && ev.Status == StatusCompleted {
				return &mockRow{values: []any{ev.ID}}
			}
		}
		return &mockRow{err: pgx.ErrNoRows}
	}

	return &mockRow{err: pgx.ErrNoRows}
}

func eventToValues(ev *EventRecord) []any {
	return []any{
		ev.ID,
		ev.AggregateType,
		ev.AggregateID,
		ev.EventType,
		ev.Payload,
		ev.Status,
		ev.Attempts,
		ev.MaxRetries,
		ev.AvailableAt,
		ev.LockedUntil,
		ev.LockedBy,
		ev.LastError,
		ev.CreatedAt,
		ev.UpdatedAt,
		ev.PublishedAt,
		ev.ProcessedAt,
	}
}

type mockRow struct {
	values []any
	err    error
}

func (r *mockRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != len(r.values) {
		return fmt.Errorf("mockRow.Scan: dest count %d does not match values count %d", len(dest), len(r.values))
	}
	for i, v := range r.values {
		assignValue(dest[i], v)
	}
	return nil
}

type mockRows struct {
	rows   [][]any
	index  int
	closed bool
	err    error
}

func (r *mockRows) Close() {
	r.closed = true
}

func (r *mockRows) Err() error {
	return r.err
}

func (r *mockRows) CommandTag() pgconn.CommandTag {
	return pgconn.NewCommandTag(fmt.Sprintf("SELECT %d", len(r.rows)))
}

func (r *mockRows) FieldDescriptions() []pgconn.FieldDescription {
	return nil
}

func (r *mockRows) Next() bool {
	if r.closed || r.index >= len(r.rows) {
		return false
	}
	r.index++
	return true
}

func (r *mockRows) Scan(dest ...any) error {
	if r.index <= 0 || r.index > len(r.rows) {
		return fmt.Errorf("mockRows.Scan: out of range")
	}
	vals := r.rows[r.index-1]
	if len(dest) != len(vals) {
		return fmt.Errorf("mockRows.Scan: dest count %d != vals count %d", len(dest), len(vals))
	}
	for i, v := range vals {
		assignValue(dest[i], v)
	}
	return nil
}

func (r *mockRows) Values() ([]any, error) {
	if r.index <= 0 || r.index > len(r.rows) {
		return nil, fmt.Errorf("mockRows.Values: out of range")
	}
	return r.rows[r.index-1], nil
}

func (r *mockRows) RawValues() [][]byte {
	return nil
}

func (r *mockRows) Conn() *pgx.Conn {
	return nil
}

func assignValue(dest any, src any) {
	if src == nil {
		return
	}
	switch d := dest.(type) {
	case *uuid.UUID:
		if u, ok := src.(uuid.UUID); ok {
			*d = u
		}
	case *string:
		if s, ok := src.(string); ok {
			*d = s
		}
	case **string:
		if s, ok := src.(*string); ok {
			*d = s
		} else if s, ok := src.(string); ok {
			*d = &s
		}
	case *int:
		if i, ok := src.(int); ok {
			*d = i
		}
	case *int64:
		if i, ok := src.(int64); ok {
			*d = i
		}
	case *time.Time:
		if t, ok := src.(time.Time); ok {
			*d = t
		}
	case **time.Time:
		if t, ok := src.(*time.Time); ok {
			*d = t
		} else if t, ok := src.(time.Time); ok {
			*d = &t
		}
	case *json.RawMessage:
		if raw, ok := src.(json.RawMessage); ok {
			*d = raw
		}
	}
}
