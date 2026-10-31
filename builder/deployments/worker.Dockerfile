# Multi-stage Dockerfile for Summit Standalone Builder Worker
# Pinned tool versions:
# - Go 1.23
# - BuildKit v0.19.0
# - Railpack v0.3.2
# - Rootless unprivileged execution (UID 1000)

FROM golang:1.23-bookworm AS builder

WORKDIR /build
COPY go.mod go.sum* ./
COPY internal/ ./internal/
COPY cmd/ ./cmd/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-w -s" -o /build/worker ./cmd/worker

FROM debian:12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    curl \
    fuse-overlayfs \
    uidmap \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged runner user (UID 1000)
RUN useradd -u 1000 -m -s /bin/bash summit && \
    mkdir -p /workspace /run/buildkit /run/secrets && \
    chown -R summit:summit /workspace /run/buildkit /run/secrets

COPY --from=builder /build/worker /usr/local/bin/worker
COPY deployments/buildkitd.toml /etc/buildkit/buildkitd.toml

USER summit
WORKDIR /workspace

ENV SUMMIT_WORKSPACE_BASE_DIR=/workspace
ENV BUILDKIT_ROOTLESS=true

ENTRYPOINT ["/usr/local/bin/worker"]
