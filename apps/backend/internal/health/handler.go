package health

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/summit/backend/internal/config"
)

// Response models the OpenAPI 3.1 HealthResponse schema defined in packages/api_spec/openapi.yaml.
type Response struct {
	Status        string `json:"status"`
	Service       string `json:"service"`
	Version       string `json:"version"`
	Region        string `json:"region"`
	EdgeRouting   string `json:"edge_routing"`
	UptimeSeconds int64  `json:"uptime_seconds"`
	Timestamp     string `json:"timestamp"`
}

// Handler serves health status responses conforming to the canonical OpenAPI contract.
type Handler struct {
	cfg       *config.Config
	startTime time.Time
}

// NewHandler constructs a new Handler.
func NewHandler(cfg *config.Config, startTime time.Time) *Handler {
	return &Handler{
		cfg:       cfg,
		startTime: startTime,
	}
}

// ServeHTTP writes the HealthResponse JSON payload.
func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	uptime := int64(time.Since(h.startTime).Seconds())
	res := Response{
		Status:        "healthy",
		Service:       h.cfg.ServiceName,
		Version:       h.cfg.ServiceVersion,
		Region:        h.cfg.Region,
		EdgeRouting:   h.cfg.EdgeRouting,
		UptimeSeconds: uptime,
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_ = json.NewEncoder(w).Encode(res)
	}
}
