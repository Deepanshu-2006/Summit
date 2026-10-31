# Summit Standalone Builder Execution System

The **Summit Builder Execution System** is a high-performance, hermetically isolated, single-attempt container build engine. It compiles tenant source code into Open Container Initiative (OCI) image artifacts using **Railpack** (for automatic language detection and plan generation) and **rootless BuildKit** inside unprivileged **gVisor (`runsc`)** sandbox containers.

---

## Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                           Rudra (Control Plane)                                   |
|                                                                                   |
|  - Manages build lifecycle & state machine in PostgreSQL                          |
|  - Provisions isolated Kubernetes Jobs per build attempt                         |
|  - Projects execution specs & credentials into ephemeral volumes                  |
|  - Ingests streaming status, log events, and completion results over HTTP         |
+------------------------------------------+----------------------------------------+
                                           |
                                           | Projections (Spec, Secrets, Env)
                                           v
+-----------------------------------------------------------------------------------+
|                gVisor Sandbox Pod (Kubernetes Job / runsc)                         |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   |                       Summit Builder Worker Process                       |   |
|   |                       (/usr/local/bin/worker, UID 1000)                   |   |
|   |                                                                           |   |
|   |  +--------------+  +--------------+  +---------------+  +--------------+  |   |
|   |  | Config / Spec|  |  Validation  |  |   Workspace   |  | Source Repo  |  |   |
|   |  | Parser (JSON)|  | Engine (v1)  |  | Manager (/tmp)|  | (Git / Auth) |  |   |
|   |  +--------------+  +--------------+  +---------------+  +--------------+  |   |
|   |                                                                           |   |
|   |  +--------------+  +--------------+  +---------------+  +--------------+  |   |
|   |  |   Railpack   |  |  Rootless    |  |  OCI Registry |  | HTTP Status/ |  |   |
|   |  | CLI Adapter  |  |  BuildKit    |  | Client (Verify|  | Log Reporter |  |   |
|   |  | (Detect/Plan)|  | (Daemon/ctl) |  |  Manifest)    |  | (to Rudra)   |  |   |
|   |  +--------------+  +--------------+  +---------------+  +--------------+  |   |
|   +---------------------------------------------------------------------------+   |
|                                                                                   |
|   Ephemeral Mounts:                                                               |
|   * /workspace  (emptyDir - git clone, app source, railpack plan)                 |
|   * /run/buildkit (emptyDir - rootless buildkitd socket & state)                   |
|   * /tmp (emptyDir - scratch space)                                               |
|   * /run/summit (ConfigMap projection - execution.json)                           |
|   * /run/secrets (Secret projection - Git tokens & Registry auth)                 |
+-----------------------------------------------------------------------------------+
```

### Core Architectural Principles

1. **Zero-Controller Coupling**:
   - The worker contains **no Kubernetes client dependencies (`client-go`)**, no CRD operators, and no cluster-admin role bindings.
   - It runs completely decoupled as a standard POSIX unprivileged process.
2. **Ephemeral Single-Attempt Execution**:
   - Exactly **1 Pod = 1 Attempt**.
   - No container reuse across builds, no dangling state, and no leftover artifacts.
   - Kubernetes `backoffLimit` is strictly set to `0`. Retries are managed authoritatively by Rudra.
3. **Defense-in-Depth Security**:
   - Runs exclusively as non-root unprivileged user (`UID 1000:GID 1000`).
   - Root filesystem is mounted strictly read-only (`readOnlyRootFilesystem: true`).
   - All capabilities dropped (`drop: ["ALL"]`). Privilege escalation blocked (`allowPrivilegeEscalation: false`).
   - Sandboxed via gVisor (`runtimeClassName: gvisor` / `runsc`) to prevent kernel escape vulnerabilities.

---

## Component Breakdown

The worker codebase is structured as modular Go packages with clean separation of concerns:

| Subsystem | Location | Responsibility |
| :--- | :--- | :--- |
| **CLI Worker** | `cmd/worker/main.go` | Entrypoint, signal handling (`SIGINT`, `SIGTERM`), subsystem wiring, exit code management. |
| **Config Loader** | `internal/config` | Reads environment variables (`SUMMIT_EXECUTION_SPEC`, `SUMMIT_WORKSPACE_BASE_DIR`, etc.). |
| **Protocol Contracts** | `internal/protocol` | Strongly-typed Go structs and JSON serialization matching schema v1 for spec, status, logs, and results. |
| **Validation** | `internal/validation` | Enforces UUID format, SHA checksums, URL safety, and prevents path traversal attacks (`..`). |
| **Workspace Manager** | `internal/workspace` | Creates and purges isolated attempt directories (`/workspace/<build-id>/<attempt-id>`). |
| **Source Manager** | `internal/source` | Authenticates and clones Git repos, verifies pinned commit SHAs, and resolves credentials. |
| **Railpack Adapter** | `internal/railpack` | Invokes Railpack CLI (`prepare`) to detect project language/framework and generate build plan. |
| **BuildKit Manager** | `internal/buildkit` | Manages rootless `buildkitd` daemon lifecycle, unix socket readiness, and executes `buildctl`. |
| **Registry Client** | `internal/registry` | Directly inspects target OCI container registries, verifying manifests, digests, and pushed layers. |
| **HTTP Reporter** | `internal/reporter` | Streams status transitions (`/status`), batches logs (`/logs`), and posts terminal results (`/result`). |
| **Process Supervisor** | `internal/process` | Executes child processes with timeouts, real-time stdout/stderr streaming callbacks, and process grouping. |
| **Coordinator** | `internal/worker` | Orchestrates the sequential pipeline stages, error trapping, and cleanup. |

---

## Protocol Contracts

All communications between Rudra and the Builder Worker strictly adhere to versioned JSON contracts.

### 1. BuildExecutionSpec (`/run/summit/execution.json`)

Primary input specification passed to the worker container:

```json
{
  "schema_version": 1,
  "build": {
    "id": "a5d09f7b-6c41-477e-8c31-1e967a5b3a4f",
    "attempt_id": "f8c3e210-9b44-42f1-8f52-47d3412019aa",
    "attempt_number": 1,
    "correlation_id": "req-trace-98317a"
  },
  "source": {
    "provider": "github",
    "repository": "summit-org/sample-service",
    "clone_url": "https://github.com/summit-org/sample-service.git",
    "branch": "main",
    "commit_sha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "root_directory": "/"
  },
  "build_config": {
    "builder": "railpack",
    "build_command": null,
    "install_command": null,
    "start_command": null,
    "dockerfile_path": null,
    "env_vars": {
      "NODE_ENV": "production"
    }
  },
  "credentials": {
    "source_credential_ref": "source-token",
    "registry_credential_ref": "registry-token"
  },
  "output": {
    "registry": "registry.jetway.internal:5000",
    "repository": "apps/sample-service",
    "tag": "v1.0.0",
    "platforms": ["linux/amd64"]
  },
  "resources": {
    "cpu_millicores": 2000,
    "memory_mib": 4096,
    "ephemeral_storage_mib": 8192
  },
  "timeout_seconds": 1200,
  "reporting": {
    "endpoint": "http://rudra.summit.svc.cluster.local:8080/api/v1/builds",
    "token_ref": "reporting-bearer-token"
  }
}
```

### 2. Status Updates (`POST {endpoint}/{buildID}/status`)

Emitted in real-time as the worker advances through each pipeline stage:
- **Stages**: `init` &rarr; `source` &rarr; `plan` &rarr; `build` &rarr; `verify` &rarr; `complete`
- **Stage Status**: `pending`, `running`, `succeeded`, `failed`, `cancelled`

### 3. Log Events (`POST {endpoint}/{buildID}/logs`)

Emitted in batches from process streams:
```json
[
  {
    "build_id": "a5d09f7b-6c41-477e-8c31-1e967a5b3a4f",
    "attempt_id": "f8c3e210-9b44-42f1-8f52-47d3412019aa",
    "sequence": 12,
    "timestamp": "2026-10-31T14:30:00.123Z",
    "stream": "stdout",
    "stage": "build",
    "message": "=> transferring context: 1.42MB done"
  }
]
```

### 4. BuildExecutionResult (`POST {endpoint}/{buildID}/result`)

Final payload posted when the build completes or fails:
- **Status**: `succeeded`, `failed`, or `cancelled`
- **Artifact**: Contains `image`, `digest`, `tag`, `size_bytes`, `manifest_type`
- **Timing**: `started_at`, `completed_at`, `duration_ms`
- **Error**: Machine-readable error code (`SOURCE_CLONE_FAILED`, `BUILD_PLAN_GENERATION_FAILED`, `IMAGE_BUILD_FAILED`, `TIMEOUT`, etc.) and human-readable diagnostic message.

---

## Running Locally

### Prerequisites

- Go 1.23+
- Git 2.40+
- Optional: `railpack` CLI and `buildctl`/`buildkitd`

### Build

```bash
# Compile worker binary to bin/worker
make build
```

### Run With Local Mock Spec

```bash
# Set environment variables
export SUMMIT_EXECUTION_SPEC="/path/to/deployments/examples/sample-execution-spec.json"
export SUMMIT_WORKSPACE_BASE_DIR="/tmp/summit-workspace"
export SUMMIT_LOG_LEVEL="debug"

