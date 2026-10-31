package workloads

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
)

const DefaultReconcileInterval = 5 * time.Second

// Controller polls SummitService custom resources and passes each desired state
// through the idempotent primitive reconciler. Polling keeps the MVP independent
// of generated clientsets and controller-runtime.
type Controller struct {
	client     dynamic.Interface
	reconciler *Reconciler
	interval   time.Duration
	logger     *slog.Logger
}

func NewController(client dynamic.Interface, reconciler *Reconciler, interval time.Duration, logger *slog.Logger) (*Controller, error) {
	if client == nil {
		return nil, fmt.Errorf("workloads: dynamic client is required")
	}
	if reconciler == nil {
		return nil, fmt.Errorf("workloads: reconciler is required")
	}
	if interval <= 0 {
		interval = DefaultReconcileInterval
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Controller{client: client, reconciler: reconciler, interval: interval, logger: logger}, nil
}

// ReconcileOnce lists all SummitService objects and attempts each independently.
func (c *Controller) ReconcileOnce(ctx context.Context) error {
	list, err := c.client.Resource(SchemeGroupVersion.WithResource("summitservices")).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("workloads: listing SummitService resources: %w", err)
	}
	for i := range list.Items {
		item := &list.Items[i]
		var service SummitService
		if err := runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, &service); err != nil {
			c.logger.Error("failed decoding SummitService resource", "namespace", item.GetNamespace(), "name", item.GetName(), "error", err)
			continue
		}
		if _, err := c.reconciler.Reconcile(ctx, &service); err != nil {
			c.logger.Error("failed reconciling SummitService", "namespace", service.Namespace, "name", service.Name, "error", err)
		}
	}
	return nil
}

// Run performs an initial reconciliation then polls until context cancellation.
func (c *Controller) Run(ctx context.Context) error {
	if err := c.ReconcileOnce(ctx); err != nil {
		c.logger.Error("SummitService list failed", "error", err)
	}
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			if err := c.ReconcileOnce(ctx); err != nil && ctx.Err() == nil {
				c.logger.Error("SummitService list failed", "error", err)
			}
		}
	}
}
