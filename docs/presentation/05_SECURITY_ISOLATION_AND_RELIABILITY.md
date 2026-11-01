# Summit: Security Architecture, Isolation & Reliability Engineering

---

## 1. The Multi-Tenant Threat Model

Hosting arbitrary customer code alongside autonomous AI agents creates a complex attack surface. Summit is engineered with a **Zero-Trust, Defense-in-Depth Security Model** designed to mitigate 5 primary threat vectors:

```mermaid
flowchart TD
    subgraph AttackVectors["Identified Multi-Tenant Threat Vectors"]
        T1["Threat 1: Host Kernel Exploitation\nMalicious code attempts container breakout via kernel vulnerabilities"]
        T2["Threat 2: Lateral Network Movement\nUntrusted pods attempt to reach K8s API server, metadata services, or other tenants"]
        T3["Threat 3: Credential & Secret Exfiltration\nAgent tool or untrusted script dumps environment variables or inspects DB"]
        T4["Threat 4: Resource Starvation / DoS\nFork bombs, memory exhaustion, or crypto-mining saturate host nodes"]
        T5["Threat 5: State Corruption & Replay Exploits\nWorker crashes cause double-billing or re-execution of side-effects"]
    end
```

---

## 2. The 5-Layer Defense-in-Depth Architecture

```mermaid
flowchart TD
    subgraph Layer1["Layer 1: Virtualized Kernel Sandboxing (gVisor runsc)"]
        L1["Intercepts 100% of Linux syscalls in user space.\nZero direct access to the host Linux kernel.\nRootless UID 1000 execution."]
    end

    subgraph Layer2["Layer 2: Network Segmentation (Cilium eBPF CNI)"]
        L2["Default-Deny policy per tenant namespace.\nBlock Cloud Metadata (169.254.169.254) and K8s API.\nStrict DNS-based egress allowlists."]
    end

    subgraph Layer3["Layer 3: Zero Secrets in DB (OpenBao + ESO)"]
        L3["Platform DB stores pointer references only.\nExternal Secrets Operator syncs directly to tenant K8s secrets.\nShort-lived 10-minute dynamic tokens."]
    end

    subgraph Layer4["Layer 4: Scoped Credential Broker & Model Gateway"]
        L4["Rivet workers hold ZERO provider API keys.\nPrompts routed through Summit Model Gateway.\nRedacts sensitive output before LLM ingestion."]
    end

    subgraph Layer5["Layer 5: Resource Quotas & Ephemeral Lifecycles"]
        L5["Strict cgroup v2 limits (CPU, Memory, PIDs).\nSandboxes destroyed immediately upon run completion.\nHard 15-minute maximum execution timeout."]
    end

    Layer1 --> Layer2 --> Layer3 --> Layer4 --> Layer5
```

---

## 3. Sandboxing Deep-Dive: Why Google gVisor (`runsc`)?

Traditional container platforms rely on shared Linux namespaces and cgroups (standard Docker / containerd `runc`). In standard containers, any zero-day vulnerability in the host Linux kernel gives an attacker full control over every tenant on the physical server.

Full hardware virtual machines (AWS EC2 / Firecracker) provide strong isolation, but suffer from slow boot times (10–45s) and excessive memory overhead (>128MB per instance).

### Comparative Sandboxing Matrix

| Dimension | Standard Docker (`runc`) | Micro-VMs (Firecracker) | **Summit Sandboxes (`gVisor runsc`)** |
| :--- | :--- | :--- | :--- |
| **Isolation Strength** | Low (Shared host kernel) | High (Hardware virtualization) | **High (Independent user-space kernel `Sentry`)** |
| **Startup Latency** | ~200ms | 5,000ms – 15,000ms | **~400ms (Near-instant)** |
| **Memory Overhead** | ~15MB | 128MB – 256MB | **~25MB** |
| **Host Kernel Attack Surface**| ~400+ Linux Syscalls exposed | Minimal (KVM device) | **Zero host syscalls (Handled by Sentry in Go)** |
| **Kubernetes Compatibility** | Native | Complex (Needs custom daemons) | **Native (`RuntimeClass: gvisor`)** |

