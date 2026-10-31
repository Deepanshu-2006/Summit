#!/usr/bin/env bash
# verify-gvisor.sh - prove that pods with runtimeClassName "gvisor" really run under gVisor.
#
# Usage: verify-gvisor.sh [--context <kube-context>] [--namespace <ns>] [--image <image>]
#
# Creates a short-lived pod (runtimeClassName: gvisor) that prints `uname -a` and `dmesg`,
# passes if the output identifies gVisor (the sandbox kernel announces itself in dmesg and
# reports a synthetic 4.4.0 kernel), then deletes the pod. Defaults: current context,
# namespace "default", image busybox:1.37. Exit code 0 = gVisor confirmed.
set -euo pipefail

CONTEXT=""
NAMESPACE="${NAMESPACE:-default}"
IMAGE="${IMAGE:-busybox:1.37}"
TIMEOUT="${TIMEOUT:-180s}"

log() { printf '[verify-gvisor] %s\n' "$*"; }
die() { printf '[verify-gvisor] ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --context) CONTEXT="${2:-}"; shift 2 ;;
    --namespace | -n) NAMESPACE="${2:-}"; shift 2 ;;
    --image) IMAGE="${2:-}"; shift 2 ;;
    -h | --help) sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

command -v kubectl > /dev/null 2>&1 || die "kubectl not found"
KUBECTL=(kubectl)
[[ -n "$CONTEXT" ]] && KUBECTL+=(--context "$CONTEXT")
KUBECTL+=(--namespace "$NAMESPACE")

POD="gvisor-verify-$(date +%s)-$RANDOM"
cleanup() {
  "${KUBECTL[@]}" delete pod "$POD" --ignore-not-found --wait=false > /dev/null 2>&1 || true
}
trap cleanup EXIT

"${KUBECTL[@]}" get runtimeclass gvisor > /dev/null 2>&1 ||
  die "RuntimeClass 'gvisor' not found; apply builder/gvisor/runtimeclass.yaml first"

log "creating pod ${POD} (runtimeClassName: gvisor, image ${IMAGE}) in namespace ${NAMESPACE}"
"${KUBECTL[@]}" apply -f - > /dev/null << YAML
apiVersion: v1
kind: Pod
metadata:
  name: ${POD}
  labels:
    app.kubernetes.io/name: gvisor-verify
spec:
  runtimeClassName: gvisor
  restartPolicy: Never
  automountServiceAccountToken: false
  containers:
    - name: probe
      image: ${IMAGE}
      command: ["sh", "-c", "echo UNAME: \$(uname -a); echo DMESG-BEGIN; dmesg 2>&1 | head -n 20; echo DMESG-END"]
YAML

log "waiting for the pod to finish (timeout ${TIMEOUT})"
if ! "${KUBECTL[@]}" wait --for=jsonpath='{.status.phase}'=Succeeded "pod/${POD}" --timeout="$TIMEOUT" > /dev/null 2>&1; then
  log "pod did not succeed; status and events:"
  "${KUBECTL[@]}" get pod "$POD" -o wide || true
  "${KUBECTL[@]}" describe pod "$POD" | sed -n '/^Events:/,$p' || true
  "${KUBECTL[@]}" logs "$POD" 2> /dev/null || true
  die "gVisor pod failed to run (is runsc registered in containerd and the RuntimeClass handler 'runsc' correct?)"
fi

OUTPUT="$("${KUBECTL[@]}" logs "$POD")"
printf '%s\n' "$OUTPUT"

shopt -s nocasematch
if [[ "$OUTPUT" == *gvisor* ]] || [[ "$OUTPUT" =~ UNAME:.*[[:space:]]4\.4\.0[[:space:]] ]]; then
  log "PASS: pod ran inside a gVisor sandbox"
else
  die "FAIL: output does not identify gVisor; the pod may have run on runc"
fi
