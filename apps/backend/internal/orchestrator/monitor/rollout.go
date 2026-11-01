package monitor

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	"github.com/google/uuid"
	"github.com/summit/backend/internal/cluster/addons"
	"github.com/summit/backend/internal/cluster/managed"
	"github.com/summit/backend/internal/cluster/workloads"
	"github.com/summit/backend/internal/platformdb"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// ServiceExposure is the subset of the tenant provisioner the monitor calls.
type ServiceExposure interface {
	EnsureTenant(ctx context.Context, userID string) (addons.Result, error)
	EnsureServiceExposure(ctx context.Context, params addons.ExposureParams) (addons.Result, error)
}

// addonRuntime provisions and observes a managed postgres or redis workload.
type addonRuntime interface {
	Provision(ctx context.Context, req managed.Request) (managed.Result, error)
	Ready(ctx context.Context, namespace, serviceID string) (exists bool, ready bool, err error)
}

// WithManagedAddon installs the postgres/redis provisioner.
func WithManagedAddon(p addonRuntime) Option {
	return func(m *Monitor) {
		m.managedAddon = p
	}
}

// WithAddonLister installs environment addon lookup for connection injection.
func WithAddonLister(l AddonLister) Option {
	return func(m *Monitor) {
		m.addons = l
	}
}

// WithVolumeSizer installs service_addons.storage_mb lookup.
func WithVolumeSizer(v VolumeSizer) Option {
	return func(m *Monitor) {
		m.volumes = v
	}
}

func hasBuildJob(active *platformdb.ActiveDeployment) bool {
	return active != nil && active.BuildJob.ID != uuid.Nil
}

func isAddon(serviceType string) bool {
	return managed.IsEngine(serviceType)
}

func isWorker(serviceType string) bool {
	return strings.EqualFold(strings.TrimSpace(serviceType), "worker")
}

func tenantNamespace(userID uuid.UUID) string {
	return "tenant-" + userID.String()
}

func workloadObjectName(serviceID uuid.UUID) string {
	return "svc-" + serviceID.String()
}

func imageRefOf(active *platformdb.ActiveDeployment) string {
	if active == nil {
		return ""
	}
	if ref := deref(active.Deployment.ImageRef); ref != "" {
		return ref
	}
	if hasBuildJob(active) {
		return active.BuildJob.ImageRef()
	}
	return ""
}

func (m *Monitor) reconcileImageReady(ctx context.Context, active *platformdb.ActiveDeployment) error {
	if isAddon(active.ServiceType) {
		return m.reconcileAddonReady(ctx, active)
	}
	return m.reconcileWorkloadReady(ctx, active)
}

func (m *Monitor) reconcileAddonReady(ctx context.Context, active *platformdb.ActiveDeployment) error {
	if m.managedAddon == nil {
		return fmt.Errorf("deployment %s: managed addon provisioner is not configured", active.Deployment.ID)
	}
	namespace := tenantNamespace(active.UserID)
	if m.provisioner != nil {
		if _, err := m.provisioner.EnsureTenant(ctx, active.UserID.String()); err != nil {
			return fmt.Errorf("ensure tenant namespace: %w", err)
		}
	}
	storageMB, err := m.storageMB(ctx, active)
	if err != nil {
		return err
	}
	res, err := m.managedAddon.Provision(ctx, managed.Request{
		Namespace:            namespace,
		TenantID:             active.UserID.String(),
		ProjectID:            active.ProjectID.String(),
		ServiceID:            active.ServiceID.String(),
		Engine:               active.ServiceType,
		StorageMB:            storageMB,
		CPURequestMillicores: active.Resources.CPURequestMillicores,
		CPULimitMillicores:   active.Resources.CPULimitMillicores,
		MemoryRequestMB:      active.Resources.MemoryRequestMB,
		MemoryLimitMB:        active.Resources.MemoryLimitMB,
	})
	if err != nil {
		return err
	}
	// Addons are not published. There is no IngressRoute and no public URL.
	_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentImageReady}, platformdb.DeploymentDeploying, "managed addon applied", platformdb.WithImageRef(res.Image))
	return err
}

