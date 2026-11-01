package orchestrator

import (
	"context"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/catalog"
	"github.com/summit/backend/internal/cluster/managed"
	"github.com/summit/backend/internal/orchestrator/monitor"
	"github.com/summit/backend/internal/platformdb"
)

// pinnedCatalog serves managed addon images from internal/catalog (digest-pinned),
// so the API (which records image_ref) and the orchestrator (which runs it) agree.
type pinnedCatalog struct{}

func (pinnedCatalog) AddonFor(engine string) (managed.Addon, bool) {
	a, ok := catalog.AddonFor(engine)
	if !ok {
		return managed.Addon{}, false
	}
	return managed.Addon{Engine: a.Engine, Version: a.Version, Image: a.Image, Port: a.Port, URLEnv: a.URLEnv}, true
}

// storeAddonLister adapts platformdb.Store to the monitor's AddonLister.
type storeAddonLister struct {
	store interface {
		ListEnvironmentAddons(ctx context.Context, environmentID uuid.UUID) ([]platformdb.EnvironmentAddon, error)
	}
}

func (l storeAddonLister) ListEnvironmentAddons(ctx context.Context, environmentID uuid.UUID) ([]monitor.EnvironmentAddon, error) {
	rows, err := l.store.ListEnvironmentAddons(ctx, environmentID)
	if err != nil {
		return nil, err
	}
	out := make([]monitor.EnvironmentAddon, 0, len(rows))
	for _, r := range rows {
		out = append(out, monitor.EnvironmentAddon{
			ServiceID:   r.ServiceID,
			ServiceName: r.ServiceName,
			Engine:      r.Engine,
			Version:     r.Version,
			Port:        int(r.Port),
		})
	}
	return out, nil
}
