package buildkit

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/summit/builder/internal/process"
)

func TestBuildKit_WaitReadySuccess(t *testing.T) {
	sockPath := fmt.Sprintf("/tmp/bk-test-%d.sock", time.Now().UnixNano())
	defer os.Remove(sockPath)
	mgr := NewManager(process.NewSupervisor(0, 0), sockPath, "mock-daemon", "mock-client")

	l, err := net.Listen("unix", sockPath)
	if err != nil {
		t.Fatalf("failed to listen on socket %s: %v", sockPath, err)
	}
	defer l.Close()

	readyDone := make(chan struct{})
	go func() {
		for {
			select {
			case <-readyDone:
				return
			default:
				_ = l.(*net.UnixListener).SetDeadline(time.Now().Add(100 * time.Millisecond))
				conn, err := l.Accept()
				if err == nil {
					_ = conn.Close()
				}
			}
		}
	}()

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	defer close(readyDone)

	if err := mgr.WaitReady(ctx); err != nil {
		t.Fatalf("expected WaitReady to succeed, got: %v", err)
	}
}

func TestBuildKit_WaitReadyTimeout(t *testing.T) {
	sockPath := filepath.Join(os.TempDir(), fmt.Sprintf("non-existent-%d.sock", time.Now().UnixNano()))
	mgr := NewManager(process.NewSupervisor(0, 0), sockPath, "mock-daemon", "mock-client")

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	if err := mgr.WaitReady(ctx); err == nil {
		t.Fatal("expected error on WaitReady timeout, got nil")
	}
}
