package addons

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"

	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation"
	dynamicfake "k8s.io/client-go/dynamic/fake"
	clienttesting "k8s.io/client-go/testing"

	"github.com/summit/backend/internal/cluster/workloads"
)

const (
	testUser    = "0F1E2D3C-AAAA-4BBB-8CCC-123456789ABC"
	testUserLow = "0f1e2d3c-aaaa-4bbb-8ccc-123456789abc"
	testNS      = "tenant-" + testUserLow
)

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// recorder is an ObjectApplier that records applied objects and can mark kinds unavailable.
type recorder struct {
	objs        []*unstructured.Unstructured
	unavailable map[string]bool // kind -> unavailable
	failKind    string
}

func (r *recorder) Apply(_ context.Context, obj *unstructured.Unstructured) error {
	if r.unavailable[obj.GetKind()] {
		return fmt.Errorf("%w: %s", ErrAddonUnavailable, obj.GetKind())
	}
	if r.failKind == obj.GetKind() {
		return errors.New("boom")
	}
	r.objs = append(r.objs, obj.DeepCopy())
	return nil
}

func (r *recorder) find(kind, name string) *unstructured.Unstructured {
	for _, o := range r.objs {
		if o.GetKind() == kind && (name == "" || o.GetName() == name) {
			return o
		}
	}
	return nil
}

func (r *recorder) kinds() []string {
	var out []string
	for _, o := range r.objs {
		out = append(out, o.GetKind()+"/"+o.GetName())
	}
	return out
}

func nested[T any](t *testing.T, obj map[string]any, fields ...string) T {
	t.Helper()
	v, found, err := unstructured.NestedFieldNoCopy(obj, fields...)
	if err != nil || !found {
		t.Fatalf("field %v not found: %v", fields, err)
	}
	out, ok := v.(T)
	if !ok {
		t.Fatalf("field %v has type %T", fields, v)
	}
	return out
}

func allOn() Config {
	c := DefaultConfig()
	c.EnableIngress, c.EnableNetworkPolicy, c.EnableESO = true, true, true
	c.ESO.ServerURL = "http://openbao.openbao.svc:8200"
	c.ESO.Role = "summit-tenant"
	return c
}

// ---- names ----

func TestTenantNamespaceName(t *testing.T) {
	got, err := TenantNamespaceName(testUser)
	if err != nil || got != testNS {
		t.Fatalf("got %q, %v", got, err)
	}
	for _, bad := range []string{"", "  ", "has space", "under_score", strings.Repeat("a", 60)} {
		if _, err := TenantNamespaceName(bad); !errors.Is(err, ErrInvalidName) {
			t.Errorf("%q: want ErrInvalidName, got %v", bad, err)
		}
	}
}

func TestServiceHost(t *testing.T) {
	cases := []struct{ svc, proj, env, domain, want string }{
		{"api", "my-project", "", "localtest.me", "api-my-project.localtest.me"},
		{"api", "my-project", "production", "localtest.me", "api-my-project.localtest.me"},
		{"api", "my-project", "Production", "localtest.me", "api-my-project.localtest.me"},
		{"api", "my-project", "staging", "localtest.me", "api-my-project-staging.localtest.me"},
		{"My_API", "Shop 2.0", "Feature/One", "Apps.Example.com.", "my-api-shop-2-0-feature-one.apps.example.com"},
		{"api", "", "preview", "localtest.me", "api-preview.localtest.me"},
	}
	for _, c := range cases {
		got, err := ServiceHost(c.svc, c.proj, c.env, c.domain)
		if err != nil || got != c.want {
			t.Errorf("ServiceHost(%q,%q,%q,%q)=%q,%v want %q", c.svc, c.proj, c.env, c.domain, got, err, c.want)
		}
	}
	prod, err := ServiceHost("api", "shop", "production", "localtest.me")
	if err != nil {
		t.Fatal(err)
	}
	stage, err := ServiceHost("api", "shop", "staging", "localtest.me")
	if err != nil {
		t.Fatal(err)
	}
	if prod == stage {
		t.Fatalf("production and staging hosts collided: %s", prod)
	}

	long1, err := ServiceHost("svc-"+strings.Repeat("a", 40), "project-"+strings.Repeat("b", 40), "", "localtest.me")
	if err != nil {
		t.Fatal(err)
	}
	long2, _ := ServiceHost("svc-"+strings.Repeat("a", 40), "project-"+strings.Repeat("b", 39)+"c", "staging", "localtest.me")
	label := strings.SplitN(long1, ".", 2)[0]
	if len(label) > 63 || len(validation.IsDNS1123Label(label)) > 0 {
		t.Errorf("invalid long label %q (%d)", label, len(label))
	}
	if long1 == long2 {
		t.Error("distinct long inputs collided")
	}

	for _, bad := range [][4]string{{"", "p", "", "localtest.me"}, {"!!!", "p", "", "localtest.me"}, {"a", "p", "", ""}, {"a", "p", "", "bad_domain"}} {
		if _, err := ServiceHost(bad[0], bad[1], bad[2], bad[3]); err == nil {
			t.Errorf("%v accepted", bad)
		}
	}
}

