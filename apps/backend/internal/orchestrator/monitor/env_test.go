package monitor

import (
	"testing"

	"github.com/google/uuid"
	corev1 "k8s.io/api/core/v1"
)

func TestMergeAddonEnv_OrderAndCanonicalNames(t *testing.T) {
	pgB := uuid.MustParse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
	pgA := uuid.MustParse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
	redis := uuid.MustParse("cccccccc-cccc-cccc-cccc-cccccccccccc")
	existing := []corev1.EnvVar{{Name: "FOO", Value: "bar"}, {Name: "DATABASE_URL", Value: "kept"}}
	got := MergeAddonEnv(existing, []EnvironmentAddon{
		{ServiceID: redis, ServiceName: "cache", Engine: "redis", Port: 6379},
		{ServiceID: pgB, ServiceName: "z-db", Engine: "postgres", Port: 5432},
		{ServiceID: pgA, ServiceName: "main-db", Engine: "postgres", Port: 5432},
	})
	names := make([]string, len(got))
	refs := map[string]string{}
	for i, env := range got {
		names[i] = env.Name
		if env.ValueFrom != nil && env.ValueFrom.SecretKeyRef != nil {
			refs[env.Name] = env.ValueFrom.SecretKeyRef.Name + "/" + env.ValueFrom.SecretKeyRef.Key
		}
	}
	want := []string{"FOO", "DATABASE_URL", "REDIS_URL", "CACHE_URL", "MAIN_DB_URL", "Z_DB_URL"}
	if stringsJoin(names) != stringsJoin(want) {
		t.Fatalf("names %v", names)
	}
	if got[1].Value != "kept" || got[1].ValueFrom != nil {
		t.Fatal("existing DATABASE_URL was replaced")
	}
	if refs["REDIS_URL"] != "addon-"+redis.String()+"/url" {
		t.Fatalf("REDIS_URL ref %s", refs["REDIS_URL"])
	}
	// First postgres by name is main-db, but DATABASE_URL already existed, so
	// MAIN_DB_URL still points at that addon.
	if refs["MAIN_DB_URL"] != "addon-"+pgA.String()+"/url" {
		t.Fatalf("MAIN_DB_URL ref %s", refs["MAIN_DB_URL"])
	}
	if refs["Z_DB_URL"] != "addon-"+pgB.String()+"/url" {
		t.Fatalf("Z_DB_URL ref %s", refs["Z_DB_URL"])
	}
}

func TestMergeAddonEnv_CanonicalWinsBeforeSnake(t *testing.T) {
	pg := uuid.MustParse("dddddddd-dddd-dddd-dddd-dddddddddddd")
	got := MergeAddonEnv(nil, []EnvironmentAddon{
		{ServiceID: pg, ServiceName: "database", Engine: "postgres"},
	})
	if len(got) != 1 || got[0].Name != "DATABASE_URL" {
		t.Fatalf("got %+v", namesOf(got))
	}
	if got[0].ValueFrom == nil || got[0].ValueFrom.SecretKeyRef.Name != "addon-"+pg.String() {
		t.Fatalf("ref %+v", got[0].ValueFrom)
	}
}

func namesOf(env []corev1.EnvVar) []string {
	out := make([]string, len(env))
	for i := range env {
		out[i] = env[i].Name
	}
	return out
}

func stringsJoin(parts []string) string {
	return stringsJoinSep(parts, ",")
}

func stringsJoinSep(parts []string, sep string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += sep
		}
		out += p
	}
	return out
}
