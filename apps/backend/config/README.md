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
| `smoke/postgres.yaml` | Optional local Kind smoke-test PostgreSQL Deployment, Service, and 5 GiB local-path PVC (not part of the control-plane kustomization) |
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
   - Network policy: `ORCHESTRATOR_ENABLE_NETWORK_POLICY=true` (`native` requires a CNI that enforces
     Kubernetes NetworkPolicy; Kind's default kindnet does not enforce it. `cilium` needs the Cilium
     CRDs). Set `ORCHESTRATOR_SERVICE_CIDR` to your cluster's
     Service CIDR (Kind config above uses `10.96.0.0/16`; default `10.96.0.0/12` covers it).
   - ESO: install External Secrets Operator and OpenBao, then `ORCHESTRATOR_ENABLE_ESO=true` with
     `ORCHESTRATOR_OPENBAO_SERVER_URL` and `ORCHESTRATOR_OPENBAO_ROLE`.
     The OpenBao Kubernetes auth role must trust the per-tenant `summit-eso-vault` ServiceAccount.

## What must be created by hand

- Secrets: `summit-orchestrator-env`, `summit-api-env`, `ghcr-push` (summit-builds), `ghcr-pull` (per tenant namespace).
- The `gvisor` RuntimeClass and builder image (Priyanshu / `builder/`).
- Traefik, Cilium, External Secrets Operator and OpenBao installs if you enable those add-ons.
- Backend container images.

## Local smoke-test PostgreSQL storage

The optional `summit-smoke` PostgreSQL manifest uses the cluster's default
`standard` StorageClass (Kind's `rancher.io/local-path`) and a 5 GiB
ReadWriteOnce PVC. Apply it only after the `summit-smoke` namespace and the
`summit-smoke-postgres` Secret exist:

```sh
kubectl apply -f apps/backend/config/smoke/postgres.yaml
```

This manifest is intentionally excluded from the main control-plane
kustomization. It is for local development and smoke tests; it does not create
an S3 backup. The PVC survives PostgreSQL pod restarts and Deployment rollouts,
but the Kind cluster's node disk is local to the cluster container, so deleting
the Kind cluster can delete this data. Keep any data that must survive cluster
recreation in a separate backup.

## Tenant PostgreSQL Workloads (SummitService)

Summit PaaS supports provisioning dedicated tenant PostgreSQL databases via the
`SummitService` CRD (`summit.dev/v1alpha1`).

### Creating a Tenant PostgreSQL Database

1. Ensure the tenant namespace exists and contains a Secret with the database password:

   ```sh
   umask 077
   openssl rand -base64 32 | tr -d '\n' > /tmp/summit-db-password
   kubectl -n tenant-user123 create secret generic db-credentials \
     --from-file=password=/tmp/summit-db-password
   rm /tmp/summit-db-password
   ```

2. Apply a `SummitService` manifest specifying `type: postgres`:

   ```yaml
   apiVersion: summit.dev/v1alpha1
   kind: SummitService
   metadata:
     name: db-orders
     namespace: tenant-user123
     labels:
       summit.dev/tenant: "user123"
       summit.dev/project: "ecommerce"
       summit.dev/service: "orders-db"
   spec:
     type: postgres
     postgres:
       version: "16"
       databaseName: "summit"
       username: "postgres"
       storage:
         storageClassName: "ebs-gp3-sc" # Explicit CSI StorageClass; cluster default is prohibited
         size: "10Gi"
       auth:
         secretRef:
           name: "db-credentials"
           key: "password"
   ```

### Reconciled Workload Architecture

- **StatefulSet:** One replica provisioned with `OrderedReady` pod management and `RollingUpdate`.
- **Persistent Volume Claims:** Exactly one PVC per service (`postgres-data`) mounted at `/var/lib/postgresql/data` (subpath `pgdata`). Volume claim templates intentionally omit OwnerReferences to prevent accidental data deletion when the CR is deleted.
- **Explicit PVC Retention:** The StatefulSet enforces `persistentVolumeClaimRetentionPolicy` with `whenDeleted: Retain` and `whenScaled: Retain`.
- **Governing & Client Services:**
  - Headless Service (`<name>-headless`): `ClusterIP: None`, `publishNotReadyAddresses: true` for stable pod DNS.
  - Client Service (`<name>`): Stable internal ClusterIP service on port 5432 for tenant backend applications.
- **Pod Hardening:** Runs as non-root (UID 70, GID 70, FSGroup 70), drops `ALL` Linux capabilities, enforces `RuntimeDefault` seccomp, and uses a read-only root filesystem with dedicated `emptyDir` scratch spaces for `/tmp` and `/var/run/postgresql` (unix domain sockets).
- **Health Probes:** Configures startup (30 failures, 5s period), readiness, and liveness probes using `pg_isready`.
- **Zero Plaintext Secrets:** Passwords must be referenced via Kubernetes `secretRef`, mounted read-only as a file, and passed to the official image through `POSTGRES_PASSWORD_FILE`. Plaintext passwords and all custom PostgreSQL env variables are rejected (including auth-bypass settings such as `POSTGRES_HOST_AUTH_METHOD=trust`).
- **Network Isolation:** A NetworkPolicy allows PostgreSQL TCP ingress only from Summit-managed pods in the same namespace and denies database egress. The policy is enforced only when the cluster CNI implements Kubernetes NetworkPolicy; verify this on each cluster before relying on it as a security boundary.
- **State Preservation on Immutable Changes:** `storageClassName` and volume claim capacity are immutable. If changed on an existing StatefulSet, the reconciler flags a failed status and surfaces an explicit validation error without deleting or recreating the StatefulSet or destroying state.

### Production Prerequisites & Operational Readiness

> [!WARNING]
> **Kind local-path is test-only:** Kind's `rancher.io/local-path` StorageClass stores data on the local Docker container filesystem. Deleting or recreating the Kind cluster irrevocably deletes this storage. The controller code alone cannot make an unconfigured cluster production-ready.

Before running tenant PostgreSQL workloads in a production environment, operators must satisfy the following infrastructure requirements:

1. **CSI-Backed Durable Storage:**
   Provision a high-durability CSI StorageClass backed by cloud block storage (e.g., AWS EBS CSI with `gp3`/`io2`, GCP Persistent Disk CSI, Azure Disk CSI, or Ceph-CSI). The current reconciler treats claim size as immutable; do not advertise expansion until PVC resize behavior and StatefulSet template reconciliation are implemented and tested.
2. **Encryption at Rest:**
   The CSI StorageClass must enforce encryption at rest via customer-managed KMS keys (e.g. AWS KMS, GCP Cloud KMS, Azure Key Vault) so all persistent volume blocks and underlying snapshots remain encrypted.
3. **Backup and Restore Testing:**
   Establish automated continuous WAL archiving and scheduled physical/logical backups (using tools such as `pgBackRest`, `WAL-G`, or `Barman`) shipping snapshots to an external, cross-region object storage bucket (S3/GCS). Conduct automated restore drills periodically to verify Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO).
