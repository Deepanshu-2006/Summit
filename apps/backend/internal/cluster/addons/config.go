package addons

import (
	"fmt"
	"os"
	"strings"

	"k8s.io/apimachinery/pkg/api/resource"
	"k8s.io/apimachinery/pkg/util/validation"
)

// NetworkPolicyMode selects the policy implementation.
type NetworkPolicyMode string

const (
	// NetworkPolicyNative emits networking.k8s.io/v1 NetworkPolicy objects (any CNI that enforces them).
	NetworkPolicyNative NetworkPolicyMode = "native"
	// NetworkPolicyCilium emits cilium.io/v2 CiliumNetworkPolicy objects.
	NetworkPolicyCilium NetworkPolicyMode = "cilium"
)

// Environment variable names (contract C8).
const (
	EnvEnableIngress       = "ORCHESTRATOR_ENABLE_INGRESS"
	EnvEnableNetworkPolicy = "ORCHESTRATOR_ENABLE_NETWORK_POLICY"
	EnvNetworkPolicyMode   = "ORCHESTRATOR_NETWORK_POLICY_MODE"
	EnvEnableESO           = "ORCHESTRATOR_ENABLE_ESO"
	EnvEnableTenantQuotas  = "ORCHESTRATOR_ENABLE_TENANT_QUOTAS"
	EnvAppsDomain          = "ORCHESTRATOR_APPS_DOMAIN"
	EnvTraefikNamespace    = "ORCHESTRATOR_TRAEFIK_NAMESPACE"
	EnvTraefikEntryPoints  = "ORCHESTRATOR_TRAEFIK_ENTRYPOINTS"
	EnvIngressTLSSecret    = "ORCHESTRATOR_INGRESS_TLS_SECRET"
	EnvIngressCertResolver = "ORCHESTRATOR_INGRESS_CERT_RESOLVER"
	EnvESOAPIVersion       = "ORCHESTRATOR_ESO_API_VERSION"
	EnvESOServiceAccount   = "ORCHESTRATOR_ESO_SERVICE_ACCOUNT"
	EnvOpenBaoServerURL    = "ORCHESTRATOR_OPENBAO_SERVER_URL"
	EnvOpenBaoRole         = "ORCHESTRATOR_OPENBAO_ROLE"
	EnvOpenBaoKVPath       = "ORCHESTRATOR_OPENBAO_KV_PATH"
	EnvOpenBaoKVVersion    = "ORCHESTRATOR_OPENBAO_KV_VERSION"
	EnvOpenBaoAuthMount    = "ORCHESTRATOR_OPENBAO_AUTH_MOUNT"
	EnvServiceCIDR         = "ORCHESTRATOR_SERVICE_CIDR"
	EnvAPINamespace        = "ORCHESTRATOR_API_NAMESPACE"
	EnvAPIPort             = "ORCHESTRATOR_API_PORT"
	EnvBuildNamespace      = "SUMMIT_BUILD_NAMESPACE"
)

// Defaults.
const (
	DefaultAppsDomain        = "localtest.me"
	DefaultTraefikNamespace  = "traefik"
	DefaultServiceCIDR       = "10.96.0.0/12"
	DefaultAPINamespace      = "summit-system"
	DefaultAPIPort           = int32(4000) // internal/config PORT default
	DefaultBuildNamespace    = "summit-builds"
	DefaultESOAPIVersion     = "external-secrets.io/v1"
	DefaultESOServiceAccount = "summit-eso-vault"
	DefaultOpenBaoKVPath     = "secret"
	DefaultOpenBaoKVVersion  = "v2"
	DefaultOpenBaoAuthMount  = "kubernetes"
)

// QuotaConfig is the per-tenant ResourceQuota and LimitRange configuration.
type QuotaConfig struct {
	RequestsCPU            string
	LimitsCPU              string
	RequestsMemory         string
	LimitsMemory           string
	PersistentVolumeClaims string
	Pods                   string

	// LimitRange container defaults.
	DefaultRequestCPU    string
	DefaultRequestMemory string
	DefaultLimitCPU      string
	DefaultLimitMemory   string
}

// DefaultQuotaConfig returns the quota values from implementation plan section 10.1.
// LimitRange defaults mirror workloads.BuildDeployment's baseline resources.
func DefaultQuotaConfig() QuotaConfig {
	return QuotaConfig{
		RequestsCPU:            "4",
		LimitsCPU:              "8",
		RequestsMemory:         "8Gi",
		LimitsMemory:           "16Gi",
		PersistentVolumeClaims: "5",
		Pods:                   "50",
		DefaultRequestCPU:      "50m",
		DefaultRequestMemory:   "64Mi",
		DefaultLimitCPU:        "1000m",
		DefaultLimitMemory:     "512Mi",
	}
}

