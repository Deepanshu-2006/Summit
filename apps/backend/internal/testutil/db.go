package testutil

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/summit/backend/internal/db"
)

// NewDB connects to TEST_DATABASE_URL, provisions a unique isolated schema,
// runs all migrations, and registers automatic cleanup to drop the schema when the test finishes.
// If TEST_DATABASE_URL is not set, the test is skipped cleanly.
func NewDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping database integration test")
		return nil
	}

	adminConfig, err := pgxpool.ParseConfig(testDBURL)
	if err != nil {
		t.Fatalf("parsing TEST_DATABASE_URL: %v", err)
	}

	adminPool, err := pgxpool.NewWithConfig(context.Background(), adminConfig)
	if err != nil {
		t.Fatalf("connecting to test database admin pool: %v", err)
	}

	schemaID := strings.ReplaceAll(uuid.New().String(), "-", "")
	schemaName := fmt.Sprintf("test_schema_%s", schemaID)

	// Create unique schema
	_, err = adminPool.Exec(context.Background(), fmt.Sprintf("CREATE SCHEMA %s", schemaName))
	if err != nil {
		adminPool.Close()
		t.Fatalf("creating test schema %s: %v", schemaName, err)
	}

	// Create test pool with runtime search_path pointing to schemaName, public
	testConfig, err := pgxpool.ParseConfig(testDBURL)
	if err != nil {
		adminPool.Close()
		t.Fatalf("parsing test pool config: %v", err)
	}
	if testConfig.ConnConfig.RuntimeParams == nil {
		testConfig.ConnConfig.RuntimeParams = make(map[string]string)
	}
	testConfig.ConnConfig.RuntimeParams["search_path"] = fmt.Sprintf("%s, public", schemaName)

	testPool, err := pgxpool.NewWithConfig(context.Background(), testConfig)
	if err != nil {
		_, _ = adminPool.Exec(context.Background(), fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schemaName))
		adminPool.Close()
		t.Fatalf("creating schema-isolated test pool: %v", err)
	}

	// Run migrations in isolated schema
	if err := db.Migrate(context.Background(), testPool); err != nil {
		testPool.Close()
		_, _ = adminPool.Exec(context.Background(), fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schemaName))
		adminPool.Close()
		t.Fatalf("running migrations in test schema %s: %v", schemaName, err)
	}

	t.Cleanup(func() {
		testPool.Close()
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, _ = adminPool.Exec(cleanupCtx, fmt.Sprintf("DROP SCHEMA IF EXISTS %s CASCADE", schemaName))
		adminPool.Close()
	})

	return testPool
}

// Seed structures
type Org struct {
	ID   uuid.UUID
	Name string
	Slug string
}

type User struct {
	ID    uuid.UUID
	Email string
	Name  string
}

type Membership struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	UserID         uuid.UUID
	Role           string
}

type Project struct {
	ID             uuid.UUID
	OrganizationID uuid.UUID
	Name           string
	Slug           string
}

type Environment struct {
	ID        uuid.UUID
	ProjectID uuid.UUID
	Name      string
	Type      string
}

type Service struct {
	ID            uuid.UUID
	EnvironmentID uuid.UUID
	Name          string
	Type          string
}

// SeedOrg inserts a test organization.
func SeedOrg(t *testing.T, pool *pgxpool.Pool, name, slug string) Org {
	t.Helper()
	if slug == "" {
		slug = "org-" + uuid.New().String()[:8]
	}
	if name == "" {
		name = "Test Org " + slug
	}
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		"INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id",
		name, slug,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seeding org: %v", err)
	}
	return Org{ID: id, Name: name, Slug: slug}
}

// SeedUser inserts a test user.
func SeedUser(t *testing.T, pool *pgxpool.Pool, email, name string) User {
	t.Helper()
	id := uuid.New()
	if email == "" {
		email = fmt.Sprintf("user-%s@example.com", id.String()[:8])
	}
	if name == "" {
		name = "Test User " + id.String()[:8]
	}
	err := pool.QueryRow(context.Background(),
		"INSERT INTO users (id, email, name) VALUES ($1, $2, $3) RETURNING id",
		id, email, name,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seeding user: %v", err)
	}
	return User{ID: id, Email: email, Name: name}
}

// SeedMembership inserts an organization membership.
func SeedMembership(t *testing.T, pool *pgxpool.Pool, orgID, userID uuid.UUID, role string) Membership {
	t.Helper()
	if role == "" {
		role = "member"
	}
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		"INSERT INTO organization_memberships (organization_id, user_id, role) VALUES ($1, $2, $3) RETURNING id",
		orgID, userID, role,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seeding membership: %v", err)
	}
	return Membership{ID: id, OrganizationID: orgID, UserID: userID, Role: role}
}

// SeedProject inserts a project under an organization.
func SeedProject(t *testing.T, pool *pgxpool.Pool, orgID uuid.UUID, name, slug string) Project {
	t.Helper()
	if slug == "" {
		slug = "project-" + uuid.New().String()[:8]
	}
	if name == "" {
		name = "Test Project " + slug
	}
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		"INSERT INTO projects (organization_id, name, slug) VALUES ($1, $2, $3) RETURNING id",
		orgID, name, slug,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seeding project: %v", err)
	}
	return Project{ID: id, OrganizationID: orgID, Name: name, Slug: slug}
}

// SeedEnvironment inserts an environment under a project.
func SeedEnvironment(t *testing.T, pool *pgxpool.Pool, projectID uuid.UUID, name, envType string) Environment {
	t.Helper()
	if name == "" {
		name = "production"
	}
	if envType == "" {
		envType = "production"
	}
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		"INSERT INTO environments (project_id, name, type) VALUES ($1, $2, $3) RETURNING id",
		projectID, name, envType,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seeding environment: %v", err)
	}
	return Environment{ID: id, ProjectID: projectID, Name: name, Type: envType}
}

// SeedService inserts a service under an environment.
func SeedService(t *testing.T, pool *pgxpool.Pool, envID uuid.UUID, name, srvType string) Service {
	t.Helper()
	if name == "" {
		name = "svc-" + uuid.New().String()[:8]
	}
	if srvType == "" {
		srvType = "web"
	}
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		"INSERT INTO services (environment_id, name, type) VALUES ($1, $2, $3) RETURNING id",
		envID, name, srvType,
	).Scan(&id)
	if err != nil {
		t.Fatalf("seeding service: %v", err)
	}
	return Service{ID: id, EnvironmentID: envID, Name: name, Type: srvType}
}
