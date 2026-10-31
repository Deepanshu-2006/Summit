// Package addons generates and applies the tenant-hardening and optional
// cluster add-on objects of the Summit orchestrator (docs/mvp_runtime_contracts.md C8):
//
//   - tenant Namespace with Pod Security Admission labels, ResourceQuota and LimitRange
//   - native networking.k8s.io/v1 NetworkPolicy and Cilium CiliumNetworkPolicy variants
//   - Traefik IngressRoute and security-headers Middleware
//   - External Secrets Operator SecretStore and ExternalSecret (OpenBao/Vault)
//
// Generators are pure functions returning typed or unstructured objects. The
// Applier performs server-side apply through a dynamic client and reports
// ErrAddonUnavailable when a CRD-backed kind is not installed so that callers
// can log and skip feature-flagged add-ons. TenantProvisioner ties generators
// and the applier together behind the C8 feature flags.
package addons
