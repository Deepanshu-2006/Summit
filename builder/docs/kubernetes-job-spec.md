# Kubernetes Pod Specification for the Summit Builder Worker

This document is the builder-side view of what the orchestrator (`apps/backend/internal/orchestrator/build/pod.go`)
must provision for a build. The orchestrator code is the source of truth; if they disagree, fix this document.
Cross-team contract: [`docs/mvp_runtime_contracts.md`](../../docs/mvp_runtime_contracts.md) (C3-C6). A runnable
reference is [`deployments/examples/kubernetes-job.yaml`](../deployments/examples/kubernetes-job.yaml).

(The file name is historical: the orchestrator creates a bare **Pod**, not a `batch/v1` Job.)

---

## 1. Responsibility separation

- **No controller coupling**: the worker binary contains no Kubernetes client and talks only to (a) the credential
  broker, (b) the build-callback API, (c) git, and (d) the registry.
- **One Pod = one build attempt** (`attempt_id == build.id`), `restartPolicy: Never`. No in-place retries; the
  orchestrator decides about new attempts.
- **Namespace**: `summit-builds`. **Builder image**: `ghcr.io/<owner>/summit-builder`, deployed by digest.

---

## 2. Isolation and security context

| Setting | Value | Why |
| :--- | :--- | :--- |
| `runtimeClassName` | `gvisor` (handler `runsc`) | Kernel-level isolation of untrusted build steps. Host setup: [`gvisor/`](../gvisor/README.md). |
| `runAsUser` / `runAsGroup` / `fsGroup` | `1000` | The `user` account of the `moby/buildkit:*-rootless` base image. `fsGroup` makes the 0440 secret files readable. |
| `runAsNonRoot` | `true` | |
| `allowPrivilegeEscalation` | `true` (**differs from the orchestrator today**) | The image's `newuidmap`/`newgidmap` carry file capabilities (`cap_setuid=ep` / `cap_setgid=ep`). With `no_new_privs` they are ignored and rootlesskit aborts with `newuidmap ... operation not permitted` (reproduced in Docker with `--security-opt no-new-privileges --cap-drop ALL`). |
| `capabilities` | `drop: ["ALL"]`, `add: ["SETUID", "SETGID"]` | `drop: ALL` alone also removes the capabilities from the bounding set, so the file capabilities cannot take effect. Verified with Docker: UID 1000 + `--cap-drop ALL --cap-add SETUID --cap-add SETGID` (and no `no-new-privileges`) completes a full Railpack build and push with BuildKit's process sandbox enabled. Nothing else is added back. |
| `seccompProfile` | `RuntimeDefault` for the pod | Under `runc`, nested user namespaces and `mount` inside them are usually blocked by the default seccomp/AppArmor profiles (upstream BuildKit documents `Unconfined` for both); under gVisor the sandbox applies its own syscall filtering. Whether `RuntimeDefault` suffices inside gVisor is **not verified**. |
| `automountServiceAccountToken` | `false` | Build steps must not see Kubernetes API credentials. |
| `readOnlyRootFilesystem` | `false` | Rootless BuildKit writes under `$HOME` and `$XDG_RUNTIME_DIR`. |
| `activeDeadlineSeconds` | `timeout_seconds` | Hard stop. |

**Why not a single-UID mapping instead?** Tried: with no subuid ranges rootlesskit 3.x refuses to start, and `unshare -Ur buildkitd` starts but cannot unpack the Railpack builder image (`failed to Lchown ".../etc/shadow" for UID 0, GID 42`). Rootless Railpack builds therefore need the multi-UID mapping, i.e. the two capabilities above.

### Process sandbox and `--oci-worker-no-process-sandbox`

By default BuildKit runs each build step in its own PID namespace. If the sandbox cannot create one, set
`BUILDKITD_FLAGS=--oci-worker-no-process-sandbox` on the pod. **Trade-off**: build steps then share the pod's PID
namespace and, being the same UID, can read `/proc/<worker pid>/...` including the mounted credential files. Use it only
if the pod is otherwise dedicated to a single trusted-enough build, never as a silent default. See
[`gvisor/README.md`](../gvisor/README.md).

---

## 3. Volumes and mounts

