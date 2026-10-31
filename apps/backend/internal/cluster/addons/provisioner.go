package addons

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/summit/backend/internal/cluster/workloads"
)

// Result reports what a provisioning call did. Entries look like "Kind/namespace/name".
type Result struct {
	Namespace string
	// Host is the public hostname when an IngressRoute was applied.
	Host string
	// Applied lists objects that were server-side applied.
	Applied []string
	// Skipped lists objects skipped because their resource type is not installed (ErrAddonUnavailable).
	Skipped []string
}

// TenantProvisioner ties the generators to an ObjectApplier behind the C8 feature flags.
// All methods are idempotent: every object is server-side applied with deterministic content.
type TenantProvisioner struct {
	cfg     Config
	applier ObjectApplier
	logger  *slog.Logger
}

// NewTenantProvisioner validates cfg and returns a provisioner. A nil logger uses slog.Default().
func NewTenantProvisioner(cfg Config, applier ObjectApplier, logger *slog.Logger) (*TenantProvisioner, error) {
	if applier == nil {
		return nil, errors.New("addons: applier is required")
	}
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &TenantProvisioner{cfg: cfg, applier: applier, logger: logger}, nil
}

func objectRef(u *unstructured.Unstructured) string {
	return fmt.Sprintf("%s/%s/%s", u.GetKind(), u.GetNamespace(), u.GetName())
}

// applyAll applies objects in order. ErrAddonUnavailable is logged and recorded in Skipped;
// other errors are collected and returned joined after all objects were attempted.
func (p *TenantProvisioner) applyAll(ctx context.Context, res *Result, objs []*unstructured.Unstructured) error {
	var errs []error
	for _, obj := range objs {
		ref := objectRef(obj)
		err := p.applier.Apply(ctx, obj)
		switch {
		case err == nil:
			res.Applied = append(res.Applied, ref)
		case errors.Is(err, ErrAddonUnavailable):
			p.logger.Warn("add-on resource type not installed; skipping", "object", ref, "error", err)
			res.Skipped = append(res.Skipped, ref)
		default:
			errs = append(errs, fmt.Errorf("%s: %w", ref, err))
		}
	}
	return errors.Join(errs...)
}

// EnsureTenant creates or updates the tenant namespace (always, with Pod Security Admission
// labels) plus, per flags, ResourceQuota/LimitRange and the baseline network policies.
// The namespace failing is fatal; remaining objects are attempted and errors joined.
func (p *TenantProvisioner) EnsureTenant(ctx context.Context, userID string) (Result, error) {
	ns, err := TenantNamespace(userID)
	if err != nil {
		return Result{}, err
	}
	res := Result{Namespace: ns.Name}
	owner := Owner{Tenant: ns.Labels[workloads.LabelTenant]}
	stampTyped(&ns.ObjectMeta, owner)

	nsObj, err := ToUnstructured(ns)
	if err != nil {
		return res, err
	}
	if err := p.applier.Apply(ctx, nsObj); err != nil {
		return res, fmt.Errorf("apply namespace %q: %w", ns.Name, err)
	}
	res.Applied = append(res.Applied, objectRef(nsObj))

	var objs []*unstructured.Unstructured
	if p.cfg.EnableTenantQuotas {
		rq, err := TenantResourceQuota(ns.Name, p.cfg.Quota, owner)
		if err != nil {
			return res, err
		}
		lr, err := TenantLimitRange(ns.Name, p.cfg.Quota, owner)
		if err != nil {
			return res, err
		}
		for _, typed := range []runtime.Object{rq, lr} {
			u, err := ToUnstructured(typed)
			if err != nil {
				return res, err
			}
			objs = append(objs, u)
		}
	}
	if p.cfg.EnableNetworkPolicy {
		netObjs, err := p.tenantNetworkObjects(ns.Name, owner)
		if err != nil {
			return res, err
		}
		objs = append(objs, netObjs...)
	}
	err = p.applyAll(ctx, &res, objs)
	return res, err
}

