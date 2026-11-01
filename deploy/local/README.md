# Local Kind deploy

Run the Summit API and orchestrator on the existing `kind-summit-local` cluster.
The cluster already has gVisor, GHCR pull secrets, and tenant namespaces. Do not
delete or recreate it. It was created without `config/kind/kind-config.yaml`
port mappings, so host ports are published by `ports.sh`.

## Bring it up

From the repo root, with kubectl context `kind-summit-local`:

```bash
deploy/local/up.sh
```

That script is idempotent and does, in order:

1. `deploy/local/build-images.sh` — multi-stage static images `summit-api:dev` and `summit-orchestrator:dev`, then `kind load`.
2. Traefik (`apps/backend/config/traefik`, image pinned by digest) is pulled by the node itself.
3. `uv run --no-project deploy/local/secrets.py` — `summit-api-env` and `summit-orchestrator-env` from `apps/backend/.env`. The GitHub App PEM is decoded from its quoted value. `WORKER_JWT_SECRET` is reused when it already exists and is never printed.
4. `deploy/local/migrate.sh` — one-shot Job using `/migrate` from the API image. Migrations are additive. If the Job fails, `up.sh` stops before rolling anything out.
5. `kubectl apply --server-side --force-conflicts -k apps/backend/config/traefik`
6. `kubectl apply -k apps/backend/config`
7. Rollout restart of the API and orchestrator (the `:dev` tag does not change, so a restart is what picks up a newly loaded image).
8. `deploy/local/ports.sh`

Pieces can be re-run on their own. `up.sh` refuses any kubectl context other than `kind-summit-local`.

## How the web app reaches the API

`apps/web/.env` sets `PLATFORM_PUBLIC_API_BASE_URL=http://127.0.0.1:4000`. The API Service is a NodePort on `30400` and still has cluster DNS:

`http://summit-api.summit-system.svc.cluster.local:4000`

`ports.sh` forwards host loopback `:4000` to that NodePort. The GitHub App callback was registered at `http://127.0.0.1:4000`, so this port has to stay on the host. The API's `PLATFORM_PUBLIC_API_BASE_URL` is that same URL. `PLATFORM_FRONTEND_BASE_URL` is `http://localhost:3000`.

Builder pods do not use `127.0.0.1`. The orchestrator sets

`ORCHESTRATOR_API_INTERNAL_URL=http://summit-api.summit-system.svc.cluster.local:4000`

and passes that to build pods (source broker and build callbacks).

## How deployed apps are reached

Traefik v3.7.17 listens in namespace `traefik`:

| Entry point | Container | NodePort | Host |
|---|---|---|---|
| `web` | 8000 | 30080 | 80 |
| `websecure` | 8443 | 30443 | 443 |

Providers are `kubernetesCRD` (`allowCrossNamespace=false`) and `kubernetesIngress` (IngressClass `traefik`). Ingress is enabled on the orchestrator with `ORCHESTRATOR_APPS_DOMAIN=localtest.me` and `ORCHESTRATOR_PUBLIC_URL_SCHEME=http`. A service is served at:

```text
http://<service>-<project>.localtest.me
```

`localtest.me` resolves to `127.0.0.1` and `::1`. `ports.sh` publishes both when Docker can bind `::1`. An HTTP request with no matching route returns Traefik's 404.

A fresh cluster created with `apps/backend/config/kind/kind-config.yaml` publishes 80, 443, and 4000 itself (including `30400 -> 4000`). `ports.sh` detects that and does not add a second listener. Do not recreate `kind-summit-local` to pick up that file; it would drop gVisor and the namespaces already on the node.

## Tear down the forwarders

```bash
deploy/local/ports.sh down
```

This removes only `summit-local-fwd-web`, `summit-local-fwd-websecure`, and `summit-local-fwd-api`. It does not stop Traefik, the API, the orchestrator, or the kind node.

## Troubleshooting

- `up.sh` exits immediately: `kubectl config current-context` is not `kind-summit-local`.
- Host port 80, 443, or 4000 is already taken: `ports.sh` prints the listener and stops. It does not kill unknown processes.
- `curl http://127.0.0.1:4000/health` fails: confirm the forwarder is running (`docker ps --filter name=summit-local-fwd-api`) and the API pod is Ready (`kubectl -n summit-system get pods`).
- `curl http://smoke.localtest.me/` fails while `curl -4` works: Docker could not bind `[::1]`. Check the `ports.sh` warning.
- API or orchestrator stays on the old image: re-run `build-images.sh`, then `kubectl -n summit-system rollout restart deploy/summit-api deploy/summit-orchestrator`. `imagePullPolicy` is `IfNotPresent`, so a new pod is what uses the image `kind load` just swapped in.
- Migration Job failed: `kubectl -n summit-system logs job/summit-migrate`. The SQL files are the `*.up.sql` files under `apps/backend/internal/db/migrations`. The runner records versions in `public.schema_migrations`.
- Traefik pod `ImagePullBackOff`: the node pulls `traefik:v3.7.17@sha256:…` from Docker Hub; check node network access, then delete the pod.
- Traefik CRDs were applied with server-side apply on purpose. A client-side `kubectl apply` can reject the CRD document because `kubectl.kubernetes.io/last-applied-configuration` exceeds 256Ki.