| Volume | Mount path | Source | Notes |
| :--- | :--- | :--- | :--- |
| `execution-spec` | `/run/summit` (ro) | ConfigMap `summit-build-spec-<attempt>` -> `execution.json` | `SUMMIT_EXECUTION_SPEC=/run/summit/execution.json` |
| `source-creds` | `/var/run/secrets/summit/source` (ro) | Secret `summit-build-<build_id>`, key `token` -> `token` | worker JWT |
| `registry-creds` | `/var/run/secrets/summit/registry` (ro) | Secret `ghcr-push` (`kubernetes.io/dockerconfigjson`), key `.dockerconfigjson` -> `config.json` | the file must be named `config.json` |
| `reporting-creds` | `/var/run/secrets/summit/reporting` (ro) | Secret `summit-build-<build_id>`, key `token` -> `token` | worker JWT |
| `build-cache` | `/home/user/.local/share/buildkit` | `emptyDir` (size-limited) | rootless BuildKit state |

All secret volumes use `defaultMode: 0440` (owner root, group 1000 via `fsGroup`).

---

## 4. Environment

| Variable | Value |
| :--- | :--- |
| `SUMMIT_EXECUTION_SPEC` | `/run/summit/execution.json` |
| `SUMMIT_SOURCE_CREDENTIAL_FILE` | `/var/run/secrets/summit/source/token` |
| `SUMMIT_SOURCE_BROKER_URL` | `<ORCHESTRATOR_API_INTERNAL_URL>/internal/v1/build-requests` |
| `SUMMIT_REGISTRY_CREDENTIAL_FILE` | `/var/run/secrets/summit/registry/config.json` |
| `SUMMIT_REPORTING_TOKEN_FILE` | `/var/run/secrets/summit/reporting/token` |
| `BUILDKIT_ROOTLESS` | `true` |
| `SUMMIT_INSECURE_REGISTRIES` | *(unset in production; only for a plain-HTTP test registry)* |
| `BUILDKITD_FLAGS` | *(unset; see section 2)* |

The image already sets `SUMMIT_BUILDKITD_BIN="rootlesskit buildkitd"`, `SUMMIT_BUILDKIT_SOCKET`,
`SUMMIT_BUILDKITD_CONFIG`, and `SUMMIT_WORKSPACE_BASE_DIR=/workspace`.

---

## 5. Secrets and credential handling

| Contract | Orchestrator provides | Builder does |
| :--- | :--- | :--- |
| **C4** per-build Secret | `summit-build-<build_id>` with key `token` (worker JWT, `sub` = build id, `aud` = `summit-builder`, `exp` set), owner-referenced to the Pod; `ghcr-push` created by an operator | Reads the files named by the three `*_FILE` variables. Never reads or uses `*_ref` strings as credentials. |
| **C5** source credentials | `SUMMIT_SOURCE_BROKER_URL` | `POST {broker}/{build.id}/source-token` with `Authorization: Bearer <JWT>` (10 s timeout, one retry on 5xx or network error); rejects the response unless `repository.clone_url` and `repository.commit_sha` (case-insensitive) match the spec; clones with the token as a per-process HTTP header, so nothing is persisted in `.git/config`. |
| **C6** callbacks | `reporting.endpoint` = `<API>/internal/v1/builds` | `POST {endpoint}/{build_id}/status|logs|result` with `Authorization: Bearer <JWT from the reporting token file>`. |
| Registry push | `ghcr-push` | `buildctl` gets `DOCKER_CONFIG=<dir of config.json>` in its own environment only (not `buildkitd`, not the worker's global environment). No `--secret`/`--ssh` mounts are ever passed, so build steps cannot read it. The same `config.json` authenticates the digest lookup (OCI Bearer token flow). |

The push credential is a **trusted publishing boundary** (team decision, see `docs/ghcr_mvp_setup.md`): it is present
in the worker's pod but never in a build step's filesystem or environment.

---

## 6. Resources

`resources.*` from the spec become requests/limits (CPU, memory, ephemeral-storage). gVisor adds roughly 150-250 MB of
sandbox overhead; configure `RuntimeClass.overhead` (see
[`deployments/examples/gvisor-runtimeclass.yaml`](../deployments/examples/gvisor-runtimeclass.yaml)) or budget it in the limits.

---

## 7. Snapshotter and user namespaces under gVisor

`deployments/buildkitd.toml` sets `snapshotter = "auto"`: BuildKit uses rootless overlayfs when the sandbox permits it
and falls back to the copy-based `native` snapshotter. `native` is correct but slow (on a Docker host, unpacking the
Railpack builder image took over 7 minutes versus seconds with overlayfs). Override with
`BUILDKITD_FLAGS=--oci-worker-snapshotter=native|overlayfs` once you have measured which works in your gVisor setup.
Rootless BuildKit needs user namespaces; gVisor supports them, but this has not been verified inside the project's
gVisor setup yet (see the status section of [`gvisor/README.md`](../gvisor/README.md)).
