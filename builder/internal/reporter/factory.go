package reporter

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
)

// ReadTokenFile returns the trimmed contents of a bearer-token file. Errors never include
// the file content.
func ReadTokenFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		var pe *os.PathError
		if errors.As(err, &pe) {
			err = pe.Err
		}
		return "", fmt.Errorf("reading reporting token file: %w", err)
	}
	token := strings.TrimSpace(string(data))
	if token == "" {
		return "", errors.New("reporting token file is empty")
	}
	return token, nil
}

// New builds the Reporter for a build.
//
//   - endpoint empty: callbacks are disabled; an in-memory reporter is returned and a
//     warning is logged (standalone/local runs).
//   - tokenFile set: the bearer token is the trimmed file contents (the per-build worker JWT).
//   - tokenFile empty: requests are sent without Authorization and a warning is logged.
func New(endpoint, tokenFile string, httpClient *http.Client, logger *slog.Logger) (Reporter, error) {
	if logger == nil {
		logger = slog.Default()
	}
	if strings.TrimSpace(endpoint) == "" {
		logger.Warn("reporting endpoint is empty; build status, logs and result will not be sent to the control plane")
		return NewMemoryReporter(), nil
	}
	token := ""
	if tokenFile != "" {
		t, err := ReadTokenFile(tokenFile)
		if err != nil {
			return nil, err
		}
		token = t
	} else {
		logger.Warn("no reporting token file configured; callbacks will be sent without Authorization")
	}
	return NewHTTPReporter(endpoint, token, httpClient), nil
}
