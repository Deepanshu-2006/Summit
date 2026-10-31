package addons

import (
	"strings"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// Native NetworkPolicy names.
const (
	PolicyDefaultDeny      = "default-deny-all"
	PolicyAllowDNS         = "allow-dns-egress"
	PolicyAllowInternet    = "allow-internet-egress"
	PolicyAllowTraefik     = "allow-traefik-ingress"
	PolicyBuilderEgress    = "builder-egress"
	PolicyCiliumTenantBase = "tenant-baseline"

	namespaceNameLabel = "kubernetes.io/metadata.name"
)

// PrivateAndMetadataCIDRs are never reachable from the internet-egress rules:
// RFC1918 ranges and the link-local range that holds the cloud metadata IP 169.254.169.254.
var PrivateAndMetadataCIDRs = []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16"}

// ExceptCIDRs returns PrivateAndMetadataCIDRs plus the cluster Service CIDR (deduplicated, stable order).
func ExceptCIDRs(serviceCIDR string) []string {
	out := append([]string(nil), PrivateAndMetadataCIDRs...)
	if c := strings.TrimSpace(serviceCIDR); c != "" {
		dup := false
		for _, e := range out {
			if e == c {
				dup = true
			}
		}
		if !dup {
			out = append(out, c)
		}
	}
	return out
}

func tcp(port int32) networkingv1.NetworkPolicyPort {
	proto := corev1.ProtocolTCP
	p := intstr.FromInt32(port)
	return networkingv1.NetworkPolicyPort{Protocol: &proto, Port: &p}
}

func udp(port int32) networkingv1.NetworkPolicyPort {
	proto := corev1.ProtocolUDP
	p := intstr.FromInt32(port)
	return networkingv1.NetworkPolicyPort{Protocol: &proto, Port: &p}
}

func nsSelector(name string) *metav1.LabelSelector {
	return &metav1.LabelSelector{MatchLabels: map[string]string{namespaceNameLabel: name}}
}

func podSelector(labels map[string]string) *metav1.LabelSelector {
	return &metav1.LabelSelector{MatchLabels: copyMap(labels)}
}

func copyMap(in map[string]string) map[string]string {
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func dnsPeerAndPorts(n NetworkConfig) networkingv1.NetworkPolicyEgressRule {
	return networkingv1.NetworkPolicyEgressRule{
		To: []networkingv1.NetworkPolicyPeer{{
			NamespaceSelector: nsSelector(n.DNSNamespace),
			PodSelector:       podSelector(n.DNSPodLabels),
		}},
		Ports: []networkingv1.NetworkPolicyPort{udp(53), tcp(53)},
	}
}

func netpol(namespace, name string, selector *metav1.LabelSelector, types ...networkingv1.PolicyType) *networkingv1.NetworkPolicy {
	return &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: namespace},
		Spec:       networkingv1.NetworkPolicySpec{PodSelector: *selector, PolicyTypes: types},
	}
}

// TenantDefaultDenyPolicy denies all ingress and egress for every pod in the tenant namespace.
func TenantDefaultDenyPolicy(namespace string, owner Owner) *networkingv1.NetworkPolicy {
	np := netpol(namespace, PolicyDefaultDeny, &metav1.LabelSelector{},
		networkingv1.PolicyTypeIngress, networkingv1.PolicyTypeEgress)
	stampTyped(&np.ObjectMeta, owner)
	return np
}

// TenantAllowDNSPolicy allows DNS egress to kube-dns in kube-system.
func TenantAllowDNSPolicy(namespace string, n NetworkConfig, owner Owner) *networkingv1.NetworkPolicy {
	np := netpol(namespace, PolicyAllowDNS, &metav1.LabelSelector{}, networkingv1.PolicyTypeEgress)
	np.Spec.Egress = []networkingv1.NetworkPolicyEgressRule{dnsPeerAndPorts(n)}
	stampTyped(&np.ObjectMeta, owner)
	return np
}

