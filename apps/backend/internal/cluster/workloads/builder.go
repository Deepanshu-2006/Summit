package workloads

import (
	"fmt"
	"strings"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// Default baseline resource bounds if not provided in spec.
var (
	defaultRequestCPU    = resource.MustParse("50m")
	defaultRequestMemory = resource.MustParse("64Mi")
	defaultLimitCPU      = resource.MustParse("1000m")
	defaultLimitMemory   = resource.MustParse("512Mi")
)

// BuildNamespace constructs a tenant namespace object with safe governance and tenancy labels.
func BuildNamespace(name string, tenantID string) *corev1.Namespace {
	labels := map[string]string{
		LabelManagedBy:  ValueManagedBy,
		LabelAppManaged: ValueManagedBy,
		LabelAppPartOf:  ValuePartOf,
	}
	if tenantID != "" {
		labels[LabelTenant] = tenantID
	}

	return &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name:   name,
			Labels: labels,
		},
	}
}

// BuildDeployment generates a production-hardened Kubernetes Deployment for the backend service.
// It enforces non-root container execution, dropped capabilities, immutable image digest,
// configurable GHCR imagePullSecrets, rolling update strategy, and resource bounds.
func BuildDeployment(svc *SummitService) (*appsv1.Deployment, error) {
	if svc == nil {
		return nil, fmt.Errorf("workloads: summit service cannot be nil")
	}

	// Copy and apply defaults
	copySvc := *svc
	copySvc.SetDefaults()
	if err := copySvc.Validate(); err != nil {
		return nil, fmt.Errorf("workloads: invalid summit service specification: %w", err)
	}

	labels := copySvc.SafeLabels()
	selector := copySvc.SelectorLabels()
	resources := resolveResources(copySvc.Spec.Resources)

	var ownerRefs []metav1.OwnerReference
	if copySvc.UID != "" {
		ownerRefs = append(ownerRefs, copySvc.MakeOwnerReference())
	}

	maxSurge := intstr.FromString("25%")
	maxUnavailable := intstr.FromInt32(0)

	deployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:            copySvc.Name,
			Namespace:       copySvc.Namespace,
			Labels:          labels,
			OwnerReferences: ownerRefs,
		},
		Spec: appsv1.DeploymentSpec{
			Replicas: copySvc.Spec.Replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: selector,
			},
			Strategy: appsv1.DeploymentStrategy{
				Type: appsv1.RollingUpdateDeploymentStrategyType,
				RollingUpdate: &appsv1.RollingUpdateDeployment{
					MaxSurge:       &maxSurge,
					MaxUnavailable: &maxUnavailable,
				},
			},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
				},
				Spec: corev1.PodSpec{
					RestartPolicy:    corev1.RestartPolicyAlways,
					ImagePullSecrets: imagePullSecrets(copySvc.Spec),
					SecurityContext: &corev1.PodSecurityContext{
						RunAsNonRoot: boolPtr(true),
						RunAsUser:    int64Ptr(1000),
						RunAsGroup:   int64Ptr(1000),
						FSGroup:      int64Ptr(1000),
						SeccompProfile: &corev1.SeccompProfile{
							Type: corev1.SeccompProfileTypeRuntimeDefault,
						},
					},
					Containers: []corev1.Container{
						{
							Name:            copySvc.Name,
							Image:           copySvc.Spec.Image,
							ImagePullPolicy: corev1.PullIfNotPresent,
							SecurityContext: &corev1.SecurityContext{
								AllowPrivilegeEscalation: boolPtr(false),
								ReadOnlyRootFilesystem:   boolPtr(false),
								Capabilities: &corev1.Capabilities{
									Drop: []corev1.Capability{"ALL"},
								},
							},
							Ports: []corev1.ContainerPort{
								{
									Name:          "http",
									ContainerPort: copySvc.Spec.Port,
									Protocol:      corev1.ProtocolTCP,
								},
							},
							Env:       copySvc.Spec.Env,
							Resources: resources,
							LivenessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									TCPSocket: &corev1.TCPSocketAction{
										Port: intstr.FromInt32(copySvc.Spec.Port),
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       10,
								TimeoutSeconds:      2,
								FailureThreshold:    3,
							},
							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									TCPSocket: &corev1.TCPSocketAction{
										Port: intstr.FromInt32(copySvc.Spec.Port),
									},
								},
								InitialDelaySeconds: 2,
								PeriodSeconds:       5,
								TimeoutSeconds:      2,
								FailureThreshold:    2,
							},
						},
					},
				},
			},
		},
	}

	return deployment, nil
}

