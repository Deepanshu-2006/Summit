package platformdb

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

const (
	maxReasonLen  = 1024
	maxMessageLen = 4096
)

// TransitionOption sets extra deployment columns in the same UPDATE as a
// status transition.
type TransitionOption func(*transitionOpts)

type transitionOpts struct {
	imageRef     *string
	publicURL    *string
	statusReason *string
	errorMessage *string
}

// WithImageRef stores deployments.image_ref (full "<repo>@sha256:<digest>").
func WithImageRef(ref string) TransitionOption {
	return func(o *transitionOpts) { o.imageRef = &ref }
}

// WithPublicURL stores deployments.public_url.
func WithPublicURL(url string) TransitionOption {
	return func(o *transitionOpts) { o.publicURL = &url }
}

// WithStatusReason overrides deployments.status_reason (defaults to the
// transition reason when that is non-empty).
func WithStatusReason(reason string) TransitionOption {
	return func(o *transitionOpts) { o.statusReason = &reason }
}

// WithErrorMessage stores deployments.error_message.
func WithErrorMessage(msg string) TransitionOption {
	return func(o *transitionOpts) { o.errorMessage = &msg }
}

// TransitionDeployment atomically moves a deployment from any status in from to
// the status to (compare-and-set), in a single transaction that also appends a
// deployment_events row (from_status = the status actually left).
//
// Side effects on the deployment row: started_at is set the first time it
// leaves 'queued'; finished_at is set when to is failed/cancelled/superseded;
// status_reason takes reason (unless WithStatusReason is used); image_ref,
// public_url and error_message are set when the matching option is passed.
//
// Returns ErrNotFound if the deployment does not exist, ErrInvalidTransition if
// its current status is not in from (including a lost race), and
// ErrInvalidArgument for unknown statuses or when from contains a terminal
// status. The graph of allowed (from, to) pairs is the caller's policy
// (orchestrator state machine); this method only guarantees atomicity.
func (s *Store) TransitionDeployment(ctx context.Context, id uuid.UUID, from []DeploymentStatus, to DeploymentStatus, reason string, opts ...TransitionOption) (*Deployment, error) {
	if len(from) == 0 {
		return nil, invalidArg("from must not be empty")
	}
	if !to.Valid() {
		return nil, invalidArg("unknown target status %q", to)
	}
	for _, f := range from {
		if !f.Valid() {
			return nil, invalidArg("unknown source status %q", f)
		}
		if f.IsTerminal() {
			return nil, invalidArg("cannot transition out of terminal status %q", f)
		}
	}
	var o transitionOpts
	for _, opt := range opts {
		opt(&o)
	}
	reason = truncateString(sanitizeText(reason), maxReasonLen)
	statusReason := o.statusReason
	if statusReason == nil && reason != "" {
		statusReason = &reason
	}
	if statusReason != nil {
		v := truncateString(sanitizeText(*statusReason), maxReasonLen)
		statusReason = &v
	}
	if o.errorMessage != nil {
		v := truncateString(sanitizeText(*o.errorMessage), maxMessageLen)
		o.errorMessage = &v
	}

	var out *Deployment
	err := s.WithTx(ctx, func(tx *Store) error {
		var current DeploymentStatus
		err := tx.db.QueryRow(ctx, `
			SELECT status FROM deployments
			WHERE id = $1 AND status = ANY($2::text[]::deployment_status[])
			FOR UPDATE`, id, statusStrings(from)).Scan(&current)
		if errors.Is(err, pgx.ErrNoRows) {
			var exists bool
			if qerr := tx.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM deployments WHERE id = $1)`, id).Scan(&exists); qerr != nil {
				return fmt.Errorf("platformdb: transition lookup: %w", qerr)
			}
			if !exists {
				return ErrNotFound
			}
			return fmt.Errorf("%w: deployment %s is not in %v", ErrInvalidTransition, id, from)
		}
		if err != nil {
			return fmt.Errorf("platformdb: transition lock: %w", err)
		}

		leavingQueued := current == DeploymentQueued && to != DeploymentQueued
		out, err = scanDeployment(tx.db.QueryRow(ctx, `
			UPDATE deployments d
			SET status = $2::text::deployment_status,
			    status_reason = COALESCE($3, d.status_reason),
			    image_ref = COALESCE($4, d.image_ref),
			    public_url = COALESCE($5, d.public_url),
			    error_message = COALESCE($6, d.error_message),
			    started_at = CASE WHEN $7 THEN COALESCE(d.started_at, now()) ELSE d.started_at END,
			    finished_at = CASE WHEN $8 THEN COALESCE(d.finished_at, now()) ELSE d.finished_at END
			WHERE d.id = $1
			RETURNING `+deploymentCols,
			id, string(to), statusReason, o.imageRef, o.publicURL, o.errorMessage,
			leavingQueued, to.IsTerminal()))
		if err != nil {
			return fmt.Errorf("platformdb: transition update: %w", err)
		}
		if _, err := tx.db.Exec(ctx, `
			INSERT INTO deployment_events (deployment_id, from_status, to_status, reason)
			VALUES ($1, $2::text::deployment_status, $3::text::deployment_status, $4)`,
			id, string(current), string(to), nullableString(reason)); err != nil {
			return fmt.Errorf("platformdb: transition event: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return out, nil
}
