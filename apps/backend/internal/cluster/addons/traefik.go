package addons

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	// TraefikAPIVersion is the Traefik CRD API version (the traefik.containo.us group is legacy).
	TraefikAPIVersion = "traefik.io/v1alpha1"
	KindIngressRoute  = "IngressRoute"
	KindMiddleware    = "Middleware"
)

// IngressParams describes one service route.
type IngressParams struct {
	Namespace   string
	Name        string // IngressRoute name (usually the Service name)
	Host        string
	ServiceName string
	ServicePort int32
	EntryPoints []string
	// TLSSecretName and CertResolver are optional.
	TLSSecretName string
	CertResolver  string
	// Middlewares are same-namespace Middleware names applied in order.
	Middlewares []string
	Owner       Owner
}

// SecurityHeadersMiddlewareName is the per-service headers Middleware name.
func SecurityHeadersMiddlewareName(serviceName string) string {
	return dnsLabel(serviceName) + "-security-headers"
}

// IngressRoute builds a Traefik IngressRoute routing Host(`host`) to a Service.
func IngressRoute(p IngressParams) (*unstructured.Unstructured, error) {
	switch {
	case p.Namespace == "" || p.Name == "" || p.ServiceName == "":
		return nil, fmt.Errorf("addons: ingress route requires namespace, name and service name")
	case p.Host == "" || strings.ContainsAny(p.Host, "`\"\\ "):
		return nil, fmt.Errorf("addons: invalid ingress host %q", p.Host)
	case p.ServicePort < 1 || p.ServicePort > 65535:
		return nil, fmt.Errorf("addons: invalid service port %d", p.ServicePort)
	case len(p.EntryPoints) == 0:
		return nil, fmt.Errorf("addons: at least one entryPoint is required")
	}

	mws := make([]any, 0, len(p.Middlewares))
	for _, m := range p.Middlewares {
		mws = append(mws, map[string]any{"name": m})
	}
	route := map[string]any{
		"kind":  "Rule",
		"match": fmt.Sprintf("Host(`%s`)", p.Host),
		"services": []any{map[string]any{
			"name": p.ServiceName,
			"port": int64(p.ServicePort),
			"kind": "Service",
		}},
	}
	if len(mws) > 0 {
		route["middlewares"] = mws
	}

	spec := map[string]any{
		"entryPoints": strSlice(p.EntryPoints),
		"routes":      []any{route},
	}
	if tls := ingressTLS(p); tls != nil {
		spec["tls"] = tls
	}

	u := newUnstructured(TraefikAPIVersion, KindIngressRoute, p.Namespace, p.Name)
	u.Object["spec"] = spec
	p.Owner.Stamp(u)
	return u, nil
}

// ingressTLS returns the tls block: an explicit secret and/or cert resolver, or an empty block
// (default certificate) when a websecure entryPoint is used without either.
func ingressTLS(p IngressParams) map[string]any {
	tls := map[string]any{}
	if p.TLSSecretName != "" {
		tls["secretName"] = p.TLSSecretName
	}
	if p.CertResolver != "" {
		tls["certResolver"] = p.CertResolver
	}
	if len(tls) > 0 {
		return tls
	}
	for _, ep := range p.EntryPoints {
		if ep == "websecure" {
			return tls
		}
	}
	return nil
}

// SecurityHeadersMiddleware builds a Traefik headers Middleware with conservative security headers.
func SecurityHeadersMiddleware(namespace, serviceName string, owner Owner) *unstructured.Unstructured {
	u := newUnstructured(TraefikAPIVersion, KindMiddleware, namespace, SecurityHeadersMiddlewareName(serviceName))
	u.Object["spec"] = map[string]any{
		"headers": map[string]any{
			"frameDeny":            true,
			"contentTypeNosniff":   true,
			"stsSeconds":           int64(31536000),
			"stsIncludeSubdomains": true,
			"referrerPolicy":       "strict-origin-when-cross-origin",
			"customResponseHeaders": map[string]any{
				"X-Powered-By": "",
				"Server":       "",
			},
		},
	}
	owner.Stamp(u)
	return u
}
