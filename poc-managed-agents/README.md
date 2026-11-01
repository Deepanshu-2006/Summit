# Managed Agents Gate 1 PoC

This package tests the Pi Durable and Rivet Actor behaviors that Summit needs before committing to the managed-agent data model. It includes a typed Rivet actor adapter backing Pi Durable on Rivet's actor-scoped embedded SQLite database (`c.db`), and tests run against both Pi Durable's standalone Node SQLite harness and RivetKit's real local Rivet Engine runtime.

## Scope

- **One Rivet Actor per Summit session:** Following verification that pinned Pi Durable 1.4.0 lacks a supported conversation deletion API, the PoC adopts the ADR 0001 fallback of one Rivet Actor per session.
- **Versioned actor key tuple:** Every session actor is keyed by `["summit-agent-v1", projectId, deploymentId, sessionId]`.
- **Actor-scoped database integration (`c.db`):** The actor configures `db: db(...)` using RivetKit's native SQLite provider. Pi Durable 1.4.0's `SqliteStorage.open(db)` connects to `c.db` via a typed adapter implementing `@earendil-works/chord/sqlite`'s `SqliteDatabase` interface (`exec`, `run`, `get`, `all`, `transaction`, `close`).
- **Strict transaction boundaries:** Transaction execution uses the transaction callback handle only, preventing statement interleaving.
- **Lifecycle and storage ownership:** The adapter's `close()` releases Pi Durable storage resources without closing the underlying Rivet-owned `c.db`. Rivet natively owns and purges the actor-scoped database when the actor is destroyed via `c.destroy()`. No manual file cleanup, raw SQL DELETEs, or shared filesystem paths are used in the actor runtime.
- **Reconciled standalone utilities:** `actorStoragePath` and `purgeActorStorage` in `harness.ts` are reconciled for Gate 1 — no longer used by the actor runtime, but preserved for standalone Node SQLite reopening test fixtures. `PI_STORAGE_DIR` is no longer required for actor runtime operation.
- **One Pi root conversation per actor:** Each session actor owns exactly one Pi Durable root conversation.
- **Deterministic faux model:** Avoids external credentials and provider calls while executing the real Pi Durable runtime loop.
- **Per-actor serialization:** An in-memory promise chain (`inActorOrder`) serializes submissions locally within a session actor.
- **Transcript reads:** The PoC serializes transcript reads behind actor submissions; it does not provide token streaming or read-while-running behavior.
- **Authoritative deployment queue:** Go's durable outbox and PostgreSQL-assigned `deployment_queue_seq` remain strictly authoritative for deployment-wide admission and FIFO ordering across session actors.
- **Request hashes:** The PoC helper hashes `[sessionId, prompt]` for actor-level deduplication only. It does not replace the full Go request hash over deployment, revision, session, attachments, and execution options.
- **Supported destruction, sleep, and recovery lifecycle:** Session destruction uses public Rivet APIs (`c.destroy()`), which invokes Rivet's `onDestroy` lifecycle hook to close the Pi harness before Rivet destroys the actor's database; tests verify that destroyed actors return `actor: not_found` while surviving session actors remain intact. Similarly, session actor sleep uses public Rivet APIs (`c.sleep()`), invoking `onSleep` to gracefully close the Pi harness while preserving `c.db`. Subsequent retrieval via `client.managedAgent.get(key)` wakes the actor, re-opens the harness in `createVars` over `c.db`, and recovers the full Pi conversation history and request idempotency state.
- **Sandbox seam:** `SandboxAdapter` is a seam only. `DisabledSandboxAdapter` denies execution, and the actor registers no code-execution tools.

The Summit control plane remains authoritative. Go must authorize the caller against the project, deployment, and session before invoking any actor action. Actor keys are generated from project, deployment, and session identifiers to scope runtime state, but they are not an authorization boundary. Pi Durable's `ownership: { kind: "ownerless" }` is only its task-tree ownership setting; it does not represent Summit user or project ownership. This package does not implement Summit APIs, migrations, outbox delivery, billing, credential brokering, event projection, gVisor, or tenant authorization. Actor keys and session IDs in tests are synthetic.

## Candidate storage topology

Current Rivet 3.0 preview documentation describes a candidate control-plane and storage topology:
- A cluster consists of three or more identical control-plane instances, each backed by its own dedicated non-shared block disk.
- Writes are replicated across a quorum of control-plane disks before acknowledgement, with background synchronization to a shared S3-compatible object bucket.
- Actor nodes connect to the control plane and execute actor processes separately.

This topology is a candidate architecture for Summit's pinned `rivetkit@3.0.0-preview.2`, not verified behavior in this repository. Actor database ownership is held by Rivet, but actual cross-node durability, failover, backup/restore, and node-loss recovery remain unproven until tested on a physical or virtual cluster.

## Requirements and commands

Use Node.js 22.19 or later and the repo-pinned pnpm package manager.

```sh
pnpm install --filter @summit/managed-agents-poc... --libc musl,glibc
pnpm --filter @summit/managed-agents-poc check
pnpm --filter @summit/managed-agents-poc test
```

On Linux x64, `--libc musl,glibc` installs RivetKit's pinned static musl Engine package alongside glibc dependencies. The Engine test uses this package to start a local Rivet runtime. Run pnpm with network access so it can verify the repository-pinned pnpm version and resolve any missing packages.

