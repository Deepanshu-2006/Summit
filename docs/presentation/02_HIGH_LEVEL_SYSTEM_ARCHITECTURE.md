# Summit: High-Level System Architecture & Platform Topology

---

## 1. End-to-End System Architecture

Summit separates concerns across four distinct operational planes:
1. **The Client Plane:** Next.js 16 Console Dashboard, CLI tools, and GitHub App webhooks.
2. **The Control Plane (`apps/backend`):** Go 1.26 API service, Supabase PostgreSQL with Transactional Outbox, and OpenBao secrets vault.
3. **The Infrastructure Data Plane:** Kubernetes orchestrator daemon, Traefik ingress controller, Cilium CNI, and tenant application pods.
4. **The Managed Agent Execution Subsystem (`agent-system`):** TypeScript adapter, Rivet Actor control plane, Pi Durable runtime, and ephemeral gVisor sandboxes.

```mermaid
flowchart TD
    subgraph Clients["Client & Event Ingress"]
        WebUI["Summit Web Console\n(Next.js 16 Dashboard)"]
        GitApp["GitHub App\n(Webhooks & OAuth)"]
        CLI["Summit CLI / SDK"]
    end

    subgraph ControlPlane["Authoritative Control Plane (Go 1.26 + Postgres)"]
        API["Summit API Server (cmd/api)\n• JWT / HMAC Auth & Verification\n• User/Project Ownership Scoping\n• OpenAPI 3.1 REST Contracts"]
        DB[(Platform Database\nSupabase PostgreSQL)]
        Outbox["Transactional Outbox\n(outbox_events Table\nFOR UPDATE SKIP LOCKED)"]
        OpenBao["OpenBao Vault\n(Secret References Only)"]
        
        API -->|"ACID Transaction"| DB
        DB --- Outbox
        API -.->|"Pointers Only"| OpenBao
    end

    subgraph OrchestratorEngine["Orchestrator & Infrastructure Controller (Go)"]
        Orch["Summit Orchestrator Daemon (cmd/orchestrator)\n• Outbox Worker & Lease Manager\n• SummitService CRD Controller\n• Deployment State Monitor\n• Ephemeral Cleanup Pruner"]
        ESO["External Secrets\nOperator (ESO)"]
        Traefik["Traefik Ingress\nController"]
        Cilium["Cilium CNI\n(eBPF Network Policies)"]
    end

    subgraph BuilderPlane["Isolated Build Infrastructure"]
        BuildKit["Ephemeral Builder Pod (gVisor runsc)\n• Rootless BuildKit v0.34.1 (UID 1000)\n• Railpack Language Auto-Detection\n• GitHub Worker Credential Broker"]
        Registry["OCI Registry\n(ghcr.io)"]
        BuildKit -->|"Pushes Digest"| Registry
    end

    subgraph AgentSystem["Managed Agent Runtime Subsystem (agent-system)"]
        Adapter["TypeScript Runtime Adapter\n(Internal Authenticated Bridge)"]
        Rivet["Rivet Engine Control Plane\n(Single-Writer Actor Scheduler)"]
        PiActors["Pi Durable Actors\n(Resumable Task State + SQLite)"]
        Sandboxes["Ephemeral Execution Sandboxes\n(gVisor runsc Isolation)"]

        Adapter --> Rivet
        Rivet --> PiActors
        PiActors -->|"Tool Calls"| Sandboxes
    end

    subgraph TenantWorkloads["Tenant Application Namespaces (tenant-<user>-<project>)"]
        TenantA["Customer Production App Pods"]
        TenantB["Customer Staging App Pods"]
    end

    %% Wiring
    WebUI -->|"HTTPS REST & SSE"| API
    GitApp -->|"Raw HMAC Webhook"| API
    CLI -->|"REST API"| API

    Outbox -->|"Poll & Lease Claim"| Orch
    Orch -->|"Schedules"| BuildKit
    Orch -->|"Reconciles CRDs"| TenantWorkloads
    Orch -->|"Configures"| Traefik
    Orch -->|"Applies Policies"| Cilium
    Orch -->|"Injects Secrets"| ESO

    Outbox -->|"Managed Agent Events"| Adapter
    Adapter -->|"Milestones & Usage"| API
    Registry -->|"Pulls Digest"| TenantWorkloads
```

---

## 2. Structural Isolation Boundaries

Summit enforces three strict, non-negotiable architectural boundaries:

```
+---------------------------------------------------------------------------------------------------+
|                                  SUMMIT 3-TIER ISOLATION BOUNDARY                                 |
+--------------------------+------------------------------------------------------------------------+
| Boundary                 | Invariant & Implementation Mechanism                                   |
+--------------------------+------------------------------------------------------------------------+
| **1. Control Plane vs.** | The Go API and PostgreSQL maintain platform state only. Customer code  |
|    **Customer Code**     | and customer binaries **never execute** in the Go backend, API server, |
|                          | or platform database. Code runs strictly in unprivileged pods.        |
+--------------------------+------------------------------------------------------------------------+
| **2. Rivet Engine vs.**  | Rivet workers execute trusted runtime actors only. Pi Durable coding   |
|    **Agent Sandboxes**   | tools (bash, file writes, code execution) are **physically prevented**  |
|                          | from running in the Rivet worker. They dispatch to gVisor sandboxes.   |
+--------------------------+------------------------------------------------------------------------+
| **3. Zero Secrets in**   | The platform database **never stores secret values** in plaintext or   |
|    **Platform Database** | ciphertext. DB stores only OpenBao/KMS pointers. Secrets are resolved  |
|                          | dynamically by ESO into customer namespaces or by Credential Brokers.  |
+--------------------------+------------------------------------------------------------------------+
```

