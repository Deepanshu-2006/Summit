package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/cluster/addons"
	"github.com/summit/backend/internal/cluster/managed"
	"github.com/summit/backend/internal/cluster/workloads"
	"github.com/summit/backend/internal/orchestrator/queue"
	"github.com/summit/backend/internal/platformdb"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

// EventTypeServiceDeleted is emitted by platformdb.SoftDeleteService (and project
// soft delete) when a service is removed.
const EventTypeServiceDeleted = "service.deleted"

var (
	summitServiceGVR = workloads.SchemeGroupVersion.WithResource("summitservices")
	ingressRouteGVR  = schema.GroupVersionResource{Group: "traefik.io", Version: "v1alpha1", Resource: "ingressroutes"}
	middlewareGVR    = schema.GroupVersionResource{Group: "traefik.io", Version: "v1alpha1", Resource: "middlewares"}
)

// ServiceDeletedHandler removes every cluster object Summit created for a
// deleted service in its tenant namespace. For postgres/redis addons this
// includes the PVC: data is deleted with the service (no backup is taken).
// All deletes are idempotent; missing objects or missing CRDs are success.
type ServiceDeletedHandler struct {
	Kube   kubernetes.Interface
	Dyn    dynamic.Interface
	Logger *slog.Logger
}

// Handle implements queue.Handler for service.deleted events.
func (h *ServiceDeletedHandler) Handle(ctx context.Context, record *queue.EventRecord) error {
	if record == nil {
		return errors.New("orchestrator worker: nil event record")
	}
	if record.EventType != EventTypeServiceDeleted {
		return fmt.Errorf("orchestrator worker: unsupported event type %q", record.EventType)
	}
	if h.Kube == nil {
		return errors.New("orchestrator worker: kubernetes client is required for service.deleted")
	}
	var ev platformdb.ServiceDeletedEvent
	if err := json.Unmarshal(record.Payload, &ev); err != nil {
		return fmt.Errorf("orchestrator worker: decode service.deleted payload: %w", err)
	}
	serviceID, err := uuid.Parse(strings.TrimSpace(ev.ServiceID))
	if err != nil {
		return fmt.Errorf("orchestrator worker: service.deleted has invalid service_id: %w", err)
	}
	namespace, err := addons.TenantNamespaceName(ev.UserID)
	if err != nil {
		return fmt.Errorf("orchestrator worker: service.deleted tenant namespace: %w", err)
	}

	var errs []error
	switch ev.ServiceType {
	case "postgres", "redis":
		if err := managed.Delete(ctx, h.Kube, namespace, serviceID.String()); err != nil {
			errs = append(errs, err)
		}
	default:
		errs = append(errs, h.deleteWorkload(ctx, namespace, serviceID)...)
	}
	if err := errors.Join(errs...); err != nil {
		return err
	}
	if h.Logger != nil {
		h.Logger.InfoContext(ctx, "service resources deleted",
			"service_id", serviceID.String(), "service_type", ev.ServiceType, "namespace", namespace)
	}
	return nil
}

func (h *ServiceDeletedHandler) deleteWorkload(ctx context.Context, namespace string, serviceID uuid.UUID) []error {
	name := "svc-" + serviceID.String()
	propagation := metav1.DeletePropagationBackground
	opts := metav1.DeleteOptions{PropagationPolicy: &propagation}
	var errs []error

	if h.Dyn != nil {
		for _, target := range []struct {
			gvr  schema.GroupVersionResource
			name string
		}{
			{summitServiceGVR, name},
			{ingressRouteGVR, name},
			{middlewareGVR, addons.SecurityHeadersMiddlewareName(name)},
		} {
			err := h.Dyn.Resource(target.gvr).Namespace(namespace).Delete(ctx, target.name, opts)
			if err != nil && !ignorableDeleteError(err) {
				errs = append(errs, fmt.Errorf("delete %s %s: %w", target.gvr.Resource, target.name, err))
			}
		}
	}
	// The reconciler owns these, but delete explicitly so cleanup does not
	// depend on owner references or the CRD being present.
	if err := h.Kube.AppsV1().Deployments(namespace).Delete(ctx, name, opts); err != nil && !ignorableDeleteError(err) {
		errs = append(errs, fmt.Errorf("delete deployment %s: %w", name, err))
	}
	if err := h.Kube.CoreV1().Services(namespace).Delete(ctx, name, opts); err != nil && !ignorableDeleteError(err) {
		errs = append(errs, fmt.Errorf("delete service %s: %w", name, err))
	}
	if err := h.Kube.NetworkingV1().NetworkPolicies(namespace).Delete(ctx, name, opts); err != nil && !ignorableDeleteError(err) {
		errs = append(errs, fmt.Errorf("delete networkpolicy %s: %w", name, err))
	}
	return errs
}

// ignorableDeleteError treats missing objects, missing namespaces and missing
// CRDs (e.g. Traefik not installed) as already deleted.
func ignorableDeleteError(err error) bool {
	return apierrors.IsNotFound(err) || meta.IsNoMatchError(err)
}

// Dispatcher routes outbox events by event_type. Unknown types return an error,
// so the queue retries them up to max_retries and then marks them exhausted;
// other events keep flowing.
func Dispatcher(handlers map[string]queue.Handler) queue.Handler {
	return func(ctx context.Context, record *queue.EventRecord) error {
		if record == nil {
			return errors.New("orchestrator worker: nil event record")
		}
		h, ok := handlers[record.EventType]
		if !ok || h == nil {
			return fmt.Errorf("orchestrator worker: no handler for event type %q", record.EventType)
		}
		return h(ctx, record)
	}
}