In Summit, all builder jobs (`builder/`) and agent code-execution sandboxes (`poc-managed-agents/src/sandbox.ts`) run exclusively under the `gvisor` RuntimeClass.

---

## 4. Secrets Management: Zero Secrets in Platform DB

A foundational principle of Summit is: **Never store secret values in the platform database.**

```mermaid
sequenceDiagram
    participant User as Developer / UI
    participant API as Summit Go API
    participant DB as Postgres Platform DB
    participant Vault as OpenBao Vault
    participant ESO as External Secrets Operator
    participant App as Customer Application Pod

    User->>API: Configure Secret: DATABASE_URL = "postgres://..."
    API->>Vault: Write encrypted secret to OpenBao path: summit/data/projects/{id}/env
    API->>DB: Store immutable reference metadata: path="summit/data/...", version=1
    Note over DB: Postgres stores NO PLAINTEXT or CIPHERTEXT secrets!

    ESO->>Vault: Authenticate via Kubernetes Service Account (AppRole)
    ESO->>Vault: Pull secret values using stored reference path
    ESO->>App: Inject secret directly into Kubernetes Secret (Mounted into Pod)
```

- **OpenBao Vault:** Provides hardware-backed KMS encryption at rest, automatic secret rotation, and audit logs.
- **External Secrets Operator (ESO):** Bridges OpenBao directly to Kubernetes namespace secrets without passing values through the Go API control plane.
- **Agent Sandbox Credential Broker:** Agent tools receive single-purpose, ephemeral credentials (such as temporary Git clone tokens) with a 15-minute TTL, destroyed upon run completion.

---

## 5. Network Security & Cilium eBPF Policies

Every customer deployment and agent sandbox is protected by strict Cilium network policies operating at the eBPF kernel layer:

```yaml
apiVersion: "cilium.io/v2"
kind: CiliumNetworkPolicy
metadata:
  name: "tenant-default-deny-and-protect"
  namespace: "tenant-acme-prod"
spec:
  endpointSelector:
    matchLabels: {}
  ingress:
    # Allow incoming traffic ONLY from Traefik Ingress Gateway
    - fromEndpoints:
        - matchLabels:
            app.kubernetes.io/name: "traefik"
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
  egress:
    # Deny all internal Kubernetes API and Cloud Metadata access
    - toCIDR:
        - "0.0.0.0/0"
      exceptCIDRs:
        - "169.254.169.254/32" # Block AWS/GCP Instance Metadata Service
        - "10.96.0.1/32"       # Block Kubernetes Core API Server
    # Allow DNS resolution only via CoreDNS
    - toEndpoints:
        - matchLabels:
            k8s-app: "kube-dns"
      toPorts:
        - ports:
            - port: "53"
              protocol: UDP
```

---

## 6. Distributed Reliability & Crash Recovery

Summit achieves high availability and fault tolerance through four interlocking architectural mechanisms:

```
+---------------------------------------------------------------------------------------------------+
|                                  SUMMIT RELIABILITY ARCHITECTURE                                  |
+--------------------------+------------------------------------------------------------------------+
| Mechanism                | Invariant & Failure Protection                                         |
+--------------------------+------------------------------------------------------------------------+
| **1. Transactional**     | Platform mutations and outbox event emissions occur inside a single    |
|    **Outbox Engine**     | ACID transaction. Network failures can never drop an event.            |
+--------------------------+------------------------------------------------------------------------+
| **2. Advisory-Locked**   | Node reboots or concurrent horizontal scaling instances cannot cause   |
|    **Workers**           | double-processing. Workers claim batches with `FOR UPDATE SKIP LOCKED`.|
+--------------------------+------------------------------------------------------------------------+
| **3. Pi Durable SQLite** | Agent conversational state is persisted to disk using SQLite Write-    |
|    **WAL Journaling**    | Ahead Logging (WAL). Reopening the database file instantly recovers    |
|                          | full execution context after ungraceful worker termination.           |
+--------------------------+------------------------------------------------------------------------+
| **4. Rivet Actor**       | Rivet ensures at most one worker process writes to an actor ID at any  |
|    **Single-Writer**     | time, preventing split-brain state corruption in multi-worker pools.   |
+--------------------------+------------------------------------------------------------------------+
```
