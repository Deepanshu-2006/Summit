package workloads

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	// GroupName is the API group for Summit PaaS custom resources.
	GroupName = "summit.dev"
	// Version is the schema version for the SummitService resource.
	Version = "v1alpha1"
	// KindSummitService is the Kind identifier for SummitService.
	KindSummitService = "SummitService"

	// DefaultPort is the default container listening port and ClusterIP target port.
	DefaultPort int32 = 8080
	// DefaultReplicas is the default number of deployment replicas.
	DefaultReplicas int32 = 1
	// DefaultPullSecretName is the standard GHCR pull secret configured in the tenant namespace.
	DefaultPullSecretName = "ghcr-pull"

	// Standard Summit PaaS governance and ownership label keys.
	LabelTenant       = "summit.dev/tenant"
	LabelProject      = "summit.dev/project"
	LabelService      = "summit.dev/service"
	LabelRelease      = "summit.dev/release"
	LabelManagedBy    = "summit.dev/managed-by"
	LabelAppName      = "app.kubernetes.io/name"
	LabelAppInstance  = "app.kubernetes.io/instance"
	LabelAppManaged   = "app.kubernetes.io/managed-by"
	LabelAppPartOf    = "app.kubernetes.io/part-of"
	LabelAppComponent = "app.kubernetes.io/component"

	// ValueManagedBy is the standardized manager value for Summit resources.
	ValueManagedBy = "summit-orchestrator"
	// ValuePartOf is the platform product family name.
	ValuePartOf = "summit"
	// ValueComponentBackend is the component identifier for backend services.
	ValueComponentBackend = "backend-service"
)

// SchemeGroupVersion is group version used to register these objects.
var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: Version}

var (
	// digestRegex verifies immutable OCI image references pinned with an exact 64-hex SHA-256 digest.
	digestRegex = regexp.MustCompile(`^[a-zA-Z0-9_.\-/:~]+@sha256:[a-fA-F0-9]{64}$`)

	ErrInvalidImageDigest = errors.New("workloads: image must be an immutable reference pinned with sha256 digest (@sha256:<64-hex>)")
	ErrInvalidPort        = errors.New("workloads: port must be between 1 and 65535")
	ErrNegativeReplicas   = errors.New("workloads: replicas cannot be negative")
	ErrMissingName        = errors.New("workloads: service metadata.name is required")
	ErrMissingNamespace   = errors.New("workloads: service metadata.namespace is required")
	ErrInvalidResources   = errors.New("workloads: resource requests cannot exceed limits")
)

// Phase defines the high-level reconciliation status of a SummitService.
type Phase string

const (
	PhasePending     Phase = "Pending"
	PhaseProgressing Phase = "Progressing"
	PhaseAvailable   Phase = "Available"
	PhaseFailed      Phase = "Failed"
)

// SummitServiceSpec defines the desired state of a namespaced backend service workload.
type SummitServiceSpec struct {
	// Image is the immutable container image reference pinned by sha256 digest.
	// Example: ghcr.io/summit/sample-backend@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
	Image string `json:"image"`

	// Replicas is the desired number of pod instances. Defaults to 1 if nil.
	Replicas *int32 `json:"replicas,omitempty"`

	// Port is the internal listening port for the container and ClusterIP service. Defaults to 8080.
	Port int32 `json:"port,omitempty"`

	// PullSecretName is the name of the GHCR image pull secret within the target namespace. Defaults to ghcr-pull.
	PullSecretName string `json:"pullSecretName,omitempty"`

	// TenantID is the platform tenant identifier for multi-tenant isolation and labeling.
	TenantID string `json:"tenantId,omitempty"`

	// ProjectID is the unique project identifier.
	ProjectID string `json:"projectId,omitempty"`

	// ServiceID is the unique service identifier within the project.
	ServiceID string `json:"serviceId,omitempty"`

	// ReleaseID is the release deployment identifier associated with this workload generation.
	ReleaseID string `json:"releaseId,omitempty"`

	// Resources defines CPU, memory, and ephemeral-storage requests and limits.
	Resources corev1.ResourceRequirements `json:"resources,omitempty"`

	// Env specifies optional environment variables to inject into the backend service container.
	Env []corev1.EnvVar `json:"env,omitempty"`
}

// SummitServiceStatus defines the observed reconciliation state of a SummitService.
type SummitServiceStatus struct {
	Phase              Phase              `json:"phase,omitempty"`
	ObservedGeneration int64              `json:"observedGeneration,omitempty"`
	ReadyReplicas      int32              `json:"readyReplicas,omitempty"`
	DeploymentName     string             `json:"deploymentName,omitempty"`
	ServiceName        string             `json:"serviceName,omitempty"`
	Conditions         []metav1.Condition `json:"conditions,omitempty"`
}

// SummitService represents the desired state and status of a Summit PaaS backend service.
type SummitService struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   SummitServiceSpec   `json:"spec,omitempty"`
	Status SummitServiceStatus `json:"status,omitempty"`
}

