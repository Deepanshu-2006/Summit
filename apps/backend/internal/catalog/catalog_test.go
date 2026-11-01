package catalog

import (
	"strings"
	"testing"
)

func TestAddonFor(t *testing.T) {
	pg, ok := AddonFor("postgres")
	if !ok || pg.Engine != "postgres" || pg.Version != "16-alpine" || pg.Port != 5432 || pg.URLEnv != "DATABASE_URL" {
		t.Fatalf("postgres = %+v ok=%v", pg, ok)
	}
	if !strings.HasPrefix(pg.Image, "docker.io/library/postgres@sha256:") || len(strings.TrimPrefix(pg.Image, "docker.io/library/postgres@sha256:")) != 64 {
		t.Fatalf("postgres image = %s", pg.Image)
	}
	rd, ok := AddonFor("redis")
	if !ok || rd.Engine != "redis" || rd.Version != "7-alpine" || rd.Port != 6379 || rd.URLEnv != "REDIS_URL" {
		t.Fatalf("redis = %+v ok=%v", rd, ok)
	}
	if !strings.HasPrefix(rd.Image, "docker.io/library/redis@sha256:") || len(strings.TrimPrefix(rd.Image, "docker.io/library/redis@sha256:")) != 64 {
		t.Fatalf("redis image = %s", rd.Image)
	}
	if _, ok := AddonFor("mysql"); ok {
		t.Fatal("mysql should be unknown")
	}
	if DefaultStorageMB != 1024 {
		t.Fatalf("storage = %d", DefaultStorageMB)
	}
}
