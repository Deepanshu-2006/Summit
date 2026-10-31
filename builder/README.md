# Summit Standalone Builder Execution System

The **Summit Builder Execution System** is a high-performance, hermetically isolated, single-attempt container build engine. It compiles tenant source code into Open Container Initiative (OCI) image artifacts using **Railpack** (for automatic language detection and plan generation) and **rootless BuildKit** inside unprivileged **gVisor (`runsc`)** sandbox containers.

---

## Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                           Rudra (Control Plane)                                   |
|                                                                                   |
|  - Manages build lifecycle & state machine in PostgreSQL                          |
|  - Provisions one isolated Kubernetes Pod per build attempt                      |
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
|   * /var/run/secrets/summit/{source,registry,reporting} (Secret projections)      |
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
   - Writable paths are limited to the workspace, `$HOME` (BuildKit state, mounted as an `emptyDir`) and `/run/user/1000`; the orchestrator sets `readOnlyRootFilesystem: false` because rootless BuildKit needs user-space writes.
   - Capabilities dropped (`drop: ["ALL"]`) except `SETUID`/`SETGID`, which rootless BuildKit's `newuidmap`/`newgidmap` need to map a UID range; that requires `allowPrivilegeEscalation: true` for the builder container (see [docs/kubernetes-job-spec.md](docs/kubernetes-job-spec.md) for the reproduction and the required orchestrator change).
   - Sandboxed via gVisor (`runtimeClassName: gvisor` / `runsc`) to prevent kernel escape vulnerabilities.

---

## Component Breakdown

The worker codebase is structured as modular Go packages with clean separation of concerns:

