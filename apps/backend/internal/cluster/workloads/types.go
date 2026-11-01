package workloads

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/resource"
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

	// DefaultPort is the default backend container listening port and ClusterIP target port.
	DefaultPort int32 = 8080
	// DefaultReplicas is the default number of deployment replicas.
	DefaultReplicas int32 = 1
	// DefaultPullSecretName is the standard GHCR pull secret configured in the tenant namespace.
	DefaultPullSecretName = "ghcr-pull"

	// PostgreSQL workload constants.
	DefaultPostgresPort         int32 = 5432
	DefaultPostgresMajorVersion       = "16"
	DefaultPostgresImage              = "postgres:16.8-alpine@sha256:3b057e1c2c6dfee60a30950096f3fab33be141dbb0fdd7af3d477083de94166c"
	DefaultPostgresDatabase           = "summit"
	DefaultPostgresUser               = "postgres"
	DefaultPostgresUID          int64 = 70
	DefaultPostgresGID          int64 = 70

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
	// ValueComponentDatabase is the component identifier for tenant databases.
	ValueComponentDatabase = "database"
)

// WorkloadType defines the architectural kind of workload (stateless backend vs stateful database).
type WorkloadType string

const (
	WorkloadTypeBackend  WorkloadType = "backend"
	WorkloadTypePostgres WorkloadType = "postgres"
)

// SchemeGroupVersion is group version used to register these objects.
var SchemeGroupVersion = schema.GroupVersion{Group: GroupName, Version: Version}

var (
	// digestRegex verifies immutable OCI image references pinned with an exact 64-hex SHA-256 digest.
	digestRegex             = regexp.MustCompile(`^[a-zA-Z0-9_.\-/:~]+@sha256:[a-fA-F0-9]{64}$`)
	postgresIdentifierRegex = regexp.MustCompile(`^[a-z_][a-z0-9_]{0,62}$`)

	ErrInvalidImageDigest         = errors.New("workloads: image must be an immutable reference pinned with sha256 digest (@sha256:<64-hex>)")
	ErrInvalidPort                = errors.New("workloads: port must be between 1 and 65535")
	ErrNegativeReplicas           = errors.New("workloads: replicas cannot be negative")
	ErrMissingName                = errors.New("workloads: service metadata.name is required")
	ErrMissingNamespace           = errors.New("workloads: service metadata.namespace is required")
	ErrInvalidResources           = errors.New("workloads: resource requests cannot exceed limits")
	ErrMissingStorageClass        = errors.New("workloads: postgres storageClassName must be explicitly configured; cluster default storage class is not permitted")
	ErrMissingStorageSize         = errors.New("workloads: postgres storage size must be explicitly configured")
	ErrInvalidStorageSize         = errors.New("workloads: postgres storage size is invalid")
	ErrMissingSecretRefName       = errors.New("workloads: postgres auth secretRef.name is required")
	ErrMissingSecretRefKey        = errors.New("workloads: postgres auth secretRef.key is required")
	ErrInvalidPostgresReplicas    = errors.New("workloads: postgres workload requires exactly 1 replica for MVP")
	ErrImmutableStorageClass      = errors.New("workloads: postgres storageClassName is immutable and cannot be changed on an existing workload")
	ErrImmutableVolumeClaim       = errors.New("workloads: postgres volumeClaimTemplate is immutable and cannot be changed on an existing workload")
	ErrUnsupportedPostgresVersion = errors.New("workloads: unsupported postgres major version")
	ErrConflictingWorkloadType    = errors.New("workloads: postgres configuration cannot be set when workload type is backend")
	ErrPlaintextPasswordForbidden = errors.New("workloads: plaintext POSTGRES_PASSWORD in env is forbidden; use auth.secretRef instead")
	ErrPostgresEnvUnsupported     = errors.New("workloads: custom env is not supported for postgres; use typed postgres settings")
	ErrInvalidPostgresIdentifier  = errors.New("workloads: postgres database and username must be lowercase identifiers of at most 63 characters")
	ErrInvalidPostgresPort        = errors.New("workloads: postgres port is fixed at 5432")
)

