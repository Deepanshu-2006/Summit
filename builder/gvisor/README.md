# gVisor host setup for the Summit builder

gVisor (`runsc`) is a **host-level** concern: the binaries and a containerd runtime handler live on the Kubernetes nodes,
and the cluster has one `RuntimeClass`. The builder image (`builder/deployments/worker.Dockerfile`) contains BuildKit and
Railpack but **no gVisor**. Build Pods opt in with `runtimeClassName: gvisor` (the orchestrator's default).

Owner: Priyanshu (isolated builder). The orchestrator (Rudra) only references the `gvisor` RuntimeClass.

| File | Purpose |
| :--- | :--- |
| `install-runsc.sh` | On a node (as root): download + sha512-verify gVisor, install `runsc`, `containerd-shim-runsc-v1` and `gvisor-bin/`, add the `runsc` handler to `/etc/containerd/config.toml`, restart containerd. |
| `kind-setup-gvisor.sh` | Kind only: runs the above inside every node of a Kind cluster and applies the RuntimeClass. |
| `runtimeclass.yaml` | `node.k8s.io/v1` RuntimeClass `gvisor` -> handler `runsc`. |
| `verify-gvisor.sh` | Runs a throwaway pod under `gvisor` and checks `uname`/`dmesg` identify gVisor. |

## Real nodes (the SSH test hosts)

```bash
# On each node (needs curl, sha512sum, and bzip2 or zstd; or run `fetch` elsewhere and pass --source-dir):
sudo ./install-runsc.sh install --dry-run     # prints exactly what would change
sudo ./install-runsc.sh install               # asks for confirmation; --yes to skip
# Once per cluster:
kubectl apply -f runtimeclass.yaml
./verify-gvisor.sh
```

What `install` changes (and prints first):

- `/usr/local/bin/{runsc,containerd-shim-runsc-v1}` and `/usr/local/bin/gvisor-bin/` (runsc looks for the sidecar
  binaries next to itself, so they travel together).
- `/etc/containerd/runsc.toml` (`[runsc_config]`, extra lines via `RUNSC_CONFIG_LINES`).
- `/etc/containerd/config.toml`: a block between `# BEGIN summit-gvisor` and `# END summit-gvisor` registering
  `runtime_type = "io.containerd.runsc.v1"`. The table name follows the config file's `version`:
  `version = 3` -> `plugins."io.containerd.cri.v1.runtime".containerd.runtimes.runsc`;
  `version = 2` (also what containerd 2.x binaries read from older files, such as Kind's) and 1.x ->
  `plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc`. A backup `config.toml.summit-gvisor.bak` is written.
  If a `runsc` table already exists outside the managed block it is left untouched.
- `systemctl restart containerd` only when the config changed. Running containers keep running.

Re-running is a no-op when binaries and config are identical. Pin: `GVISOR_RELEASE` (default `20261026.0`; `latest` is
accepted but mutable).

## Kind (`summit-local`)

```bash
./kind-setup-gvisor.sh --cluster summit-local --dry-run   # prints plan, changes nothing
./kind-setup-gvisor.sh --cluster summit-local             # asks for confirmation
./verify-gvisor.sh --context kind-summit-local
```

Kind nodes lack `bzip2`/`zstd`, so the script downloads and verifies on the host and `docker cp`s the binaries into each node.
It sets `ignore-cgroups = "true"` in `runsc.toml` because runsc runs nested inside the node container; override with
`RUNSC_CONFIG_LINES=...`. Node changes live in the node container's filesystem: recreating the cluster loses them, so
re-run the script after `kind create cluster`.

## BuildKit inside gVisor

- Rootless BuildKit needs user namespaces and (by default) a PID namespace for build steps. gVisor implements both, but rootless BuildKit running end-to-end inside gVisor is not yet verified here (see below).
- If the sandbox cannot provide the PID namespace, `BUILDKITD_FLAGS=--oci-worker-no-process-sandbox` makes BuildKit run
  steps in the pod's PID namespace. **That weakens isolation between customer build steps and the worker** (same UID,
  shared `/proc`, so mounted credentials become readable). Treat it as a last resort and decide it explicitly.
- `deployments/buildkitd.toml` uses `snapshotter = "auto"`; force `native` or `overlayfs` with
  `BUILDKITD_FLAGS=--oci-worker-snapshotter=...` after measuring.
- The image's `newuidmap`/`newgidmap` have file capabilities (`cap_setuid`/`cap_setgid`). With `drop: [ALL]` plus
  `allowPrivilegeEscalation: false` (what the orchestrator's `pod.go` sets today) rootlesskit fails with
  `newuidmap ... operation not permitted`. The pod needs `allowPrivilegeEscalation: true` and `add: [SETUID, SETGID]`
  (reproduced and verified in plain Docker; see `docs/kubernetes-job-spec.md`). A single-UID mapping is not an alternative:
  it cannot unpack images with files owned by other UIDs.

## Status of verification

Verified by the author: the scripts' syntax (`bash -n`), the containerd config edit logic on a copy of the Kind node's
config (v2 layout), a synthetic v3 layout, idempotency, and the "table already present" skip; the release download and
sha512 verification. **Not verified**: actually installing into a node, a pod starting under `runsc`, and BuildKit
running inside gVisor. Run `verify-gvisor.sh` and a real build under `gvisor` before relying on it.
