package platformdb

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// Secret reference providers accepted by the schema.
const (
	SecretProviderOpenBao    = "openbao"
	SecretProviderAWS        = "aws_secrets_manager"
	SecretProviderKubernetes = "kubernetes_secret"
	maxSecretKeyLen          = 255
	maxSecretPathLen         = 512
	maxSecretVersionLen      = 128
)

var (
	secretKeyRe     = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	secretPathRe    = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_./:@+=\-]*$`)
	secretVersionRe = regexp.MustCompile(`^[A-Za-z0-9_.:\-]+$`)
	// Prefixes of well-known credential formats: a value pasted into the path
	// field is rejected rather than stored.
	secretValuePrefixes = []string{"ghp_", "gho_", "ghs_", "ghu_", "github_pat_", "sk-", "xoxb-", "xoxp-", "akia", "asia", "eyj"}
)

// SecretReferenceInput describes a pointer to a secret stored elsewhere.
// There is deliberately no value field.
type SecretReferenceInput struct {
	KeyName   string  // environment variable name exposed to the workload
	Provider  string  // openbao | aws_secrets_manager | kubernetes_secret
	VaultPath string  // OpenBao path, AWS secret name/ARN, or Kubernetes secret name[/key]
	VersionID *string // optional provider version identifier
}

// Validate rejects malformed pointers and input that looks like a secret
// value. This is defence in depth; the schema has no column for values.
func (in SecretReferenceInput) Validate() error {
	if len(in.KeyName) > maxSecretKeyLen || !secretKeyRe.MatchString(in.KeyName) {
		return invalidArg("key name must be an environment variable name (letters, digits, underscore)")
	}
	switch in.Provider {
	case SecretProviderOpenBao, SecretProviderAWS, SecretProviderKubernetes:
	default:
		return invalidArg("provider must be openbao, aws_secrets_manager or kubernetes_secret")
	}
	if len(in.VaultPath) > maxSecretPathLen || !secretPathRe.MatchString(in.VaultPath) {
		return invalidArg("vault path must be a pointer (no whitespace or quotes) of at most %d chars", maxSecretPathLen)
	}
	lower := strings.ToLower(in.VaultPath)
	for _, pfx := range secretValuePrefixes {
		if strings.HasPrefix(lower, pfx) {
			return invalidArg("vault path looks like a secret value, not a pointer")
		}
	}
	if strings.HasPrefix(lower, "arn:") && !strings.HasPrefix(lower, "arn:aws:secretsmanager:") &&
		!strings.HasPrefix(lower, "arn:aws-cn:secretsmanager:") && !strings.HasPrefix(lower, "arn:aws-us-gov:secretsmanager:") {
		return invalidArg("ARN must reference AWS Secrets Manager")
	}
	if in.VersionID != nil && (len(*in.VersionID) > maxSecretVersionLen || !secretVersionRe.MatchString(*in.VersionID)) {
		return invalidArg("version id is malformed")
	}
	return nil
}

const secretCols = `sr.id, sr.user_id, sr.project_id, sr.environment_id, sr.key_name, sr.provider, sr.provider_vault_path,
	sr.provider_version_id, sr.created_at, sr.updated_at`

func scanSecret(row pgx.Row) (*SecretReference, error) {
	var r SecretReference
	if err := row.Scan(&r.ID, &r.UserID, &r.ProjectID, &r.EnvironmentID, &r.KeyName, &r.Provider, &r.VaultPath,
		&r.VersionID, &r.CreatedAt, &r.UpdatedAt); err != nil {
		return nil, err
	}
	return &r, nil
}

// requireEnvironment returns the owning project id of a live environment owned by userID.
func (s *Store) requireEnvironment(ctx context.Context, userID, environmentID uuid.UUID) (uuid.UUID, error) {
	var projectID uuid.UUID
	err := s.db.QueryRow(ctx, `
		SELECT e.project_id FROM environments e JOIN projects p ON p.id = e.project_id
		WHERE e.id = $1 AND p.user_id = $2 AND e.deleted_at IS NULL AND p.deleted_at IS NULL`,
		environmentID, userID).Scan(&projectID)
	if err != nil {
		return uuid.Nil, notFoundIfNoRows(err)
	}
	return projectID, nil
}

// ListSecretReferences returns the pointers of an environment owned by userID,
// ordered by key name.
func (s *Store) ListSecretReferences(ctx context.Context, userID, environmentID uuid.UUID) ([]SecretReference, error) {
	if _, err := s.requireEnvironment(ctx, userID, environmentID); err != nil {
		return nil, err
	}
	rows, err := s.db.Query(ctx, `
		SELECT `+secretCols+` FROM secret_references sr
		WHERE sr.user_id = $1 AND sr.environment_id = $2 ORDER BY sr.key_name`, userID, environmentID)
	if err != nil {
		return nil, fmt.Errorf("platformdb: list secret references: %w", err)
	}
	defer rows.Close()
	var out []SecretReference
	for rows.Next() {
		r, err := scanSecret(rows)
		if err != nil {
			return nil, fmt.Errorf("platformdb: scan secret reference: %w", err)
		}
		out = append(out, *r)
	}
	return out, rows.Err()
}

// CreateSecretReference stores a pointer for an environment owned by userID.
// A duplicate key name within the environment returns ErrConflict.
func (s *Store) CreateSecretReference(ctx context.Context, userID, environmentID uuid.UUID, in SecretReferenceInput) (*SecretReference, error) {
	if err := in.Validate(); err != nil {
		return nil, err
	}
	projectID, err := s.requireEnvironment(ctx, userID, environmentID)
	if err != nil {
		return nil, err
	}
	r, err := scanSecret(s.db.QueryRow(ctx, `
		INSERT INTO secret_references AS sr (user_id, project_id, environment_id, key_name, provider, provider_vault_path, provider_version_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING `+secretCols, userID, projectID, environmentID, in.KeyName, in.Provider, in.VaultPath, in.VersionID))
	if err != nil {
		if isUniqueViolation(err) {
			return nil, fmt.Errorf("%w: secret key %q already exists in environment", ErrConflict, in.KeyName)
		}
		return nil, fmt.Errorf("platformdb: insert secret reference: %w", err)
	}
	return r, nil
}

// DeleteSecretReference removes a pointer (never the secret itself).
// ErrNotFound if it does not exist in that environment for userID.
func (s *Store) DeleteSecretReference(ctx context.Context, userID, environmentID, id uuid.UUID) error {
	tag, err := s.db.Exec(ctx, `
		DELETE FROM secret_references WHERE id = $1 AND user_id = $2 AND environment_id = $3`, id, userID, environmentID)
	if err != nil {
		return fmt.Errorf("platformdb: delete secret reference: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