4. **Monitoring & Telemetry:**
   Deploy `postgres_exporter` and configure Prometheus scraping for database connection saturation, cache hit ratios, transaction wraparound, and disk utilization alerts (>80%). Aggregate database query performance via `pg_stat_statements` and stream pod logs to Loki.
5. **Zero-Trust Network Policies:**
   Use a NetworkPolicy-enforcing CNI (such as Cilium or Calico) and verify policy behavior with allow/deny connectivity tests. The generated policy scopes access to Summit-managed pods in the same namespace, which should correspond to a project environment; deny all outbound internet egress from the database pod.
6. **PostgreSQL Version Upgrades:**
   PostgreSQL 16 is the standard supported major version for MVP. Major version upgrades (e.g. to Postgres 17+) require deliberate data migration procedures (`pg_upgrade` or logical dump and restore) and must be validated in staging environments prior to production migration.

## Known limits

- Tenant PostgreSQL is a single-replica StatefulSet; it has no automatic failover or high availability. The controller and manifests are not, by themselves, sufficient for production use. Production requires validated durable/encrypted storage, tested backups and restore procedures, monitoring/alerts, NetworkPolicy enforcement, secret rotation operations, and a tested upgrade/incident runbook.

- Rootless BuildKit requires `allowPrivilegeEscalation: true` and `SETUID`/`SETGID` capabilities for its
  `newuidmap`/`newgidmap` helpers. Pod Security Admission `restricted` (and `baseline`) rejects those fields,
  so `summit-builds` uses `enforce: privileged` while retaining `audit` and `warn: restricted`. This is an
  admission-policy exception, not a privileged container: builder Pods still run as UID 1000 under gVisor,
  drop every other capability, use `RuntimeDefault` seccomp, and receive no service-account token. Keep
  `summit-builds` pod-create RBAC limited to the orchestrator service account and review audit/warn output.
- The ClusterRole cannot be namespace-scoped; it intentionally has no delete on tenant objects,
  so tenant teardown (plan section 13.2) needs an RBAC extension when implemented.
- Orchestrator runs 1 replica: the pruner has no leader election yet.
