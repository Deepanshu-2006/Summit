#!/usr/bin/env bash
# Publish host loopback ports to the kind node's NodePorts.
#
# kind-summit-local was created without extraPortMappings, and the cluster must
# not be recreated. These containers sit on the kind docker network and forward:
#   127.0.0.1:80   and [::1]:80   -> summit-local-control-plane:30080  (Traefik web)
#   127.0.0.1:443  and [::1]:443  -> summit-local-control-plane:30443  (Traefik websecure)
#   127.0.0.1:4000 and [::1]:4000 -> summit-local-control-plane:30400  (summit-api)
#
# localtest.me has both A 127.0.0.1 and AAAA ::1. IPv6 publish is attempted and
# skipped, with a warning, when the docker daemon cannot bind ::1.
#
# Usage:
#   deploy/local/ports.sh        # install or keep the forwarders
#   deploy/local/ports.sh down   # remove only these forwarders
set -euo pipefail

SOCAT_IMAGE="alpine/socat:1.8.0.0@sha256:a6be4c0262b339c53ddad723cdd178a1a13271e1137c65e27f90a08c16de02b8"
NETWORK="${KIND_NETWORK:-kind}"
TARGET="${KIND_NODE:-summit-local-control-plane}"

NAMES=(summit-local-fwd-web summit-local-fwd-websecure summit-local-fwd-api)
HOST_PORTS=(80 443 4000)
NODE_PORTS=(30080 30443 30400)

if [[ "${1:-up}" == "down" ]]; then
  docker rm -f "${NAMES[@]}" >/dev/null 2>&1 || true
  echo "removed forwarders: ${NAMES[*]}"
  exit 0
fi

if [[ "${1:-up}" != "up" ]]; then
  echo "usage: $0 [up|down]" >&2
  exit 2
fi

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "docker network ${NETWORK} not found" >&2
  exit 1
fi

port_listeners() {
  local port="$1"
  if ss -H -tulpn "sport = :${port}" 2>/dev/null; then
    return 0
  fi
  ss -tulpn 2>/dev/null | rg ":${port}\\b" || true
}

kind_publishes_host_port() {
  local port="$1"
  docker port "$TARGET" 2>/dev/null | rg -q -e "-> (127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::\\]|\\[::1\\]):${port}$"
}

forwarder_current() {
  local name="$1"
  local host_port="$2"
  local running image network bindings
  running="$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null || echo false)"
  [[ "$running" == "true" ]] || return 1
  image="$(docker inspect -f '{{.Config.Image}}' "$name")"
  [[ "$image" == "$SOCAT_IMAGE" ]] || return 1
  network="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$name")"
  [[ "$network" == *"${NETWORK}"* ]] || return 1
  bindings="$(docker inspect -f '{{json .HostConfig.PortBindings}}' "$name")"
  [[ "$bindings" == *"127.0.0.1"* && "$bindings" == *"\"${host_port}/tcp\""* ]] || return 1
  return 0
}

IPV6_OK=1

ensure_one() {
  local name="$1"
  local host_port="$2"
  local node_port="$3"

  if forwarder_current "$name" "$host_port"; then
    echo "${name} already running"
    return 0
  fi

  if docker inspect "$name" >/dev/null 2>&1; then
    docker rm -f "$name" >/dev/null
  fi

  if kind_publishes_host_port "$host_port"; then
    echo "${TARGET} already publishes host port ${host_port}; not starting ${name}"
    return 0
  fi

  local listeners
  listeners="$(port_listeners "$host_port" || true)"
  if [[ -n "${listeners}" ]]; then
    echo "host port ${host_port} is in use by another process; not killing it" >&2
    echo "${listeners}" >&2
    exit 1
  fi

  local -a publish=(-p "127.0.0.1:${host_port}:${host_port}")
  if [[ "$IPV6_OK" == "1" ]]; then
    publish+=(-p "[::1]:${host_port}:${host_port}")
  fi

  if ! docker run -d \
      --name "$name" \
      --network "$NETWORK" \
      --restart unless-stopped \
      "${publish[@]}" \
      "$SOCAT_IMAGE" \
      "TCP-LISTEN:${host_port},fork,reuseaddr" "TCP:${TARGET}:${node_port}" >/dev/null; then
    if [[ "$IPV6_OK" == "1" ]]; then
      echo "docker could not publish [::1]:${host_port}; retrying IPv4 only" >&2
      docker rm -f "$name" >/dev/null 2>&1 || true
      IPV6_OK=0
      docker run -d \
        --name "$name" \
        --network "$NETWORK" \
        --restart unless-stopped \
        -p "127.0.0.1:${host_port}:${host_port}" \
        "$SOCAT_IMAGE" \
        "TCP-LISTEN:${host_port},fork,reuseaddr" "TCP:${TARGET}:${node_port}" >/dev/null
    else
      echo "failed to start ${name}" >&2
      exit 1
    fi
  fi
  echo "started ${name}: loopback:${host_port} -> ${TARGET}:${node_port}"
}

for i in "${!NAMES[@]}"; do
  ensure_one "${NAMES[$i]}" "${HOST_PORTS[$i]}" "${NODE_PORTS[$i]}"
done
