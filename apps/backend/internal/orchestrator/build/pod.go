package build

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	// LabelBuildID tracks the platform build identifier.
	LabelBuildID = "summit.dev/build-id"

	// LabelAttemptID tracks the specific execution attempt identifier.
	LabelAttemptID = "summit.dev/attempt-id"

	// LabelComponent marks the builder pod role.
	LabelComponent = "summit.dev/component"

	// LabelCorrelationID carries tracing correlation metadata.
	LabelCorrelationID = "summit.dev/correlation-id"

	// AnnSchemaVersion annotates the execution spec contract version.
	AnnSchemaVersion = "summit.dev/schema-version"

	// AnnRepository annotates the source repository.
	AnnRepository = "summit.dev/repository"

	// AnnCommitSHA annotates the source commit SHA.
	AnnCommitSHA = "summit.dev/commit-sha"

	// AnnTargetRef annotates the destination OCI image reference.
	AnnTargetRef = "summit.dev/target-image"
)

var nameSanitizer = regexp.MustCompile(`[^a-z0-9.-]+`)

// BuildPodName returns a deterministic, DNS-1123 compliant pod name for the attempt.
func BuildPodName(attemptID string) string {
	clean := strings.ToLower(attemptID)
	clean = nameSanitizer.ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-.")
	if len(clean) > 50 {
		clean = clean[:50]
		clean = strings.Trim(clean, "-.")
	}
	return fmt.Sprintf("summit-build-%s", clean)
}

// BuildConfigMapName returns a deterministic, DNS-1123 compliant configmap name for the attempt.
func BuildConfigMapName(attemptID string) string {
	clean := strings.ToLower(attemptID)
	clean = nameSanitizer.ReplaceAllString(clean, "-")
	clean = strings.Trim(clean, "-.")
	if len(clean) > 45 {
		clean = clean[:45]
		clean = strings.Trim(clean, "-.")
	}
	return fmt.Sprintf("summit-build-spec-%s", clean)
}

// BuildConfigMap generates the ConfigMap containing the read-only execution.json document.
func BuildConfigMap(spec BuildExecutionSpec, cfg Config) (*corev1.ConfigMap, error) {
	specJSON, err := json.MarshalIndent(spec, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to serialize execution spec: %w", err)
	}

	cmName := BuildConfigMapName(spec.Build.AttemptID)

	labels := map[string]string{
		LabelBuildID:   spec.Build.ID,
		LabelAttemptID: spec.Build.AttemptID,
		LabelComponent: "builder-spec",
	}
	if spec.Build.CorrelationID != "" {
		labels[LabelCorrelationID] = spec.Build.CorrelationID
	}

	cm := &corev1.ConfigMap{
		ObjectMeta: metav1.ObjectMeta{
			Name:      cmName,
			Namespace: cfg.Namespace,
			Labels:    labels,
			Annotations: map[string]string{
				AnnSchemaVersion: fmt.Sprintf("%d", spec.SchemaVersion),
				AnnRepository:    spec.Source.Repository,
				AnnCommitSHA:     spec.Source.CommitSHA,
			},
		},
		Data: map[string]string{
			"execution.json": string(specJSON),
		},
	}

	return cm, nil
}

