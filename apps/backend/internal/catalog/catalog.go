package catalog

// Addon is one managed data service the orchestrator can run without a build.
type Addon struct {
	Engine  string // postgres | redis
	Version string // image tag, e.g. 16-alpine
	Image   string // repo@sha256:<digest>
	Port    int32
	URLEnv  string // DATABASE_URL | REDIS_URL
}

const (
	// DefaultStorageMB is the service_addons.storage_mb used at create time.
	DefaultStorageMB = 1024

	postgresImage = "docker.io/library/postgres@sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab"
	redisImage    = "docker.io/library/redis@sha256:8da19c7399dca900c6822a1cf30f9d2285585e2c4b457ff4095b0f4500054d3f"
)

// AddonFor returns the pinned addon for engine ("postgres" or "redis").
func AddonFor(engine string) (Addon, bool) {
	switch engine {
	case "postgres":
		return Addon{
			Engine:  "postgres",
			Version: "16-alpine",
			Image:   postgresImage,
			Port:    5432,
			URLEnv:  "DATABASE_URL",
		}, true
	case "redis":
		return Addon{
			Engine:  "redis",
			Version: "7-alpine",
			Image:   redisImage,
			Port:    6379,
			URLEnv:  "REDIS_URL",
		}, true
	default:
		return Addon{}, false
	}
}
