#!/usr/bin/env bash
# install-runsc.sh - install gVisor (runsc + containerd shim) on a Kubernetes node and
# register the `runsc` runtime handler with containerd.
#
# Owner: Priyanshu (isolated builder). Host-level setup only; the builder image does not
# contain gVisor.
#
# Usage:
#   install-runsc.sh fetch   <dir>                 download + sha512-verify + extract (no root needed)
#   install-runsc.sh install [--source-dir <dir>] [--yes] [--dry-run] [--no-restart]
#
# `install` copies runsc, containerd-shim-runsc-v1 and gvisor-bin/ into $INSTALL_DIR, adds
# the runsc runtime to the containerd config between marker comments (idempotent), writes
# $RUNSC_CONFIG, and restarts containerd. It prints every change before making it and asks
# for confirmation unless --yes is given. Run as root.
#
# Environment:
#   GVISOR_RELEASE        release to install (default: 20261026.0, pinned). "latest" works but is mutable.
#   INSTALL_DIR           where binaries go                 (default /usr/local/bin)
#   CONTAINERD_CONFIG     containerd config file            (default /etc/containerd/config.toml)
#   RUNSC_CONFIG          runsc options file for containerd (default /etc/containerd/runsc.toml)
#   RUNSC_CONFIG_LINES    extra lines for [runsc_config], newline separated (default none)
#
# The tarball layout (runsc, containerd-shim-runsc-v1, gvisor-bin/) and sha512 files follow
# https://gvisor.dev/docs/user_guide/install/ . runsc looks for gvisor-bin/ next to itself,
# so the directory must be installed together with the binary.
set -euo pipefail

GVISOR_RELEASE="${GVISOR_RELEASE:-20261026.0}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
CONTAINERD_CONFIG="${CONTAINERD_CONFIG:-/etc/containerd/config.toml}"
RUNSC_CONFIG="${RUNSC_CONFIG:-/etc/containerd/runsc.toml}"
RUNSC_CONFIG_LINES="${RUNSC_CONFIG_LINES:-}"

BEGIN_MARK="# BEGIN summit-gvisor (managed by builder/gvisor/install-runsc.sh)"
END_MARK="# END summit-gvisor"

log() { printf '[install-runsc] %s\n' "$*"; }
die() { printf '[install-runsc] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo x86_64 ;;
    aarch64 | arm64) echo aarch64 ;;
    *) die "unsupported architecture: $(uname -m)" ;;
  esac
}

# ---------------------------------------------------------------------------
# fetch <dir>
# ---------------------------------------------------------------------------
cmd_fetch() {
  local dest="${1:-}"
  [[ -n "$dest" ]] || die "fetch requires a destination directory"
  mkdir -p "$dest"
  local a url tmp archive ext
  a="$(arch)"
  url="https://storage.googleapis.com/gvisor/releases/release/${GVISOR_RELEASE}/${a}"
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" RETURN

  if command -v bzip2 > /dev/null 2>&1; then
    ext="tar.bz2"
  elif command -v zstd > /dev/null 2>&1; then
    ext="tar.zstd"
  else
    die "need bzip2 or zstd to unpack the gVisor release"
  fi
  archive="gvisor.${ext}"

  log "downloading ${url}/${archive}"
  curl -fsSL --retry 3 -o "${tmp}/${archive}" "${url}/${archive}"
  curl -fsSL --retry 3 -o "${tmp}/${archive}.sha512" "${url}/${archive}.sha512"
  log "verifying sha512"
  (cd "$tmp" && sha512sum -c "${archive}.sha512")

  if [[ "$ext" == "tar.bz2" ]]; then
    tar -xjf "${tmp}/${archive}" -C "$dest"
  else
    tar --zstd -xf "${tmp}/${archive}" -C "$dest"
  fi
  [[ -x "${dest}/runsc" && -x "${dest}/containerd-shim-runsc-v1" ]] ||
    die "release ${GVISOR_RELEASE} did not contain runsc and containerd-shim-runsc-v1"
  log "extracted to ${dest}: $("${dest}/runsc" --version | head -1)"
}