// Validate checks that every quantity parses.
func (q QuotaConfig) Validate() error {
	for name, v := range map[string]string{
		"requests.cpu": q.RequestsCPU, "limits.cpu": q.LimitsCPU,
		"requests.memory": q.RequestsMemory, "limits.memory": q.LimitsMemory,
		"persistentvolumeclaims": q.PersistentVolumeClaims, "pods": q.Pods,
		"default request cpu": q.DefaultRequestCPU, "default request memory": q.DefaultRequestMemory,
		"default limit cpu": q.DefaultLimitCPU, "default limit memory": q.DefaultLimitMemory,
	} {
		if _, err := resource.ParseQuantity(v); err != nil {
			return fmt.Errorf("addons: invalid quota %s %q: %w", name, v, err)
		}
	}
	return nil
}

// TraefikConfig describes where Traefik runs and how routes are exposed.
type TraefikConfig struct {
	// Namespace and PodLabels select the Traefik pods allowed to reach tenant workloads.
	Namespace string
	PodLabels map[string]string
	// EntryPoints are the Traefik entryPoints used by generated IngressRoutes (web, websecure).
	EntryPoints []string
	// TLSSecretName and CertResolver are optional; with a websecure entryPoint and neither
	// set, an empty tls block is emitted (Traefik's default certificate).
	TLSSecretName string
	CertResolver  string
}

// NetworkConfig holds cluster facts needed by network policies.
type NetworkConfig struct {
	// ServiceCIDR is the cluster Service CIDR, excluded from internet egress.
	ServiceCIDR string
	// DNSNamespace/DNSPodLabels select kube-dns.
	DNSNamespace string
	DNSPodLabels map[string]string
	// APINamespace, APIPodLabels and APIPort identify the control-plane API that builders call back.
	APINamespace string
	APIPodLabels map[string]string
	APIPort      int32
	// BuildNamespace is the namespace of builder pods.
	BuildNamespace string
	// BuilderPodLabels select builder pods (matches build/pod.go).
	BuilderPodLabels map[string]string
	// BuildAllowedFQDNs are the Cilium toFQDNs destinations for builders (port 443).
	BuildAllowedFQDNs []string
}

// DefaultBuildAllowedFQDNs lists the registries and package hosts builders may reach (plan section 9.3,
// plus github.com for source cloning and Docker Hub for base images).
func DefaultBuildAllowedFQDNs() []string {
	return []string{
		"github.com", "api.github.com", "codeload.github.com",
		"ghcr.io", "pkg-containers.githubusercontent.com",
		"registry-1.docker.io", "auth.docker.io", "production.cloudflare.docker.com",
		"registry.npmjs.org", "pypi.org", "files.pythonhosted.org",
		"proxy.golang.org", "sum.golang.org", "crates.io", "static.crates.io", "index.crates.io",
		"deb.debian.org", "security.debian.org",
	}
}

// ESOConfig configures the OpenBao/Vault backed SecretStore.
type ESOConfig struct {
	// APIVersion of external-secrets.io objects.
	APIVersion string
	// StoreName is the SecretStore name created in each tenant namespace.
	StoreName string
	// ServiceAccount is the tenant-namespace ServiceAccount whose token is used for Kubernetes auth.
	ServiceAccount  string
	ServerURL       string
	KVPath          string
	KVVersion       string
	AuthMountPath   string
	Role            string
	RefreshInterval string
}

// Config controls which add-ons are provisioned and how they are shaped.
type Config struct {
	EnableIngress       bool
	EnableNetworkPolicy bool
	NetworkPolicyMode   NetworkPolicyMode
	EnableESO           bool
	EnableTenantQuotas  bool

	AppsDomain string
	Traefik    TraefikConfig
	Network    NetworkConfig
	ESO        ESOConfig
	Quota      QuotaConfig
}

// DefaultConfig returns safe defaults: quotas on, every CRD-backed or policy add-on off.
func DefaultConfig() Config {
	return Config{
		EnableTenantQuotas: true,
		NetworkPolicyMode:  NetworkPolicyNative,
		AppsDomain:         DefaultAppsDomain,
		Traefik: TraefikConfig{
			Namespace:   DefaultTraefikNamespace,
			PodLabels:   map[string]string{"app.kubernetes.io/name": "traefik"},
			EntryPoints: []string{"web"},
		},
		Network: NetworkConfig{
			ServiceCIDR:       DefaultServiceCIDR,
			DNSNamespace:      "kube-system",
			DNSPodLabels:      map[string]string{"k8s-app": "kube-dns"},
			APINamespace:      DefaultAPINamespace,
			APIPodLabels:      map[string]string{"app.kubernetes.io/name": "summit-api"},
			APIPort:           DefaultAPIPort,
			BuildNamespace:    DefaultBuildNamespace,
			BuilderPodLabels:  map[string]string{"summit.dev/component": "builder"},
			BuildAllowedFQDNs: DefaultBuildAllowedFQDNs(),
		},
		ESO: ESOConfig{
			APIVersion:      DefaultESOAPIVersion,
			StoreName:       "openbao-store",
			ServiceAccount:  DefaultESOServiceAccount,
			KVPath:          DefaultOpenBaoKVPath,
			KVVersion:       DefaultOpenBaoKVVersion,
			AuthMountPath:   DefaultOpenBaoAuthMount,
			RefreshInterval: "1h",
		},
		Quota: DefaultQuotaConfig(),
	}
}

