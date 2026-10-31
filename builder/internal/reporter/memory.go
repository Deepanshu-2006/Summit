package reporter

import (
	"context"
	"sync"

	"github.com/summit/builder/internal/protocol"
)

// MemoryReporter records all reported events in memory for testing and standalone runs.
type MemoryReporter struct {
	mu          sync.Mutex
	Statuses    []protocol.StatusUpdate
	Logs        []protocol.LogEvent
	FinalResult *protocol.BuildExecutionResult
}

// NewMemoryReporter constructs a new MemoryReporter.
func NewMemoryReporter() *MemoryReporter {
	return &MemoryReporter{}
}

func (m *MemoryReporter) ReportStatus(_ context.Context, update protocol.StatusUpdate) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Statuses = append(m.Statuses, update)
	return nil
}

func (m *MemoryReporter) ReportLog(_ context.Context, event protocol.LogEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.Logs = append(m.Logs, event)
	return nil
}

func (m *MemoryReporter) ReportHeartbeat(_ context.Context, buildID, attemptID string, sequence int) error {
	update := protocol.NewStatusUpdate(buildID, attemptID, sequence, "heartbeat", protocol.StageStatusRunning, "heartbeat")
	return m.ReportStatus(context.Background(), update)
}

func (m *MemoryReporter) ReportResult(_ context.Context, result protocol.BuildExecutionResult) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.FinalResult = &result
	return nil
}

func (m *MemoryReporter) Flush(_ context.Context) error {
	return nil
}
