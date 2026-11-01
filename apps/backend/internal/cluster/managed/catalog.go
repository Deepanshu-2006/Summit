package managed

import "strings"

// Engine names accepted for managed addons.
const (
	EnginePostgres = "postgres"
	EngineRedis    = "redis"
)

// Addon is the pinned runtime image for one managed engine.
// Field names match internal/catalog.AddonFor when that package is present:
// Engine, Version, Image, Port, URLEnv.
type Addon struct {
	Engine  string
	Version string
	Image   string
	Port    int32
	URLEnv  string
}

// Catalog resolves a managed engine to its pinned image.
type Catalog interface {
	AddonFor(engine string) (Addon, bool)
}

type staticCatalog struct {
	byEngine map[string]Addon
}

func (c staticCatalog) AddonFor(engine string) (Addon, bool) {
	a, ok := c.byEngine[strings.ToLower(strings.TrimSpace(engine))]
	return a, ok
}

// DefaultCatalog pins postgres:16-alpine (DATABASE_URL) and redis:7-alpine (REDIS_URL).
// The orchestrator uses internal/catalog.AddonFor instead when that package is available.
func DefaultCatalog() Catalog {
	return staticCatalog{byEngine: map[string]Addon{
		EnginePostgres: {
			Engine:  EnginePostgres,
			Version: "16",
			Image:   "postgres:16-alpine",
			Port:    5432,
			URLEnv:  "DATABASE_URL",
		},
		EngineRedis: {
			Engine:  EngineRedis,
			Version: "7",
			Image:   "redis:7-alpine",
			Port:    6379,
			URLEnv:  "REDIS_URL",
		},
	}}
}

// IsEngine reports whether engine is a managed postgres or redis addon.
func IsEngine(engine string) bool {
	switch strings.ToLower(strings.TrimSpace(engine)) {
	case EnginePostgres, EngineRedis:
		return true
	default:
		return false
	}
}
