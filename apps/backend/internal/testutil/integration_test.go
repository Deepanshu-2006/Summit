package testutil

import (
	"context"
	"testing"
)

func TestNewDB_Integration(t *testing.T) {
	pool := NewDB(t)
	if pool == nil {
		return
	}

	// Verify migrations were applied by querying schema_migrations
	var count int
	err := pool.QueryRow(context.Background(), "SELECT count(*) FROM schema_migrations").Scan(&count)
	if err != nil {
		t.Fatalf("querying schema_migrations: %v", err)
	}
	if count < 2 {
		t.Errorf("expected at least 2 migrations applied, got %d", count)
	}

	// Test all seed helpers in sequence
	org := SeedOrg(t, pool, "Acme Corp", "")
	if org.ID.String() == "" {
		t.Fatal("expected non-empty org ID")
	}

	user := SeedUser(t, pool, "alice@acme.com", "Alice Smith")
	if user.ID.String() == "" {
		t.Fatal("expected non-empty user ID")
	}

	membership := SeedMembership(t, pool, org.ID, user.ID, "owner")
	if membership.Role != "owner" {
		t.Errorf("expected role owner, got %s", membership.Role)
	}

	project := SeedProject(t, pool, org.ID, "Web App", "")
	if project.OrganizationID != org.ID {
		t.Errorf("expected project org %s, got %s", org.ID, project.OrganizationID)
	}

	env := SeedEnvironment(t, pool, project.ID, "production", "production")
	if env.ProjectID != project.ID {
		t.Errorf("expected env project %s, got %s", project.ID, env.ProjectID)
	}

	service := SeedService(t, pool, env.ID, "api-gateway", "web")
	if service.EnvironmentID != env.ID {
		t.Errorf("expected service env %s, got %s", env.ID, service.EnvironmentID)
	}
}
