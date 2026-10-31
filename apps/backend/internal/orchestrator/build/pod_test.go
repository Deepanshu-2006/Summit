package build

import (
	"encoding/json"
	"testing"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
)

func TestBuildPodManifest_Success(t *testing.T) {
	spec := validSpec()
	cfg := DefaultConfig()
	cfg.BuilderImage = "ghcr.io/priyanshu/summit-builder:v2.4.0"
	cfg.RuntimeClassName = "gvisor"
	cfg.BuilderImagePullSecret = "ghcr-pull"

	mode := int32(0440)
	secretMounts := []SecretMount{
		{
			VolumeName:  "source-creds",
			SecretName:  "git-token",
			MountPath:   "/var/run/secrets/summit/source",
			ReadOnly:    true,
			DefaultMode: &mode,
		},
		{
			VolumeName:  "registry-creds",
			SecretName:  "ghcr-push-token",
			MountPath:   "/var/run/secrets/summit/registry",
			ReadOnly:    true,
			DefaultMode: &mode,
		},
	}

	pod, cm, err := BuildPodManifest(spec, cfg, secretMounts)
	if err != nil {
		t.Fatalf("unexpected error building pod manifest: %v", err)
	}

	// 1. Verify ConfigMap
	if cm == nil {
		t.Fatalf("expected non-nil configmap")
	}
	specData, exists := cm.Data["execution.json"]
	if !exists {
		t.Fatalf("expected execution.json in configmap data")
	}

	var parsedSpec BuildExecutionSpec
	if err := json.Unmarshal([]byte(specData), &parsedSpec); err != nil {
		t.Fatalf("failed to unmarshal spec from configmap data: %v", err)
	}
	if parsedSpec.Build.ID != spec.Build.ID {
		t.Errorf("spec in configmap mismatch: expected build ID %s, got %s", spec.Build.ID, parsedSpec.Build.ID)
	}

	// 2. Verify Pod Metadata
	if pod.Name != BuildPodName(spec.Build.AttemptID) {
		t.Errorf("expected pod name %s, got %s", BuildPodName(spec.Build.AttemptID), pod.Name)
	}
	if pod.Namespace != cfg.Namespace {
		t.Errorf("expected namespace %s, got %s", cfg.Namespace, pod.Namespace)
	}
	if pod.Labels[LabelBuildID] != spec.Build.ID {
		t.Errorf("expected label build-id %s, got %s", spec.Build.ID, pod.Labels[LabelBuildID])
	}
	if pod.Labels[LabelAttemptID] != spec.Build.AttemptID {
		t.Errorf("expected label attempt-id %s, got %s", spec.Build.AttemptID, pod.Labels[LabelAttemptID])
	}
	if pod.Labels[LabelComponent] != "builder" {
		t.Errorf("expected label component 'builder', got %s", pod.Labels[LabelComponent])
	}

	// 3. Verify Sandboxing & RuntimeClass
	if pod.Spec.RuntimeClassName == nil || *pod.Spec.RuntimeClassName != "gvisor" {
		t.Errorf("expected runtimeClassName 'gvisor', got %v", pod.Spec.RuntimeClassName)
	}
	if pod.Spec.RestartPolicy != corev1.RestartPolicyNever {
		t.Errorf("expected restartPolicy Never, got %s", pod.Spec.RestartPolicy)
	}

	// 4. Verify Finite Deadline
	if pod.Spec.ActiveDeadlineSeconds == nil || *pod.Spec.ActiveDeadlineSeconds != int64(spec.TimeoutSeconds) {
		t.Errorf("expected activeDeadlineSeconds %d, got %v", spec.TimeoutSeconds, pod.Spec.ActiveDeadlineSeconds)
	}

	// 5. Verify Pod Security Context
	psc := pod.Spec.SecurityContext
	if psc == nil {
		t.Fatalf("expected non-nil pod security context")
	}
	if psc.RunAsNonRoot == nil || !*psc.RunAsNonRoot {
		t.Errorf("expected RunAsNonRoot true")
	}
	if psc.RunAsUser == nil || *psc.RunAsUser != 1000 {
		t.Errorf("expected RunAsUser 1000, got %v", psc.RunAsUser)
	}
	if psc.RunAsGroup == nil || *psc.RunAsGroup != 1000 {
		t.Errorf("expected RunAsGroup 1000, got %v", psc.RunAsGroup)
	}
	if psc.FSGroup == nil || *psc.FSGroup != 1000 {
		t.Errorf("expected FSGroup 1000, got %v", psc.FSGroup)
	}
	if pod.Spec.AutomountServiceAccountToken == nil || *pod.Spec.AutomountServiceAccountToken {
		t.Errorf("builder pod must not receive a Kubernetes service account token")
	}
	if len(pod.Spec.ImagePullSecrets) != 1 || pod.Spec.ImagePullSecrets[0].Name != "ghcr-pull" {
		t.Errorf("expected configured builder image pull secret, got %+v", pod.Spec.ImagePullSecrets)
	}

	// 6. Verify Container
	if len(pod.Spec.Containers) != 1 {
		t.Fatalf("expected exactly 1 container, got %d", len(pod.Spec.Containers))
	}
	c := pod.Spec.Containers[0]
	if c.Name != "builder" {
		t.Errorf("expected container name 'builder', got %s", c.Name)
	}
	if c.Image != "ghcr.io/priyanshu/summit-builder:v2.4.0" {
		t.Errorf("expected configurable image 'ghcr.io/priyanshu/summit-builder:v2.4.0', got %s", c.Image)
	}

	// 7. Verify Container Security Context
	csc := c.SecurityContext
	if csc == nil {
		t.Fatalf("expected non-nil container security context")
	}
	if csc.AllowPrivilegeEscalation == nil || *csc.AllowPrivilegeEscalation {
		t.Errorf("expected AllowPrivilegeEscalation false")
	}
	if csc.ReadOnlyRootFilesystem == nil || *csc.ReadOnlyRootFilesystem {
		t.Errorf("expected ReadOnlyRootFilesystem false for rootless buildkit cache layer")
	}
	if csc.Capabilities == nil || len(csc.Capabilities.Drop) != 1 || csc.Capabilities.Drop[0] != "ALL" {
		t.Errorf("expected drop ALL capabilities, got %v", csc.Capabilities)
	}

	// 8. Verify Finite Requests and Limits
	cpuLimit := c.Resources.Limits[corev1.ResourceCPU]
	if !cpuLimit.Equal(resource.MustParse("1000m")) {
		t.Errorf("expected cpu limit 1000m, got %s", cpuLimit.String())
	}
	memLimit := c.Resources.Limits[corev1.ResourceMemory]
	if !memLimit.Equal(resource.MustParse("2048Mi")) {
		t.Errorf("expected memory limit 2048Mi, got %s", memLimit.String())
	}
	storageLimit := c.Resources.Limits[corev1.ResourceEphemeralStorage]
	if !storageLimit.Equal(resource.MustParse("4096Mi")) {
		t.Errorf("expected ephemeral storage limit 4096Mi, got %s", storageLimit.String())
	}

	// 9. Verify Env Vars
	var foundSpecPath, foundRootless, foundNodeEnv bool
	for _, env := range c.Env {
		switch env.Name {
		case ExecutionSpecEnvVar:
			foundSpecPath = true
			if env.Value != "/run/summit/execution.json" {
				t.Errorf("expected spec path '/run/summit/execution.json', got %s", env.Value)
			}
		case "BUILDKIT_ROOTLESS":
			foundRootless = true
			if env.Value != "true" {
				t.Errorf("expected BUILDKIT_ROOTLESS true")
			}
		case "NODE_ENV":
			foundNodeEnv = true
			if env.Value != "production" {
				t.Errorf("expected NODE_ENV production")
			}
		}
	}
	if !foundSpecPath {
		t.Errorf("missing SUMMIT_EXECUTION_SPEC env var")
	}
	if !foundRootless {
		t.Errorf("missing BUILDKIT_ROOTLESS env var")
	}
	if !foundNodeEnv {
		t.Errorf("missing custom NODE_ENV env var")
	}

	// 10. Verify Volume Mounts
	var specMounted, sourceMounted, registryMounted bool
	for _, vm := range c.VolumeMounts {
		if vm.Name == "execution-spec" {
			specMounted = true
			if !vm.ReadOnly {
				t.Errorf("execution-spec mount must be read-only")
			}
			if vm.MountPath != "/run/summit" {
				t.Errorf("unexpected mount path for execution-spec: %s", vm.MountPath)
			}
		}
		if vm.Name == "source-creds" {
			sourceMounted = true
			if !vm.ReadOnly {
				t.Errorf("source-creds mount must be read-only")
			}
		}
		if vm.Name == "registry-creds" {
			registryMounted = true
			if !vm.ReadOnly {
				t.Errorf("registry-creds mount must be read-only")
			}
		}
	}
	if !specMounted {
		t.Errorf("missing execution-spec volume mount")
	}
	if !sourceMounted {
		t.Errorf("missing source-creds volume mount")
	}
	if !registryMounted {
		t.Errorf("missing registry-creds volume mount")
	}
}