func (m *Monitor) reconcileWorkloadReady(ctx context.Context, active *platformdb.ActiveDeployment) error {
	imageRef := imageRefOf(active)
	if imageRef == "" {
		return fmt.Errorf("deployment %s has no image reference", active.Deployment.ID)
	}
	serviceName := workloadObjectName(active.ServiceID)
	namespace := tenantNamespace(active.UserID)
	port := int32(active.Resources.Port)
	if port <= 0 {
		port = workloads.DefaultPort
	}
	replicas := int32(active.Resources.MinReplicas)
	if replicas <= 0 {
		replicas = workloads.DefaultReplicas
	}
	pullSecret := m.cfg.WorkloadPullSecret
	if strings.TrimSpace(pullSecret) == "" {
		pullSecret = workloads.DefaultPullSecretName
	}

	var existingEnv []corev1.EnvVar
	if m.dynClient != nil {
		gvr := workloads.SchemeGroupVersion.WithResource("summitservices")
		existing, err := m.dynClient.Resource(gvr).Namespace(namespace).Get(ctx, serviceName, metav1.GetOptions{})
		if err != nil && !apierrors.IsNotFound(err) {
			return fmt.Errorf("get SummitService: %w", err)
		}
		if err == nil {
			existingEnv, err = envFromUnstructured(existing)
			if err != nil {
				return err
			}
		}
	}
	envAddons, err := m.environmentAddons(ctx, active.EnvironmentID)
	if err != nil {
		return err
	}

	summitSvc := &workloads.SummitService{
		TypeMeta: metav1.TypeMeta{
			APIVersion: workloads.SchemeGroupVersion.String(),
			Kind:       workloads.KindSummitService,
		},
		ObjectMeta: metav1.ObjectMeta{Name: serviceName, Namespace: namespace},
		Spec: workloads.SummitServiceSpec{
			Image:          imageRef,
			Replicas:       &replicas,
			Port:           port,
			PullSecretName: pullSecret,
			TenantID:       active.UserID.String(),
			ProjectID:      active.ProjectID.String(),
			ServiceID:      active.ServiceID.String(),
			ReleaseID:      active.Deployment.ID.String(),
			Resources:      workloadResources(active.Resources),
			Env:            MergeAddonEnv(existingEnv, envAddons),
		},
	}
	summitSvc.SetDefaults()

	// The tenant namespace must exist before the SummitService is applied into it. It may be
	// missing on a user's first deploy or after their last service was deleted.
	if m.provisioner != nil {
		if _, err := m.provisioner.EnsureTenant(ctx, active.UserID.String()); err != nil {
			return fmt.Errorf("ensure tenant namespace: %w", err)
		}
	}

	if m.dynClient != nil {
		if err := m.applySummitService(ctx, summitSvc); err != nil {
			return err
		}
	}

	var publicURL string
	if m.provisioner != nil {
		expRes, err := m.provisioner.EnsureServiceExposure(ctx, addons.ExposureParams{
			UserID:      active.UserID.String(),
			ProjectID:   active.ProjectID.String(),
			ProjectSlug: active.ProjectSlug,
			ServiceID:   active.ServiceID.String(),
			ServiceName: serviceName,
			HostLabel:   active.ServiceName,
			Port:        port,
			Environment: active.EnvironmentName,
			SkipIngress: isWorker(active.ServiceType),
		})
		if err != nil {
			return fmt.Errorf("expose service: %w", err)
		}
		if expRes.Host != "" && !isWorker(active.ServiceType) {
			publicURL, err = FormatPublicURL(m.cfg.PublicURLScheme, expRes.Host, m.cfg.PublicURLPort)
			if err != nil {
				return err
			}
		}
	}

	opts := []platformdb.TransitionOption{platformdb.WithImageRef(imageRef)}
	if publicURL != "" {
		opts = append(opts, platformdb.WithPublicURL(publicURL))
	}
	_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentImageReady}, platformdb.DeploymentDeploying, "SummitService applied", opts...)
	return err
}

func (m *Monitor) applySummitService(ctx context.Context, summitSvc *workloads.SummitService) error {
	gvr := workloads.SchemeGroupVersion.WithResource("summitservices")
	unstrMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(summitSvc)
	if err != nil {
		return fmt.Errorf("converting SummitService: %w", err)
	}
	unstr := &unstructured.Unstructured{Object: unstrMap}
	unstr.SetLabels(summitSvc.SafeLabels())
	namespace, serviceName := summitSvc.Namespace, summitSvc.Name

	existing, err := m.dynClient.Resource(gvr).Namespace(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		_, err = m.dynClient.Resource(gvr).Namespace(namespace).Create(ctx, unstr, metav1.CreateOptions{})
	} else if err == nil {
		existing.Object["spec"] = unstr.Object["spec"]
		existing.SetLabels(summitSvc.SafeLabels())
		_, err = m.dynClient.Resource(gvr).Namespace(namespace).Update(ctx, existing, metav1.UpdateOptions{})
	}
	if err != nil {
		return fmt.Errorf("applying SummitService resource: %w", err)
	}
	return nil
}

func (m *Monitor) reconcileDeploying(ctx context.Context, active *platformdb.ActiveDeployment) error {
	namespace := tenantNamespace(active.UserID)
	if isAddon(active.ServiceType) {
		if m.managedAddon == nil {
			return nil
		}
		exists, _, err := m.managedAddon.Ready(ctx, namespace, active.ServiceID.String())
		if err != nil || !exists {
			return err
		}
		_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentDeploying}, platformdb.DeploymentHealthChecking, "addon statefulset created; awaiting readiness")
		return err
	}
	if m.kubeClient == nil {
		return nil
	}
	serviceName := workloadObjectName(active.ServiceID)
	dep, err := m.kubeClient.AppsV1().Deployments(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err == nil && dep != nil {
		_, err = m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentDeploying}, platformdb.DeploymentHealthChecking, "workload deployment created; awaiting readiness")
		return err
	}
	return nil
}

