# Cluster deployment manifests

Manifests for running the Summit control plane (API + orchestrator) and the
build/tenant guard rails on a Kubernetes cluster (Kind first). Behaviour and
naming follow `docs/mvp_runtime_contracts.md`.

## Layout

| Path | Purpose |
|---|---|
| `namespaces.yaml` | `summit-system` restricted; `summit-builds` privileged admission with restricted audit/warn |
| `crd/summit.dev_summitservices.yaml` | `SummitService` CRD |
| `rbac/orchestrator.yaml` | orchestrator ServiceAccount, ClusterRole, build/lease Roles (no escalate/bind/impersonate) |
| `builds/serviceaccount.yaml` | `summit-builder` ServiceAccount used by build Pods |
| `builds/network-policy.yaml` | native NetworkPolicy locking down builder Pods (generated, see below) |
| `builds/cilium-network-policy.yaml` | Cilium equivalent with `toFQDNs` (generated; not in the kustomization) |
| `api/deployment.yaml` | API Deployment and Service `summit-api` (port 4000) |
| `orchestrator/deployment.yaml` | orchestrator Deployment (1 replica, read-only root FS, non-root) |
| `kind/kind-config.yaml` | example Kind config with host ports 80/443 for Traefik |
| `kustomization.yaml` | ties the above together (excludes the gVisor RuntimeClass, Cilium file, Kind config) |

The `builds/*network-policy.yaml` files are rendered from the Go generators in
`internal/cluster/addons`; a unit test fails if they drift. Regenerate with
`UPDATE_GOLDEN=1 go -C apps/backend test ./internal/cluster/addons -run TestRenderedManifests`.

## Apply order

1. (Optional, new cluster) `kind create cluster --name summit-local --config apps/backend/config/kind/kind-config.yaml`.
   Do not recreate an existing cluster you want to keep.
2. gVisor RuntimeClass and node runtime: owned by `builder/gvisor/` (not part of this kustomization).
3. `kubectl apply -k apps/backend/config` (namespaces, CRD, RBAC, builder ServiceAccount,
   builder NetworkPolicy, API, orchestrator). The Deployments will not become ready until the
   Secrets below exist and the images are loaded.
4. Create the Secrets by hand (never commit them):

   ```sh
   kubectl -n summit-system create secret generic summit-orchestrator-env \
     --from-literal=DATABASE_URL='postgres://...' \
     --from-literal=WORKER_JWT_SECRET="$(openssl rand -base64 48)"

   # Every key becomes an env var of the API (DATABASE_URL, SUPABASE_*, GITHUB_*, ...).
   # WORKER_JWT_SECRET MUST equal the orchestrator's value.
   kubectl -n summit-system create secret generic summit-api-env \
     --from-literal=DATABASE_URL='postgres://...' \
     --from-literal=WORKER_JWT_SECRET='<same as above>' \
     --from-literal=SUPABASE_JWKS_URL='...'

   # Registry push credential read by the builder (contract C4); docker config JSON.
   kubectl -n summit-builds create secret docker-registry ghcr-push \
     --docker-server=ghcr.io --docker-username=<user> --docker-password=<PAT with write:packages>

   # Image pull credential for tenant workloads, one per tenant namespace
   # (the orchestrator does not copy it yet): ghcr-pull in tenant-<user_id>.
   kubectl -n tenant-<user_id> create secret docker-registry ghcr-pull \
     --docker-server=ghcr.io --docker-username=<user> --docker-password=<PAT with read:packages>
   ```

5. Build and load images (no backend Dockerfile exists yet, so `summit-api:dev`,
   `summit-orchestrator:dev` and `summit-builder:dev` are placeholders):
   `kind load docker-image summit-api:dev --name summit-local`, and so on.
6. Optional add-ons, each behind an orchestrator env flag (all off except quotas):
   - Traefik (install it, expose NodePorts 30080/30443 for the Kind config), then `ORCHESTRATOR_ENABLE_INGRESS=true`.
   - Network policy: `ORCHESTRATOR_ENABLE_NETWORK_POLICY=true` (`native` works on kindnet and any
     enforcing CNI; `cilium` needs the Cilium CRDs). Set `ORCHESTRATOR_SERVICE_CIDR` to your cluster's
     Service CIDR (Kind config above uses `10.96.0.0/16`; default `10.96.0.0/12` covers it).
   - ESO: install External Secrets Operator and OpenBao, then `ORCHESTRATOR_ENABLE_ESO=true` with
     `ORCHESTRATOR_OPENBAO_SERVER_URL` and `ORCHESTRATOR_OPENBAO_ROLE`.
     The OpenBao Kubernetes auth role must trust the per-tenant `summit-eso-vault` ServiceAccount.

## What must be created by hand

- Secrets: `summit-orchestrator-env`, `summit-api-env`, `ghcr-push` (summit-builds), `ghcr-pull` (per tenant namespace).
- The `gvisor` RuntimeClass and builder image (Priyanshu / `builder/`).
- Traefik, Cilium, External Secrets Operator and OpenBao installs if you enable those add-ons.
- Backend container images.

## Known limits

- Rootless BuildKit requires `allowPrivilegeEscalation: true` and `SETUID`/`SETGID` capabilities for its
  `newuidmap`/`newgidmap` helpers. Pod Security Admission `restricted` (and `baseline`) rejects those fields,
  so `summit-builds` uses `enforce: privileged` while retaining `audit` and `warn: restricted`. This is an
  admission-policy exception, not a privileged container: builder Pods still run as UID 1000 under gVisor,
  drop every other capability, use `RuntimeDefault` seccomp, and receive no service-account token. Keep
  `summit-builds` pod-create RBAC limited to the orchestrator service account and review audit/warn output.
- The ClusterRole cannot be namespace-scoped; it intentionally has no delete on tenant objects,
  so tenant teardown (plan section 13.2) needs an RBAC extension when implemented.
- Orchestrator runs 1 replica: the pruner has no leader election yet.