# ---------------------------------------------------------------------------
# install
# ---------------------------------------------------------------------------
containerd_config_version() {
  local line v=""
  while IFS= read -r line; do
    if [[ "$line" =~ ^[[:space:]]*version[[:space:]]*=[[:space:]]*([0-9]+) ]]; then
      v="${BASH_REMATCH[1]}"
      break
    fi
  done < "$CONTAINERD_CONFIG"
  echo "${v:-1}"
}

# The CRI plugin was renamed in config version 3 (containerd 2.x defaults). A containerd 2.x
# binary still reads `version = 2` files with the legacy plugin name, so key off the file.
runtime_table() {
  case "$(containerd_config_version)" in
    3) echo 'plugins."io.containerd.cri.v1.runtime".containerd.runtimes.runsc' ;;
    2) echo 'plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc' ;;
    *) echo 'plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runsc' ;;
  esac
}

render_block() {
  local table="$1"
  printf '%s\n' "$BEGIN_MARK"
  printf '[%s]\n' "$table"
  printf '  runtime_type = "io.containerd.runsc.v1"\n'
  printf '[%s.options]\n' "$table"
  printf '  TypeUrl = "io.containerd.runsc.v1.options"\n'
  printf '  ConfigPath = "%s"\n' "$RUNSC_CONFIG"
  printf '%s\n' "$END_MARK"
}

render_runsc_config() {
  printf '[runsc_config]\n'
  if [[ -n "$RUNSC_CONFIG_LINES" ]]; then
    printf '%s\n' "$RUNSC_CONFIG_LINES"
  fi
}

# Print the config file with any previously managed block removed.
strip_block() {
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" '
    $0 == b { skip = 1; next }
    $0 == e { skip = 0; next }
    !skip { print }
  ' "$CONTAINERD_CONFIG"
}

same_file() { [[ -f "$1" && -f "$2" ]] && cmp -s "$1" "$2"; }