# Execute worker
./bin/worker
```

---

## Container Execution

The worker is packaged using a multi-stage, rootless Dockerfile (`deployments/worker.Dockerfile`).

### Build Container Image

```bash
docker build -t ghcr.io/summit/builder-worker:latest -f deployments/worker.Dockerfile .
```

### Run Rootless Container Locally

```bash
docker run --rm \
  --user 1000:1000 \
  --read-only \
  -v /tmp/workspace:/workspace \
  -v /tmp/buildkit:/run/buildkit \
  -v /tmp/tmp:/tmp \
  -v $(pwd)/deployments/examples/sample-execution-spec.json:/run/summit/execution.json:ro \
  -e SUMMIT_EXECUTION_SPEC=/run/summit/execution.json \
  -e SUMMIT_WORKSPACE_BASE_DIR=/workspace \
  ghcr.io/summit/builder-worker:latest
```

---

## Kubernetes Execution Model

Rudra launches the builder worker using Kubernetes Jobs inside the `gvisor` RuntimeClass:

1. **Job Scheduling**: Rudra receives build triggers, generates a `BuildExecutionSpec`, creates a Kubernetes Secret/ConfigMap, and posts the `batch/v1` `Job` manifest to the cluster.
2. **Hardened Isolation**:
   - `runtimeClassName: gvisor` ensures syscall-level kernel interception via Sentry.
   - `readOnlyRootFilesystem: true` protects system bins.
   - `emptyDir` volumes provide ephemeral scratch pads that vanish when the job finishes.
3. **Telemetry Streaming**:
   - The worker establishes direct HTTP/JSON connections back to the Rudra endpoint using a short-lived Bearer token.
   - When finished, the worker reports the final OCI image digest and terminates with exit code `0`.
4. **Garbage Collection**:
   - Kubernetes `ttlSecondsAfterFinished: 600` automatically cleans up Job and Pod resources 10 minutes after completion.

For full details and reference manifests, see:
- [Kubernetes Job Spec Documentation](docs/kubernetes-job-spec.md)
- [Reference Kubernetes Job YAML](deployments/examples/kubernetes-job.yaml)
- [Reference gVisor RuntimeClass](deployments/examples/gvisor-runtimeclass.yaml)

---

## Verification & Testing

The Summit Builder suite contains comprehensive unit and integration tests:

```bash
# Run all unit tests
make test

# Run tests with race detector enabled
make test-race

# Run static code analysis
make vet

# Format codebase
make fmt

# Clean build artifacts
make clean
```