func (m *Monitor) reconcileHealth(ctx context.Context, active *platformdb.ActiveDeployment) error {
	namespace := tenantNamespace(active.UserID)
	if isAddon(active.ServiceType) {
		if m.managedAddon == nil {
			return nil
		}
		_, ready, err := m.managedAddon.Ready(ctx, namespace, active.ServiceID.String())
		if err != nil {
			return err
		}
		if ready {
			return m.markRunning(ctx, active)
		}
		return m.failIfRolloutTimedOut(ctx, active)
	}
	if m.kubeClient == nil {
		return nil
	}
	serviceName := workloadObjectName(active.ServiceID)
	dep, err := m.kubeClient.AppsV1().Deployments(namespace).Get(ctx, serviceName, metav1.GetOptions{})
	if err != nil || dep == nil {
		return nil
	}
	replicas := int32(1)
	if dep.Spec.Replicas != nil {
		replicas = *dep.Spec.Replicas
	}
	if dep.Status.AvailableReplicas >= replicas && dep.Status.UpdatedReplicas >= replicas {
		return m.markRunning(ctx, active)
	}
	return m.failIfRolloutTimedOut(ctx, active)
}

func (m *Monitor) markRunning(ctx context.Context, active *platformdb.ActiveDeployment) error {
	_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentHealthChecking}, platformdb.DeploymentRunning, "workload healthy and available")
	if err != nil {
		return err
	}
	promRes, promErr := m.rolloutStore.PromoteRelease(ctx, active.Deployment.ID, nil)
	if promErr != nil {
		m.logger.Warn("failed to promote release after reaching running", "deployment_id", active.Deployment.ID, "error", promErr)
	} else {
		m.logger.Info("promoted active release", "deployment_id", active.Deployment.ID, "release_number", promRes.Release.ReleaseNumber, "superseded", len(promRes.SupersededDeploymentIDs))
	}
	return nil
}

func (m *Monitor) failIfRolloutTimedOut(ctx context.Context, active *platformdb.ActiveDeployment) error {
	if active.Deployment.StartedAt != nil && m.now().Sub(*active.Deployment.StartedAt) > m.cfg.RolloutTimeout {
		msg := "deployment timed out awaiting available replicas"
		_, err := m.rolloutStore.TransitionDeployment(ctx, active.Deployment.ID, []platformdb.DeploymentStatus{platformdb.DeploymentHealthChecking}, platformdb.DeploymentFailed, msg, platformdb.WithErrorMessage(msg))
		return err
	}
	return nil
}

func (m *Monitor) environmentAddons(ctx context.Context, environmentID uuid.UUID) ([]EnvironmentAddon, error) {
	if m.addons == nil || environmentID == uuid.Nil {
		return nil, nil
	}
	addons, err := m.addons.ListEnvironmentAddons(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("list environment addons: %w", err)
	}
	return addons, nil
}

func (m *Monitor) storageMB(ctx context.Context, active *platformdb.ActiveDeployment) (int, error) {
	if m.volumes != nil {
		mb, err := m.volumes.AddonStorageMB(ctx, active.ServiceID)
		if err != nil {
			return 0, fmt.Errorf("addon storage: %w", err)
		}
		if mb > 0 {
			return mb, nil
		}
	}
	return storageMBFromActive(active), nil
}

func storageMBFromActive(active *platformdb.ActiveDeployment) int {
	if active == nil {
		return 0
	}
	v := reflect.ValueOf(*active)
	if mb := exportedInt(v, "StorageMB"); mb > 0 {
		return mb
	}
	if res := v.FieldByName("Resources"); res.IsValid() {
		if mb := exportedInt(res, "StorageMB"); mb > 0 {
			return mb
		}
	}
	return 0
}

func exportedInt(v reflect.Value, name string) int {
	f := v.FieldByName(name)
	if !f.IsValid() || !f.CanInt() {
		return 0
	}
	return int(f.Int())
}

func workloadResources(res platformdb.ServiceResources) corev1.ResourceRequirements {
	return corev1.ResourceRequirements{
		Requests: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse(fmt.Sprintf("%dm", res.CPURequestMillicores)),
			corev1.ResourceMemory: resource.MustParse(fmt.Sprintf("%dMi", res.MemoryRequestMB)),
		},
		Limits: corev1.ResourceList{
			corev1.ResourceCPU:    resource.MustParse(fmt.Sprintf("%dm", res.CPULimitMillicores)),
			corev1.ResourceMemory: resource.MustParse(fmt.Sprintf("%dMi", res.MemoryLimitMB)),
		},
	}
}

func envFromUnstructured(u *unstructured.Unstructured) ([]corev1.EnvVar, error) {
	if u == nil {
		return nil, nil
	}
	var svc workloads.SummitService
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, &svc); err != nil {
		return nil, fmt.Errorf("reading SummitService env: %w", err)
	}
	return svc.Spec.Env, nil
}