// TenantAllowInternetEgressPolicy allows 443/80 egress to the internet, excluding RFC1918,
// link-local (metadata) and the Service CIDR. Cross-tenant and control-plane pod traffic is
// therefore blocked (pod and Service networks live in the excluded private ranges).
func TenantAllowInternetEgressPolicy(namespace string, n NetworkConfig, owner Owner) *networkingv1.NetworkPolicy {
	np := netpol(namespace, PolicyAllowInternet, &metav1.LabelSelector{}, networkingv1.PolicyTypeEgress)
	np.Spec.Egress = []networkingv1.NetworkPolicyEgressRule{{
		To: []networkingv1.NetworkPolicyPeer{{IPBlock: &networkingv1.IPBlock{
			CIDR:   "0.0.0.0/0",
			Except: ExceptCIDRs(n.ServiceCIDR),
		}}},
		Ports: []networkingv1.NetworkPolicyPort{tcp(443), tcp(80)},
	}}
	stampTyped(&np.ObjectMeta, owner)
	return np
}

// AllowTraefikIngressPolicy allows ingress to the selected pods on the given port only from
// Traefik pods in the Traefik namespace. Namespace and pod selectors sit in a single peer, so
// both must match. A nil selector (or empty map) selects every pod in the namespace.
func AllowTraefikIngressPolicy(namespace, name string, pods map[string]string, port int32, t TraefikConfig, owner Owner) *networkingv1.NetworkPolicy {
	sel := &metav1.LabelSelector{}
	if len(pods) > 0 {
		sel = podSelector(pods)
	}
	np := netpol(namespace, name, sel, networkingv1.PolicyTypeIngress)
	np.Spec.Ingress = []networkingv1.NetworkPolicyIngressRule{{
		From: []networkingv1.NetworkPolicyPeer{{
			NamespaceSelector: nsSelector(t.Namespace),
			PodSelector:       podSelector(t.PodLabels),
		}},
		Ports: []networkingv1.NetworkPolicyPort{tcp(port)},
	}}
	stampTyped(&np.ObjectMeta, owner)
	return np
}

// ServiceIngressPolicyName is the per-service Traefik ingress policy name.
func ServiceIngressPolicyName(serviceName string) string {
	return PolicyAllowTraefik + "-" + dnsLabel(serviceName)
}

// TenantNetworkPolicies returns the baseline native policy set for a tenant namespace:
// default deny, DNS egress, internet egress, and Traefik ingress to appPort for all pods.
func TenantNetworkPolicies(namespace string, cfg Config, appPort int32, owner Owner) []*networkingv1.NetworkPolicy {
	return []*networkingv1.NetworkPolicy{
		TenantDefaultDenyPolicy(namespace, owner),
		TenantAllowDNSPolicy(namespace, cfg.Network, owner),
		TenantAllowInternetEgressPolicy(namespace, cfg.Network, owner),
		AllowTraefikIngressPolicy(namespace, PolicyAllowTraefik, nil, appPort, cfg.Traefik, owner),
	}
}

// BuilderNetworkPolicy locks down builder pods in the build namespace: no ingress; egress only to
// DNS, HTTPS (443) on the internet excluding private/link-local/service ranges, and the
// control-plane API pods (callback + source-token broker).
func BuilderNetworkPolicy(n NetworkConfig) *networkingv1.NetworkPolicy {
	np := netpol(n.BuildNamespace, PolicyBuilderEgress, podSelector(n.BuilderPodLabels),
		networkingv1.PolicyTypeIngress, networkingv1.PolicyTypeEgress)
	np.Spec.Ingress = nil // deny all ingress
	np.Spec.Egress = []networkingv1.NetworkPolicyEgressRule{
		dnsPeerAndPorts(n),
		{
			To: []networkingv1.NetworkPolicyPeer{{IPBlock: &networkingv1.IPBlock{
				CIDR:   "0.0.0.0/0",
				Except: ExceptCIDRs(n.ServiceCIDR),
			}}},
			Ports: []networkingv1.NetworkPolicyPort{tcp(443)},
		},
		{
			To: []networkingv1.NetworkPolicyPeer{{
				NamespaceSelector: nsSelector(n.APINamespace),
				PodSelector:       podSelector(n.APIPodLabels),
			}},
			Ports: []networkingv1.NetworkPolicyPort{tcp(n.APIPort)},
		},
	}
	np.Labels = Owner{}.Labels()
	return np
}