// ---- tenant ----

func TestTenantNamespaceLabels(t *testing.T) {
	ns, err := TenantNamespace(testUser)
	if err != nil {
		t.Fatal(err)
	}
	if ns.Name != testNS {
		t.Errorf("name %q", ns.Name)
	}
	want := map[string]string{
		workloads.LabelTenant:    testUserLow,
		workloads.LabelManagedBy: workloads.ValueManagedBy,
		LabelPSAEnforce:          "restricted",
		LabelPSAAudit:            "restricted",
		LabelPSAWarn:             "restricted",
	}
	for k, v := range want {
		if ns.Labels[k] != v {
			t.Errorf("label %s=%q want %q", k, ns.Labels[k], v)
		}
	}
}

func TestQuotaAndLimitRangeDefaults(t *testing.T) {
	rq, err := TenantResourceQuota(testNS, DefaultQuotaConfig(), Owner{Tenant: testUserLow})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"requests.cpu": "4", "limits.cpu": "8", "requests.memory": "8Gi", "limits.memory": "16Gi",
		"persistentvolumeclaims": "5", "pods": "50",
	}
	if len(rq.Spec.Hard) != len(want) {
		t.Errorf("hard has %d entries", len(rq.Spec.Hard))
	}
	for k, v := range want {
		q := rq.Spec.Hard[corev1ResourceName(k)]
		if q.String() != v {
			t.Errorf("%s=%s want %s", k, q.String(), v)
		}
	}
	lr, err := TenantLimitRange(testNS, DefaultQuotaConfig(), Owner{})
	if err != nil {
		t.Fatal(err)
	}
	item := lr.Spec.Limits[0]
	if item.Type != "Container" || item.Default.Cpu().String() != "1" || item.DefaultRequest.Memory().String() != "64Mi" {
		t.Errorf("unexpected limit range item: %+v", item)
	}

	bad := DefaultQuotaConfig()
	bad.Pods = "many"
	if _, err := TenantResourceQuota(testNS, bad, Owner{}); err == nil {
		t.Error("invalid quota accepted")
	}
	bad = DefaultQuotaConfig()
	bad.DefaultRequestCPU = "4"
	if _, err := TenantLimitRange(testNS, bad, Owner{}); err == nil {
		t.Error("request > limit accepted")
	}
}

// ---- network policies ----

func TestExceptCIDRs(t *testing.T) {
	got := ExceptCIDRs("10.96.0.0/12")
	for _, must := range []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "169.254.0.0/16", "10.96.0.0/12"} {
		found := false
		for _, g := range got {
			found = found || g == must
		}
		if !found {
			t.Errorf("missing %s in %v", must, got)
		}
	}
	if len(ExceptCIDRs("10.0.0.0/8")) != 4 {
		t.Error("duplicate CIDR not deduplicated")
	}
}

func TestTenantNativePolicies(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Network.ServiceCIDR = "100.64.0.0/16"
	pols := TenantNetworkPolicies(testNS, cfg, 8080, Owner{Tenant: testUserLow})
	byName := map[string]*networkingv1.NetworkPolicy{}
	for _, p := range pols {
		byName[p.Name] = p
		if p.Namespace != testNS || p.Labels[workloads.LabelManagedBy] != workloads.ValueManagedBy {
			t.Errorf("%s: namespace/labels wrong: %+v", p.Name, p.ObjectMeta)
		}
	}

	deny := byName[PolicyDefaultDeny]
	if len(deny.Spec.PodSelector.MatchLabels) != 0 || len(deny.Spec.PolicyTypes) != 2 || len(deny.Spec.Ingress) != 0 || len(deny.Spec.Egress) != 0 {
		t.Errorf("default deny wrong: %+v", deny.Spec)
	}

	dns := byName[PolicyAllowDNS].Spec.Egress[0]
	if dns.To[0].NamespaceSelector.MatchLabels[namespaceNameLabel] != "kube-system" ||
		dns.To[0].PodSelector.MatchLabels["k8s-app"] != "kube-dns" || len(dns.Ports) != 2 {
		t.Errorf("dns rule wrong: %+v", dns)
	}

	inet := byName[PolicyAllowInternet].Spec.Egress[0]
	ib := inet.To[0].IPBlock
	if ib.CIDR != "0.0.0.0/0" || !contains(ib.Except, "169.254.0.0/16") || !contains(ib.Except, "100.64.0.0/16") || !contains(ib.Except, "10.0.0.0/8") {
		t.Errorf("internet except wrong: %+v", ib)
	}
	if len(inet.Ports) != 2 || inet.Ports[0].Port.IntValue() != 443 || inet.Ports[1].Port.IntValue() != 80 {
		t.Errorf("internet ports wrong: %+v", inet.Ports)
	}

	in := byName[PolicyAllowTraefik].Spec.Ingress[0]
	peer := in.From[0]
	if peer.NamespaceSelector.MatchLabels[namespaceNameLabel] != "traefik" ||
		peer.PodSelector.MatchLabels["app.kubernetes.io/name"] != "traefik" || len(in.From) != 1 {
		t.Errorf("traefik peer wrong: %+v", in.From)
	}
	if in.Ports[0].Port.IntValue() != 8080 {
		t.Errorf("ingress port wrong")
	}
}

