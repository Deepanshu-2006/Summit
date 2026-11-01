package addons

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/util/validation"

	"github.com/summit/backend/internal/cluster/workloads"
)

// TenantNamespacePrefix is the prefix of tenant namespaces (contract C1).
const TenantNamespacePrefix = "tenant-"

// ErrInvalidName indicates an identifier that cannot be turned into a valid Kubernetes name.
var ErrInvalidName = errors.New("addons: invalid name")

// TenantNamespaceName returns "tenant-<lowercased user id>" and validates that
// the result is a DNS-1123 label of at most 63 characters.
func TenantNamespaceName(userID string) (string, error) {
	id := strings.ToLower(strings.TrimSpace(userID))
	if id == "" {
		return "", fmt.Errorf("%w: empty user id", ErrInvalidName)
	}
	name := TenantNamespacePrefix + id
	if errs := validation.IsDNS1123Label(name); len(errs) > 0 {
		return "", fmt.Errorf("%w: namespace %q: %s", ErrInvalidName, name, strings.Join(errs, "; "))
	}
	return name, nil
}

var (
	nonLabelChars = regexp.MustCompile(`[^a-z0-9]+`)
)

// dnsLabel lowercases s, replaces runs of invalid characters with a single
// hyphen and trims leading/trailing hyphens. The result may be empty.
func dnsLabel(s string) string {
	s = nonLabelChars.ReplaceAllString(strings.ToLower(s), "-")
	return strings.Trim(s, "-")
}

// ServiceHost returns the public hostname for a service.
//
// Production (environment empty or "production") keeps
// "<service>-<project>.<appsDomain>". Every other environment uses
// "<service>-<project>-<env>.<appsDomain>". Each part is sanitised into
// DNS-1123 label characters. When the joined label would exceed 63 characters
// it is truncated and suffixed with an 8-hex-digit hash of the full sanitised
// value so that distinct inputs stay distinct.
//
// Kubernetes object names are not derived from this host. Workload objects are
// svc-<service id> and addon objects are addon-<service id>, so two
// environments never share an object name.
func ServiceHost(serviceName, projectSlug, environment, appsDomain string) (string, error) {
	svc := dnsLabel(serviceName)
	if svc == "" {
		return "", fmt.Errorf("%w: service name %q has no usable characters", ErrInvalidName, serviceName)
	}
	domain := strings.ToLower(strings.Trim(strings.TrimSpace(appsDomain), "."))
	if errs := validation.IsDNS1123Subdomain(domain); len(errs) > 0 {
		return "", fmt.Errorf("%w: apps domain %q: %s", ErrInvalidName, appsDomain, strings.Join(errs, "; "))
	}

	label := svc
	if proj := dnsLabel(projectSlug); proj != "" {
		label = svc + "-" + proj
	}
	if env := dnsLabel(environment); env != "" && env != "production" {
		label = label + "-" + env
	}
	if len(label) > 63 {
		sum := sha256.Sum256([]byte(label))
		suffix := hex.EncodeToString(sum[:4])
		label = strings.Trim(label[:63-1-len(suffix)], "-") + "-" + suffix
	}
	return label + "." + domain, nil
}

// Owner identifies the tenant/project/service an object belongs to.
type Owner struct {
	Tenant  string
	Project string
	Service string
}

// Labels returns the managed-by and ownership labels, using the same keys as
// workloads.SummitService.SafeLabels.
func (o Owner) Labels() map[string]string {
	labels := map[string]string{
		workloads.LabelManagedBy:  workloads.ValueManagedBy,
		workloads.LabelAppManaged: workloads.ValueManagedBy,
		workloads.LabelAppPartOf:  workloads.ValuePartOf,
	}
	if o.Tenant != "" {
		labels[workloads.LabelTenant] = o.Tenant
	}
	if o.Project != "" {
		labels[workloads.LabelProject] = o.Project
	}
	if o.Service != "" {
		labels[workloads.LabelService] = o.Service
	}
	return labels
}

// Stamp merges Owner labels into obj without overwriting labels the generator already set.
func (o Owner) Stamp(obj *unstructured.Unstructured) {
	labels := obj.GetLabels()
	if labels == nil {
		labels = map[string]string{}
	}
	for k, v := range o.Labels() {
		if _, exists := labels[k]; !exists {
			labels[k] = v
		}
	}
	obj.SetLabels(labels)
}

func stampTyped(meta *metav1.ObjectMeta, o Owner) {
	if meta.Labels == nil {
		meta.Labels = map[string]string{}
	}
	for k, v := range o.Labels() {
		if _, exists := meta.Labels[k]; !exists {
			meta.Labels[k] = v
		}
	}
}

func validateCIDR(cidr string) error {
	if _, _, err := net.ParseCIDR(strings.TrimSpace(cidr)); err != nil {
		return fmt.Errorf("invalid CIDR %q: %w", cidr, err)
	}
	return nil
}
