// Package githubwebhook implements self-contained GitHub webhook security verification,
// header parsing, payload size bounding, and event normalization for the Summit PaaS control plane.
//
// All operations rely solely on the Go standard library (crypto/hmac, crypto/sha256, crypto/subtle,
// encoding/hex, encoding/json, and net/http).
//
// Key components:
//   - ParseHeaders: validates required webhook headers (X-Hub-Signature-256, X-GitHub-Delivery, X-GitHub-Event).
//   - VerifySignature: executes HMAC-SHA256 signature verification over exact raw bytes using constant-time comparison.
//   - ReadBody: strictly bounds body reads (default 5 MiB) to guard against resource exhaustion.
//   - Normalize: transforms raw payloads into typed, normalized Event models for push, installation, and installation_repositories.
//   - MinimalPayload: outputs compact JSON containing only the essential IDs and metadata for persistence and queueing.
package githubwebhook