// LoadConfigFromEnv builds a Config from the C8 environment variables, using
// DefaultConfig for anything unset.
func LoadConfigFromEnv() Config {
	return loadConfig(os.Getenv)
}

func loadConfig(get func(string) string) Config {
	cfg := DefaultConfig()
	str := func(key string, dst *string) {
		if v := strings.TrimSpace(get(key)); v != "" {
			*dst = v
		}
	}
	flag := func(key string, dst *bool) {
		if v := strings.TrimSpace(get(key)); v != "" {
			*dst = strings.EqualFold(v, "true") || v == "1"
		}
	}

	flag(EnvEnableIngress, &cfg.EnableIngress)
	flag(EnvEnableNetworkPolicy, &cfg.EnableNetworkPolicy)
	flag(EnvEnableESO, &cfg.EnableESO)
	flag(EnvEnableTenantQuotas, &cfg.EnableTenantQuotas)

	if v := strings.ToLower(strings.TrimSpace(get(EnvNetworkPolicyMode))); v != "" {
		cfg.NetworkPolicyMode = NetworkPolicyMode(v) // validated by Config.Validate
	}
	str(EnvAppsDomain, &cfg.AppsDomain)
	str(EnvTraefikNamespace, &cfg.Traefik.Namespace)
	if v := strings.TrimSpace(get(EnvTraefikEntryPoints)); v != "" {
		cfg.Traefik.EntryPoints = splitList(v)
	}
	str(EnvIngressTLSSecret, &cfg.Traefik.TLSSecretName)
	str(EnvIngressCertResolver, &cfg.Traefik.CertResolver)

	str(EnvESOAPIVersion, &cfg.ESO.APIVersion)
	str(EnvESOServiceAccount, &cfg.ESO.ServiceAccount)
	str(EnvOpenBaoServerURL, &cfg.ESO.ServerURL)
	str(EnvOpenBaoRole, &cfg.ESO.Role)
	str(EnvOpenBaoKVPath, &cfg.ESO.KVPath)
	str(EnvOpenBaoKVVersion, &cfg.ESO.KVVersion)
	str(EnvOpenBaoAuthMount, &cfg.ESO.AuthMountPath)

	str(EnvServiceCIDR, &cfg.Network.ServiceCIDR)
	str(EnvAPINamespace, &cfg.Network.APINamespace)
	str(EnvBuildNamespace, &cfg.Network.BuildNamespace)
	if v := strings.TrimSpace(get(EnvAPIPort)); v != "" {
		var p int
		if _, err := fmt.Sscanf(v, "%d", &p); err == nil && p > 0 && p <= 65535 {
			cfg.Network.APIPort = int32(p)
		}
	}
	return cfg
}

func splitList(v string) []string {
	var out []string
	for _, part := range strings.Split(v, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// Validate checks the configuration for the enabled add-ons.
func (c Config) Validate() error {
	if c.EnableNetworkPolicy {
		switch c.NetworkPolicyMode {
		case NetworkPolicyNative, NetworkPolicyCilium:
		default:
			return fmt.Errorf("addons: unsupported network policy mode %q (want native or cilium)", c.NetworkPolicyMode)
		}
		if err := validateCIDR(c.Network.ServiceCIDR); err != nil {
			return fmt.Errorf("addons: service CIDR: %w", err)
		}
		if c.Network.APIPort < 1 {
			return fmt.Errorf("addons: API port must be positive")
		}
	}
	if c.EnableIngress {
		if errs := validation.IsDNS1123Subdomain(c.AppsDomain); len(errs) > 0 {
			return fmt.Errorf("addons: invalid apps domain %q: %s", c.AppsDomain, strings.Join(errs, "; "))
		}
		if len(c.Traefik.EntryPoints) == 0 {
			return fmt.Errorf("addons: at least one Traefik entryPoint is required")
		}
	}
	if c.EnableESO {
		if strings.TrimSpace(c.ESO.ServerURL) == "" || strings.TrimSpace(c.ESO.Role) == "" {
			return fmt.Errorf("addons: ESO requires %s and %s", EnvOpenBaoServerURL, EnvOpenBaoRole)
		}
	}
	if c.EnableTenantQuotas {
		return c.Quota.Validate()
	}
	return nil
}
