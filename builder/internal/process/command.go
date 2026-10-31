package process

import (
	"context"
	"fmt"
	"os/exec"
)

// CommandSpec defines the configuration for launching a supervised process.
type CommandSpec struct {
	Command string
	Args    []string
	Cwd     string
	Env     []string
}

// BuildCommand creates an exec.Cmd configured for execution within the given context.
func (cs *CommandSpec) BuildCommand(_ context.Context) (*exec.Cmd, error) {
	if cs.Command == "" {
		return nil, fmt.Errorf("command binary cannot be empty")
	}

	cmd := exec.Command(cs.Command, cs.Args...)
	if cs.Cwd != "" {
		cmd.Dir = cs.Cwd
	}
	if len(cs.Env) > 0 {
		cmd.Env = cs.Env
	}
	return cmd, nil
}
