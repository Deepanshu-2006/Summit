package platformdb

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCursorRoundTrip(t *testing.T) {
	ts := time.Date(2026, 11, 1, 12, 30, 45, 123456000, time.UTC)
	id := uuid.New()
	c := EncodeCursor(ts, id)
	gotT, gotID, err := DecodeCursor(c)
	if err != nil {
		t.Fatalf("DecodeCursor: %v", err)
	}
	if !gotT.Equal(ts) || gotID != id {
		t.Fatalf("round trip mismatch: %v %v vs %v %v", gotT, gotID, ts, id)
	}
}

func TestCursorTruncatesToMicroseconds(t *testing.T) {
	ts := time.Date(2026, 1, 2, 3, 4, 5, 123456789, time.UTC)
	gotT, _, err := DecodeCursor(EncodeCursor(ts, uuid.New()))
	if err != nil {
		t.Fatal(err)
	}
	if want := ts.Truncate(time.Microsecond); !gotT.Equal(want) {
		t.Fatalf("got %v want %v", gotT, want)
	}
}

func TestDecodeCursorRejectsMalformed(t *testing.T) {
	bad := []string{
		"", "!!!", "bm90LWEtY3Vyc29y", // not base64 / wrong shape
		EncodeCursor(time.Now(), uuid.New()) + "x",
	}
	for _, c := range bad {
		if _, _, err := DecodeCursor(c); !errors.Is(err, ErrInvalidArgument) {
			t.Errorf("DecodeCursor(%q) err = %v, want ErrInvalidArgument", c, err)
		}
	}
}

func TestListParamsLimit(t *testing.T) {
	cases := []struct{ in, want int }{{0, DefaultPageLimit}, {-5, DefaultPageLimit}, {7, 7}, {100, 100}, {101, MaxPageLimit}, {5000, MaxPageLimit}}
	for _, c := range cases {
		if got := (ListParams{Limit: c.in}).limit(); got != c.want {
			t.Errorf("limit(%d) = %d, want %d", c.in, got, c.want)
		}
	}
}

func TestPageOf(t *testing.T) {
	type row struct {
		t  time.Time
		id uuid.UUID
	}
	key := func(r row) (time.Time, uuid.UUID) { return r.t, r.id }
	mk := func(n int) []row {
		out := make([]row, n)
		for i := range out {
			out[i] = row{time.Now().Add(time.Duration(i) * time.Second), uuid.New()}
		}
		return out
	}
	if p := pageOf(mk(2), 2, key); p.NextCursor != "" || len(p.Items) != 2 {
		t.Errorf("exact fit should have no next cursor: %+v", p)
	}
	rows := mk(3)
	p := pageOf(rows, 2, key)
	if len(p.Items) != 2 || p.NextCursor != EncodeCursor(rows[1].t, rows[1].id) {
		t.Errorf("over-fetched page wrong: %+v", p)
	}
}

func TestSecretReferenceInputValidate(t *testing.T) {
	ok := SecretReferenceInput{KeyName: "DATABASE_URL", Provider: SecretProviderOpenBao, VaultPath: "secret/data/proj/db"}
	if err := ok.Validate(); err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}
	ver := "3"
	ok.VersionID = &ver
	if err := ok.Validate(); err != nil {
		t.Fatalf("valid version rejected: %v", err)
	}
	bad := map[string]SecretReferenceInput{
		"empty key":       {KeyName: "", Provider: SecretProviderOpenBao, VaultPath: "a/b"},
		"key with dash":   {KeyName: "A-B", Provider: SecretProviderOpenBao, VaultPath: "a/b"},
		"bad provider":    {KeyName: "A", Provider: "plaintext", VaultPath: "a/b"},
		"path whitespace": {KeyName: "A", Provider: SecretProviderOpenBao, VaultPath: "p@ss word"},
		"github token":    {KeyName: "A", Provider: SecretProviderOpenBao, VaultPath: "ghp_abcdefghijklmnopqrstuvwxyz0123456789"},
		"jwt-like":        {KeyName: "A", Provider: SecretProviderOpenBao, VaultPath: "eyJhbGciOiJIUzI1NiJ9.e30.abc"},
		"aws key id":      {KeyName: "A", Provider: SecretProviderAWS, VaultPath: "AKIAIOSFODNN7EXAMPLE"},
		"non-sm arn":      {KeyName: "A", Provider: SecretProviderAWS, VaultPath: "arn:aws:s3:::bucket"},
		"quoted":          {KeyName: "A", Provider: SecretProviderOpenBao, VaultPath: `"hunter2"`},
		"too long":        {KeyName: "A", Provider: SecretProviderOpenBao, VaultPath: string(make([]byte, 600))},
	}
	for name, in := range bad {
		if err := in.Validate(); !errors.Is(err, ErrInvalidArgument) {
			t.Errorf("%s: err = %v, want ErrInvalidArgument", name, err)
		}
	}
	arn := SecretReferenceInput{KeyName: "A", Provider: SecretProviderAWS,
		VaultPath: "arn:aws:secretsmanager:us-east-1:123456789012:secret:prod/db-AbCdEf"}
	if err := arn.Validate(); err != nil {
		t.Errorf("valid ARN rejected: %v", err)
	}
}

func TestServiceResourcesValidate(t *testing.T) {
	good := ServiceResources{CPURequestMillicores: 100, CPULimitMillicores: 500, MemoryRequestMB: 128, MemoryLimitMB: 512, MinReplicas: 1, MaxReplicas: 3, Port: 8080}
	if err := good.Validate(); err != nil {
		t.Fatal(err)
	}
	for name, mut := range map[string]func(*ServiceResources){
		"cpu req>limit": func(r *ServiceResources) { r.CPURequestMillicores = 600 },
		"mem zero":      func(r *ServiceResources) { r.MemoryRequestMB = 0 },
		"min>max":       func(r *ServiceResources) { r.MinReplicas = 4 },
		"max zero":      func(r *ServiceResources) { r.MinReplicas, r.MaxReplicas = 0, 0 },
		"port 0":        func(r *ServiceResources) { r.Port = 0 },
		"port big":      func(r *ServiceResources) { r.Port = 70000 },
	} {
		r := good
		mut(&r)
		if err := r.Validate(); !errors.Is(err, ErrInvalidArgument) {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func TestTruncateString(t *testing.T) {
	if got := truncateString("short", 100); got != "short" {
		t.Errorf("got %q", got)
	}
	var long string
	for i := 0; i < 5000; i++ {
		long += "é" // 2 bytes each
	}
	got := truncateString(long, 1000)
	if len(got) > 1000 {
		t.Errorf("len %d > 1000", len(got))
	}
	if !validUTF8(got) {
		t.Errorf("truncation split a rune")
	}
}

func validUTF8(s string) bool { return sanitizeText(s) == s }
