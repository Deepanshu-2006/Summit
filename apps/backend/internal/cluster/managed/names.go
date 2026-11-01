package managed

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
)

const (
	// NamePrefix is the prefix of addon Secret, Service, and StatefulSet names.
	NamePrefix = "addon-"
	// VolumeName is the volumeClaimTemplates name. PVCs are <volume>-<sts>-<ordinal>.
	VolumeName = "data"
	// DefaultStorage is used when the service has no storage_mb.
	DefaultStorage = "1Gi"
	// DefaultStorageMB is the mebibyte equivalent documented next to DefaultStorage.
	// 1Gi is the quantity actually applied; this constant is the fallback input.
	DefaultStorageMB = 1024
)

// ObjectName returns addon-<service id> after checking it is one DNS-1123 label.
func ObjectName(serviceID string) (string, error) {
	id := strings.ToLower(strings.TrimSpace(serviceID))
	if id == "" {
		return "", fmt.Errorf("managed: service id is empty")
	}
	name := NamePrefix + id
	if errs := validation.IsDNS1123Label(name); len(errs) > 0 {
		return "", fmt.Errorf("managed: name %q: %s", name, strings.Join(errs, "; "))
	}
	return name, nil
}

// DataPVCName is the PVC created for the single replica: data-addon-<id>-0.
func DataPVCName(serviceID string) (string, error) {
	name, err := ObjectName(serviceID)
	if err != nil {
		return "", err
	}
	pvc := VolumeName + "-" + name + "-0"
	if errs := validation.IsDNS1123Label(pvc); len(errs) > 0 {
		return "", fmt.Errorf("managed: pvc name %q: %s", pvc, strings.Join(errs, "; "))
	}
	return pvc, nil
}

// ServiceDNS is the in-cluster host used in the connection URL.
func ServiceDNS(namespace, serviceID string) (string, error) {
	name, err := ObjectName(serviceID)
	if err != nil {
		return "", err
	}
	ns := strings.ToLower(strings.TrimSpace(namespace))
	if errs := validation.IsDNS1123Label(ns); len(errs) > 0 {
		return "", fmt.Errorf("managed: namespace %q: %s", namespace, strings.Join(errs, "; "))
	}
	return name + "." + ns + ".svc.cluster.local", nil
}