// imagePullSecrets references the pull secret only when one is configured and
// the reconciler has not marked it absent. A missing secret must not be named:
// kubelet refuses to pull a public image when imagePullSecrets points at a
// secret that does not exist.
func imagePullSecrets(spec SummitServiceSpec) []corev1.LocalObjectReference {
	if spec.OmitPullSecret {
		return nil
	}
	name := strings.TrimSpace(spec.PullSecretName)
	if name == "" {
		return nil
	}
	return []corev1.LocalObjectReference{{Name: name}}
}

// BuildService constructs an internal ClusterIP Service pointing to the backend Deployment pods.
func BuildService(svc *SummitService) (*corev1.Service, error) {
	if svc == nil {
		return nil, fmt.Errorf("workloads: summit service cannot be nil")
	}

	copySvc := *svc
	copySvc.SetDefaults()
	if err := copySvc.Validate(); err != nil {
		return nil, fmt.Errorf("workloads: invalid summit service specification: %w", err)
	}

	var ownerRefs []metav1.OwnerReference
	if copySvc.UID != "" {
		ownerRefs = append(ownerRefs, copySvc.MakeOwnerReference())
	}

	return &corev1.Service{
		ObjectMeta: metav1.ObjectMeta{
			Name:            copySvc.Name,
			Namespace:       copySvc.Namespace,
			Labels:          copySvc.SafeLabels(),
			OwnerReferences: ownerRefs,
		},
		Spec: corev1.ServiceSpec{
			Type:     corev1.ServiceTypeClusterIP,
			Selector: copySvc.SelectorLabels(),
			Ports: []corev1.ServicePort{
				{
					Name:       "http",
					Protocol:   corev1.ProtocolTCP,
					Port:       copySvc.Spec.Port,
					TargetPort: intstr.FromInt32(copySvc.Spec.Port),
				},
			},
		},
	}, nil
}

// resolveResources sets baseline CPU and memory boundaries if none were specified.
func resolveResources(specRes corev1.ResourceRequirements) corev1.ResourceRequirements {
	resolved := corev1.ResourceRequirements{
		Requests: make(corev1.ResourceList),
		Limits:   make(corev1.ResourceList),
	}

	// Copy caller requests
	for k, v := range specRes.Requests {
		resolved.Requests[k] = v.DeepCopy()
	}
	// Copy caller limits
	for k, v := range specRes.Limits {
		resolved.Limits[k] = v.DeepCopy()
	}

	// Apply defaults where missing
	if _, ok := resolved.Requests[corev1.ResourceCPU]; !ok {
		resolved.Requests[corev1.ResourceCPU] = defaultRequestCPU.DeepCopy()
	}
	if _, ok := resolved.Requests[corev1.ResourceMemory]; !ok {
		resolved.Requests[corev1.ResourceMemory] = defaultRequestMemory.DeepCopy()
	}
	if _, ok := resolved.Limits[corev1.ResourceCPU]; !ok {
		resolved.Limits[corev1.ResourceCPU] = defaultLimitCPU.DeepCopy()
	}
	if _, ok := resolved.Limits[corev1.ResourceMemory]; !ok {
		resolved.Limits[corev1.ResourceMemory] = defaultLimitMemory.DeepCopy()
	}

	return resolved
}

func boolPtr(b bool) *bool {
	return &b
}

func int64Ptr(i int64) *int64 {
	return &i
}