func TestBuilderNativePolicy(t *testing.T) {
	np := BuilderNetworkPolicy(DefaultConfig().Network)
	if np.Namespace != "summit-builds" || np.Spec.PodSelector.MatchLabels["summit.dev/component"] != "builder" {
		t.Errorf("selector/ns wrong: %+v", np.ObjectMeta)
	}
	if len(np.Spec.Ingress) != 0 || len(np.Spec.PolicyTypes) != 2 {
		t.Errorf("ingress must be denied: %+v", np.Spec)
	}
	if len(np.Spec.Egress) != 3 {
		t.Fatalf("want 3 egress rules, got %d", len(np.Spec.Egress))
	}
	inet := np.Spec.Egress[1]
	if len(inet.Ports) != 2 || inet.Ports[0].Port.IntValue() != 80 || inet.Ports[1].Port.IntValue() != 443 || !contains(inet.To[0].IPBlock.Except, "169.254.0.0/16") {
		t.Errorf("internet rule wrong: %+v", inet)
	}
	api := np.Spec.Egress[2]
	if api.To[0].NamespaceSelector.MatchLabels[namespaceNameLabel] != "summit-system" ||
		api.To[0].PodSelector.MatchLabels["app.kubernetes.io/name"] != "summit-api" ||
		api.Ports[0].Port.IntValue() != 4000 {
		t.Errorf("api rule wrong: %+v", api)
	}
}

func TestCiliumPolicies(t *testing.T) {
	cfg := DefaultConfig()
	tenant := CiliumTenantPolicy(testNS, cfg, 8080, Owner{Tenant: testUserLow})
	if tenant.GetAPIVersion() != "cilium.io/v2" || tenant.GetKind() != "CiliumNetworkPolicy" || tenant.GetNamespace() != testNS {
		t.Errorf("identity wrong: %v", tenant.Object)
	}
	ingress := nested[[]any](t, tenant.Object, "spec", "ingress")
	from := nested[[]any](t, ingress[0].(map[string]any), "fromEndpoints")
	labels := from[0].(map[string]any)["matchLabels"].(map[string]any)
	if labels[ciliumNamespaceLabel] != "traefik" || labels["app.kubernetes.io/name"] != "traefik" {
		t.Errorf("from endpoints wrong: %v", labels)
	}
	egress := nested[[]any](t, tenant.Object, "spec", "egress")
	cidr := egress[1].(map[string]any)["toCIDRSet"].([]any)[0].(map[string]any)
	if cidr["cidr"] != "0.0.0.0/0" || len(cidr["except"].([]any)) < 5 {
		t.Errorf("cidr set wrong: %v", cidr)
	}

	build := CiliumBuilderPolicy(cfg.Network)
	spec := nested[map[string]any](t, build.Object, "spec")
	if len(spec["ingress"].([]any)) != 1 || len(spec["ingress"].([]any)[0].(map[string]any)) != 0 {
		t.Errorf("ingress must be a single empty deny-all rule: %v", spec["ingress"])
	}
	var fqdns []string
	for _, r := range spec["egress"].([]any) {
		if f, ok := r.(map[string]any)["toFQDNs"]; ok {
			for _, e := range f.([]any) {
				fqdns = append(fqdns, e.(map[string]any)["matchName"].(string))
			}
		}
	}
	for _, want := range []string{"ghcr.io", "registry.npmjs.org", "pypi.org", "proxy.golang.org", "crates.io", "github.com", "deb.debian.org", "security.debian.org"} {
		if !contains(fqdns, want) {
			t.Errorf("fqdn %s missing from %v", want, fqdns)
		}
	}
	if build.GetNamespace() != "summit-builds" {
		t.Errorf("build ns %q", build.GetNamespace())
	}
}

// ---- traefik / eso ----