cmd_install() {
  local source_dir="" assume_yes=0 dry_run=0 restart=1
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --source-dir) source_dir="${2:-}"; shift 2 ;;
      --yes | -y) assume_yes=1; shift ;;
      --dry-run) dry_run=1; shift ;;
      --no-restart) restart=0; shift ;;
      -h | --help) usage 0 ;;
      *) die "unknown option: $1" ;;
    esac
  done

  [[ -f "$CONTAINERD_CONFIG" ]] || die "containerd config not found: $CONTAINERD_CONFIG"
  if [[ $dry_run -eq 0 ]]; then
    mkdir -p "$INSTALL_DIR" 2> /dev/null || true
    if [[ ! -w "$CONTAINERD_CONFIG" || ! -w "$INSTALL_DIR" ]]; then
      die "need write access to ${CONTAINERD_CONFIG} and ${INSTALL_DIR} (run as root with sudo), or pass --dry-run"
    fi
  fi

  local cleanup_dir=""
  if [[ -z "$source_dir" ]]; then
    cleanup_dir="$(mktemp -d)"
    # shellcheck disable=SC2064
    trap "rm -rf '$cleanup_dir'" EXIT
    cmd_fetch "$cleanup_dir"
    source_dir="$cleanup_dir"
  fi
  [[ -x "${source_dir}/runsc" && -x "${source_dir}/containerd-shim-runsc-v1" ]] ||
    die "${source_dir} must contain runsc and containerd-shim-runsc-v1"

  local table; table="$(runtime_table)"
  local existing_table_unmanaged=0 stripped normalized wanted
  stripped="$(strip_block)"
  # Compare ignoring quote style and spaces: containerd 2.x writes plugins.'x' (single quotes).
  normalized="${stripped//\"/}"; normalized="${normalized//\'/}"; normalized="${normalized// /}"
  wanted="[${table//\"/}]"
  if [[ "$normalized" == *"$wanted"* ]]; then
    existing_table_unmanaged=1
  fi

  # ---- plan -----------------------------------------------------------------
  log "plan (release ${GVISOR_RELEASE}, $(uname -m), containerd config version $(containerd_config_version)):"
  local f
  for f in runsc containerd-shim-runsc-v1; do
    if same_file "${source_dir}/${f}" "${INSTALL_DIR}/${f}"; then
      log "  keep    ${INSTALL_DIR}/${f} (identical)"
    else
      log "  install ${INSTALL_DIR}/${f}"
    fi
  done
  if [[ -d "${source_dir}/gvisor-bin" ]]; then
    log "  sync    ${INSTALL_DIR}/gvisor-bin/ (sidecar binaries runsc executes at runtime)"
  fi
  log "  write   ${RUNSC_CONFIG}"
  if [[ $existing_table_unmanaged -eq 1 ]]; then
    log "  skip    ${CONTAINERD_CONFIG}: [${table}] already defined outside the managed block; left untouched"
  else
    log "  update  ${CONTAINERD_CONFIG}: add [${table}] (managed block, replaced on re-run; backup alongside)"
  fi
  if [[ $restart -eq 1 ]]; then
    log "  restart containerd only if its config changed (running containers keep running)"
  else
    log "  (containerd restart skipped: --no-restart)"
  fi

  if [[ $dry_run -eq 1 ]]; then
    log "dry run: nothing changed"
    return 0
  fi
  if [[ $assume_yes -eq 0 ]]; then
    local answer=""
    read -r -p "[install-runsc] apply these changes? [y/N] " answer || true
    [[ "$answer" == "y" || "$answer" == "Y" ]] || die "aborted"
  fi

  # ---- apply ----------------------------------------------------------------
  mkdir -p "$INSTALL_DIR"
  for f in runsc containerd-shim-runsc-v1; do
    if ! same_file "${source_dir}/${f}" "${INSTALL_DIR}/${f}"; then
      install -m 0755 "${source_dir}/${f}" "${INSTALL_DIR}/${f}.new"
      mv -f "${INSTALL_DIR}/${f}.new" "${INSTALL_DIR}/${f}"
    fi
  done
  if [[ -d "${source_dir}/gvisor-bin" ]]; then
    mkdir -p "${INSTALL_DIR}/gvisor-bin"
    for f in "${source_dir}/gvisor-bin/"*; do
      install -m 0755 "$f" "${INSTALL_DIR}/gvisor-bin/.$(basename "$f").new"
      mv -f "${INSTALL_DIR}/gvisor-bin/.$(basename "$f").new" "${INSTALL_DIR}/gvisor-bin/$(basename "$f")"
    done
  fi

  mkdir -p "$(dirname "$RUNSC_CONFIG")"
  render_runsc_config > "$RUNSC_CONFIG"

  local changed=0
  if [[ $existing_table_unmanaged -eq 0 ]]; then
    local new_cfg; new_cfg="$(mktemp)"
    { printf '%s\n' "$stripped"; echo; render_block "$table"; } > "$new_cfg"
    if ! cmp -s "$new_cfg" "$CONTAINERD_CONFIG"; then
      cp -p "$CONTAINERD_CONFIG" "${CONTAINERD_CONFIG}.summit-gvisor.bak"
      cp "$new_cfg" "$CONTAINERD_CONFIG"
      changed=1
    fi
    rm -f "$new_cfg"
  fi

  "${INSTALL_DIR}/runsc" --version | head -1 | sed 's/^/[install-runsc] installed: /'

  if [[ $restart -eq 1 ]]; then
    if command -v systemctl > /dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
      if [[ $changed -eq 1 ]]; then
        systemctl restart containerd
        log "containerd restarted"
      else
        log "containerd config unchanged; not restarting"
      fi
    else
      log "systemd not detected: restart containerd manually for the config to take effect"
    fi
  fi
  log "done. Next: apply builder/gvisor/runtimeclass.yaml and run builder/gvisor/verify-gvisor.sh"
}

main() {
  local sub="${1:-}"
  [[ -n "$sub" ]] || usage 1
  shift
  case "$sub" in
    fetch) cmd_fetch "$@" ;;
    install) cmd_install "$@" ;;
    -h | --help | help) usage 0 ;;
    *) usage 1 ;;
  esac
}

main "$@"
