#!/usr/bin/env bash
# Build summit-api:dev and summit-orchestrator:dev from the working tree and
# load them into the kind cluster. Safe to re-run.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLUSTER="${KIND_CLUSTER:-summit-local}"

if ! rg -q '^\.env$' "$ROOT/apps/backend/.dockerignore"; then
  echo "apps/backend/.dockerignore must exclude .env" >&2
  exit 1
fi

docker build \
  -f "$ROOT/apps/backend/Dockerfile.api" \
  -t summit-api:dev \
  "$ROOT/apps/backend"

docker build \
  -f "$ROOT/apps/backend/Dockerfile.orchestrator" \
  -t summit-orchestrator:dev \
  "$ROOT/apps/backend"

kind load docker-image summit-api:dev --name "$CLUSTER"
kind load docker-image summit-orchestrator:dev --name "$CLUSTER"

echo "loaded summit-api:dev and summit-orchestrator:dev into kind cluster $CLUSTER"
