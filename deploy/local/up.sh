#!/usr/bin/env bash
# Build, load, configure, migrate, and roll out the local Summit control plane.
# Idempotent. Refuses to touch any kubectl context other than kind-summit-local.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER="${KIND_CLUSTER:-summit-local}"
NS="${SUMMIT_NAMESPACE:-summit-system}"

ctx="$(kubectl config current-context)"
if [[ "$ctx" != "kind-${CLUSTER}" ]]; then
  echo "refusing to run: kubectl context is ${ctx}, want kind-${CLUSTER}" >&2
  exit 1
fi

"$ROOT/deploy/local/build-images.sh"

# Traefik (pinned by digest in config/traefik) is pulled by the node itself;
# `kind load` cannot import its multi-arch index, so it is not loaded here.
uv run --no-project "$ROOT/deploy/local/secrets.py"
"$ROOT/deploy/local/migrate.sh"

kubectl apply --server-side --force-conflicts -k "$ROOT/apps/backend/config/traefik"
kubectl apply -k "$ROOT/apps/backend/config"

# Replace the running pods in place so a rebuilt :dev tag is actually started.
kubectl -n "$NS" rollout restart deploy/summit-api deploy/summit-orchestrator
kubectl -n "$NS" rollout status deploy/summit-api --timeout=180s
kubectl -n "$NS" rollout status deploy/summit-orchestrator --timeout=180s
kubectl -n traefik rollout status deploy/traefik --timeout=180s

"$ROOT/deploy/local/ports.sh"

echo "summit local control plane is up"
echo "  API:     http://127.0.0.1:4000/health"
echo "  Traefik: http://127.0.0.1/  (404 with no matching route is expected)"
echo "  Apps:    http://<service>-<project>.localtest.me"
