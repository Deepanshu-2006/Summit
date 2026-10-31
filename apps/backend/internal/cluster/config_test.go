package cluster

import (
	"errors"
	"testing"
	"time"
)

func TestNewDefaultConfig(t *testing.T) {
	cfg := NewDefaultConfig()

	if cfg.Target != TargetKind {
		t.Fatalf("expected TargetKind, got %s", cfg.Target)
	}
	if cfg.ProbeTimeout != DefaultProbeTimeout {
		t.Fatalf("expected probe timeout %v, got %v", DefaultProbeTimeout, cfg.ProbeTimeout)
	}

	if err := cfg.Validate(); err != nil {
		t.Fatalf("expected default config to validate, got error: %v", err)
	}
}

func TestConfig_Validate(t *testing.T) {
	tests := []struct {
		name        string
		cfg         Config
		expectErr   bool
		errSentinel error
	}{
		{
			name: "valid kind config",
			cfg: Config{
				Target:       TargetKind,
				ProbeTimeout: 5 * time.Second,
			},
			expectErr: false,
		},
		{
			name: "valid in-cluster config",
			cfg: Config{
				Target:       TargetInCluster,
				ProbeTimeout: 5 * time.Second,
			},
			expectErr: false,
		},
		{
			name: "valid kubeconfig config",
			cfg: Config{
				Target:         TargetKubeconfig,
				KubeconfigPath: "/home/user/.kube/config",
				ProbeTimeout:   5 * time.Second,
			},
			expectErr: false,
		},
		{
			name: "valid mock config",
			cfg: Config{
				Target:       TargetMock,
				ProbeTimeout: 1 * time.Second,
			},
			expectErr: false,
		},
		{
			name: "empty target",
			cfg: Config{
				Target:       "",
				ProbeTimeout: 5 * time.Second,
			},
			expectErr:   true,
			errSentinel: ErrInvalidTarget,
		},
		{
			name: "unsupported target",
			cfg: Config{
				Target:       TargetType("aws-eks"),
				ProbeTimeout: 5 * time.Second,
			},
			expectErr:   true,
			errSentinel: ErrInvalidTarget,
		},
		{
			name: "non-positive probe timeout",
			cfg: Config{
				Target:       TargetKind,
				ProbeTimeout: 0,
			},
			expectErr:   true,
			errSentinel: ErrInvalidProbeTimeout,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.cfg.Validate()
			if tc.expectErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tc.errSentinel != nil && !errors.Is(err, tc.errSentinel) {
					t.Fatalf("expected error matching %v, got %v", tc.errSentinel, err)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}
