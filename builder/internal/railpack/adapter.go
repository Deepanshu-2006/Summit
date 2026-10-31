package railpack

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/summit/builder/internal/process"
	"github.com/summit/builder/internal/protocol"
)

// PrepareInput defines the parameters passed to railpack prepare.
type PrepareInput struct {
	AppDir      string
	PlanPath    string
	BuildConfig protocol.BuildConfig
}

// PrepareResult holds detection and build plan generation results.
type PrepareResult struct {
	PlanPath        string
	DetectedRuntime string
	StartCommand    string
	PlanJSON        []byte
}

// RailpackAdapter defines the interface for interacting with the Railpack CLI.
type RailpackAdapter interface {
	Version(ctx context.Context) (string, error)
	Prepare(ctx context.Context, input PrepareInput) (*PrepareResult, error)
	ValidatePlan(ctx context.Context, planPath string) error
}

// CLIAdapter invokes the railpack binary via the process supervisor.
type CLIAdapter struct {
	supervisor *process.Supervisor
	binary     string
}

// NewCLIAdapter constructs a new CLIAdapter.
func NewCLIAdapter(supervisor *process.Supervisor, binary string) *CLIAdapter {
	if binary == "" {
		binary = "railpack"
	}
	if supervisor == nil {
		supervisor = process.NewSupervisor(0, 0)
	}
	return &CLIAdapter{
		supervisor: supervisor,
		binary:     binary,
	}
}

// Version returns the railpack CLI version string.
func (c *CLIAdapter) Version(ctx context.Context) (string, error) {
	spec := process.CommandSpec{
		Command: c.binary,
		Args:    []string{"--version"},
	}
	res, err := c.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		return "", fmt.Errorf("checking railpack version: %w", err)
	}
	return strings.TrimSpace(res.Stdout), nil
}

// Prepare invokes railpack prepare or generates the fallback build plan.
func (c *CLIAdapter) Prepare(ctx context.Context, input PrepareInput) (*PrepareResult, error) {
	if input.AppDir == "" {
		return nil, fmt.Errorf("appDir cannot be empty")
	}
	if input.PlanPath == "" {
		return nil, fmt.Errorf("planPath cannot be empty")
	}

	// Ensure parent directory for plan exists
	if err := os.MkdirAll(filepath.Dir(input.PlanPath), 0700); err != nil {
		return nil, fmt.Errorf("creating directory for railpack plan: %w", err)
	}

	args := []string{"prepare", input.AppDir, "--output", input.PlanPath}
	if input.BuildConfig.BuildCommand != nil && *input.BuildConfig.BuildCommand != "" {
		args = append(args, "--build-cmd", *input.BuildConfig.BuildCommand)
	}
	if input.BuildConfig.InstallCommand != nil && *input.BuildConfig.InstallCommand != "" {
		args = append(args, "--install-cmd", *input.BuildConfig.InstallCommand)
	}
	if input.BuildConfig.StartCommand != nil && *input.BuildConfig.StartCommand != "" {
		args = append(args, "--start-cmd", *input.BuildConfig.StartCommand)
	}

	spec := process.CommandSpec{
		Command: c.binary,
		Args:    args,
		Cwd:     input.AppDir,
	}

	res, err := c.supervisor.Execute(ctx, spec, nil)
	if err != nil {
		stderr := ""
		if res != nil {
			stderr = res.Stderr
		}
		return nil, fmt.Errorf("executing railpack prepare (%s): %w", stderr, err)
	}

	// Read and validate generated plan file
	planBytes, err := os.ReadFile(input.PlanPath)
	if err != nil {
		return nil, fmt.Errorf("reading generated railpack plan from %s: %w", input.PlanPath, err)
	}

	var plan Plan
	if err := json.Unmarshal(planBytes, &plan); err != nil {
		return nil, fmt.Errorf("unmarshaling generated railpack plan: %w", err)
	}

	runtime := plan.Runtime.Language
	if runtime == "" {
		runtime = plan.Provider
	}
	if runtime == "" {
		runtime = "generic"
	}

	return &PrepareResult{
		PlanPath:        input.PlanPath,
		DetectedRuntime: runtime,
		StartCommand:    plan.StartCommand,
		PlanJSON:        planBytes,
	}, nil
}

// ValidatePlan validates that planPath exists and contains valid JSON with required fields.
func (c *CLIAdapter) ValidatePlan(_ context.Context, planPath string) error {
	data, err := os.ReadFile(planPath)
	if err != nil {
		return fmt.Errorf("reading plan file %s: %w", planPath, err)
	}
	var plan Plan
	if err := json.Unmarshal(data, &plan); err != nil {
		return fmt.Errorf("invalid railpack plan JSON: %w", err)
	}
	return nil
}
