#!/usr/bin/env bash
# Apply pending SQL migrations with /migrate from summit-api:dev.
# Deletes and recreates the Job so a new image is picked up. Does not drop data.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NS="${SUMMIT_NAMESPACE:-summit-system}"

sanitize() {
  python3 -c 'import sys,re
t=sys.stdin.read()
t=re.sub(r"postgres(?:ql)?://\S+","postgres://<redacted>",t,flags=re.I)
print(t, end="")'
}

kubectl -n "$NS" delete job summit-migrate --ignore-not-found
kubectl apply -f "$ROOT/deploy/local/migrate-job.yaml"

if ! kubectl -n "$NS" wait --for=condition=complete "job/summit-migrate" --timeout=180s; then
  echo "migration job failed" >&2
  kubectl -n "$NS" logs "job/summit-migrate" --tail=120 | sanitize >&2 || true
  exit 1
fi

echo "migration job complete"
kubectl -n "$NS" logs "job/summit-migrate" | sanitize
