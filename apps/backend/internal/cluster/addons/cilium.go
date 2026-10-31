package addons

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	// CiliumAPIVersion and CiliumKind identify CiliumNetworkPolicy.
	CiliumAPIVersion = "cilium.io/v2"
	CiliumKind       = "CiliumNetworkPolicy"

	ciliumNamespaceLabel = "k8s:io.kubernetes.pod.namespace"
)

func ciliumEndpoint(namespace string, podLabels map[string]string, prefixPodLabels bool) map[string]any {
	m := map[string]any{ciliumNamespaceLabel: namespace}
	for k, v := range podLabels {
		if prefixPodLabels {
			m["k8s:"+k] = v
		} else {
			m[k] = v
		}
	}
	return map[string]any{"matchLabels": m}
}

func ciliumExcept(serviceCIDR string) map[string]any {
	return map[string]any{"cidr": "0.0.0.0/0", "except": strSlice(ExceptCIDRs(serviceCIDR))}
}

func ciliumDNSRule(n NetworkConfig) map[string]any {
	return map[string]any{
		"toEndpoints": []any{ciliumEndpoint(n.DNSNamespace, n.DNSPodLabels, true)},
		"toPorts": []any{map[string]any{
			"ports": []any{portEntry(53, "UDP"), portEntry(53, "TCP")},
			// L7 DNS visibility is required for toFQDNs to learn IPs; "*" allows any name.
			"rules": map[string]any{"dns": []any{map[string]any{"matchPattern": "*"}}},
		}},
	}
}

// CiliumTenantPolicy is the CiliumNetworkPolicy equivalent of TenantNetworkPolicies: every pod in
// the namespace gets default-deny in both directions with explicit allows for Traefik ingress on
// appPort, DNS, and internet 443/80 excluding private, link-local and Service ranges.
func CiliumTenantPolicy(namespace string, cfg Config, appPort int32, owner Owner) *unstructured.Unstructured {
	u := newUnstructured(CiliumAPIVersion, CiliumKind, namespace, PolicyCiliumTenantBase)
	u.Object["spec"] = map[string]any{
		"endpointSelector": map[string]any{},
		"ingress": []any{map[string]any{
			"fromEndpoints": []any{ciliumEndpoint(cfg.Traefik.Namespace, cfg.Traefik.PodLabels, false)},
			"toPorts":       []any{map[string]any{"ports": []any{portEntry(appPort, "TCP")}}},
		}},
		"egress": []any{
			ciliumDNSRule(cfg.Network),
			map[string]any{
				"toCIDRSet": []any{ciliumExcept(cfg.Network.ServiceCIDR)},
				"toPorts":   []any{map[string]any{"ports": []any{portEntry(443, "TCP"), portEntry(80, "TCP")}}},
			},
		},
	}
	owner.Stamp(u)
	return u
}

// CiliumBuilderPolicy is the CiliumNetworkPolicy for builder pods (plan section 9.3): no ingress
// (an empty ingress rule is Cilium's explicit deny-all), egress only to DNS, the allowed registry
// and package FQDNs on 443, and the control-plane API pods.
func CiliumBuilderPolicy(n NetworkConfig) *unstructured.Unstructured {
	u := newUnstructured(CiliumAPIVersion, CiliumKind, n.BuildNamespace, PolicyBuilderEgress)
	fqdns := make([]any, 0, len(n.BuildAllowedFQDNs))
	for _, f := range n.BuildAllowedFQDNs {
		fqdns = append(fqdns, map[string]any{"matchName": f})
	}
	egress := []any{
		ciliumDNSRule(n),
		map[string]any{
			"toEndpoints": []any{ciliumEndpoint(n.APINamespace, n.APIPodLabels, false)},
			"toPorts":     []any{map[string]any{"ports": []any{portEntry(n.APIPort, "TCP")}}},
		},
	}
	if len(fqdns) > 0 {
		egress = append(egress, map[string]any{
			"toFQDNs": fqdns,
			"toPorts": []any{map[string]any{"ports": []any{portEntry(443, "TCP")}}},
		})
	}
	u.Object["spec"] = map[string]any{
		"endpointSelector": map[string]any{"matchLabels": strMap(n.BuilderPodLabels)},
		"ingress":          []any{map[string]any{}},
		"egress":           egress,
	}
	Owner{}.Stamp(u)
	return u
}

// CiliumServiceIngressPolicy allows Traefik ingress to one service's pods on its port. It is needed
// in addition to CiliumTenantPolicy only when a service listens on a port other than the tenant default.
func CiliumServiceIngressPolicy(namespace, serviceName string, pods map[string]string, port int32, t TraefikConfig, owner Owner) *unstructured.Unstructured {
	u := newUnstructured(CiliumAPIVersion, CiliumKind, namespace, ServiceIngressPolicyName(serviceName))
	u.Object["spec"] = map[string]any{
		"endpointSelector": map[string]any{"matchLabels": strMap(pods)},
		"ingress": []any{map[string]any{
			"fromEndpoints": []any{ciliumEndpoint(t.Namespace, t.PodLabels, false)},
			"toPorts":       []any{map[string]any{"ports": []any{portEntry(port, "TCP")}}},
		}},
	}
	owner.Stamp(u)
	return u
}
