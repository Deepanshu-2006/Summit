#!/usr/bin/env bash
# kind-setup-gvisor.sh - install gVisor into every node of a Kind cluster and apply the
# `gvisor` RuntimeClass.
#
# Usage: kind-setup-gvisor.sh [--cluster <name>] [--yes] [--dry-run]
#
#   --cluster   Kind cluster name (default: $KIND_CLUSTER or summit-local)
#   --yes       do not ask for confirmation
#   --dry-run   only print what would be changed
#
# What it does (and prints before doing it):
#   1. downloads and sha512-verifies the pinned gVisor release ON THE HOST (kind nodes have no
#      bzip2/zstd), via install-runsc.sh fetch;
#   2. for each node from `kind get nodes --name <cluster>`: docker cp the binaries and
#      install-runsc.sh into the node container and run `install-runsc.sh install` there. That
#      adds the runsc handler to the node's /etc/containerd/config.toml (managed block,
#      idempotent) and restarts the node's containerd;
#   3. kubectl apply -f runtimeclass.yaml (context kind-<cluster>).
#
# It is idempotent: nodes that already have identical binaries and config are left alone.
# Kind-specific: runsc runs nested inside the node container, so cgroup management is
# disabled for gVisor pods (RUNSC_CONFIG_LINES, overridable). This has not been verified on
# every host; run verify-gvisor.sh afterwards.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER="${KIND_CLUSTER:-summit-local}"
ASSUME_YES=0
DRY_RUN=0
RUNSC_CONFIG_LINES="${RUNSC_CONFIG_LINES-ignore-cgroups = \"true\"}"
GVISOR_RELEASE="${GVISOR_RELEASE:-20261026.0}"
export GVISOR_RELEASE

log() { printf '[kind-setup-gvisor] %s\n' "$*"; }
die() { printf '[kind-setup-gvisor] ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster) CLUSTER="${2:-}"; shift 2 ;;
    --yes | -y) ASSUME_YES=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h | --help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done
[[ -n "$CLUSTER" ]] || die "cluster name is empty"

for tool in docker kind kubectl; do
  command -v "$tool" > /dev/null 2>&1 || die "$tool not found in PATH"
done

mapfile -t NODES < <(kind get nodes --name "$CLUSTER")
[[ ${#NODES[@]} -gt 0 ]] || die "no nodes found for Kind cluster '${CLUSTER}' (kind get clusters)"
CONTEXT="kind-${CLUSTER}"

log "cluster:        ${CLUSTER} (kubectl context ${CONTEXT})"
log "gVisor release: ${GVISOR_RELEASE}"
log "nodes:          ${NODES[*]}"
log "plan:"
log "  - fetch + sha512-verify gVisor on this host (temp dir, removed afterwards)"
for n in "${NODES[@]}"; do
  log "  - node ${n}: docker cp binaries + install-runsc.sh; install into /usr/local/bin;"
  log "      add runtimes.runsc to /etc/containerd/config.toml (backup config.toml.summit-gvisor.bak);"
  log "      write /etc/containerd/runsc.toml; restart containerd inside the node if config changed"
done
log "  - kubectl --context ${CONTEXT} apply -f ${HERE}/runtimeclass.yaml"

if [[ $DRY_RUN -eq 1 ]]; then
  log "dry run: nothing changed"
  exit 0
fi
if [[ $ASSUME_YES -eq 0 ]]; then
  read -r -p "[kind-setup-gvisor] apply these changes? [y/N] " answer || true
  [[ "${answer:-}" == "y" || "${answer:-}" == "Y" ]] || die "aborted"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
bash "${HERE}/install-runsc.sh" fetch "${WORK}/gvisor"

for n in "${NODES[@]}"; do
  log "configuring node ${n}"
  docker exec "$n" rm -rf /tmp/summit-gvisor
  docker exec "$n" mkdir -p /tmp/summit-gvisor
  docker cp "${WORK}/gvisor/." "${n}:/tmp/summit-gvisor/src"
  docker cp "${HERE}/install-runsc.sh" "${n}:/tmp/summit-gvisor/install-runsc.sh"
  docker exec -e RUNSC_CONFIG_LINES="${RUNSC_CONFIG_LINES}" -e GVISOR_RELEASE="${GVISOR_RELEASE}" "$n" \
    bash /tmp/summit-gvisor/install-runsc.sh install --source-dir /tmp/summit-gvisor/src --yes
  docker exec "$n" rm -rf /tmp/summit-gvisor
done

kubectl --context "$CONTEXT" apply -f "${HERE}/runtimeclass.yaml"
log "done. Verify with: ${HERE}/verify-gvisor.sh"