---

## 3. Core Operational Workflows

### Workflow A: Git Push to Deployment (The PaaS Pipeline)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant GH as GitHub Webhook
    participant API as Go API Server
    participant DB as Postgres (Outbox)
    participant Orch as Go Orchestrator
    participant Build as gVisor Builder Pod
    participant OCI as Container Registry (GHCR)
    participant K8s as Tenant K8s Cluster

    Dev->>GH: git push (refs/heads/main)
    GH->>API: POST /api/v1/integrations/github/webhook (Raw HMAC)
    API->>API: Verify HMAC-SHA256 & match project
    API->>DB: Atomic Commit: deployment row + outbox_events
    API-->>GH: 202 Accepted (Handled in <50ms)
    
    Orch->>DB: Poll outbox_events (FOR UPDATE SKIP LOCKED)
    Orch->>Build: Schedule Build Pod (gVisor runsc, Rootless BuildKit)
    Build->>API: Request short-lived Git clone token
    Build->>Build: Railpack analysis & OCI container compilation
    Build->>OCI: Push image digest (ghcr.io/org/repo:sha)
    Build->>API: POST /api/v1/build-workers/{id}/result (Complete)

    Orch->>K8s: Reconcile SummitService CRD (Deployment, Service, Traefik Ingress)
    K8s->>OCI: Pull image by immutable SHA-256 digest
    K8s->>K8s: Rollout healthy (Readiness probe passed)
    Orch->>DB: Update deployment status = 'succeeded'
    API-->>Dev: Live Dashboard updates via SSE
```

---

### Workflow B: Managed Agent Prompt & Resumable Execution

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer / User
    participant API as Go API Server
    participant Storage as Encrypted Object Store
    participant DB as Postgres (Outbox)
    participant Orch as Go Outbox Worker
    participant Adapter as TypeScript Adapter
    participant Actor as Rivet Actor (Pi Durable)
    participant Broker as Credential Broker
    participant Box as gVisor Sandbox Pod

    Dev->>API: POST /api/v1/agent-sessions/{id}/runs (Prompt: "Fix bug #42")
    API->>API: Authorize user/project & generate request_hash
    API->>Storage: Store encrypted prompt input payload
    API->>DB: Atomic commit: agent_runs (queued) + outbox_events
    API-->>Dev: 202 Accepted (durable run_id returned)

    Orch->>DB: Claim agent.run.submit.requested outbox event
    Orch->>Adapter: Deliver authenticated event payload
    Adapter->>API: Fetch encrypted prompt input over internal TLS
    Adapter->>Actor: Submit run to Rivet Actor ["summit-agent-v1", proj, dep, sess]
    Actor->>Actor: Pi Durable deserializes state & begins reasoning loop

    Actor->>Broker: Request scoped model credentials
    Broker-->>Actor: Return short-lived Model Gateway proxy token
    Actor->>Actor: LLM generates tool call: execute_bash("npm test")

    Actor->>Box: Forward command to isolated gVisor sandbox
    Box->>Box: Execute inside unprivileged virtualized kernel
    Box-->>Actor: Return command stdout/stderr
    Actor->>Actor: Pi records durable step in SQLite journal
    
    Actor->>Adapter: Emit runtime milestone event
    Adapter->>API: Internal callback: POST /events (monotonic sequence)
    API->>DB: Record agent_events projection & update metering
    API-->>Dev: SSE Stream delivers milestone update in real time
```

---

## 4. Kubernetes Namespace & Network Topology

```text
===================================================================================
                       SUMMIT KUBERNETES TOPOLOGY
===================================================================================

[ Namespace: summit-control-plane ]
  ├── api-server (Deployment, 3 replicas, Go 1.26)
  ├── orchestrator-daemon (Deployment, Active/Passive leader election)
  ├── openbao-vault (StatefulSet, HA Raft storage)
  └── external-secrets-operator (Controller)

[ Namespace: agent-system ]
  ├── ts-agent-adapter (Deployment, internal mTLS endpoint)
  ├── rivet-control-plane (Deployment, single-writer actor scheduler)
  ├── rivet-workers (StatefulSet / Deployment, Pi Durable actor execution)
  └── scoped-credential-broker (Deployment, OpenBao capability resolver)

[ Namespace: summit-builders ]  <-- Hardened by Cilium CNI (Default Deny)
  ├── buildkit-job-001 (gVisor runsc, rootless, ephemeral, auto-pruned)
  └── buildkit-job-002 (gVisor runsc, rootless, ephemeral, auto-pruned)

[ Namespace: agent-sandboxes ]  <-- Hardened by Cilium CNI (Strict Egress Allowlist)
  ├── sandbox-run-attempt-101 (gVisor runsc, ephemeral micro-VM)
  └── sandbox-run-attempt-102 (gVisor runsc, ephemeral micro-VM)

[ Namespace: tenant-<user_slug>-<project_slug> ]
  ├── summit-service-api (Deployment, customer application)
  ├── summit-service-frontend (Deployment, customer web client)
  └── traefik-ingress-routes (CRD, SSL/TLS terminated at edge)
===================================================================================
```
