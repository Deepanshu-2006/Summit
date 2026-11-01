package monitor

import (
	"context"
	"regexp"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/cluster/managed"
	corev1 "k8s.io/api/core/v1"
)

// EnvironmentAddon is one managed addon attached to an environment.
// It matches the platformdb.ListEnvironmentAddons row: ServiceID, ServiceName,
// Engine, Version, Port.
type EnvironmentAddon struct {
	ServiceID   uuid.UUID
	ServiceName string
	Engine      string
	Version     string
	Port        int
}

// AddonLister loads the addons whose connection URLs are injected into workloads.
type AddonLister interface {
	ListEnvironmentAddons(ctx context.Context, environmentID uuid.UUID) ([]EnvironmentAddon, error)
}

// VolumeSizer returns service_addons.storage_mb. Zero means the default 1Gi.
type VolumeSizer interface {
	AddonStorageMB(ctx context.Context, serviceID uuid.UUID) (int, error)
}

var nonEnvChars = regexp.MustCompile(`[^A-Za-z0-9]+`)

// snakeURLName is <SERVICE_NAME_UPPER_SNAKE>_URL.
func snakeURLName(serviceName string) string {
	s := nonEnvChars.ReplaceAllString(serviceName, "_")
	s = strings.Trim(s, "_")
	if s == "" {
		return ""
	}
	s = strings.ToUpper(s)
	if s[0] >= '0' && s[0] <= '9' {
		s = "SVC_" + s
	}
	return s + "_URL"
}

func addonSecretRef(serviceID uuid.UUID) *corev1.EnvVarSource {
	name, err := managed.ObjectName(serviceID.String())
	if err != nil {
		name = "addon-" + strings.ToLower(serviceID.String())
	}
	return &corev1.EnvVarSource{
		SecretKeyRef: &corev1.SecretKeySelector{
			LocalObjectReference: corev1.LocalObjectReference{Name: name},
			Key:                  "url",
		},
	}
}

// MergeAddonEnv appends addon connection URLs to existing.
// Addons are ordered by service name, then service id. The first postgres
// contributes DATABASE_URL and the first redis contributes REDIS_URL. Every
// addon also contributes <SERVICE_NAME_UPPER_SNAKE>_URL. Existing names are
// kept and never duplicated.
func MergeAddonEnv(existing []corev1.EnvVar, addons []EnvironmentAddon) []corev1.EnvVar {
	out := append([]corev1.EnvVar(nil), existing...)
	seen := make(map[string]struct{}, len(out))
	for _, env := range out {
		seen[env.Name] = struct{}{}
	}
	sorted := append([]EnvironmentAddon(nil), addons...)
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].ServiceName != sorted[j].ServiceName {
			return sorted[i].ServiceName < sorted[j].ServiceName
		}
		return sorted[i].ServiceID.String() < sorted[j].ServiceID.String()
	})
	add := func(name string, addon EnvironmentAddon) {
		if name == "" {
			return
		}
		if _, ok := seen[name]; ok {
			return
		}
		seen[name] = struct{}{}
		out = append(out, corev1.EnvVar{Name: name, ValueFrom: addonSecretRef(addon.ServiceID)})
	}
	var sawPostgres, sawRedis bool
	for _, addon := range sorted {
		switch strings.ToLower(strings.TrimSpace(addon.Engine)) {
		case managed.EnginePostgres:
			if !sawPostgres {
				add("DATABASE_URL", addon)
				sawPostgres = true
			}
		case managed.EngineRedis:
			if !sawRedis {
				add("REDIS_URL", addon)
				sawRedis = true
			}
		}
	}
	for _, addon := range sorted {
		add(snakeURLName(addon.ServiceName), addon)
	}
	return out
}