| Subsystem | Location | Responsibility |
| :--- | :--- | :--- |
| **CLI Worker** | `cmd/worker/main.go` | Entrypoint, signal handling (`SIGINT`, `SIGTERM`), subsystem wiring, exit code management. |
| **Config Loader** | `internal/config` | Reads environment variables (`SUMMIT_EXECUTION_SPEC`, credential file paths, broker URL, ...). See [Configuration](#configuration). |
| **Protocol Contracts** | `internal/protocol` | Strongly-typed Go structs and JSON serialization matching schema v1 for spec, status, logs, and results. |
| **Validation** | `internal/validation` | Enforces UUID format, SHA checksums, URL safety, and prevents path traversal attacks (`..`). |
| **Workspace Manager** | `internal/workspace` | Creates and purges isolated attempt directories (`/workspace/<build-id>/<attempt-id>`). |
| **Source Manager** | `internal/source` | Exchanges the worker JWT for a short-lived GitHub installation token at the credential broker, clones with it (HTTP header in the git process environment only; never in the URL or `.git/config`), and verifies the pinned commit SHA. |
| **Railpack Adapter** | `internal/railpack` | Invokes Railpack CLI (`prepare`) to detect project language/framework and generate build plan. |
| **BuildKit Manager** | `internal/buildkit` | Manages rootless `buildkitd` daemon lifecycle, unix socket readiness, and executes `buildctl`. |
| **Registry Client** | `internal/registry` | Post-push digest verification with OCI token auth (`WWW-Authenticate` Bearer challenge, basic credentials from the docker `config.json`), HTTPS unless the host is loopback or listed in `SUMMIT_INSECURE_REGISTRIES`. |
| **HTTP Reporter** | `internal/reporter` | Streams status transitions (`/status`), batches logs (`/logs`), and posts terminal results (`/result`) with the worker JWT read from `SUMMIT_REPORTING_TOKEN_FILE`. |
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
    "attempt_id": "a5d09f7b-6c41-477e-8c31-1e967a5b3a4f",
    "attempt_number": 1,
    "correlation_id": "corr-build-a5d09f7b-trace-01"
  },
  "source": {
    "provider": "github",
    "repository": "summit-org/sample-service",
    "clone_url": "https://github.com/summit-org/sample-service.git",
    "branch": "main",
    "commit_sha": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
    "root_directory": "/"
  },
  "build_config": {
    "builder": "railpack",
    "build_command": null,
    "install_command": null,
    "start_command": null,
    "dockerfile_path": null,
    "env_vars": {
      "NODE_ENV": "production",
      "PORT": "3000"
    }
  },
  "credentials": {
    "source_credential_ref": "secret:summit-build-a5d09f7b-6c41-477e-8c31-1e967a5b3a4f",
    "registry_credential_ref": "secret:ghcr-push"
  },
  "output": {
    "registry": "ghcr.io",
    "repository": "summit-org/summit-app-3f1c2a9e-7b0d-4e55-9a1c-0d2f6b8e4c11",
    "tag": "sha-e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
    "platforms": [
      "linux/amd64"
    ]
  },
  "resources": {
    "cpu_millicores": 2000,
    "memory_mib": 4096,
    "ephemeral_storage_mib": 8192
  },
  "timeout_seconds": 1200,
  "reporting": {
    "endpoint": "http://summit-api.summit-system.svc.cluster.local:8080/internal/v1/builds",
    "token_ref": "secret:summit-build-a5d09f7b-6c41-477e-8c31-1e967a5b3a4f"
  }
}
```

`credentials.*_ref` and `reporting.token_ref` are **opaque references** (`secret:<name>`) that the
orchestrator turns into the file mounts below; the worker never uses them as credentials.
`attempt_id` equals `build.id` (single attempt per build job, see
[`docs/mvp_runtime_contracts.md`](../docs/mvp_runtime_contracts.md) C1).

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
- **Artifact**: Contains `repository` (for example `ghcr.io/<owner>/summit-app-<service-id>`), `digest` (`sha256:<64 hex>`), `tag` (`sha-<commit>`), `platforms`, `size_bytes`
- **Timing**: `started_at`, `completed_at`, `duration_ms`
- **Error**: Machine-readable error code (`SOURCE_CLONE_FAILED`, `BUILD_PLAN_GENERATION_FAILED`, `IMAGE_BUILD_FAILED`, `TIMEOUT`, etc.) and human-readable diagnostic message.

---

## Configuration

All settings are environment variables; every credential setting is optional (validated when present).

| Variable | Meaning |
| :--- | :--- |
| `SUMMIT_EXECUTION_SPEC` | **Required.** Path to `execution.json`. |
| `SUMMIT_SOURCE_CREDENTIAL_FILE` | File with the per-build worker JWT (`/var/run/secrets/summit/source/token`). |
| `SUMMIT_SOURCE_BROKER_URL` | Broker base URL; the worker calls `POST {url}/{build.id}/source-token` with `Authorization: Bearer <JWT>` (10 s timeout, one retry on 5xx/network error) and checks the returned `clone_url`/`commit_sha` against the spec. Without it, a credential file that is *not* a JWT is used directly as a git token (local tests); a JWT without a broker URL is an error. |
| `SUMMIT_REGISTRY_CREDENTIAL_FILE` | Docker `config.json` for the push (`/var/run/secrets/summit/registry/config.json`; must be named `config.json`). Its directory is exported as `DOCKER_CONFIG` **to the `buildctl` process only**, and its `auths["ghcr.io"]` entry authenticates the post-push digest lookup. |
| `SUMMIT_REPORTING_TOKEN_FILE` | File with the worker JWT used as bearer for `{reporting.endpoint}/{build_id}/{status,logs,result}`. If `reporting.endpoint` is empty the worker logs a warning and keeps results in memory only. |
| `SUMMIT_INSECURE_REGISTRIES` | Comma-separated `host[:port]` list reachable over plain HTTP (also sets `registry.insecure=true` on the image exporter for that host). Loopback hosts are always allowed; nothing else is. |
| `SUMMIT_WORKSPACE_BASE_DIR`, `SUMMIT_WORKER_ID`, `SUMMIT_LOG_LEVEL`, `SUMMIT_DEFAULT_TIMEOUT_SECONDS` | Workspace root (default `/workspace`), worker identity, log level, fallback timeout. |
| `SUMMIT_BUILDKITD_BIN`, `SUMMIT_BUILDKIT_SOCKET`, `SUMMIT_BUILDKITD_CONFIG`, `BUILDKITD_FLAGS` | BuildKit daemon command (`rootlesskit buildkitd` in the image), socket, config file, extra daemon flags (for example `--oci-worker-no-process-sandbox` or `--oci-worker-snapshotter=native`). |
| `SUMMIT_RAILPACK_BIN`, `SUMMIT_RAILPACK_FRONTEND_IMAGE` | Railpack CLI path and the BuildKit frontend image (default `ghcr.io/railwayapp/railpack-frontend:v0.43.0`, kept in step with the CLI version baked into the image). |

### Credential flow (contract C4-C6)

1. **Source**: JWT from the source credential file -> broker -> GitHub installation token (read-only `contents`). It is passed to `git` as a per-process `http.<origin>/.extraHeader` through `GIT_CONFIG_*` environment variables, so it is not in the remote URL, process arguments, `.git/config`, or logs (`SanitizeGitOutput` and error scrubbing remain as defence in depth).
2. **Push**: `buildctl` pushes to `ghcr.io/<owner>/summit-app-<service-id>:sha-<commit>` using `$DOCKER_CONFIG/config.json`. BuildKit does not expose client registry credentials to `RUN` steps and the worker adds no `--secret`/`--ssh` mounts, so customer build commands never see them. (Pulling a `FROM ghcr.io/...` base image does present the credential to ghcr.io itself, as any Docker client would.)
3. **Verify**: after the push the worker `GET /v2/<repo>/manifests/<tag>` on the registry, answering the `WWW-Authenticate: Bearer realm=...,service=...,scope=...` challenge with a token fetched from the realm using the same `config.json`. The digest comes from `Docker-Content-Digest` (or SHA-256 of the body) and is reported as `artifact.digest = sha256:<64 hex>` together with the repository and tag; deployments then use `...@sha256:<digest>`.
4. **Report**: every callback carries `Authorization: Bearer <worker JWT>` read from the reporting token file.

---

## Running Locally

### Prerequisites

- Go 1.26+
- Git 2.40+
- Optional: `railpack` CLI and `buildctl`/`buildkitd`

### Build and test

```bash
make build        # bin/worker
make test         # go test ./...
make vet
```

### Run With Local Mock Spec

```bash
export SUMMIT_EXECUTION_SPEC="/path/to/spec.json"      # clone_url may be a local path
export SUMMIT_WORKSPACE_BASE_DIR="/tmp/summit-workspace"
export SUMMIT_SOURCE_CREDENTIAL_FILE=/tmp/token          # raw token file => used directly (no broker)
./bin/worker
```

`deployments/examples/sample-execution-spec.json` is a contract-shaped example (GHCR destination);
it will only build with real GitHub/GHCR credentials.

---

## Container Execution

The worker image (`deployments/worker.Dockerfile`) is multi-stage:

| Layer | Source | Pin |
| :--- | :--- | :--- |
| Worker binary | `golang:1.26-alpine`, `CGO_ENABLED=0` | Go 1.26 |
| Runtime base | `moby/buildkit:v0.34.1-rootless` (Alpine; `buildkitd`, `buildctl`, `rootlesskit`, UID/GID 1000) | tag + index digest |
| Railpack CLI | `railwayapp/railpack` release `v0.43.0`, `*-unknown-linux-musl.tar.gz`, SHA-256 verified against the release `checksums.txt` | v0.43.0 (matches the `railpack-frontend:v0.43.0` BuildKit frontend) |
| Extras | `git`, `ca-certificates` | Alpine packages |

It runs as UID 1000 and adds no setuid binaries. CI publishes it to `ghcr.io/<owner>/summit-builder`
(`.github/workflows/builder-image.yml`, tags `sha-<commit>` and `latest`).

### Build the image

```bash
docker build -f builder/deployments/worker.Dockerfile builder -t summit-builder:dev
```

### Try it locally (plain Docker)

Rootless BuildKit needs relaxed seccomp/AppArmor outside Kubernetes (see
[upstream docs](https://github.com/moby/buildkit/blob/master/docs/rootless.md)):

```bash
docker run --rm --network host \
  --security-opt seccomp=unconfined --security-opt apparmor=unconfined --security-opt systempaths=unconfined \
  -v "$PWD/spec.json":/run/summit/execution.json:ro \
  -v "$PWD/secrets/source":/var/run/secrets/summit/source:ro \
  -v "$PWD/secrets/registry":/var/run/secrets/summit/registry:ro \
  -v "$PWD/secrets/reporting":/var/run/secrets/summit/reporting:ro \
  -e SUMMIT_EXECUTION_SPEC=/run/summit/execution.json \
  -e SUMMIT_SOURCE_CREDENTIAL_FILE=/var/run/secrets/summit/source/token \
  -e SUMMIT_REGISTRY_CREDENTIAL_FILE=/var/run/secrets/summit/registry/config.json \
  -e SUMMIT_REPORTING_TOKEN_FILE=/var/run/secrets/summit/reporting/token \
  -e BUILDKITD_FLAGS=--oci-worker-snapshotter=overlayfs \
  summit-builder:dev
