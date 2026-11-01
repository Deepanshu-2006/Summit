package workloads

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
)

// ReconcileResult summarizes the mutations performed during reconciliation.
type ReconcileResult struct {
	NamespaceCreated  bool   `json:"namespace_created"`
	DeploymentCreated bool   `json:"deployment_created"`
	DeploymentUpdated bool   `json:"deployment_updated"`
	ServiceCreated    bool   `json:"service_created"`
	ServiceUpdated    bool   `json:"service_updated"`
	Phase             Phase  `json:"phase"`
	DeploymentName    string `json:"deployment_name"`
	ServiceName       string `json:"service_name"`
}

// Reconciler executes idempotent reconciliation of SummitService custom resources
// into Kubernetes Namespaces, Deployments, and internal ClusterIP Services.
type Reconciler struct {
	client        kubernetes.Interface
	statusClient  dynamic.Interface
	defaultSecret string
	autoNamespace bool
}

// ReconcilerOption customizes the reconciler behavior.
type ReconcilerOption func(*Reconciler)

// WithAutoNamespace enables or disables automatic tenant namespace creation if missing.
func WithAutoNamespace(auto bool) ReconcilerOption {
	return func(r *Reconciler) {
		r.autoNamespace = auto
	}
}

// WithDefaultPullSecret sets a fallback GHCR image pull secret name.
func WithDefaultPullSecret(secretName string) ReconcilerOption {
	return func(r *Reconciler) {
		r.defaultSecret = secretName
	}
}

// WithStatusClient enables persistence of SummitService status through the CRD status subresource.
func WithStatusClient(client dynamic.Interface) ReconcilerOption {
	return func(r *Reconciler) {
		r.statusClient = client
	}
}

