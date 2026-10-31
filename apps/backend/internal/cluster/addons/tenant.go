package addons

import (
	"fmt"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/summit/backend/internal/cluster/workloads"
)

// Pod Security Admission label keys and levels.
const (
	LabelPSAEnforce        = "pod-security.kubernetes.io/enforce"
	LabelPSAEnforceVersion = "pod-security.kubernetes.io/enforce-version"
	LabelPSAAudit          = "pod-security.kubernetes.io/audit"
	LabelPSAWarn           = "pod-security.kubernetes.io/warn"

	PSALevelRestricted = "restricted"

	// ResourceQuotaName and LimitRangeName are the per-tenant object names.
	ResourceQuotaName = "tenant-quota"
	LimitRangeName    = "tenant-limits"
)

// TenantNamespace returns the hardened namespace for a tenant: Summit
// ownership labels plus Pod Security Admission "restricted" enforcement, which
// the SummitService Deployment (non-root, drop ALL, RuntimeDefault seccomp,
// no privilege escalation) satisfies.
func TenantNamespace(userID string) (*corev1.Namespace, error) {
	name, err := TenantNamespaceName(userID)
	if err != nil {
		return nil, err
	}
	tenant := strings.ToLower(strings.TrimSpace(userID))
	ns := workloads.BuildNamespace(name, tenant)
	ns.Labels[LabelPSAEnforce] = PSALevelRestricted
	ns.Labels[LabelPSAEnforceVersion] = "latest"
	ns.Labels[LabelPSAAudit] = PSALevelRestricted
	ns.Labels[LabelPSAWarn] = PSALevelRestricted
	return ns, nil
}

// TenantResourceQuota returns the per-tenant compute/object quota.
func TenantResourceQuota(namespace string, q QuotaConfig, owner Owner) (*corev1.ResourceQuota, error) {
	if err := q.Validate(); err != nil {
		return nil, err
	}
	rq := &corev1.ResourceQuota{
		ObjectMeta: metav1.ObjectMeta{Name: ResourceQuotaName, Namespace: namespace},
		Spec: corev1.ResourceQuotaSpec{Hard: corev1.ResourceList{
			corev1.ResourceRequestsCPU:            resource.MustParse(q.RequestsCPU),
			corev1.ResourceLimitsCPU:              resource.MustParse(q.LimitsCPU),
			corev1.ResourceRequestsMemory:         resource.MustParse(q.RequestsMemory),
			corev1.ResourceLimitsMemory:           resource.MustParse(q.LimitsMemory),
			corev1.ResourcePersistentVolumeClaims: resource.MustParse(q.PersistentVolumeClaims),
			corev1.ResourcePods:                   resource.MustParse(q.Pods),
		}},
	}
	stampTyped(&rq.ObjectMeta, owner)
	return rq, nil
}

// TenantLimitRange returns container default requests/limits so pods that omit
// resources are admitted under the quota with bounded consumption.
func TenantLimitRange(namespace string, q QuotaConfig, owner Owner) (*corev1.LimitRange, error) {
	if err := q.Validate(); err != nil {
		return nil, err
	}
	reqCPU, limCPU := resource.MustParse(q.DefaultRequestCPU), resource.MustParse(q.DefaultLimitCPU)
	reqMem, limMem := resource.MustParse(q.DefaultRequestMemory), resource.MustParse(q.DefaultLimitMemory)
	if reqCPU.Cmp(limCPU) > 0 || reqMem.Cmp(limMem) > 0 {
		return nil, fmt.Errorf("addons: limit range default requests exceed default limits")
	}
	lr := &corev1.LimitRange{
		ObjectMeta: metav1.ObjectMeta{Name: LimitRangeName, Namespace: namespace},
		Spec: corev1.LimitRangeSpec{Limits: []corev1.LimitRangeItem{{
			Type: corev1.LimitTypeContainer,
			DefaultRequest: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse(q.DefaultRequestCPU),
				corev1.ResourceMemory: resource.MustParse(q.DefaultRequestMemory),
			},
			Default: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse(q.DefaultLimitCPU),
				corev1.ResourceMemory: resource.MustParse(q.DefaultLimitMemory),
			},
		}}},
	}
	stampTyped(&lr.ObjectMeta, owner)
	return lr, nil
}
