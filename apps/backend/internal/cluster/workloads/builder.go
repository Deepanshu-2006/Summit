package workloads

import (
	"fmt"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"
)

// Default baseline resource bounds for backend workloads.
var (
	defaultRequestCPU    = resource.MustParse("50m")
	defaultRequestMemory = resource.MustParse("64Mi")
	defaultLimitCPU      = resource.MustParse("1000m")
	defaultLimitMemory   = resource.MustParse("512Mi")
)

// Default baseline resource bounds for stateful PostgreSQL workloads.
var (
	defaultPostgresRequestCPU              = resource.MustParse("100m")
	defaultPostgresRequestMemory           = resource.MustParse("256Mi")
	defaultPostgresRequestEphemeralStorage = resource.MustParse("512Mi")
	defaultPostgresLimitCPU                = resource.MustParse("1000m")
	defaultPostgresLimitMemory             = resource.MustParse("1Gi")
	defaultPostgresLimitEphemeralStorage   = resource.MustParse("2Gi")
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

	if copySvc.IsPostgres() {
		return nil, fmt.Errorf("workloads: cannot build deployment for postgres workload %q; use BuildPostgresStatefulSet", copySvc.Name)
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
					RestartPolicy: corev1.RestartPolicyAlways,
					ImagePullSecrets: []corev1.LocalObjectReference{
						{Name: copySvc.Spec.PullSecretName},
					},
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

// BuildPostgresStatefulSet constructs a production-hardened StatefulSet for single-instance PostgreSQL workloads.
// It enforces 1 replica, dedicated per-service PVC with explicit storage class, non-root execution (UID 70),
// dropped capabilities, seccomp RuntimeDefault, read-only rootfs with emptyDir scratch spaces,
// explicit PVC retention on deletion and scale-down, startup/readiness/liveness probes, and rolling rollout.
func BuildPostgresStatefulSet(svc *SummitService) (*appsv1.StatefulSet, error) {
	if svc == nil {
		return nil, fmt.Errorf("workloads: summit service cannot be nil")
	}

	copySvc := *svc
	copySvc.SetDefaults()
	if err := copySvc.Validate(); err != nil {
		return nil, fmt.Errorf("workloads: invalid summit service specification: %w", err)
	}

	if !copySvc.IsPostgres() {
		return nil, fmt.Errorf("workloads: cannot build statefulset for backend workload %q; use BuildDeployment", copySvc.Name)
	}

	labels := copySvc.SafeLabels()
	selector := copySvc.SelectorLabels()
	resources := resolvePostgresResources(copySvc.Spec.Resources)

	var ownerRefs []metav1.OwnerReference
	if copySvc.UID != "" {
		ownerRefs = append(ownerRefs, copySvc.MakeOwnerReference())
	}

	headlessServiceName := copySvc.Name + "-headless"
	dbUser := copySvc.Spec.Postgres.Username
	dbName := copySvc.Spec.Postgres.DatabaseName
	port := copySvc.Spec.Port

	envVars := []corev1.EnvVar{
		{Name: "POSTGRES_DB", Value: dbName},
		{Name: "POSTGRES_USER", Value: dbUser},
		{Name: "POSTGRES_PASSWORD_FILE", Value: "/run/secrets/postgres/password"},
		{Name: "PGDATA", Value: "/var/lib/postgresql/data/pgdata"},
	}
	if len(copySvc.Spec.Env) > 0 {
		envVars = append(envVars, copySvc.Spec.Env...)
	}

	var pullSecrets []corev1.LocalObjectReference
	if copySvc.Spec.PullSecretName != "" {
		pullSecrets = append(pullSecrets, corev1.LocalObjectReference{Name: copySvc.Spec.PullSecretName})
	}

	probeCmd := []string{"pg_isready", "-h", "127.0.0.1", "-p", fmt.Sprintf("%d", port), "-U", dbUser, "-d", dbName}

	storageClass := copySvc.Spec.Postgres.Storage.StorageClassName
	storageQty := resource.MustParse(copySvc.Spec.Postgres.Storage.Size)

	// Per-service PVC claim template.
	// IMPORTANT RETENTION CONTRACT: Omit OwnerReference so custom resource deletion does NOT
	// cascade to PVC deletion. PVC is retained indefinitely until explicitly managed.
	pvcTemplate := corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:   "postgres-data",
			Labels: labels,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{
				corev1.ReadWriteOnce,
			},
			StorageClassName: &storageClass,
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					corev1.ResourceStorage: storageQty,
				},
			},
		},
	}

	replicas := int32(1)

	sts := &appsv1.StatefulSet{
		ObjectMeta: metav1.ObjectMeta{
			Name:            copySvc.Name,
			Namespace:       copySvc.Namespace,
			Labels:          labels,
			OwnerReferences: ownerRefs,
		},
		Spec: appsv1.StatefulSetSpec{
			ServiceName: headlessServiceName,
			Replicas:    &replicas,
			Selector: &metav1.LabelSelector{
				MatchLabels: selector,
			},
			PodManagementPolicy: appsv1.OrderedReadyPodManagement,
			UpdateStrategy: appsv1.StatefulSetUpdateStrategy{
				Type: appsv1.RollingUpdateStatefulSetStrategyType,
			},
			PersistentVolumeClaimRetentionPolicy: &appsv1.StatefulSetPersistentVolumeClaimRetentionPolicy{
				WhenDeleted: appsv1.RetainPersistentVolumeClaimRetentionPolicyType,
				WhenScaled:  appsv1.RetainPersistentVolumeClaimRetentionPolicyType,
			},
			VolumeClaimTemplates: []corev1.PersistentVolumeClaim{pvcTemplate},
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: labels,
				},
				Spec: corev1.PodSpec{
					RestartPolicy:    corev1.RestartPolicyAlways,
					ImagePullSecrets: pullSecrets,
					SecurityContext: &corev1.PodSecurityContext{
						RunAsNonRoot: boolPtr(true),
						RunAsUser:    int64Ptr(DefaultPostgresUID),
						RunAsGroup:   int64Ptr(DefaultPostgresGID),
						FSGroup:      int64Ptr(DefaultPostgresGID),
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
								ReadOnlyRootFilesystem:   boolPtr(true),
								Capabilities: &corev1.Capabilities{
									Drop: []corev1.Capability{"ALL"},
								},
							},
							Ports: []corev1.ContainerPort{
								{
									Name:          "postgres",
									ContainerPort: port,
									Protocol:      corev1.ProtocolTCP,
								},
							},
							Env:       envVars,
							Resources: resources,
							VolumeMounts: []corev1.VolumeMount{
								{
									Name:      "postgres-data",
									MountPath: "/var/lib/postgresql/data",
									SubPath:   "pgdata",
								},
								{
									Name:      "tmp",
									MountPath: "/tmp",
								},
								{
									Name:      "run",
									MountPath: "/var/run/postgresql",
								},
								{
									Name:      "postgres-auth",
									MountPath: "/run/secrets/postgres",
									ReadOnly:  true,
								},
							},
							StartupProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									Exec: &corev1.ExecAction{
										Command: probeCmd,
									},
								},
								InitialDelaySeconds: 5,
								PeriodSeconds:       5,
								TimeoutSeconds:      3,
								FailureThreshold:    30,
							},
							ReadinessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									Exec: &corev1.ExecAction{
										Command: probeCmd,
									},
								},
								InitialDelaySeconds: 2,
								PeriodSeconds:       5,
								TimeoutSeconds:      3,
								FailureThreshold:    3,
							},
							LivenessProbe: &corev1.Probe{
								ProbeHandler: corev1.ProbeHandler{
									Exec: &corev1.ExecAction{
										Command: probeCmd,
									},
								},
								InitialDelaySeconds: 10,
								PeriodSeconds:       10,
								TimeoutSeconds:      5,
								FailureThreshold:    3,
							},
						},
					},
					Volumes: []corev1.Volume{
						{
							Name: "tmp",
							VolumeSource: corev1.VolumeSource{
								EmptyDir: &corev1.EmptyDirVolumeSource{},
							},
						},
						{
							Name: "run",
							VolumeSource: corev1.VolumeSource{
								EmptyDir: &corev1.EmptyDirVolumeSource{},
							},
						},
						{
							Name: "postgres-auth",
							VolumeSource: corev1.VolumeSource{
								Secret: &corev1.SecretVolumeSource{
									SecretName: copySvc.Spec.Postgres.Auth.SecretRef.Name,
									Items: []corev1.KeyToPath{{
										Key:  copySvc.Spec.Postgres.Auth.SecretRef.Key,
										Path: "password",
									}},
									DefaultMode: int32Ptr(0440),
								},
							},
						},
					},
				},
			},
		},
	}

	return sts, nil
}