// SummitServiceList contains a list of SummitService resources.
type SummitServiceList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []SummitService `json:"items"`
}

// SetDefaults applies standard defaults to unpopulated spec fields.
func (s *SummitService) SetDefaults() {
	if s.TypeMeta.APIVersion == "" {
		s.TypeMeta.APIVersion = SchemeGroupVersion.String()
	}
	if s.TypeMeta.Kind == "" {
		s.TypeMeta.Kind = KindSummitService
	}
	if s.Spec.Port == 0 {
		s.Spec.Port = DefaultPort
	}
	if s.Spec.Replicas == nil {
		rep := DefaultReplicas
		s.Spec.Replicas = &rep
	}
	if strings.TrimSpace(s.Spec.PullSecretName) == "" {
		s.Spec.PullSecretName = DefaultPullSecretName
	}
}

// Validate checks that all required fields satisfy platform security and operational rules.
func (s *SummitService) Validate() error {
	if strings.TrimSpace(s.Name) == "" {
		return ErrMissingName
	}
	if strings.TrimSpace(s.Namespace) == "" {
		return ErrMissingNamespace
	}

	image := strings.TrimSpace(s.Spec.Image)
	if image == "" || !digestRegex.MatchString(image) {
		return fmt.Errorf("%w: got %q", ErrInvalidImageDigest, s.Spec.Image)
	}

	if s.Spec.Port < 0 || s.Spec.Port > 65535 || (s.Spec.Port != 0 && s.Spec.Port < 1) {
		return fmt.Errorf("%w: got %d", ErrInvalidPort, s.Spec.Port)
	}

	if s.Spec.Replicas != nil && *s.Spec.Replicas < 0 {
		return fmt.Errorf("%w: got %d", ErrNegativeReplicas, *s.Spec.Replicas)
	}

	if err := validateResourceBounds(s.Spec.Resources); err != nil {
		return err
	}

	return nil
}

// validateResourceBounds verifies that compute requests do not exceed compute limits when both are present.
func validateResourceBounds(res corev1.ResourceRequirements) error {
	if res.Requests == nil || res.Limits == nil {
		return nil
	}

	if reqCPU, hasReq := res.Requests[corev1.ResourceCPU]; hasReq {
		if limCPU, hasLim := res.Limits[corev1.ResourceCPU]; hasLim {
			if reqCPU.Cmp(limCPU) > 0 {
				return fmt.Errorf("%w: cpu request %s exceeds limit %s", ErrInvalidResources, reqCPU.String(), limCPU.String())
			}
		}
	}

	if reqMem, hasReq := res.Requests[corev1.ResourceMemory]; hasReq {
		if limMem, hasLim := res.Limits[corev1.ResourceMemory]; hasLim {
			if reqMem.Cmp(limMem) > 0 {
				return fmt.Errorf("%w: memory request %s exceeds limit %s", ErrInvalidResources, reqMem.String(), limMem.String())
			}
		}
	}

	return nil
}

// SafeLabels returns platform-compliant operational, tenancy, and tracking labels.
func (s *SummitService) SafeLabels() map[string]string {
	labels := map[string]string{
		LabelAppName:      s.Name,
		LabelAppInstance:  s.Name,
		LabelAppManaged:   ValueManagedBy,
		LabelAppPartOf:    ValuePartOf,
		LabelAppComponent: ValueComponentBackend,
		LabelManagedBy:    ValueManagedBy,
	}

	if s.Spec.TenantID != "" {
		labels[LabelTenant] = s.Spec.TenantID
	}
	if s.Spec.ProjectID != "" {
		labels[LabelProject] = s.Spec.ProjectID
	}
	if s.Spec.ServiceID != "" {
		labels[LabelService] = s.Spec.ServiceID
	}
	if s.Spec.ReleaseID != "" {
		labels[LabelRelease] = s.Spec.ReleaseID
	}

	return labels
}

// SelectorLabels returns standard, immutable match labels for Deployment pod selector and Service endpoints.
func (s *SummitService) SelectorLabels() map[string]string {
	sel := map[string]string{
		LabelAppName:      s.Name,
		LabelAppComponent: ValueComponentBackend,
	}
	if s.Spec.ServiceID != "" {
		sel[LabelService] = s.Spec.ServiceID
	}
	return sel
}

// MakeOwnerReference creates an OwnerReference referencing this SummitService custom resource.
func (s *SummitService) MakeOwnerReference() metav1.OwnerReference {
	isController := true
	blockOwnerDeletion := true
	return metav1.OwnerReference{
		APIVersion:         SchemeGroupVersion.String(),
		Kind:               KindSummitService,
		Name:               s.Name,
		UID:                s.UID,
		Controller:         &isController,
		BlockOwnerDeletion: &blockOwnerDeletion,
	}
}
