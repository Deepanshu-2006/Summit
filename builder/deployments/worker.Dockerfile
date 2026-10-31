# syntax=docker/dockerfile:1
#
# Summit builder worker image.
#
#   docker build -f builder/deployments/worker.Dockerfile builder -t summit-builder:dev
#
# Runtime base is the official rootless BuildKit image (Alpine; ships buildkitd, buildctl,
# rootlesskit and the unprivileged user `user`, UID/GID 1000). On top of it:
#   - git + ca-certificates          (source checkout over HTTPS)
#   - railpack CLI                   (plan generation; version-aligned with the frontend image
#                                     used by internal/buildkit: ghcr.io/railwayapp/railpack-frontend)
#   - worker                         (this module's cmd/worker, the entrypoint)
#
# Everything runs as UID 1000 and this file adds no setuid binaries. The base image's
# newuidmap/newgidmap use file capabilities, so the pod must keep SETUID/SETGID and allow
# privilege escalation (drop ALL + add SETUID,SETGID + allowPrivilegeEscalation: true), run under
# `runtimeClassName: gvisor`; see builder/docs/kubernetes-job-spec.md and builder/gvisor/README.md.

ARG GO_VERSION=1.26
# Pin both the tag and the index digest (digest observed for v0.34.1-rootless on 2026-11-01).
ARG BUILDKIT_IMAGE=moby/buildkit:v0.34.1-rootless@sha256:f68752a5a94acfcdad2d07867b7075601a421638e17fc5f28efc1c814d0c4f89
ARG BUILDKIT_VERSION=v0.34.1
ARG RAILPACK_VERSION=v0.43.0

# ---------------------------------------------------------------------------
# Stage 1: build the worker (static binary)
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION}-alpine AS worker-build
ARG TARGETOS=linux
ARG TARGETARCH
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} \
    go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker

# ---------------------------------------------------------------------------
# Stage 2: fetch and checksum-verify the railpack CLI (static musl binary)
# Release assets: railpack-<version>-<arch>-unknown-linux-musl.tar.gz + checksums.txt
# ---------------------------------------------------------------------------
FROM --platform=$BUILDPLATFORM alpine:3.23 AS railpack-fetch
ARG RAILPACK_VERSION
ARG TARGETARCH
RUN apk add --no-cache ca-certificates curl
WORKDIR /dl
RUN set -eu; \
    case "${TARGETARCH}" in \
      amd64) arch=x86_64 ;; \
      arm64) arch=arm64 ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    asset="railpack-${RAILPACK_VERSION}-${arch}-unknown-linux-musl.tar.gz"; \
    base="https://github.com/railwayapp/railpack/releases/download/${RAILPACK_VERSION}"; \
    curl -fsSL --retry 3 -o "${asset}" "${base}/${asset}"; \
    curl -fsSL --retry 3 -o checksums.txt "${base}/checksums.txt"; \
    awk -v f="${asset}" '$2 == f { print }' checksums.txt > expected.sha256; \
    test -s expected.sha256 || { echo "no checksum published for ${asset}" >&2; exit 1; }; \
    sha256sum -c expected.sha256; \
    tar -xzf "${asset}" railpack; \
    install -m 0755 railpack /railpack

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM ${BUILDKIT_IMAGE}
ARG BUILDKIT_VERSION
ARG RAILPACK_VERSION

USER root
RUN apk add --no-cache git ca-certificates \
    && mkdir -p /workspace /run/user/1000 /etc/buildkit \
    && chown 1000:1000 /workspace /run/user/1000

COPY --from=worker-build  /out/worker /usr/local/bin/worker
COPY --from=railpack-fetch /railpack   /usr/local/bin/railpack
COPY deployments/buildkitd.toml /etc/buildkit/buildkitd.toml

USER 1000:1000
WORKDIR /workspace

# The upstream image's own ENTRYPOINT is `rootlesskit buildkitd`; the worker owns the daemon
# lifecycle instead, starting it the same way and talking to it on XDG_RUNTIME_DIR.
#
# BUILDKITD_FLAGS is read by the worker and appended to the buildkitd command line. It is
# empty by default. If the sandbox cannot create a PID namespace for build steps (seen with
# some seccomp/AppArmor/gVisor configurations), set
#   BUILDKITD_FLAGS=--oci-worker-no-process-sandbox
# on the pod; see builder/gvisor/README.md for the trade-off.
ENV SUMMIT_WORKSPACE_BASE_DIR=/workspace \
    SUMMIT_BUILDKITD_BIN="rootlesskit buildkitd" \
    SUMMIT_BUILDKIT_SOCKET=/run/user/1000/buildkit/buildkitd.sock \
    SUMMIT_BUILDKITD_CONFIG=/etc/buildkit/buildkitd.toml \
    SUMMIT_RAILPACK_VERSION=${RAILPACK_VERSION} \
    SUMMIT_BUILDKIT_VERSION=${BUILDKIT_VERSION} \
    BUILDKIT_ROOTLESS=true

ENTRYPOINT ["/usr/local/bin/worker"]
