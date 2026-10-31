# Kubernetes Job Specification for Summit Builder Worker

This document specifies the authoritative contract, isolation boundaries, volume topologies, and security constraints required by **Rudra** (the Summit Builder Control Plane) when provisioning builder execution pods on Kubernetes.

---

## 1. Architectural Overview & Responsibility Separation

The Summit Builder Execution System follows a **strictly decoupled worker model**:

- **No Controller Coupling**: The worker binary (`/usr/local/bin/worker`) contains zero Kubernetes client libraries (`client-go`), zero Kubernetes CRDs, and zero direct dependencies on the cluster control plane API.
- **Ephemeral Single-Attempt Execution**: Exactly **one Kubernetes Job = one build attempt**. The builder worker execution is strictly ephemeral. It mounts temporary storage, compiles the artifact, pushes to the registry, transmits telemetry and final status over HTTP to Rudra, and terminates.
- **No In-Place Worker Retries**: All retry logic, exponential backoff, attempt orchestration, and state transitions reside authoritatively in Rudra.

---

## 2. Kubernetes Job Resource Definition

Rudra schedules builds using the standard Kubernetes `batch/v1` `Job` API.

### Required Job Metadata & Fields

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: summit-build-<build_id_prefix>-att-<attempt_num>
  namespace: summit-builders
  labels:
    app.kubernetes.io/name: summit-builder
    app.kubernetes.io/component: worker
    summit.io/build-id: "<uuid>"
    summit.io/attempt-id: "<uuid>"
    summit.io/tenant-id: "<tenant_id>"
spec:
  # CRITICAL: Prevent Kubernetes from restarting failed worker pods in-place.
  # In-place restarts can reuse dirty workspace storage or corrupt BuildKit daemon state.
  backoffLimit: 0

  # Active deadline enforces the pod-level watchdog safety window.
  # Set to: spec.timeout_seconds + 60s (grace period for graceful reporting).
  activeDeadlineSeconds: 1260

  # Automatic garbage collection of completed and failed build jobs.
  # Rudra harvests status via HTTP reporting; this cleans Kubernetes resource records.
  ttlSecondsAfterFinished: 600

  template:
    metadata:
      labels:
        app.kubernetes.io/name: summit-builder
        summit.io/build-id: "<uuid>"
        summit.io/attempt-id: "<uuid>"
    spec:
      runtimeClassName: gvisor
      restartPolicy: Never
```

### Key Operational Invariants

1. **`backoffLimit: 0`**: Ensures that if a container encounters an unhandled crash or non-zero exit code, Kubernetes will not trigger a retry inside the same pod or Job. Rudra detects the failure (via HTTP or Job status) and provisions a fresh Job with a new attempt ID if retry is permitted.
2. **`restartPolicy: Never`**: Pod containers will not restart on failure.
3. **`activeDeadlineSeconds`**: Serves as the ultimate hard-stop watchdog. If the worker process deadlocks or hangs beyond the configured timeout, the kubelet terminates the entire pod.

---

## 3. Pod & Container Security Context

To safely execute untrusted multi-tenant source code, builds must run under extreme privilege de-escalation:

### Pod-Level Security Context

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000       # summit user
    runAsGroup: 1000      # summit group
    fsGroup: 1000         # Volume permissions mapped to summit
    seccompProfile:
      type: RuntimeDefault
```

### Container-Level Security Context

```yaml
containers:
  - name: worker
    image: ghcr.io/summit/builder-worker:latest
    imagePullPolicy: IfNotPresent
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
          - ALL
```

### Security Enforcement Rationale

| Requirement | Implementation | Security Benefit |
| :--- | :--- | :--- |
| **Non-Root Execution** | `runAsUser: 1000`, `runAsGroup: 1000` | Prevents root execution inside the container namespace. |
| **Read-Only Root Filesystem** | `readOnlyRootFilesystem: true` | Prevents malicious code or compromised build tools from tampering with root binaries or system libraries. |
| **No Privilege Escalation** | `allowPrivilegeEscalation: false` | Disallows `setuid`/`setgid` binaries (e.g. `sudo`, `newuidmap`) from gaining elevated privileges. |
| **Zero Linux Capabilities** | `capabilities: drop: ["ALL"]` | Strips all Linux capabilities (`CAP_SYS_ADMIN`, `CAP_NET_ADMIN`, etc.). Rootless BuildKit runs purely via user namespaces. |
| **Default Seccomp** | `seccompProfile: RuntimeDefault` | Blocks dangerous kernel syscalls before they reach the hypervisor/gVisor boundary. |

---

## 4. Volume Mounts & Ephemeral Storage

Because `readOnlyRootFilesystem: true` is enforced, all writable directories needed for compilation, caching, daemon sockets, and temporary files must be explicitly backed by writable ephemeral mounts:

### Volume Mount Map