// BuildPodManifest generates a Kubernetes Pod specification implementing all isolation,
// security, resource boundary, and read-only secret/spec mount requirements.
func BuildPodManifest(spec BuildExecutionSpec, cfg Config, secretMounts []SecretMount) (*corev1.Pod, *corev1.ConfigMap, error) {
	if err := spec.Validate(); err != nil {
		return nil, nil, fmt.Errorf("invalid execution spec: %w", err)
	}
	if err := cfg.Validate(); err != nil {
		return nil, nil, fmt.Errorf("invalid builder config: %w", err)
	}

	cm, err := BuildConfigMap(spec, cfg)
	if err != nil {
		return nil, nil, err
	}

	podName := BuildPodName(spec.Build.AttemptID)

	// Validate secret mounts: must all be read-only and contain no secret values
	for _, sm := range secretMounts {
		if err := sm.Validate(); err != nil {
			return nil, nil, fmt.Errorf("invalid secret mount %q: %w", sm.VolumeName, err)
		}
	}

	// Finite timeout / deadline
	var timeoutSeconds int64
	if spec.TimeoutSeconds > 0 {
		timeoutSeconds = int64(spec.TimeoutSeconds)
	} else {
		timeoutSeconds = int64(cfg.DefaultTimeoutSeconds)
	}

	// Compute finite resource requirements
	resReq, err := computeResourceRequirements(spec.Resources, cfg)
	if err != nil {
		return nil, nil, fmt.Errorf("resource computation error: %w", err)
	}

	// Labels & Annotations
	podLabels := map[string]string{
		LabelBuildID:   spec.Build.ID,
		LabelAttemptID: spec.Build.AttemptID,
		LabelComponent: "builder",
	}
	if spec.Build.CorrelationID != "" {
		podLabels[LabelCorrelationID] = spec.Build.CorrelationID
	}

	podAnnotations := map[string]string{
		AnnSchemaVersion: fmt.Sprintf("%d", spec.SchemaVersion),
		AnnRepository:    spec.Source.Repository,
		AnnCommitSHA:     spec.Source.CommitSHA,
		AnnTargetRef:     spec.Output.FullTargetRef(),
	}

	// Volumes & VolumeMounts setup
	volumes := make([]corev1.Volume, 0, 3+len(secretMounts))
	volumeMounts := make([]corev1.VolumeMount, 0, 3+len(secretMounts))

	// 1. Read-only execution spec volume mounted at /run/summit/execution.json
	specDir := filepath.Dir(cfg.SpecMountPath)
	specFile := filepath.Base(cfg.SpecMountPath)
	// ConfigMap volumes are root-owned; fsGroup 1000 needs group-read permission.
	specMode := int32(0440)

	volumes = append(volumes, corev1.Volume{
		Name: "execution-spec",
		VolumeSource: corev1.VolumeSource{
			ConfigMap: &corev1.ConfigMapVolumeSource{
				LocalObjectReference: corev1.LocalObjectReference{
					Name: cm.Name,
				},
				DefaultMode: &specMode,
				Items: []corev1.KeyToPath{
					{
						Key:  "execution.json",
						Path: specFile,
					},
				},
			},
		},
	})

	volumeMounts = append(volumeMounts, corev1.VolumeMount{
		Name:      "execution-spec",
		MountPath: specDir,
		ReadOnly:  true,
	})

	// 2. Secret volume mounts: strictly read-only, referencing K8s Secrets by name only
	for _, sm := range secretMounts {
		mode := int32(0440)
		if sm.DefaultMode != nil {
			mode = *sm.DefaultMode
		}

		volumes = append(volumes, corev1.Volume{
			Name: sm.VolumeName,
			VolumeSource: corev1.VolumeSource{
				Secret: &corev1.SecretVolumeSource{
					SecretName:  sm.SecretName,
					DefaultMode: &mode,
					Items:       sm.Items,
				},
			},
		})

		volumeMounts = append(volumeMounts, corev1.VolumeMount{
			Name:      sm.VolumeName,
			MountPath: sm.MountPath,
			ReadOnly:  true,
		})
	}

	// 3. User-space cache scratchpad (emptyDir) for rootless buildkit
	cacheLimit := resource.MustParse(cfg.DefaultStorageLimit)
	volumes = append(volumes, corev1.Volume{
		Name: "build-cache",
		VolumeSource: corev1.VolumeSource{
			EmptyDir: &corev1.EmptyDirVolumeSource{
				SizeLimit: &cacheLimit,
			},
		},
	})
	volumeMounts = append(volumeMounts, corev1.VolumeMount{
		Name:      "build-cache",
		MountPath: "/home/user/.local/share/buildkit",
		ReadOnly:  false,
	})

	// Container environment variables
	envVars := []corev1.EnvVar{
		{
			Name:  ExecutionSpecEnvVar,
			Value: cfg.SpecMountPath,
		},
		{
			Name:  "BUILDKIT_ROOTLESS",
			Value: "true",
		},
		{
			Name:  "SUMMIT_SOURCE_CREDENTIAL_FILE",
			Value: SourceCredentialFile,
		},
		{
			Name:  "SUMMIT_REGISTRY_CREDENTIAL_FILE",
			Value: RegistryCredentialFile,
		},
		{
			Name:  "SUMMIT_REPORTING_TOKEN_FILE",
			Value: ReportingTokenFile,
		},
	}

	// Add any non-secret build config environment variables in sorted order
	if len(spec.BuildConfig.EnvVars) > 0 {
		keys := make([]string, 0, len(spec.BuildConfig.EnvVars))
		for k := range spec.BuildConfig.EnvVars {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			// Skip injecting secrets or overriding execution spec path
			if k == ExecutionSpecEnvVar {
				continue
			}
			envVars = append(envVars, corev1.EnvVar{
				Name:  k,
				Value: spec.BuildConfig.EnvVars[k],
			})
		}
	}

	// Security contexts (UID/GID 1000, drop all capabilities, non-root)
	runAsUser := int64(1000)
	runAsGroup := int64(1000)
	fsGroup := int64(1000)
	runAsNonRoot := true
	allowPrivilegeEscalation := false
	readOnlyRootFilesystem := false // Rootless buildkit requires cache layer writes in user space

	podSecurityContext := &corev1.PodSecurityContext{
		RunAsNonRoot: &runAsNonRoot,
		RunAsUser:    &runAsUser,
		RunAsGroup:   &runAsGroup,
		FSGroup:      &fsGroup,
		SeccompProfile: &corev1.SeccompProfile{
			Type: corev1.SeccompProfileTypeRuntimeDefault,
		},
	}

	containerSecurityContext := &corev1.SecurityContext{
		RunAsNonRoot:             &runAsNonRoot,
		RunAsUser:                &runAsUser,
		RunAsGroup:               &runAsGroup,
		AllowPrivilegeEscalation: &allowPrivilegeEscalation,
		ReadOnlyRootFilesystem:   &readOnlyRootFilesystem,
		Capabilities: &corev1.Capabilities{
			Drop: []corev1.Capability{"ALL"},
		},
	}

	// Container definition
	builderContainer := corev1.Container{
		Name:            "builder",
		Image:           cfg.BuilderImage,
		ImagePullPolicy: corev1.PullIfNotPresent,
		SecurityContext: containerSecurityContext,
		Resources:       resReq,
		Env:             envVars,
		VolumeMounts:    volumeMounts,
	}

	// Pod specification referencing existing configured gVisor runtimeClass only
	runtimeClass := cfg.RuntimeClassName

	pod := &corev1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name:        podName,
			Namespace:   cfg.Namespace,
			Labels:      podLabels,
			Annotations: podAnnotations,
		},
		Spec: corev1.PodSpec{
			RuntimeClassName:      &runtimeClass,
			RestartPolicy:         corev1.RestartPolicyNever,
			ActiveDeadlineSeconds: &timeoutSeconds,
			ServiceAccountName:    cfg.ServiceAccountName,
			// The builder does not need Kubernetes API credentials. In particular,
			// repository-controlled build steps must not inherit the service account token.
			AutomountServiceAccountToken: boolPtr(false),
			SecurityContext:              podSecurityContext,
			ImagePullSecrets:             builderImagePullSecrets(cfg.BuilderImagePullSecret),
			Containers: []corev1.Container{
				builderContainer,
			},
			Volumes: volumes,
		},
	}

	return pod, cm, nil
}