// BuildService constructs an internal ClusterIP Service pointing to the backend Deployment or Postgres StatefulSet pods.
func BuildService(svc *SummitService) (*corev1.Service, error) {
	if svc == nil {
		return nil, fmt.Errorf("workloads: summit service cannot be nil")
	}

	if svc.IsPostgres() {
		return BuildPostgresClientService(svc)
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

// BuildPostgresHeadlessService constructs the headless governing Service required for StatefulSet pod identity.
func BuildPostgresHeadlessService(svc *SummitService) (*corev1.Service, error) {
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
			Name:            copySvc.Name + "-headless",
			Namespace:       copySvc.Namespace,
			Labels:          copySvc.SafeLabels(),
			OwnerReferences: ownerRefs,
		},
		Spec: corev1.ServiceSpec{
			Type:                     corev1.ServiceTypeClusterIP,
			ClusterIP:                corev1.ClusterIPNone,
			PublishNotReadyAddresses: true,
			Selector:                 copySvc.SelectorLabels(),
			Ports: []corev1.ServicePort{
				{
					Name:       "postgres",
					Protocol:   corev1.ProtocolTCP,
					Port:       copySvc.Spec.Port,
					TargetPort: intstr.FromInt32(copySvc.Spec.Port),
				},
			},
		},
	}, nil
}

