package orchestrator

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/summit/backend/internal/cluster"
)

func TestNewApp_Success(t *testing.T) {
	cfg := Config{
		Environment: "test",
		Cluster: cluster.Config{
			Target:       cluster.TargetMock,
			ProbeTimeout: 1 * time.Second,
		},
	}

	app, err := New(Dependencies{
		Config: cfg,
	})
	if err != nil {
		t.Fatalf("unexpected error creating app: %v", err)
	}

	if app.Config().Environment != "test" {
		t.Errorf("expected environment 'test', got %s", app.Config().Environment)
	}
}

func TestNewApp_InvalidConfig(t *testing.T) {
	cfg := Config{
		Environment: "",
	}

	_, err := New(Dependencies{
		Config: cfg,
	})
	if err == nil {
		t.Fatalf("expected error creating app with invalid config, got nil")
	}
}

func TestApp_Run_ProbeSuccess_GracefulShutdown(t *testing.T) {
	cfg := Config{
		Environment: "development",
		Cluster: cluster.Config{
			Target:       cluster.TargetMock,
			ProbeTimeout: 1 * time.Second,
		},
	}

	mockClient := &cluster.MockClient{
		TargetType: cluster.TargetMock,
		VersionInfo: &cluster.ServerVersionInfo{
			Major:      "1",
			Minor:      "37",
			GitVersion: "v1.37.0",
			Platform:   "linux/amd64",
		},
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	app, err := New(Dependencies{
		Config:        cfg,
		Logger:        logger,
		ClusterClient: mockClient,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Run(ctx)
	}()

	// Signal graceful cancellation after short delay
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case runErr := <-errCh:
		if runErr != nil {
			t.Fatalf("expected clean shutdown, got error: %v", runErr)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for orchestrator to shut down gracefully")
	}
}

func TestApp_Run_ProbeFailure_DevelopmentMode(t *testing.T) {
	cfg := Config{
		Environment: "development",
		Cluster: cluster.Config{
			Target:       cluster.TargetMock,
			ProbeTimeout: 500 * time.Millisecond,
		},
	}

	mockClient := &cluster.MockClient{
		TargetType: cluster.TargetMock,
		ProbeErr:   errors.New("connection refused"),
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	app, err := New(Dependencies{
		Config:        cfg,
		Logger:        logger,
		ClusterClient: mockClient,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- app.Run(ctx)
	}()

	// Allow probe to fail and continue in degraded mode, then cancel
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case runErr := <-errCh:
		if runErr != nil {
			t.Fatalf("development mode should continue despite probe failure, got: %v", runErr)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for orchestrator shutdown")
	}
}

func TestApp_Run_ProbeFailure_ProductionMode(t *testing.T) {
	cfg := Config{
		Environment: "production",
		Cluster: cluster.Config{
			Target:       cluster.TargetInCluster,
			ProbeTimeout: 500 * time.Millisecond,
		},
	}

	mockClient := &cluster.MockClient{
		TargetType: cluster.TargetInCluster,
		ProbeErr:   errors.New("in-cluster api server unreachable"),
	}

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	app, err := New(Dependencies{
		Config:        cfg,
		Logger:        logger,
		ClusterClient: mockClient,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// In production, Run should fail if probe fails
	err = app.Run(context.Background())
	if err == nil {
		t.Fatalf("expected error in production mode on probe failure, got nil")
	}
}

func TestConfig_LoadAndValidate(t *testing.T) {
	cfg := LoadConfig()

	if err := cfg.Validate(); err != nil {
		t.Fatalf("default loaded config should validate successfully: %v", err)
	}

	if cfg.Cluster.Target != cluster.TargetKind {
		t.Errorf("expected default cluster target to be TargetKind, got %s", cfg.Cluster.Target)
	}
}