// NewReconciler constructs a new workload reconciler.
func NewReconciler(client kubernetes.Interface, opts ...ReconcilerOption) *Reconciler {
	r := &Reconciler{
		client:        client,
		defaultSecret: DefaultPullSecretName,
		autoNamespace: true,
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// Reconcile drives the cluster state to match the desired SummitService specification idempotently.
func (r *Reconciler) Reconcile(ctx context.Context, svc *SummitService) (result *ReconcileResult, reconcileErr error) {
	if svc == nil {
		return nil, fmt.Errorf("workloads: cannot reconcile nil summit service")
	}
	defer func() {
		svc.Status.ObservedGeneration = svc.Generation
		if r.statusClient != nil {
			if err := r.persistStatus(ctx, svc); err != nil && reconcileErr == nil {
				reconcileErr = fmt.Errorf("workloads: persisting SummitService status: %w", err)
			}
		}
	}()

	if err := ctx.Err(); err != nil {
		return nil, err
	}

	svc.SetDefaults()
	if r.defaultSecret != "" && (svc.Spec.PullSecretName == "" || svc.Spec.PullSecretName == DefaultPullSecretName) {
		svc.Spec.PullSecretName = r.defaultSecret
	}

	if err := svc.Validate(); err != nil {
		svc.Status.Phase = PhaseFailed
		setCondition(&svc.Status, "Reconciled", metav1.ConditionFalse, "ValidationError", err.Error())
		return nil, fmt.Errorf("workloads: invalid desired state: %w", err)
	}

	result = &ReconcileResult{
		DeploymentName: svc.Name,
		ServiceName:    svc.Name,
	}

	// 1. Ensure Namespace
	if r.autoNamespace && svc.Namespace != "" {
		nsCreated, err := r.reconcileNamespace(ctx, svc.Namespace, svc.Spec.TenantID)
		if err != nil {
			svc.Status.Phase = PhaseFailed
			setCondition(&svc.Status, "NamespaceReady", metav1.ConditionFalse, "NamespaceReconciliationFailed", err.Error())
			return nil, fmt.Errorf("workloads: reconciling namespace %q failed: %w", svc.Namespace, err)
		}
		result.NamespaceCreated = nsCreated
		setCondition(&svc.Status, "NamespaceReady", metav1.ConditionTrue, "NamespaceReconciled", "Namespace exists and matches tenancy baseline")
	}

	if err := r.dropAbsentPullSecret(ctx, svc); err != nil {
		svc.Status.Phase = PhaseFailed
		setCondition(&svc.Status, "Reconciled", metav1.ConditionFalse, "PullSecretLookupFailed", err.Error())
		return nil, err
	}

	// 2. Reconcile Deployment
	desiredDep, err := BuildDeployment(svc)
	if err != nil {
		svc.Status.Phase = PhaseFailed
		return nil, err
	}

	depCreated, depUpdated, liveDep, err := r.reconcileDeployment(ctx, desiredDep)
	if err != nil {
		svc.Status.Phase = PhaseFailed
		setCondition(&svc.Status, "DeploymentAvailable", metav1.ConditionFalse, "DeploymentReconciliationFailed", err.Error())
		return nil, fmt.Errorf("workloads: reconciling deployment %q failed: %w", svc.Name, err)
	}
	result.DeploymentCreated = depCreated
	result.DeploymentUpdated = depUpdated

	// 3. Reconcile Internal ClusterIP Service
	desiredSvc, err := BuildService(svc)
	if err != nil {
		svc.Status.Phase = PhaseFailed
		return nil, err
	}

	svcCreated, svcUpdated, err := r.reconcileService(ctx, desiredSvc)
	if err != nil {
		svc.Status.Phase = PhaseFailed
		setCondition(&svc.Status, "ServiceReady", metav1.ConditionFalse, "ServiceReconciliationFailed", err.Error())
		return nil, fmt.Errorf("workloads: reconciling clusterip service %q failed: %w", svc.Name, err)
	}
	result.ServiceCreated = svcCreated
	result.ServiceUpdated = svcUpdated
	setCondition(&svc.Status, "ServiceReady", metav1.ConditionTrue, "ServiceConfigured", "Internal ClusterIP service is configured")

	// 4. Compute status & phase
	phase := PhaseProgressing
	if liveDep != nil {
		svc.Status.ReadyReplicas = liveDep.Status.ReadyReplicas
		if liveDep.Status.AvailableReplicas > 0 {
			phase = PhaseAvailable
			setCondition(&svc.Status, "DeploymentAvailable", metav1.ConditionTrue, "MinimumReplicasAvailable", "Backend deployment has ready available replicas")
		} else {
			setCondition(&svc.Status, "DeploymentAvailable", metav1.ConditionFalse, "AwaitingReplicas", "Deployment is rolling out pods")
		}
	} else if depCreated {
		setCondition(&svc.Status, "DeploymentAvailable", metav1.ConditionFalse, "DeploymentCreated", "Deployment created; awaiting pod scheduling")
	}

	svc.Status.Phase = phase
	svc.Status.DeploymentName = svc.Name
	svc.Status.ServiceName = svc.Name
	result.Phase = phase
	setCondition(&svc.Status, "Reconciled", metav1.ConditionTrue, "ReconcileSuccess", "Workload slice reconciled successfully")

	return result, nil
}

// dropAbsentPullSecret clears the pull-secret reference when that Secret is not
// in the namespace. Public images then pull without ghcr-pull. A later reconcile
// adds the reference once the Secret exists. The CR spec is not rewritten.
func (r *Reconciler) dropAbsentPullSecret(ctx context.Context, svc *SummitService) error {
	if r.client == nil || svc.Spec.OmitPullSecret {
		return nil
	}
	name := strings.TrimSpace(svc.Spec.PullSecretName)
	if name == "" {
		return nil
	}
	_, err := r.client.CoreV1().Secrets(svc.Namespace).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		svc.Spec.PullSecretName = ""
		svc.Spec.OmitPullSecret = true
		return nil
	}
	return err
}

// reconcileNamespace ensures the target namespace exists with safe tenancy labels.
func (r *Reconciler) reconcileNamespace(ctx context.Context, namespace, tenantID string) (bool, error) {
	_, err := r.client.CoreV1().Namespaces().Get(ctx, namespace, metav1.GetOptions{})
	if err == nil {
		return false, nil
	}

	if !apierrors.IsNotFound(err) {
		return false, err
	}

	ns := BuildNamespace(namespace, tenantID)
	_, err = r.client.CoreV1().Namespaces().Create(ctx, ns, metav1.CreateOptions{})
	if err != nil && !apierrors.IsAlreadyExists(err) {
		return false, err
	}

	return true, nil
}

// reconcileDeployment creates or updates the Deployment spec idempotently.
func (r *Reconciler) reconcileDeployment(ctx context.Context, desired *appsv1.Deployment) (created bool, updated bool, live *appsv1.Deployment, err error) {
	existing, err := r.client.AppsV1().Deployments(desired.Namespace).Get(ctx, desired.Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		createdDep, createErr := r.client.AppsV1().Deployments(desired.Namespace).Create(ctx, desired, metav1.CreateOptions{})
		if createErr != nil {
			return false, false, nil, createErr
		}
		return true, false, createdDep, nil
	}
	if err != nil {
		return false, false, nil, err
	}

	// Check if update is needed
	needsUpdate := false

	if !reflect.DeepEqual(existing.Spec.Replicas, desired.Spec.Replicas) {
		existing.Spec.Replicas = desired.Spec.Replicas
		needsUpdate = true
	}

	if !managedContainersEqual(existing.Spec.Template.Spec.Containers, desired.Spec.Template.Spec.Containers) {
		existing.Spec.Template.Spec.Containers = desired.Spec.Template.Spec.Containers
		needsUpdate = true
	}

	if !reflect.DeepEqual(existing.Spec.Template.Spec.ImagePullSecrets, desired.Spec.Template.Spec.ImagePullSecrets) {
		existing.Spec.Template.Spec.ImagePullSecrets = desired.Spec.Template.Spec.ImagePullSecrets
		needsUpdate = true
	}

	if !reflect.DeepEqual(existing.Spec.Template.Spec.SecurityContext, desired.Spec.Template.Spec.SecurityContext) {
		existing.Spec.Template.Spec.SecurityContext = desired.Spec.Template.Spec.SecurityContext
		needsUpdate = true
	}

	if !reflect.DeepEqual(existing.Labels, desired.Labels) {
		existing.Labels = desired.Labels
		needsUpdate = true
	}

	if !reflect.DeepEqual(existing.Spec.Template.Labels, desired.Spec.Template.Labels) {
		existing.Spec.Template.Labels = desired.Spec.Template.Labels
		needsUpdate = true
	}

	if !reflect.DeepEqual(existing.OwnerReferences, desired.OwnerReferences) {
		existing.OwnerReferences = desired.OwnerReferences
		needsUpdate = true
	}

	if !needsUpdate {
		return false, false, existing, nil
	}

	updatedDep, updateErr := r.client.AppsV1().Deployments(desired.Namespace).Update(ctx, existing, metav1.UpdateOptions{})
	if updateErr != nil {
		return false, false, nil, updateErr
	}

	return false, true, updatedDep, nil
}

// managedContainersEqual ignores API-server defaulted fields while comparing every
// container property this reconciler owns.
func managedContainersEqual(existing, desired []corev1.Container) bool {
	if len(existing) != len(desired) {
		return false
	}
	for i := range desired {
		a, b := existing[i], desired[i]
		if a.Name != b.Name || a.Image != b.Image || a.ImagePullPolicy != b.ImagePullPolicy ||
			!reflect.DeepEqual(a.Command, b.Command) || !reflect.DeepEqual(a.Args, b.Args) || a.WorkingDir != b.WorkingDir ||
			!reflect.DeepEqual(a.Ports, b.Ports) || !reflect.DeepEqual(a.Env, b.Env) || !reflect.DeepEqual(a.Resources, b.Resources) ||
			!managedSecurityContextEqual(a.SecurityContext, b.SecurityContext) ||
			!managedProbeEqual(a.LivenessProbe, b.LivenessProbe) || !managedProbeEqual(a.ReadinessProbe, b.ReadinessProbe) {
			return false
		}
	}
	return true
}

func managedSecurityContextEqual(a, b *corev1.SecurityContext) bool {
	if a == nil || b == nil {
		return a == b
	}
	return reflect.DeepEqual(a.RunAsUser, b.RunAsUser) && reflect.DeepEqual(a.RunAsGroup, b.RunAsGroup) &&
		reflect.DeepEqual(a.RunAsNonRoot, b.RunAsNonRoot) && reflect.DeepEqual(a.AllowPrivilegeEscalation, b.AllowPrivilegeEscalation) &&
		reflect.DeepEqual(a.ReadOnlyRootFilesystem, b.ReadOnlyRootFilesystem) && reflect.DeepEqual(a.Capabilities, b.Capabilities) &&
		reflect.DeepEqual(a.SeccompProfile, b.SeccompProfile)
}

func managedProbeEqual(a, b *corev1.Probe) bool {
	if a == nil || b == nil {
		return a == b
	}
	return reflect.DeepEqual(a.ProbeHandler, b.ProbeHandler) && a.InitialDelaySeconds == b.InitialDelaySeconds &&
		a.PeriodSeconds == b.PeriodSeconds && a.TimeoutSeconds == b.TimeoutSeconds && a.FailureThreshold == b.FailureThreshold
}

func (r *Reconciler) persistStatus(ctx context.Context, svc *SummitService) error {
	resourceClient := r.statusClient.Resource(SchemeGroupVersion.WithResource("summitservices")).Namespace(svc.Namespace)
	current, err := resourceClient.Get(ctx, svc.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}
	desiredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(svc)
	if err != nil {
		return err
	}
	desired := &unstructured.Unstructured{Object: desiredMap}
	current.Object["status"] = desired.Object["status"]
	_, err = resourceClient.UpdateStatus(ctx, current, metav1.UpdateOptions{})
	return err
}

// reconcileService creates or updates the internal ClusterIP service while preserving the allocated ClusterIP.
func (r *Reconciler) reconcileService(ctx context.Context, desired *corev1.Service) (created bool, updated bool, err error) {
	existing, err := r.client.CoreV1().Services(desired.Namespace).Get(ctx, desired.Name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		_, createErr := r.client.CoreV1().Services(desired.Namespace).Create(ctx, desired, metav1.CreateOptions{})
		if createErr != nil {
			return false, false, createErr
		}
		return true, false, nil
	}
	if err != nil {
		return false, false, err
	}

	needsUpdate := false

	// Compare selector
	if !reflect.DeepEqual(existing.Spec.Selector, desired.Spec.Selector) {
		existing.Spec.Selector = desired.Spec.Selector
		needsUpdate = true
	}

	// Compare ports
	if !servicePortsEqual(existing.Spec.Ports, desired.Spec.Ports) {
		existing.Spec.Ports = desired.Spec.Ports
		needsUpdate = true
	}

	// Compare labels
	if !reflect.DeepEqual(existing.Labels, desired.Labels) {
		existing.Labels = desired.Labels
		needsUpdate = true
	}

	// Compare owner references
	if !reflect.DeepEqual(existing.OwnerReferences, desired.OwnerReferences) {
		existing.OwnerReferences = desired.OwnerReferences
		needsUpdate = true
	}

	if !needsUpdate {
		return false, false, nil
	}

	// Note: We leave existing.Spec.ClusterIP intact as it cannot be modified once allocated
	_, updateErr := r.client.CoreV1().Services(desired.Namespace).Update(ctx, existing, metav1.UpdateOptions{})
	if updateErr != nil {
		return false, false, updateErr
	}

	return false, true, nil
}

func servicePortsEqual(a, b []corev1.ServicePort) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].Port != b[i].Port || a[i].TargetPort != b[i].TargetPort || a[i].Protocol != b[i].Protocol || a[i].Name != b[i].Name {
			return false
		}
	}
	return true
}

func setCondition(status *SummitServiceStatus, condType string, condStatus metav1.ConditionStatus, reason, message string) {
	now := metav1.NewTime(time.Now().UTC())
	for i := range status.Conditions {
		if status.Conditions[i].Type == condType {
			if status.Conditions[i].Status != condStatus {
				status.Conditions[i].Status = condStatus
				status.Conditions[i].LastTransitionTime = now
			}
			status.Conditions[i].Reason = reason
			status.Conditions[i].Message = message
			return
		}
	}

	status.Conditions = append(status.Conditions, metav1.Condition{
		Type:               condType,
		Status:             condStatus,
		LastTransitionTime: now,
		Reason:             reason,
		Message:            message,
	})
}
