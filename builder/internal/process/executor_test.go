package process

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestSupervisor_ExecuteSuccess(t *testing.T) {
	sup := NewSupervisor(1*time.Second, 1024*1024)
	spec := CommandSpec{
		Command: "echo",
		Args:    []string{"hello", "world"},
	}

	var lines []string
	var mu sync.Mutex
	callback := func(stream, line string) {
		mu.Lock()
		defer mu.Unlock()
		lines = append(lines, line)
	}

	res, err := sup.Execute(context.Background(), spec, callback)
	if err != nil {
		t.Fatalf("unexpected error executing command: %v", err)
	}

	if res.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", res.ExitCode)
	}
	if !strings.Contains(res.Stdout, "hello world") {
		t.Errorf("expected stdout to contain 'hello world', got: %s", res.Stdout)
	}
	if len(lines) == 0 || lines[0] != "hello world" {
		t.Errorf("callback did not receive output line: %v", lines)
	}
}

func TestSupervisor_Cancellation(t *testing.T) {
	sup := NewSupervisor(100*time.Millisecond, 1024*1024)
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	spec := CommandSpec{
		Command: "sleep",
		Args:    []string{"10"},
	}

	_, err := sup.Execute(ctx, spec, nil)
	if err == nil {
		t.Fatal("expected error due to cancellation, got nil")
	}
}

func TestSupervisor_NonZeroExit(t *testing.T) {
	sup := NewSupervisor(1*time.Second, 1024*1024)
	spec := CommandSpec{
		Command: "sh",
		Args:    []string{"-c", "exit 42"},
	}

	res, err := sup.Execute(context.Background(), spec, nil)
	if err == nil {
		t.Fatal("expected error for non-zero exit code, got nil")
	}
	if res.ExitCode != 42 {
		t.Errorf("expected exit code 42, got %d", res.ExitCode)
	}
}
