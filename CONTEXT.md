# Summit Platform Context

This glossary defines the resource and ownership terms used by the managed-agent specification. Summit's account model here is user ownership: a user owns projects, and agent resources are scoped through those projects. It does not introduce organization ownership.

## Platform resources

**User**:
A Summit account that owns projects and the platform resources beneath them.

**Project**:
A user-owned application boundary containing environments, services, and managed agents.
_Avoid_: Workspace

**Agent definition**:
A user-owned, project-scoped configuration with a stable ID and an immutable revision history.
_Avoid_: Agent instance, agent deployment

**Agent revision**:
An immutable version of an agent definition's configuration that deployments and runs pin for reproducibility.
_Avoid_: Agent config update

**Agent deployment**:
One environment-specific activation of an agent definition, pinned to an immutable revision and managing independent session-scoped Rivet Actors.
_Avoid_: Agent instance, runtime

**Agent session**:
An independent conversation within an agent deployment, mapped to one Rivet Actor and one Pi Durable root conversation. V1 queues session runs in deployment order and does not execute two runs concurrently in one deployment.
_Avoid_: Run, deployment

**Agent run**:
A single accepted prompt or task execution submitted within an agent session.
_Avoid_: Session, job (unless referring to the outbox job)

**Rivet Actor**:
The Rivet runtime process/address assigned to one managed-agent session. It is not a Summit authorization identity; Go authorizes every request.
_Avoid_: Agent deployment
