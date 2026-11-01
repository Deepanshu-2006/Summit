// Package catalog holds the pinned official images for managed addons.
// The orchestrator uses AddonFor to choose the image, port, and connection
// environment variable for a postgres or redis service. Digests are the
// multi-arch index (OCI image index) so every architecture resolves to the
// same pin.
//
// Refresh (anonymous Docker Hub; take Docker-Content-Digest):
//
//	docker buildx imagetools inspect docker.io/library/postgres:16-alpine
//	docker buildx imagetools inspect docker.io/library/redis:7-alpine
//
// Last resolved: 2026-11-01.
package catalog