// Phase defines the high-level reconciliation status of a SummitService.
type Phase string

const (
	PhasePending     Phase = "Pending"
	PhaseProgressing Phase = "Progressing"
	PhaseAvailable   Phase = "Available"
	PhaseFailed      Phase = "Failed"
)

// PostgresSecretRef references a Kubernetes Secret holding the database password.
type PostgresSecretRef struct {
	// Name is the name of the Kubernetes Secret in the same namespace.
	Name string `json:"name"`
	// Key is the key within the Secret holding the password value.
	Key string `json:"key"`
}

// PostgresAuthSpec defines credential references for the PostgreSQL database.
// Plaintext passwords must never be stored in this specification.
type PostgresAuthSpec struct {
	// SecretRef references a Kubernetes Secret key containing the database password.
	SecretRef PostgresSecretRef `json:"secretRef"`
}

// PostgresStorageSpec defines explicit storage parameters for the PostgreSQL database.
type PostgresStorageSpec struct {
	// StorageClassName must be explicitly configured. Using cluster default is strictly forbidden.
	StorageClassName string `json:"storageClassName"`
	// Size is the requested persistent storage volume size (e.g. "10Gi").
	Size string `json:"size"`
}

// PostgresSpec specifies the desired state for a managed single-instance PostgreSQL database workload.
type PostgresSpec struct {
	// Version is the deliberate PostgreSQL major version (default: "16").
	Version string `json:"version,omitempty"`
	// Image is an optional immutable digest-pinned image override.
	// If omitted, DefaultPostgresImage is used.
	Image string `json:"image,omitempty"`
	// Storage defines the explicit StorageClass and volume size.
	Storage PostgresStorageSpec `json:"storage"`
	// Auth references the Secret containing the password.
	Auth PostgresAuthSpec `json:"auth"`
	// DatabaseName is the default database to create (defaults to "summit").
	DatabaseName string `json:"databaseName,omitempty"`
	// Username is the default admin/app user (defaults to "postgres").
	Username string `json:"username,omitempty"`
}

// SummitServiceSpec defines the desired state of a namespaced backend or database service workload.
type SummitServiceSpec struct {
	// Type specifies the workload architectural type: "backend" (default) or "postgres".
	Type WorkloadType `json:"type,omitempty"`

	// Postgres contains the specification for a PostgreSQL database workload.
	Postgres *PostgresSpec `json:"postgres,omitempty"`

	// Image is the immutable container image reference pinned by sha256 digest.
	// Example: ghcr.io/summit/sample-backend@sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
	Image string `json:"image,omitempty"`

	// Replicas is the desired number of pod instances. Defaults to 1 if nil.
	Replicas *int32 `json:"replicas,omitempty"`

	// Port is the internal listening port for the container and ClusterIP service. Defaults to 8080 (backend) or 5432 (postgres).
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

	// Env specifies optional environment variables to inject into the service container.
	Env []corev1.EnvVar `json:"env,omitempty"`
}

// SummitServiceStatus defines the observed reconciliation state of a SummitService.
type SummitServiceStatus struct {
	Phase              Phase              `json:"phase,omitempty"`
	ObservedGeneration int64              `json:"observedGeneration,omitempty"`
	ReadyReplicas      int32              `json:"readyReplicas,omitempty"`
	DeploymentName     string             `json:"deploymentName,omitempty"`
	StatefulSetName    string             `json:"statefulSetName,omitempty"`
	ServiceName        string             `json:"serviceName,omitempty"`
	Conditions         []metav1.Condition `json:"conditions,omitempty"`
}

// SummitService represents the desired state and status of a Summit PaaS backend service or database workload.
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