// BuildPostgresClientService constructs a stable in-cluster ClusterIP client Service for applications to connect to PostgreSQL.
func BuildPostgresClientService(svc *SummitService) (*corev1.Service, error) {
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
					Name:       "postgres",
					Protocol:   corev1.ProtocolTCP,
					Port:       copySvc.Spec.Port,
					TargetPort: intstr.FromInt32(copySvc.Spec.Port),
				},
			},
		},
	}, nil
}

// BuildPostgresNetworkPolicy restricts database ingress to Summit-managed pods
// in the same tenant namespace and denies database egress. NetworkPolicy
// enforcement depends on the cluster CNI.
func BuildPostgresNetworkPolicy(svc *SummitService) (*networkingv1.NetworkPolicy, error) {
	if svc == nil {
		return nil, fmt.Errorf("workloads: summit service cannot be nil")
	}

	copySvc := *svc
	copySvc.SetDefaults()
	if err := copySvc.Validate(); err != nil {
		return nil, fmt.Errorf("workloads: invalid summit service specification: %w", err)
	}
	if !copySvc.IsPostgres() {
		return nil, fmt.Errorf("workloads: cannot build postgres network policy for backend workload %q", copySvc.Name)
	}

	var ownerRefs []metav1.OwnerReference
	if copySvc.UID != "" {
		ownerRefs = append(ownerRefs, copySvc.MakeOwnerReference())
	}
	tcp := corev1.ProtocolTCP
	port := copySvc.Spec.Port

	return &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:            copySvc.Name,
			Namespace:       copySvc.Namespace,
			Labels:          copySvc.SafeLabels(),
			OwnerReferences: ownerRefs,
		},
		Spec: networkingv1.NetworkPolicySpec{
			PodSelector: metav1.LabelSelector{MatchLabels: copySvc.SelectorLabels()},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress, networkingv1.PolicyTypeEgress},
			Ingress: []networkingv1.NetworkPolicyIngressRule{{
				From: []networkingv1.NetworkPolicyPeer{{
					PodSelector: &metav1.LabelSelector{MatchLabels: map[string]string{LabelManagedBy: ValueManagedBy}},
				}},
				Ports: []networkingv1.NetworkPolicyPort{{
					Protocol: &tcp,
					Port:     &intstr.IntOrString{Type: intstr.Int, IntVal: port},
				}},
			}},
			// Egress is deliberately empty: managed PostgreSQL has no outbound
			// dependency after startup.
		},
	}, nil
}

// resolveResources sets baseline CPU and memory boundaries for backend workloads if none were specified.
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

// resolvePostgresResources sets baseline CPU, memory, and ephemeral-storage boundaries for PostgreSQL workloads.
func resolvePostgresResources(specRes corev1.ResourceRequirements) corev1.ResourceRequirements {
	resolved := corev1.ResourceRequirements{
		Requests: make(corev1.ResourceList),
		Limits:   make(corev1.ResourceList),
	}

	for k, v := range specRes.Requests {
		resolved.Requests[k] = v.DeepCopy()
	}
	for k, v := range specRes.Limits {
		resolved.Limits[k] = v.DeepCopy()
	}

	if _, ok := resolved.Requests[corev1.ResourceCPU]; !ok {
		resolved.Requests[corev1.ResourceCPU] = defaultPostgresRequestCPU.DeepCopy()
	}
	if _, ok := resolved.Requests[corev1.ResourceMemory]; !ok {
		resolved.Requests[corev1.ResourceMemory] = defaultPostgresRequestMemory.DeepCopy()
	}
	if _, ok := resolved.Requests[corev1.ResourceEphemeralStorage]; !ok {
		resolved.Requests[corev1.ResourceEphemeralStorage] = defaultPostgresRequestEphemeralStorage.DeepCopy()
	}

	if _, ok := resolved.Limits[corev1.ResourceCPU]; !ok {
		resolved.Limits[corev1.ResourceCPU] = defaultPostgresLimitCPU.DeepCopy()
	}
	if _, ok := resolved.Limits[corev1.ResourceMemory]; !ok {
		resolved.Limits[corev1.ResourceMemory] = defaultPostgresLimitMemory.DeepCopy()
	}
	if _, ok := resolved.Limits[corev1.ResourceEphemeralStorage]; !ok {
		resolved.Limits[corev1.ResourceEphemeralStorage] = defaultPostgresLimitEphemeralStorage.DeepCopy()
	}

	return resolved
}

func boolPtr(b bool) *bool {
	return &b
}

func int64Ptr(i int64) *int64 {
	return &i
}

func int32Ptr(i int32) *int32 {
	return &i
}
