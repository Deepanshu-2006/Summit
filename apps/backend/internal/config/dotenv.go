package config

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/joho/godotenv"
)

// LoadDevelopmentEnv loads the repository or package .env file for local
// development and tests. Existing process environment values take precedence.
func LoadDevelopmentEnv(logger *slog.Logger) {
	if logger == nil {
		logger = slog.Default()
	}

	environment := strings.TrimSpace(os.Getenv("ENVIRONMENT"))
	if environment == "" {
		environment = strings.TrimSpace(os.Getenv("ENV"))
	}
	if environment != "" && !strings.EqualFold(environment, "development") && !strings.EqualFold(environment, "test") {
		return
	}

	for _, envPath := range []string{filepath.Join("apps", "backend", ".env"), ".env"} {
		if _, err := os.Stat(envPath); err != nil {
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			logger.Warn("could not inspect local environment file", "path", envPath, "error", err)
			return
		}

		if err := godotenv.Load(envPath); err != nil {
			logger.Error("failed to load local environment file", "path", envPath, "error", err)
			os.Exit(1)
		}
		logger.Info("loaded local environment file", "path", envPath)
		return
	}
}