func TestBuildPodManifest_FallbackDefaults(t *testing.T) {
	spec := validSpec()
	spec.Resources = ResourceLimits{} // zeroed out
	spec.TimeoutSeconds = 0           // zeroed out

	cfg := DefaultConfig()
	cfg.BuilderImage = "ghcr.io/priyanshu/summit-builder:v2.4.0"

	pod, _, err := BuildPodManifest(spec, cfg, nil)
	if err != nil {
		t.Fatalf("unexpected error building manifest: %v", err)
	}

	if *pod.Spec.ActiveDeadlineSeconds != int64(cfg.DefaultTimeoutSeconds) {
		t.Errorf("expected fallback deadline %d, got %d", cfg.DefaultTimeoutSeconds, *pod.Spec.ActiveDeadlineSeconds)
	}

	c := pod.Spec.Containers[0]
	cpuLimit := c.Resources.Limits[corev1.ResourceCPU]
	if !cpuLimit.Equal(resource.MustParse(cfg.DefaultCPULimit)) {
		t.Errorf("expected fallback cpu limit %s, got %s", cfg.DefaultCPULimit, cpuLimit.String())
	}
	memLimit := c.Resources.Limits[corev1.ResourceMemory]
	if !memLimit.Equal(resource.MustParse(cfg.DefaultMemoryLimit)) {
		t.Errorf("expected fallback memory limit %s, got %s", cfg.DefaultMemoryLimit, memLimit.String())
	}
}