```yaml
volumeMounts:
  # Ephemeral workspace for cloning repository, Railpack analysis, and build artifacts
  - name: workspace-volume
    mountPath: /workspace
    readOnly: false

  # Ephemeral socket and state directory for rootless buildkitd
  - name: buildkit-run
    mountPath: /run/buildkit
    readOnly: false

  # Ephemeral scratch space for system temp files (Go build cache, npm caches, etc.)
  - name: tmp-volume
    mountPath: /tmp
    readOnly: false

  # Projected JSON execution specification generated by Rudra
  - name: execution-spec
    mountPath: /run/summit
    readOnly: true

  # Projected authentication tokens (git credentials and OCI registry secrets)
  - name: secret-tokens
    mountPath: /run/secrets
    readOnly: true
```

### Volume Definitions

```yaml
volumes:
  - name: workspace-volume
    emptyDir:
      medium: "" # Backed by node NVMe/SSD, or "Memory" for fast in-RAM builds
      sizeLimit: 10Gi

  - name: buildkit-run
    emptyDir:
      medium: "Memory"
      sizeLimit: 2Gi

  - name: tmp-volume
    emptyDir:
      medium: ""
      sizeLimit: 5Gi

  - name: execution-spec
    configMap:
      name: summit-spec-<attempt_id>
      items:
        - key: execution.json
          path: execution.json

  - name: secret-tokens
    secret:
      secretName: summit-creds-<attempt_id>
      defaultMode: 0400
      items:
        - key: source-token
          path: source-credentials/token
        - key: registry-auth
          path: registry-credentials/auth
```

---

## 5. Secret Projections & Credential Management

To avoid passing plaintext credentials through environment variables or command-line arguments:

1. **Source Credentials (`/run/secrets/source-credentials/token` or `id_rsa`)**:
   - Projected by Rudra from the tenant's connected Git provider integration.
   - The worker's `source.Manager` resolves tokens from `/run/secrets/` or static reference maps.
   - Git operations use authenticated HTTPS clone URLs (`x-access-token:<token>@github.com/...`) or SSH identity configurations in ephemeral memory.
2. **OCI Registry Credentials (`/run/secrets/registry-credentials/auth`)**:
   - Projected by Rudra with base64 basic auth or short-lived Bearer tokens.
   - Pushed directly to `buildctl` or used by `registry.Client` for OCI manifest verification.
3. **File Permissions**:
   - All secret files are projected with permissions `0400` owned by UID `1000`.

---

## 6. Execution Spec Projection & Downward API

The primary input contract for the worker is the `BuildExecutionSpec` JSON document.

### Environment Variable Bindings

```yaml
env:
  # Pointer to the projected execution spec JSON
  - name: SUMMIT_EXECUTION_SPEC
    value: "/run/summit/execution.json"

  # Base directory where attempt subdirectories are isolated
  - name: SUMMIT_WORKSPACE_BASE_DIR
    value: "/workspace"

  # Operational logging level (debug, info, warn, error)
  - name: SUMMIT_LOG_LEVEL
    value: "info"

  # Fallback execution timeout in seconds if unspecified in spec
  - name: SUMMIT_DEFAULT_TIMEOUT_SECONDS
    value: "1200"

  # Downward API: pod identity for distributed tracing and logging
  - name: SUMMIT_WORKER_ID
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
```

---

## 7. gVisor (`runsc`) RuntimeClass Compatibility

Summit runs all builder workers inside **gVisor (`runsc`)** sandbox containers to enforce strict kernel isolation between multi-tenant workloads.

### RuntimeClass Configuration

```yaml
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
overhead:
  podFixed:
    cpu: "250m"
    memory: "256Mi"
scheduling:
  nodeSelector:
    summit.io/node-role: builder-sandbox
  tolerations:
    - key: "summit.io/sandbox-workload"
      operator: "Equal"
      value: "true"
      effect: "NoSchedule"
```

### Critical gVisor Operational Considerations

1. **User Namespaces**:
   - Rootless BuildKit runs inside user namespaces.
   - When configured with gVisor, `runsc` must support user namespaces. The host containerd configuration for `runsc` should include `--directfs=true` and allow unprivileged user namespaces.
2. **BuildKit Snapshotter Selection**:
   - Standard Linux containers commonly use `overlayfs` for container layer composition.
   - Inside gVisor sandboxes without nested overlayfs privileges, the worker's `deployments/buildkitd.toml` is configured to use the **`native`** snapshotter:
     ```toml
     [worker.oci]
       enabled = true
       rootless = true
       platforms = ["linux/amd64"]
       snapshotter = "native"
     ```
   - This prevents `EINVAL` or `EPERM` mount failures when manipulating container layers inside gVisor.
3. **Directfs & I/O Performance**:
   - `directfs` allows the Sentry (gVisor kernel) to make direct host filesystem calls rather than funneling all file operations through a Gofer 9P/virtiofs channel, significantly boosting git checkout and npm/cargo compilation speed.
4. **Memory Overhead**:
   - The Sentry sandbox kernel consumes ~150-250MB of memory overhead. Rudra factors this into the Kubernetes pod resource limits (`spec.resources.memory_mib` + 512Mi buffer).