```

---

## Kubernetes Execution Model

The Rudra orchestrator launches one Pod per build in the `summit-builds` namespace under the `gvisor` RuntimeClass:

1. **Scheduling**: the orchestrator creates the per-build Secret `summit-build-<build_id>` (worker JWT), the execution-spec ConfigMap, and the Pod. The push credential Secret (`ghcr-push`, `kubernetes.io/dockerconfigjson`) is created out-of-band by an operator.
2. **Hardened isolation**:
   - `runtimeClassName: gvisor` (host setup in [`gvisor/`](gvisor/README.md)); `runAsUser/Group/fsGroup: 1000`; `drop: [ALL]` + `add: [SETUID, SETGID]` and `allowPrivilegeEscalation: true` (required by rootless BuildKit, see the note above); no service-account token.
   - Secrets are mounted read-only at `/var/run/secrets/summit/{source,registry,reporting}`.
3. **Telemetry**: the worker POSTs to `<reporting.endpoint>/{build_id}/{status,logs,result}` with the worker JWT; on success the result contains `artifact.digest`.
4. **Garbage collection**: the per-build Secret is owned by the Pod; the orchestrator prunes terminal Pods.

For full details and reference manifests, see:
- [Kubernetes Job Spec Documentation](docs/kubernetes-job-spec.md)
- [Reference build Pod YAML](deployments/examples/kubernetes-job.yaml)
- [gVisor host setup, RuntimeClass and verification](gvisor/README.md)
- [Runtime contracts C3-C6](../docs/mvp_runtime_contracts.md)

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