// IsPostgres returns true if this SummitService represents a PostgreSQL database workload.
func (s *SummitService) IsPostgres() bool {
	return s.Spec.Type == WorkloadTypePostgres || s.Spec.Postgres != nil
}

// SetDefaults applies standard defaults to unpopulated spec fields.
func (s *SummitService) SetDefaults() {
	if s.TypeMeta.APIVersion == "" {
		s.TypeMeta.APIVersion = SchemeGroupVersion.String()
	}
	if s.TypeMeta.Kind == "" {
		s.TypeMeta.Kind = KindSummitService
	}

	if s.IsPostgres() {
		s.Spec.Type = WorkloadTypePostgres
		if s.Spec.Postgres == nil {
			s.Spec.Postgres = &PostgresSpec{}
		}
		if s.Spec.Port == 0 {
			s.Spec.Port = DefaultPostgresPort
		}
		if s.Spec.Replicas == nil {
			rep := DefaultReplicas
			s.Spec.Replicas = &rep
		}
		if s.Spec.Postgres.Version == "" {
			s.Spec.Postgres.Version = DefaultPostgresMajorVersion
		}
		if s.Spec.Postgres.DatabaseName == "" {
			s.Spec.Postgres.DatabaseName = DefaultPostgresDatabase
		}
		if s.Spec.Postgres.Username == "" {
			s.Spec.Postgres.Username = DefaultPostgresUser
		}
		// Synchronize image defaults
		if s.Spec.Postgres.Image != "" && s.Spec.Image == "" {
			s.Spec.Image = s.Spec.Postgres.Image
		} else if s.Spec.Image != "" && s.Spec.Postgres.Image == "" {
			s.Spec.Postgres.Image = s.Spec.Image
		} else if s.Spec.Image == "" && s.Spec.Postgres.Image == "" {
			s.Spec.Image = DefaultPostgresImage
			s.Spec.Postgres.Image = DefaultPostgresImage
		}
	} else {
		if s.Spec.Type == "" {
			s.Spec.Type = WorkloadTypeBackend
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
}

// Validate checks that all required fields satisfy platform security and operational rules.
func (s *SummitService) Validate() error {
	if strings.TrimSpace(s.Name) == "" {
		return ErrMissingName
	}
	if strings.TrimSpace(s.Namespace) == "" {
		return ErrMissingNamespace
	}

	if s.Spec.Type == WorkloadTypeBackend && s.Spec.Postgres != nil {
		return ErrConflictingWorkloadType
	}

	if s.IsPostgres() {
		if s.Spec.Postgres == nil {
			return errors.New("workloads: postgres workload requires postgres specification")
		}

		if s.Spec.Replicas != nil && *s.Spec.Replicas != 1 {
			return fmt.Errorf("%w: got %d", ErrInvalidPostgresReplicas, *s.Spec.Replicas)
		}

		// Validate deliberate major version
		if s.Spec.Postgres.Version != "" && s.Spec.Postgres.Version != DefaultPostgresMajorVersion {
			return fmt.Errorf("%w: version %q not supported; only major version %s is supported for MVP", ErrUnsupportedPostgresVersion, s.Spec.Postgres.Version, DefaultPostgresMajorVersion)
		}

		// Validate image digest
		image := strings.TrimSpace(s.Spec.Image)
		if image == "" || !digestRegex.MatchString(image) {
			return fmt.Errorf("%w: got %q", ErrInvalidImageDigest, s.Spec.Image)
		}
		if s.Spec.Postgres.Image != "" {
			pgImage := strings.TrimSpace(s.Spec.Postgres.Image)
			if !digestRegex.MatchString(pgImage) {
				return fmt.Errorf("%w: got %q", ErrInvalidImageDigest, s.Spec.Postgres.Image)
			}
			if s.Spec.Image != "" && s.Spec.Image != pgImage {
				return fmt.Errorf("workloads: conflicting image references: spec.image=%q vs spec.postgres.image=%q", s.Spec.Image, s.Spec.Postgres.Image)
			}
		}

		// Storage validation - explicit StorageClass and size required
		sc := strings.TrimSpace(s.Spec.Postgres.Storage.StorageClassName)
		if sc == "" {
			return ErrMissingStorageClass
		}
		rawSize := strings.TrimSpace(s.Spec.Postgres.Storage.Size)
		if rawSize == "" {
			return ErrMissingStorageSize
		}
		qty, err := resource.ParseQuantity(rawSize)
		if err != nil || qty.Sign() <= 0 {
			return fmt.Errorf("%w: %q", ErrInvalidStorageSize, rawSize)
		}

		// Auth validation - secret reference required, no plaintext credentials
		if strings.TrimSpace(s.Spec.Postgres.Auth.SecretRef.Name) == "" {
			return ErrMissingSecretRefName
		}
		if strings.TrimSpace(s.Spec.Postgres.Auth.SecretRef.Key) == "" {
			return ErrMissingSecretRefKey
		}

		// PostgreSQL image initialization is controlled only through typed spec
		// fields. Arbitrary env vars could bypass password auth (for example
		// POSTGRES_HOST_AUTH_METHOD=trust) or inject a plaintext password.
		if len(s.Spec.Env) > 0 {
			for _, env := range s.Spec.Env {
				if env.Name == "POSTGRES_PASSWORD" || env.Name == "PGPASSWORD" {
					return ErrPlaintextPasswordForbidden
				}
			}
			return ErrPostgresEnvUnsupported
		}
		if s.Spec.Port != 0 && s.Spec.Port != DefaultPostgresPort {
			return fmt.Errorf("%w: got %d", ErrInvalidPostgresPort, s.Spec.Port)
		}
		if !postgresIdentifierRegex.MatchString(s.Spec.Postgres.Username) || !postgresIdentifierRegex.MatchString(s.Spec.Postgres.DatabaseName) {
			return ErrInvalidPostgresIdentifier
		}
	} else {
		image := strings.TrimSpace(s.Spec.Image)
		if image == "" || !digestRegex.MatchString(image) {
			return fmt.Errorf("%w: got %q", ErrInvalidImageDigest, s.Spec.Image)
		}
		if s.Spec.Replicas != nil && *s.Spec.Replicas < 0 {
			return fmt.Errorf("%w: got %d", ErrNegativeReplicas, *s.Spec.Replicas)
		}
	}

	if s.Spec.Port < 0 || s.Spec.Port > 65535 || (s.Spec.Port != 0 && s.Spec.Port < 1) {
		return fmt.Errorf("%w: got %d", ErrInvalidPort, s.Spec.Port)
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

	if reqStorage, hasReq := res.Requests[corev1.ResourceEphemeralStorage]; hasReq {
		if limStorage, hasLim := res.Limits[corev1.ResourceEphemeralStorage]; hasLim {
			if reqStorage.Cmp(limStorage) > 0 {
				return fmt.Errorf("%w: ephemeral-storage request %s exceeds limit %s", ErrInvalidResources, reqStorage.String(), limStorage.String())
			}
		}
	}

	return nil
}

// SafeLabels returns platform-compliant operational, tenancy, and tracking labels.
func (s *SummitService) SafeLabels() map[string]string {
	component := ValueComponentBackend
	if s.IsPostgres() {
		component = ValueComponentDatabase
	}
	labels := map[string]string{
		LabelAppName:      s.Name,
		LabelAppInstance:  s.Name,
		LabelAppManaged:   ValueManagedBy,
		LabelAppPartOf:    ValuePartOf,
		LabelAppComponent: component,
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

// SelectorLabels returns standard, immutable match labels for pod selectors and Service endpoints.
func (s *SummitService) SelectorLabels() map[string]string {
	component := ValueComponentBackend
	if s.IsPostgres() {
		component = ValueComponentDatabase
	}
	sel := map[string]string{
		LabelAppName:      s.Name,
		LabelAppComponent: component,
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
