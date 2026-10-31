package build

import (
	"context"
	"strings"
	"testing"
)

func TestDefaultSecretResolver_ResolveSecretMounts(t *testing.T) {
	resolver := NewDefaultSecretResolver()

	creds := CredentialsSpec{
		SourceCredentialRef:   "secret:summit-builds/git-token",
		RegistryCredentialRef: "k8s:ghcr-push-creds",
	}
	reporting := ReportingSpec{TokenRef: "k8s:reporting-token"}

	mounts, err := resolver.ResolveSecretMounts(context.Background(), "summit-builds", creds, reporting)
	if err != nil {
		t.Fatalf("unexpected error resolving mounts: %v", err)
	}

	if len(mounts) != 3 {
		t.Fatalf("expected 3 secret mounts, got %d", len(mounts))
	}

	// Source cred mount check
	src := mounts[0]
	if src.VolumeName != "source-creds" {
		t.Errorf("unexpected volume name: %s", src.VolumeName)
	}
	if src.SecretName != "git-token" {
		t.Errorf("unexpected resolved secret name: %s", src.SecretName)
	}
	if src.MountPath != "/var/run/secrets/summit/source" {
		t.Errorf("unexpected mount path: %s", src.MountPath)
	}
	if !src.ReadOnly {
		t.Errorf("secret mount must be strictly read-only")
	}
	if src.DefaultMode == nil || *src.DefaultMode != 0440 {
		t.Errorf("expected defaultMode 0440 for fsGroup access, got %v", src.DefaultMode)
	}
	if len(src.Items) != 1 || src.Items[0].Key != "token" || src.Items[0].Path != "token" {
		t.Errorf("source credential must project the token key to the agreed file: %+v", src.Items)
	}

	// Registry cred mount check
	reg := mounts[1]
	if reg.VolumeName != "registry-creds" {
		t.Errorf("unexpected volume name: %s", reg.VolumeName)
	}
	if reg.SecretName != "ghcr-push-creds" {
		t.Errorf("unexpected resolved secret name: %s", reg.SecretName)
	}
	if reg.MountPath != "/var/run/secrets/summit/registry" {
		t.Errorf("unexpected mount path: %s", reg.MountPath)
	}
	if !reg.ReadOnly {
		t.Errorf("secret mount must be strictly read-only")
	}
	if len(reg.Items) != 1 || reg.Items[0].Key != ".dockerconfigjson" || reg.Items[0].Path != "config.json" {
		t.Errorf("registry credentials must project the docker config key to config.json: %+v", reg.Items)
	}
	if mounts[2].SecretName != "reporting-token" || mounts[2].MountPath != "/var/run/secrets/summit/reporting" {
		t.Errorf("unexpected reporting token mount: %+v", mounts[2])
	}
	if len(mounts[2].Items) != 1 || mounts[2].Items[0].Key != "token" || mounts[2].Items[0].Path != "token" {
		t.Errorf("reporting credentials must project the token key: %+v", mounts[2].Items)
	}
}

func TestSecretMount_Validate_EnforcesReadOnly(t *testing.T) {
	mount := SecretMount{
		VolumeName: "insecure-creds",
		SecretName: "app-secret",
		MountPath:  "/var/run/secrets/app",
		ReadOnly:   false, // VIOLATION
	}

	err := mount.Validate()
	if err == nil {
		t.Fatalf("expected error for non-read-only mount, got nil")
	}
	if !strings.Contains(err.Error(), "strictly read-only") {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestParseSecretRef(t *testing.T) {
	tests := []struct {
		input    string
		expected string
		wantErr  bool
	}{
		{"secret:my-token", "my-token", false},
		{"k8s:tenant-1/db-pass", "db-pass", false},
		{"vault:secret/v1/deploy-key", "deploy-key", false},
		{"SIMPLE_SECRET", "simple-secret", false},
		{"name-with-@#$special", "name-with-special", false},
		{"path/to/@#$clean-key", "clean-key", false},
		{"", "", true},
		{"secret:", "", true},
	}

	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			res, err := parseSecretRef(tc.input)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error for %q, got %q", tc.input, res)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error for %q: %v", tc.input, err)
				}
				if res != tc.expected {
					t.Errorf("expected %q, got %q", tc.expected, res)
				}
			}
		})
	}
}
