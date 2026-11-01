// Package registry resolves public OCI image references to an immutable
// repo@sha256 digest via the distribution API. It speaks anonymous bearer
// auth (Docker Hub and ghcr.io). Private registries return a clear error.
package registry
