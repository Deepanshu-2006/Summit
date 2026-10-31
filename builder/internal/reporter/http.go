package reporter

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/summit/builder/internal/protocol"
)

// Reporter defines progress and telemetry reporting back to the Builder Control Plane.
type Reporter interface {
	ReportStatus(ctx context.Context, update protocol.StatusUpdate) error
	ReportLog(ctx context.Context, event protocol.LogEvent) error
	ReportHeartbeat(ctx context.Context, buildID, attemptID string, sequence int) error
	ReportResult(ctx context.Context, result protocol.BuildExecutionResult) error
	Flush(ctx context.Context) error
}

// HTTPReporter posts updates, batched logs, and results to the control plane HTTP endpoint.
type HTTPReporter struct {
	endpoint   string
	token      string
	httpClient *http.Client

	logMu     sync.Mutex
	flushMu   sync.Mutex
	logBuffer []protocol.LogEvent
	maxBatch  int
}

// NewHTTPReporter constructs a new HTTPReporter.
func NewHTTPReporter(endpoint, token string, httpClient *http.Client) *HTTPReporter {
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 10 * time.Second}
	}
	endpoint = strings.TrimRight(endpoint, "/")

	return &HTTPReporter{
		endpoint:   endpoint,
		token:      token,
		httpClient: httpClient,
		maxBatch:   50,
	}
}

// ReportStatus sends a stage transition update.
func (h *HTTPReporter) ReportStatus(ctx context.Context, update protocol.StatusUpdate) error {
	url := fmt.Sprintf("%s/%s/status", h.endpoint, update.BuildID)
	return h.postJSON(ctx, url, update)
}

// ReportHeartbeat sends a periodic heartbeat to maintain orchestrator lease.
func (h *HTTPReporter) ReportHeartbeat(ctx context.Context, buildID, attemptID string, sequence int) error {
	update := protocol.NewStatusUpdate(buildID, attemptID, sequence, "heartbeat", protocol.StageStatusRunning, "heartbeat")
	return h.ReportStatus(ctx, update)
}

// ReportLog queues a log event and flushes if the buffer reaches maxBatch.
func (h *HTTPReporter) ReportLog(ctx context.Context, event protocol.LogEvent) error {
	h.logMu.Lock()
	h.logBuffer = append(h.logBuffer, event)
	readyToFlush := len(h.logBuffer) >= h.maxBatch
	h.logMu.Unlock()

	if readyToFlush {
		return h.Flush(ctx)
	}
	return nil
}

// Flush sends all buffered log events.
func (h *HTTPReporter) Flush(ctx context.Context) error {
	h.flushMu.Lock()
	defer h.flushMu.Unlock()

	h.logMu.Lock()
	if len(h.logBuffer) == 0 {
		h.logMu.Unlock()
		return nil
	}
	batch := h.logBuffer
	h.logBuffer = nil
	h.logMu.Unlock()

	buildID := batch[0].BuildID
	url := fmt.Sprintf("%s/%s/logs", h.endpoint, buildID)
	return h.postJSON(ctx, url, batch)
}

// ReportResult sends the final terminal execution result.
func (h *HTTPReporter) ReportResult(ctx context.Context, result protocol.BuildExecutionResult) error {
	// Flush any pending logs first
	_ = h.Flush(ctx)
	url := fmt.Sprintf("%s/%s/result", h.endpoint, result.BuildID)
	return h.postJSON(ctx, url, result)
}

func (h *HTTPReporter) postJSON(ctx context.Context, url string, payload any) error {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling reporter payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("creating reporter request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if h.token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", h.token))
	}

	// Retry once on network failure to tolerate transient control plane lag
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		resp, err := h.httpClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return nil
			}
			lastErr = fmt.Errorf("reporter endpoint %s returned status %d", url, resp.StatusCode)
		} else {
			lastErr = err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(200 * time.Millisecond):
		}
	}
	return lastErr
}