Run the package's `server` command only where the matching Rivet Engine binary is installed or `RIVET_ENGINE_BINARY_PATH` points to it. The `client` command expects an authenticated `RIVET_ENDPOINT`; it is a local smoke client and is not the Summit public API.

## Verified results

The tests use the pinned `@earendil-works/pi-durable` 1.4.0, `@earendil-works/chord` 1.4.0, `@earendil-works/pi-ai` 1.4.0, and `rivetkit` 3.0.0-preview.2 packages:

1. **Pi Durable Storage conformance (25/25 cases):** The complete Pi Durable Storage conformance test suite executes and passes directly against Rivet's actor-scoped `c.db` via the typed adapter.
2. **Transaction isolation and rollback:** The typed wrapper executes statements through transaction callback handles only, rolls back state cleanly on error, and confirms `close()` releases Pi storage while preserving Rivet-owned `c.db`.
3. **Session actor isolation:** Two session actors in the same deployment run with independent actor-scoped `c.db` instances, executing concurrent submissions and maintaining isolated transcripts.
4. **Idempotency and conflict detection:** Resubmitting an identical `requestId` returns the cached submission idempotently, while reusing a request ID with a different prompt or session is rejected.
5. **Session destruction lifecycle:** Calling `target.destroy()` invokes `c.destroy()`, closes the Pi harness via `onDestroy`, and Rivet destroys the actor's database. Subsequent queries on the target actor fail with `actor: not_found`, while surviving session actors remain fully functional with intact transcripts.
6. **Standalone Node SQLite reopen:** Standalone tests verify that closing and reopening a Pi Durable Harness over local SQLite recovers conversation history and ordering.
7. **Deterministic key derivation:** Actor keys derive a deterministic 4-element tuple `["summit-agent-v1", projectId, deploymentId, sessionId]`.
8. **Actor sleep and recovery lifecycle over `c.db`:** Calling `agent.sleep()` invokes public `c.sleep()`, triggering Rivet's `onSleep` callback, gracefully closing the Pi Harness, releasing Pi storage resources, and unloading in-memory actor variables. Subsequent retrieval via `client.managedAgent.get(key)` wakes the actor, re-invokes `createVars` to re-open the Pi Harness over `c.db`, recovers the full previously acknowledged transcript, preserves request idempotency and conflict detection, and successfully appends follow-up runs to the durable transcript.

`pnpm --filter @summit/managed-agents-poc check` and `pnpm --filter @summit/managed-agents-poc test` are the repeatable checks.

## Runtime and recovery limits

The pinned platform package `@rivetkit/engine-cli-linux-x64-musl@3.0.0-preview.2` contains a statically linked `rivet-engine` binary running on Linux x64 hosts.

Observed test runtime behavior and exact limitations:
- **Engine restart testability boundary in pinned test harness:** In pinned `rivetkit@3.0.0-preview.2`, the native runtime N-API binding (`rivetkit-napi`) is a process-level singleton. Calling `registry.shutdown()` terminates the local engine child process and transitions the native module into an unrecoverable `shut_down` state. Attempting to start a second registry instance in the same Node process fails at readiness check (`503 status: shut_down`) and triggers `process.exit(1)`. Recreating or restarting the local engine process within a single test runner process is therefore unsupported by the pinned test harness without process re-forking. The closest genuine actual-runtime recovery check supported by the public Rivet actor API and local engine is actor sleep & wake lifecycle (`c.sleep()`), which exercises the complete unload, harness release, storage preservation, wake, harness re-instantiation, transcript recovery, and follow-up run execution loop over actual actor-scoped `c.db`.
- **Actor-scoped DB ownership:** Actor databases are owned and removed by Rivet upon actor destruction.
- **Local single-process Engine scope:** Local Engine integration tests run against a single local Engine process. Multi-worker scheduling, cross-node actor migration, quorum disk replication, and machine-loss recovery are **unproven** in this environment and require a real multi-node cluster test.
- **No production RPO/RTO claims:** Neither automatic worker failover nor production RPO/RTO metrics can be asserted without physical crash/network partition testing on a deployed cluster.
- **Engine test API access boundary:** Rivet's local Engine test API does not expose `c.db` directly to external client handles; testing storage conformance requires actor actions running inside the actor context. Running multiple conformance cases within a single actor instance uses isolated table prefixes because the actor-scoped SQLite database avoids raw SQL table drops.
- **Engine serialization warning:** During actor destruction, the pinned local Rivet engine CLI emits an internal log: `level=error message="serializeState callback returned error" error="Actor stopping: ... Caused by: stopping: Actor stopping: ..."`. This occurs because the engine attempts state serialization during shutdown; it does not block destruction or prevent resource release.

## Gate 1 work still required

- Validate multi-worker Rivet cluster behavior, cross-node failover, and worker migration with actual machine failures.
- Verify request hash persistence and reconciliation with Summit Go outbox records across worker restarts.
- Validate model gateway and credential-broker identity propagation.
- Implement a fresh per-attempt gVisor sandbox provisioner and cleanup contract before enabling user-code tools.
- Pin and test forward-only state compatibility for Pi Durable migrations under actor version upgrades.

## Documentation sources

- [Rivet Pi integration](https://rivet.dev/agents/docs/pi/)
- [Rivet Actor SQLite](https://rivet.dev/actors/docs/sqlite/)
- [Pi Durable README and storage behavior](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md)
- [Pi Durable API specification](https://github.com/earendil-works/pi/blob/main/packages/durable/docs/spec.md)