func TestIngressRoute(t *testing.T) {
	r, err := IngressRoute(IngressParams{
		Namespace: testNS, Name: "svc-1", Host: "svc-1-shop.localtest.me", ServiceName: "svc-1", ServicePort: 8080,
		EntryPoints: []string{"web", "websecure"}, TLSSecretName: "wild-tls", Middlewares: []string{"svc-1-security-headers"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if r.GetAPIVersion() != "traefik.io/v1alpha1" || r.GetKind() != "IngressRoute" {
		t.Errorf("identity wrong")
	}
	routes := nested[[]any](t, r.Object, "spec", "routes")
	route := routes[0].(map[string]any)
	if route["match"] != "Host(`svc-1-shop.localtest.me`)" {
		t.Errorf("match=%v", route["match"])
	}
	svc := route["services"].([]any)[0].(map[string]any)
	if svc["name"] != "svc-1" || svc["port"] != int64(8080) {
		t.Errorf("service ref wrong: %v", svc)
	}
	if nested[map[string]any](t, r.Object, "spec", "tls")["secretName"] != "wild-tls" {
		t.Error("tls secret missing")
	}

	// web only: no tls. websecure only without secret: empty tls block.
	web, _ := IngressRoute(IngressParams{Namespace: "n", Name: "a", Host: "a.b", ServiceName: "a", ServicePort: 80, EntryPoints: []string{"web"}})
	if _, found, _ := unstructured.NestedFieldNoCopy(web.Object, "spec", "tls"); found {
		t.Error("tls must be omitted for web-only")
	}
	sec, _ := IngressRoute(IngressParams{Namespace: "n", Name: "a", Host: "a.b", ServiceName: "a", ServicePort: 80, EntryPoints: []string{"websecure"}, CertResolver: "le"})
	if nested[map[string]any](t, sec.Object, "spec", "tls")["certResolver"] != "le" {
		t.Error("cert resolver missing")
	}

	for _, bad := range []IngressParams{
		{Name: "a", Host: "h", ServiceName: "a", ServicePort: 80, EntryPoints: []string{"web"}},
		{Namespace: "n", Name: "a", Host: "h`) || Host(`evil", ServiceName: "a", ServicePort: 80, EntryPoints: []string{"web"}},
		{Namespace: "n", Name: "a", Host: "h", ServiceName: "a", ServicePort: 0, EntryPoints: []string{"web"}},
		{Namespace: "n", Name: "a", Host: "h", ServiceName: "a", ServicePort: 80},
	} {
		if _, err := IngressRoute(bad); err == nil {
			t.Errorf("accepted invalid %+v", bad)
		}
	}
}

func TestSecurityHeadersMiddleware(t *testing.T) {
	m := SecurityHeadersMiddleware(testNS, "Svc_1", Owner{})
	if m.GetKind() != "Middleware" || m.GetName() != "svc-1-security-headers" {
		t.Errorf("identity %s/%s", m.GetKind(), m.GetName())
	}
	h := nested[map[string]any](t, m.Object, "spec", "headers")
	if h["frameDeny"] != true || h["contentTypeNosniff"] != true || h["stsSeconds"] != int64(31536000) {
		t.Errorf("headers wrong: %v", h)
	}
}

func TestESOObjects(t *testing.T) {
	cfg := allOn()
	store, err := SecretStore(testNS, cfg.ESO, Owner{})
	if err != nil {
		t.Fatal(err)
	}
	if store.GetAPIVersion() != "external-secrets.io/v1" || store.GetKind() != "SecretStore" {
		t.Errorf("identity wrong: %s %s", store.GetAPIVersion(), store.GetKind())
	}
	vault := nested[map[string]any](t, store.Object, "spec", "provider", "vault")
	k8s := nested[map[string]any](t, vault, "auth", "kubernetes")
	if vault["server"] != cfg.ESO.ServerURL || vault["path"] != "secret" || vault["version"] != "v2" ||
		k8s["role"] != "summit-tenant" || k8s["mountPath"] != "kubernetes" ||
		k8s["serviceAccountRef"].(map[string]any)["name"] != DefaultESOServiceAccount {
		t.Errorf("vault config wrong: %v", vault)
	}

	cfg.ESO.APIVersion = "external-secrets.io/v1beta1"
	es, err := ExternalSecret(ExternalSecretParams{Namespace: testNS, UserID: "u1", ProjectID: "p1", Environment: "staging"}, cfg.ESO)
	if err != nil {
		t.Fatal(err)
	}
	if es.GetAPIVersion() != "external-secrets.io/v1beta1" {
		t.Error("configurable apiVersion ignored")
	}
	spec := nested[map[string]any](t, es.Object, "spec")
	if spec["target"].(map[string]any)["name"] != "app-env-secret" || spec["target"].(map[string]any)["creationPolicy"] != "Owner" {
		t.Errorf("target wrong: %v", spec["target"])
	}
	key := spec["dataFrom"].([]any)[0].(map[string]any)["extract"].(map[string]any)["key"]
	if key != "tenants/u1/projects/p1/staging" {
		t.Errorf("key=%v", key)
	}
	if spec["secretStoreRef"].(map[string]any)["name"] != "openbao-store" {
		t.Error("store ref wrong")
	}
	if SecretPath("u", "p", "") != "tenants/u/projects/p/production" {
		t.Error("default environment wrong")
	}

	if _, err := ExternalSecret(ExternalSecretParams{Namespace: testNS, UserID: "u/../x", ProjectID: "p"}, cfg.ESO); err == nil {
		t.Error("path traversal accepted")
	}
	if _, err := SecretStore(testNS, ESOConfig{}, Owner{}); err == nil {
		t.Error("empty ESO config accepted")
	}
}

// ---- unstructured safety ----

func TestGeneratedObjectsAreDeepCopySafe(t *testing.T) {
	cfg := allOn()
	rec := &recorder{}
	p, err := NewTenantProvisioner(cfg, rec, quiet())
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err := p.EnsureTenant(ctx, testUser); err != nil {
		t.Fatal(err)
	}
	if _, err := p.EnsureServiceExposure(ctx, ExposureParams{UserID: testUser, ProjectID: "p1", ProjectSlug: "shop", ServiceID: "s1", ServiceName: "svc-s1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := p.EnsureBuildNetworkPolicy(ctx); err != nil {
		t.Fatal(err)
	}
	cfg.NetworkPolicyMode = NetworkPolicyCilium
	rec2 := &recorder{}
	p2, _ := NewTenantProvisioner(cfg, rec2, quiet())
	p2.EnsureTenant(ctx, testUser)
	p2.EnsureBuildNetworkPolicy(ctx)
	for _, o := range append(rec.objs, rec2.objs...) {
		_ = o.DeepCopy() // panics on non-JSON types such as []string
		if _, err := json.Marshal(o.Object); err != nil {
			t.Errorf("%s: %v", objectRef(o), err)
		}
		if o.GetLabels()[workloads.LabelManagedBy] != workloads.ValueManagedBy {
			t.Errorf("%s missing managed-by label", objectRef(o))
		}
	}
}

// ---- config ----

func TestLoadConfigDefaultsAndEnv(t *testing.T) {
	cfg := loadConfig(func(string) string { return "" })
	if cfg.EnableIngress || cfg.EnableNetworkPolicy || cfg.EnableESO || !cfg.EnableTenantQuotas {
		t.Errorf("unexpected default flags: %+v", cfg)
	}
	if cfg.NetworkPolicyMode != NetworkPolicyNative || cfg.AppsDomain != "localtest.me" || cfg.ESO.APIVersion != "external-secrets.io/v1" {
		t.Errorf("unexpected defaults: %+v", cfg)
	}
	if err := cfg.Validate(); err != nil {
		t.Errorf("defaults invalid: %v", err)
	}

	env := map[string]string{
		EnvEnableIngress: "true", EnvEnableNetworkPolicy: "TRUE", EnvNetworkPolicyMode: "Cilium", EnvEnableESO: "1",
		EnvEnableTenantQuotas: "false", EnvAppsDomain: "apps.example.com", EnvTraefikNamespace: "ingress",
		EnvTraefikEntryPoints: "web, websecure", EnvOpenBaoServerURL: "https://bao:8200", EnvOpenBaoRole: "r",
		EnvServiceCIDR: "10.43.0.0/16", EnvAPIPort: "8080", EnvESOAPIVersion: "external-secrets.io/v1beta1",
	}
	cfg = loadConfig(func(k string) string { return env[k] })
	if !cfg.EnableIngress || !cfg.EnableNetworkPolicy || !cfg.EnableESO || cfg.EnableTenantQuotas ||
		cfg.NetworkPolicyMode != NetworkPolicyCilium || cfg.AppsDomain != "apps.example.com" ||
		cfg.Traefik.Namespace != "ingress" || len(cfg.Traefik.EntryPoints) != 2 || cfg.Network.ServiceCIDR != "10.43.0.0/16" ||
		cfg.Network.APIPort != 8080 || cfg.ESO.Role != "r" || cfg.ESO.APIVersion != "external-secrets.io/v1beta1" {
		t.Errorf("env not applied: %+v", cfg)
	}
	if err := cfg.Validate(); err != nil {
		t.Errorf("env config invalid: %v", err)
	}
}

func TestConfigValidate(t *testing.T) {
	c := DefaultConfig()
	c.EnableNetworkPolicy, c.NetworkPolicyMode = true, "calico"
	if c.Validate() == nil {
		t.Error("bad mode accepted")
	}
	c = DefaultConfig()
	c.EnableNetworkPolicy, c.Network.ServiceCIDR = true, "nope"
	if c.Validate() == nil {
		t.Error("bad CIDR accepted")
	}
	c = DefaultConfig()
	c.EnableESO = true
	if c.Validate() == nil {
		t.Error("ESO without server/role accepted")
	}
	c = DefaultConfig()
	c.EnableIngress, c.AppsDomain = true, "bad_domain"
	if c.Validate() == nil {
		t.Error("bad domain accepted")
	}
}

// ---- provisioner ----

func TestEnsureTenantFlags(t *testing.T) {
	ctx := context.Background()

	// defaults: namespace + quota + limitrange only
	rec := &recorder{}
	p, _ := NewTenantProvisioner(DefaultConfig(), rec, quiet())
	res, err := p.EnsureTenant(ctx, testUser)
	if err != nil {
		t.Fatal(err)
	}
	if res.Namespace != testNS {
		t.Errorf("namespace %q", res.Namespace)
	}
	if got := strings.Join(rec.kinds(), ","); got != "Namespace/"+testNS+",ResourceQuota/tenant-quota,LimitRange/tenant-limits" {
		t.Errorf("default objects: %s", got)
	}
	ns := rec.find("Namespace", "")
	if ns.GetLabels()[LabelPSAEnforce] != "restricted" || ns.GetLabels()[workloads.LabelTenant] != testUserLow {
		t.Errorf("namespace labels: %v", ns.GetLabels())
	}

	// quotas off
	cfg := DefaultConfig()
	cfg.EnableTenantQuotas = false
	rec = &recorder{}
	p, _ = NewTenantProvisioner(cfg, rec, quiet())
	if _, err := p.EnsureTenant(ctx, testUser); err != nil || len(rec.objs) != 1 {
		t.Errorf("quotas off: err=%v objs=%v", err, rec.kinds())
	}

	// native network policy
	cfg = DefaultConfig()
	cfg.EnableNetworkPolicy = true
	rec = &recorder{}
	p, _ = NewTenantProvisioner(cfg, rec, quiet())
	if _, err := p.EnsureTenant(ctx, testUser); err != nil {
		t.Fatal(err)
	}
	for _, n := range []string{PolicyDefaultDeny, PolicyAllowDNS, PolicyAllowInternet, PolicyAllowTraefik} {
		if rec.find("NetworkPolicy", n) == nil {
			t.Errorf("missing NetworkPolicy %s", n)
		}
	}
	if np := rec.find("NetworkPolicy", PolicyAllowDNS); np.GetAPIVersion() != "networking.k8s.io/v1" {
		t.Errorf("apiVersion %s", np.GetAPIVersion())
	}

	// cilium mode
	cfg.NetworkPolicyMode = NetworkPolicyCilium
	rec = &recorder{}
	p, _ = NewTenantProvisioner(cfg, rec, quiet())
	if _, err := p.EnsureTenant(ctx, testUser); err != nil {
		t.Fatal(err)
	}
	if rec.find("CiliumNetworkPolicy", PolicyCiliumTenantBase) == nil || rec.find("NetworkPolicy", "") != nil {
		t.Errorf("cilium objects: %v", rec.kinds())
	}

	// invalid user
	if _, err := p.EnsureTenant(ctx, "Bad User"); !errors.Is(err, ErrInvalidName) {
		t.Errorf("want ErrInvalidName, got %v", err)
	}
}

func TestEnsureTenantIsIdempotent(t *testing.T) {
	cfg := allOn()
	a, b := &recorder{}, &recorder{}
	pa, _ := NewTenantProvisioner(cfg, a, quiet())
	pb, _ := NewTenantProvisioner(cfg, b, quiet())
	ctx := context.Background()
	pa.EnsureTenant(ctx, testUser)
	pb.EnsureTenant(ctx, testUser)
	pb.EnsureTenant(ctx, testUser)
	if len(b.objs) != 2*len(a.objs) {
		t.Fatalf("object counts differ: %d vs %d", len(a.objs), len(b.objs))
	}
	for i, o := range a.objs {
		if !equalObj(o, b.objs[i]) || !equalObj(o, b.objs[i+len(a.objs)]) {
			t.Errorf("object %s differs between runs", objectRef(o))
		}
	}
}

func equalObj(a, b *unstructured.Unstructured) bool {
	ja, _ := json.Marshal(a.Object)
	jb, _ := json.Marshal(b.Object)
	return string(ja) == string(jb)
}

func TestEnsureTenantSkipsUnavailableAddons(t *testing.T) {
	cfg := DefaultConfig()
	cfg.EnableNetworkPolicy, cfg.NetworkPolicyMode = true, NetworkPolicyCilium
	rec := &recorder{unavailable: map[string]bool{"CiliumNetworkPolicy": true}}
	p, _ := NewTenantProvisioner(cfg, rec, quiet())
	res, err := p.EnsureTenant(context.Background(), testUser)
	if err != nil {
		t.Fatalf("unavailable add-on must not fail: %v", err)
	}
	if len(res.Skipped) != 1 || !strings.HasPrefix(res.Skipped[0], "CiliumNetworkPolicy/") || len(res.Applied) != 3 {
		t.Errorf("result: %+v", res)
	}
}

func TestEnsureTenantNamespaceFailureIsFatalAndOtherErrorsJoined(t *testing.T) {
	rec := &recorder{failKind: "Namespace"}
	p, _ := NewTenantProvisioner(DefaultConfig(), rec, quiet())
	if _, err := p.EnsureTenant(context.Background(), testUser); err == nil || len(rec.objs) != 0 {
		t.Errorf("namespace failure should abort: err=%v objs=%v", err, rec.kinds())
	}
	rec = &recorder{failKind: "ResourceQuota"}
	p, _ = NewTenantProvisioner(DefaultConfig(), rec, quiet())
	_, err := p.EnsureTenant(context.Background(), testUser)
	if err == nil || rec.find("LimitRange", "") == nil {
		t.Errorf("other objects should still be applied: err=%v objs=%v", err, rec.kinds())
	}
}

func TestEnsureServiceExposure(t *testing.T) {
	rec := &recorder{}
	p, err := NewTenantProvisioner(allOn(), rec, quiet())
	if err != nil {
		t.Fatal(err)
	}
	res, err := p.EnsureServiceExposure(context.Background(), ExposureParams{
		UserID: testUser, ProjectID: "proj-1", ProjectSlug: "Shop", ServiceID: "sid1", ServiceName: "svc-sid1", Port: 3000, Environment: "production",
	})
	if err != nil {
		t.Fatal(err)
	}
	if res.Host != "svc-sid1-shop.localtest.me" {
		t.Errorf("host %q", res.Host)
	}
	route := rec.find("IngressRoute", "svc-sid1")
	if route == nil || rec.find("Middleware", "svc-sid1-security-headers") == nil {
		t.Fatalf("objects: %v", rec.kinds())
	}
	labels := route.GetLabels()
	if labels[workloads.LabelTenant] != testUserLow || labels[workloads.LabelProject] != "proj-1" || labels[workloads.LabelService] != "sid1" {
		t.Errorf("owner labels: %v", labels)
	}
	routes := nested[[]any](t, route.Object, "spec", "routes")
	if routes[0].(map[string]any)["services"].([]any)[0].(map[string]any)["port"] != int64(3000) {
		t.Error("service port wrong")
	}

	np := rec.find("NetworkPolicy", ServiceIngressPolicyName("svc-sid1"))
	if np == nil {
		t.Fatalf("service network policy missing: %v", rec.kinds())
	}
	sel := nested[map[string]any](t, np.Object, "spec", "podSelector", "matchLabels")
	if sel[workloads.LabelService] != "sid1" || sel[workloads.LabelAppName] != "svc-sid1" {
		t.Errorf("pod selector: %v", sel)
	}

	es := rec.find("ExternalSecret", "")
	key := nested[[]any](t, es.Object, "spec", "dataFrom")[0].(map[string]any)["extract"].(map[string]any)["key"]
	if key != "tenants/"+testUserLow+"/projects/proj-1/production" {
		t.Errorf("secret key %v", key)
	}
	if rec.find("SecretStore", "openbao-store") == nil || rec.find("ServiceAccount", DefaultESOServiceAccount) == nil {
		t.Errorf("ESO objects missing: %v", rec.kinds())
	}
}

func TestEnsureServiceExposureFlagsOffAndSkip(t *testing.T) {
	rec := &recorder{}
	p, _ := NewTenantProvisioner(DefaultConfig(), rec, quiet())
	res, err := p.EnsureServiceExposure(context.Background(), ExposureParams{UserID: testUser, ProjectID: "p", ServiceName: "svc-x"})
	if err != nil || len(rec.objs) != 0 || res.Host != "" {
		t.Errorf("all flags off should apply nothing: err=%v objs=%v", err, rec.kinds())
	}

	rec = &recorder{unavailable: map[string]bool{"IngressRoute": true, "Middleware": true, "ExternalSecret": true, "SecretStore": true}}
	p, _ = NewTenantProvisioner(allOn(), rec, quiet())
	res, err = p.EnsureServiceExposure(context.Background(), ExposureParams{UserID: testUser, ProjectID: "p", ServiceName: "svc-x", ProjectSlug: "s"})
	if err != nil {
		t.Fatalf("skip should not error: %v", err)
	}
	if len(res.Skipped) != 4 || len(res.Applied) != 2 { // NetworkPolicy + ServiceAccount applied
		t.Errorf("result: %+v", res)
	}
	if _, err := p.EnsureServiceExposure(context.Background(), ExposureParams{UserID: testUser, ProjectID: "p"}); err == nil {
		t.Error("empty service name accepted")
	}
}

func TestEnsureBuildNetworkPolicy(t *testing.T) {
	rec := &recorder{}
	p, _ := NewTenantProvisioner(DefaultConfig(), rec, quiet())
	if _, err := p.EnsureBuildNetworkPolicy(context.Background()); err != nil || len(rec.objs) != 0 {
		t.Error("disabled flag should be a no-op")
	}
	cfg := DefaultConfig()
	cfg.EnableNetworkPolicy = true
	p, _ = NewTenantProvisioner(cfg, rec, quiet())
	if _, err := p.EnsureBuildNetworkPolicy(context.Background()); err != nil || rec.find("NetworkPolicy", PolicyBuilderEgress) == nil {
		t.Errorf("builder policy missing: %v", rec.kinds())
	}
}

func TestNewTenantProvisionerValidates(t *testing.T) {
	if _, err := NewTenantProvisioner(DefaultConfig(), nil, nil); err == nil {
		t.Error("nil applier accepted")
	}
	cfg := DefaultConfig()
	cfg.EnableESO = true
	if _, err := NewTenantProvisioner(cfg, &recorder{}, nil); err == nil {
		t.Error("invalid config accepted")
	}
}

// ---- applier ----

func testMapper() meta.RESTMapper {
	m := meta.NewDefaultRESTMapper(nil)
	m.Add(schema.GroupVersionKind{Version: "v1", Kind: "Namespace"}, meta.RESTScopeRoot)
	m.Add(schema.GroupVersionKind{Group: "networking.k8s.io", Version: "v1", Kind: "NetworkPolicy"}, meta.RESTScopeNamespace)
	m.Add(schema.GroupVersionKind{Group: "traefik.io", Version: "v1alpha1", Kind: "IngressRoute"}, meta.RESTScopeNamespace)
	return m
}

func newFakeDynamic(onPatch func(clienttesting.PatchAction) (bool, runtime.Object, error)) *dynamicfake.FakeDynamicClient {
	c := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme())
	c.PrependReactor("patch", "*", func(a clienttesting.Action) (bool, runtime.Object, error) {
		return onPatch(a.(clienttesting.PatchAction))
	})
	return c
}

func TestApplierServerSideApply(t *testing.T) {
	var got clienttesting.PatchAction
	dyn := newFakeDynamic(func(a clienttesting.PatchAction) (bool, runtime.Object, error) {
		got = a
		return true, &unstructured.Unstructured{Object: map[string]any{}}, nil
	})
	ap := NewApplier(dyn, testMapper())

	np := TenantDefaultDenyPolicy(testNS, Owner{Tenant: testUserLow})
	np.Labels = nil // the Applier must still add managed-by
	if err := ap.ApplyTyped(context.Background(), np); err != nil {
		t.Fatal(err)
	}
	if got == nil || got.GetPatchType() != "application/apply-patch+yaml" {
		t.Fatalf("not an apply patch: %v", got)
	}
	if got.GetName() != PolicyDefaultDeny || got.GetNamespace() != testNS || got.GetResource().Resource != "networkpolicies" {
		t.Errorf("target wrong: %s %s %v", got.GetNamespace(), got.GetName(), got.GetResource())
	}
	var sent map[string]any
	if err := json.Unmarshal(got.GetPatch(), &sent); err != nil {
		t.Fatal(err)
	}
	if sent["kind"] != "NetworkPolicy" || sent["apiVersion"] != "networking.k8s.io/v1" {
		t.Errorf("payload identity: %v", sent)
	}
	labels := sent["metadata"].(map[string]any)["labels"].(map[string]any)
	if labels[workloads.LabelManagedBy] != workloads.ValueManagedBy {
		t.Errorf("managed-by label missing: %v", labels)
	}
	if _, has := sent["status"]; has {
		t.Error("status must not be sent")
	}
	if _, has := sent["metadata"].(map[string]any)["creationTimestamp"]; has {
		t.Error("creationTimestamp must not be sent")
	}

	// cluster-scoped
	ns, _ := TenantNamespace(testUser)
	if err := ap.ApplyTyped(context.Background(), ns); err != nil {
		t.Fatal(err)
	}
	if got.GetNamespace() != "" || got.GetResource().Resource != "namespaces" {
		t.Errorf("namespace apply target: %v", got.GetResource())
	}
}

func TestApplierUnavailable(t *testing.T) {
	dyn := newFakeDynamic(func(a clienttesting.PatchAction) (bool, runtime.Object, error) {
		return true, nil, apierrors.NewNotFound(schema.GroupResource{Group: "traefik.io", Resource: "ingressroutes"}, "x")
	})
	ap := NewApplier(dyn, testMapper())
	ctx := context.Background()

	// kind unknown to the RESTMapper (CRD not installed)
	cilium := CiliumBuilderPolicy(DefaultConfig().Network)
	if err := ap.Apply(ctx, cilium); !errors.Is(err, ErrAddonUnavailable) {
		t.Errorf("no-kind-match: want ErrAddonUnavailable, got %v", err)
	}

	// mapper knows the kind but the server answers 404 for the resource
	route, _ := IngressRoute(IngressParams{Namespace: "n", Name: "a", Host: "a.b", ServiceName: "a", ServicePort: 80, EntryPoints: []string{"web"}})
	if err := ap.Apply(ctx, route); !errors.Is(err, ErrAddonUnavailable) {
		t.Errorf("404: want ErrAddonUnavailable, got %v", err)
	}
}

func TestApplierMissingNamespaceIsNotUnavailable(t *testing.T) {
	dyn := newFakeDynamic(func(a clienttesting.PatchAction) (bool, runtime.Object, error) {
		return true, nil, &apierrors.StatusError{ErrStatus: metav1.Status{
			Status: metav1.StatusFailure, Reason: metav1.StatusReasonNotFound, Code: 404,
			Message: `namespaces "n" not found`, Details: &metav1.StatusDetails{Name: "n", Kind: "namespaces"},
		}}
	})
	ap := NewApplier(dyn, testMapper())
	route, _ := IngressRoute(IngressParams{Namespace: "n", Name: "a", Host: "a.b", ServiceName: "a", ServicePort: 80, EntryPoints: []string{"web"}})
	err := ap.Apply(context.Background(), route)
	if err == nil || errors.Is(err, ErrAddonUnavailable) {
		t.Errorf("missing namespace must be a hard error, got %v", err)
	}
}

func TestApplierValidatesInput(t *testing.T) {
	ap := NewApplier(newFakeDynamic(func(clienttesting.PatchAction) (bool, runtime.Object, error) { return true, nil, nil }), testMapper())
	if err := ap.Apply(context.Background(), nil); err == nil {
		t.Error("nil accepted")
	}
	noNS := newUnstructured("networking.k8s.io/v1", "NetworkPolicy", "", "x")
	if err := ap.Apply(context.Background(), noNS); err == nil {
		t.Error("namespaced object without namespace accepted")
	}
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func corev1ResourceName(s string) corev1.ResourceName { return corev1.ResourceName(s) }
