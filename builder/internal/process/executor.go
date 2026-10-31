package process

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// StreamCallback is invoked when a new line is read from stdout or stderr.
type StreamCallback func(stream string, line string)

// ProcessResult captures the outcome of a supervised process execution.
type ProcessResult struct {
	ExitCode int
	Stdout   string
	Stderr   string
	Duration time.Duration
}

// Supervisor manages subprocess execution, process-group signaling, and output streaming.
type Supervisor struct {
	gracePeriod time.Duration
	maxBufSize  int
}

// NewSupervisor constructs a new Supervisor.
func NewSupervisor(gracePeriod time.Duration, maxBufSize int) *Supervisor {
	if gracePeriod <= 0 {
		gracePeriod = 3 * time.Second
	}
	if maxBufSize <= 0 {
		maxBufSize = 10 * 1024 * 1024 // 10MB default bound
	}
	return &Supervisor{
		gracePeriod: gracePeriod,
		maxBufSize:  maxBufSize,
	}
}

// Execute launches the process specified by spec, streams lines to callback (if non-nil),
// and guarantees process-group cleanup if ctx is cancelled or times out.
func (s *Supervisor) Execute(ctx context.Context, spec CommandSpec, callback StreamCallback) (*ProcessResult, error) {
	cmd, err := spec.BuildCommand(ctx)
	if err != nil {
		return nil, err
	}

	// Place child process in its own process group to ensure child processes can be terminated together
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("creating stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("creating stderr pipe: %w", err)
	}

	var stdoutBuf, stderrBuf bytes.Buffer
	var wg sync.WaitGroup

	readStream := func(r io.Reader, w *bytes.Buffer, streamName string) {
		defer wg.Done()
		scanner := bufio.NewScanner(r)
		// Max token size 1MB per line
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		for scanner.Scan() {
			line := scanner.Text()
			if w.Len() < s.maxBufSize {
				w.WriteString(line)
				w.WriteByte('\n')
			}
			if callback != nil {
				callback(streamName, line)
			}
		}
		if scanErr := scanner.Err(); scanErr != nil {
			if callback != nil {
				callback(streamName, fmt.Sprintf("[stream scanner error: %v]", scanErr))
			}
		}
	}

	start := time.Now()
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("starting process %s: %w", spec.Command, err)
	}

	pgid := cmd.Process.Pid

	wg.Add(2)
	go readStream(stdoutPipe, &stdoutBuf, "stdout")
	go readStream(stderrPipe, &stderrBuf, "stderr")

	// Monitor context cancellation and terminate process group cleanly
	done := make(chan struct{})
	go func() {
		select {
		case <-done:
			return
		case <-ctx.Done():
			// Send SIGTERM to process group
			if pgid > 0 {
				_ = syscall.Kill(-pgid, syscall.SIGTERM)
			}

			// Wait for grace period before force killing with SIGKILL
			select {
			case <-done:
				return
			case <-time.After(s.gracePeriod):
				if pgid > 0 {
					_ = syscall.Kill(-pgid, syscall.SIGKILL)
				}
			}
		}
	}()

	// Wait for pipe drain before closing process descriptor with cmd.Wait()
	wg.Wait()
	waitErr := cmd.Wait()
	close(done)
	duration := time.Since(start)

	exitCode := 0
	if waitErr != nil {
		var exitErr *exec.ExitError
		if errors.As(waitErr, &exitErr) {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}

	res := &ProcessResult{
		ExitCode: exitCode,
		Stdout:   stdoutBuf.String(),
		Stderr:   stderrBuf.String(),
		Duration: duration,
	}

	if ctx.Err() != nil {
		return res, fmt.Errorf("process terminated due to context: %w", ctx.Err())
	}
	if waitErr != nil {
		return res, fmt.Errorf("command failed with exit code %d: %w", exitCode, waitErr)
	}

	return res, nil
}
