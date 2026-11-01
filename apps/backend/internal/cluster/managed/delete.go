package managed

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/summit/backend/internal/cluster/workloads"
)

// Delete removes the addon StatefulSet, headless Service, Secret, and PVCs.
//
// The PVC delete is intentional and final: the service's data is removed with
// the service. This function does not take a backup, snapshot, or dump first.
// A missing object is success, so the call is safe to repeat.
func Delete(ctx context.Context, client kubernetes.Interface, namespace, serviceID string) error {
	if client == nil {
		return errors.New("managed: kubernetes client is required")
	}
	name, err := ObjectName(serviceID)
	if err != nil {
		return err
	}
	pvcName, err := DataPVCName(serviceID)
	if err != nil {
		return err
	}
	propagation := metav1.DeletePropagationBackground
	opts := metav1.DeleteOptions{PropagationPolicy: &propagation}
	var errs []error
	if err := client.AppsV1().StatefulSets(namespace).Delete(ctx, name, opts); err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("managed: delete statefulset %s: %w", name, err))
	}
	if err := client.CoreV1().Services(namespace).Delete(ctx, name, opts); err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("managed: delete service %s: %w", name, err))
	}
	if err := client.CoreV1().Secrets(namespace).Delete(ctx, name, opts); err != nil && !apierrors.IsNotFound(err) {
		errs = append(errs, fmt.Errorf("managed: delete secret %s: %w", name, err))
	}
	if err := deletePVCs(ctx, client, namespace, serviceID, pvcName); err != nil {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

func deletePVCs(ctx context.Context, client kubernetes.Interface, namespace, serviceID, conventional string) error {
	var errs []error
	sel := fmt.Sprintf("%s=%s", workloads.LabelService, serviceID)
	list, err := client.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{LabelSelector: sel})
	if err != nil {
		errs = append(errs, fmt.Errorf("managed: list pvcs: %w", err))
	} else {
		for i := range list.Items {
			if err := deletePVC(ctx, client, namespace, list.Items[i].Name); err != nil {
				errs = append(errs, err)
			}
		}
	}
	// Cover a PVC that was created without the owner label.
	if err := deletePVC(ctx, client, namespace, conventional); err != nil {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}

func deletePVC(ctx context.Context, client kubernetes.Interface, namespace, name string) error {
	err := client.CoreV1().PersistentVolumeClaims(namespace).Delete(ctx, name, metav1.DeleteOptions{})
	if err != nil && !apierrors.IsNotFound(err) {
		return fmt.Errorf("managed: delete pvc %s: %w", name, err)
	}
	return nil
}