func (p *TenantProvisioner) tenantNetworkObjects(namespace string, owner Owner) ([]*unstructured.Unstructured, error) {
	if p.cfg.NetworkPolicyMode == NetworkPolicyCilium {
		return []*unstructured.Unstructured{CiliumTenantPolicy(namespace, p.cfg, workloads.DefaultPort, owner)}, nil
	}
	var out []*unstructured.Unstructured
	for _, np := range TenantNetworkPolicies(namespace, p.cfg, workloads.DefaultPort, owner) {
		u, err := ToUnstructured(np)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, nil
}

// EnsureBuildNetworkPolicy applies the builder pod lockdown in the build namespace when network
// policies are enabled. The namespace itself must already exist (config/namespaces.yaml).
func (p *TenantProvisioner) EnsureBuildNetworkPolicy(ctx context.Context) (Result, error) {
	res := Result{Namespace: p.cfg.Network.BuildNamespace}
	if !p.cfg.EnableNetworkPolicy {
		return res, nil
	}
	var obj *unstructured.Unstructured
	if p.cfg.NetworkPolicyMode == NetworkPolicyCilium {
		obj = CiliumBuilderPolicy(p.cfg.Network)
	} else {
		u, err := ToUnstructured(BuilderNetworkPolicy(p.cfg.Network))
		if err != nil {
			return res, err
		}
		obj = u
	}
	return res, p.applyAll(ctx, &res, []*unstructured.Unstructured{obj})
}

// ExposureParams identifies a service for routing, secrets and per-service network policy.
type ExposureParams struct {
	UserID      string
	ProjectID   string
	ProjectSlug string
	ServiceID   string
	// ServiceName is the Kubernetes Service name (SummitService name, e.g. svc-<service_id>).
	ServiceName string
	Port        int32
	Environment string
	// Host overrides the generated <service>-<project-slug>.<apps domain> host.
	Host string
	// PodSelector overrides the default workloads selector labels for the service pods.
	PodSelector map[string]string
	// SecretName overrides the target Secret name (default app-env-secret).
	SecretName string
}

// EnsureServiceExposure applies, per flags: the Traefik IngressRoute and security-headers
// Middleware, the per-service Traefik ingress network policy, and the ESO ServiceAccount,
// SecretStore and ExternalSecret. The tenant namespace must exist (EnsureTenant).
func (p *TenantProvisioner) EnsureServiceExposure(ctx context.Context, params ExposureParams) (Result, error) {
	nsName, err := TenantNamespaceName(params.UserID)
	if err != nil {
		return Result{}, err
	}
	res := Result{Namespace: nsName}
	if strings.TrimSpace(params.ServiceName) == "" {
		return res, fmt.Errorf("%w: empty service name", ErrInvalidName)
	}
	port := params.Port
	if port == 0 {
		port = workloads.DefaultPort
	}
	owner := Owner{
		Tenant:  strings.ToLower(strings.TrimSpace(params.UserID)),
		Project: params.ProjectID,
		Service: params.ServiceID,
	}

	var objs []*unstructured.Unstructured

	if p.cfg.EnableIngress {
		host := params.Host
		if host == "" {
			if host, err = ServiceHost(params.ServiceName, params.ProjectSlug, p.cfg.AppsDomain); err != nil {
				return res, err
			}
		}
		route, err := IngressRoute(IngressParams{
			Namespace:     nsName,
			Name:          params.ServiceName,
			Host:          host,
			ServiceName:   params.ServiceName,
			ServicePort:   port,
			EntryPoints:   p.cfg.Traefik.EntryPoints,
			TLSSecretName: p.cfg.Traefik.TLSSecretName,
			CertResolver:  p.cfg.Traefik.CertResolver,
			Middlewares:   []string{SecurityHeadersMiddlewareName(params.ServiceName)},
			Owner:         owner,
		})
		if err != nil {
			return res, err
		}
		res.Host = host
		// Middleware first so the route never references a missing one.
		objs = append(objs, SecurityHeadersMiddleware(nsName, params.ServiceName, owner), route)
	}

	if p.cfg.EnableNetworkPolicy {
		sel := params.PodSelector
		if len(sel) == 0 {
			svc := workloads.SummitService{
				ObjectMeta: metav1.ObjectMeta{Name: params.ServiceName},
				Spec:       workloads.SummitServiceSpec{ServiceID: params.ServiceID},
			}
			sel = svc.SelectorLabels()
		}
		if p.cfg.NetworkPolicyMode == NetworkPolicyCilium {
			objs = append(objs, CiliumServiceIngressPolicy(nsName, params.ServiceName, sel, port, p.cfg.Traefik, owner))
		} else {
			u, err := ToUnstructured(AllowTraefikIngressPolicy(nsName, ServiceIngressPolicyName(params.ServiceName), sel, port, p.cfg.Traefik, owner))
			if err != nil {
				return res, err
			}
			objs = append(objs, u)
		}
	}

	if p.cfg.EnableESO {
		sa := &corev1.ServiceAccount{ObjectMeta: metav1.ObjectMeta{Name: p.cfg.ESO.ServiceAccount, Namespace: nsName}}
		stampTyped(&sa.ObjectMeta, Owner{Tenant: owner.Tenant})
		saObj, err := ToUnstructured(sa)
		if err != nil {
			return res, err
		}
		store, err := SecretStore(nsName, p.cfg.ESO, Owner{Tenant: owner.Tenant})
		if err != nil {
			return res, err
		}
		es, err := ExternalSecret(ExternalSecretParams{
			Namespace:   nsName,
			UserID:      owner.Tenant,
			ProjectID:   params.ProjectID,
			Environment: params.Environment,
			TargetName:  params.SecretName,
			Owner:       owner,
		}, p.cfg.ESO)
		if err != nil {
			return res, err
		}
		objs = append(objs, saObj, store, es)
	}

	err = p.applyAll(ctx, &res, objs)
	return res, err
}