func builderImagePullSecrets(name string) []corev1.LocalObjectReference {
	if strings.TrimSpace(name) == "" {
		return nil
	}
	return []corev1.LocalObjectReference{{Name: strings.TrimSpace(name)}}
}

func boolPtr(value bool) *bool {
	return &value
}

// computeResourceRequirements calculates finite requests and limits from spec resources or fallback config.
func computeResourceRequirements(res ResourceLimits, cfg Config) (corev1.ResourceRequirements, error) {
	// Parse limits
	cpuLimitStr := cfg.DefaultCPULimit
	if res.CPUMillicores >= 100 {
		cpuLimitStr = fmt.Sprintf("%dm", res.CPUMillicores)
	}

	memLimitStr := cfg.DefaultMemoryLimit
	if res.MemoryMiB >= 128 {
		memLimitStr = fmt.Sprintf("%dMi", res.MemoryMiB)
	}

	storageLimitStr := cfg.DefaultStorageLimit
	if res.EphemeralStorageMiB >= 512 {
		storageLimitStr = fmt.Sprintf("%dMi", res.EphemeralStorageMiB)
	}

	cpuLimit, err := resource.ParseQuantity(cpuLimitStr)
	if err != nil {
		return corev1.ResourceRequirements{}, fmt.Errorf("invalid cpu limit %q: %w", cpuLimitStr, err)
	}
	memLimit, err := resource.ParseQuantity(memLimitStr)
	if err != nil {
		return corev1.ResourceRequirements{}, fmt.Errorf("invalid memory limit %q: %w", memLimitStr, err)
	}
	storageLimit, err := resource.ParseQuantity(storageLimitStr)
	if err != nil {
		return corev1.ResourceRequirements{}, fmt.Errorf("invalid storage limit %q: %w", storageLimitStr, err)
	}

	// Parse requests
	cpuReq, err := resource.ParseQuantity(cfg.DefaultCPURequest)
	if err != nil {
		return corev1.ResourceRequirements{}, fmt.Errorf("invalid default cpu request: %w", err)
	}
	// Ensure request does not exceed limit
	if cpuReq.Cmp(cpuLimit) > 0 {
		cpuReq = cpuLimit.DeepCopy()
	}

	memReq, err := resource.ParseQuantity(cfg.DefaultMemoryRequest)
	if err != nil {
		return corev1.ResourceRequirements{}, fmt.Errorf("invalid default memory request: %w", err)
	}
	if memReq.Cmp(memLimit) > 0 {
		memReq = memLimit.DeepCopy()
	}

	storageReq, err := resource.ParseQuantity(cfg.DefaultStorageRequest)
	if err != nil {
		return corev1.ResourceRequirements{}, fmt.Errorf("invalid default storage request: %w", err)
	}
	if storageReq.Cmp(storageLimit) > 0 {
		storageReq = storageLimit.DeepCopy()
	}

	return corev1.ResourceRequirements{
		Limits: corev1.ResourceList{
			corev1.ResourceCPU:              cpuLimit,
			corev1.ResourceMemory:           memLimit,
			corev1.ResourceEphemeralStorage: storageLimit,
		},
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:              cpuReq,
			corev1.ResourceMemory:           memReq,
			corev1.ResourceEphemeralStorage: storageReq,
		},
	}, nil
}
