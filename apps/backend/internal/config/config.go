package config

import (
	"net"
	"os"
)

// Config holds runtime configuration for the backend service.
type Config struct {
	Host           string
	Port           string
	ServiceName    string
	ServiceVersion string
	Region         string
	EdgeRouting    string
	Environment    string
}

// Load loads configuration from environment variables with safe defaults.
func Load() *Config {
	env := getEnv("ENVIRONMENT", "")
	if env == "" {
		env = getEnv("ENV", "development")
	}

	return &Config{
		Host:           getEnv("HOST", ""),
		Port:           getEnv("PORT", "4000"),
		ServiceName:    getEnv("SERVICE_NAME", "meridian-api"),
		ServiceVersion: getEnv("SERVICE_VERSION", "1.0.0"),
		Region:         getEnv("REGION", "cdg-1 (Paris)"),
		EdgeRouting:    getEnv("EDGE_ROUTING", "anycast"),
		Environment:    env,
	}
}

// Address returns the listen address for the HTTP server.
func (c *Config) Address() string {
	if c.Host != "" {
		return net.JoinHostPort(c.Host, c.Port)
	}
	return ":" + c.Port
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
