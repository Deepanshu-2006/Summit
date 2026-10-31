# GHCR for the MVP

**Status:** MVP registry direction; confirm visibility and push authentication with the team.

**Registry:** GitHub Container Registry (`ghcr.io`)
**Cluster:** Test-only Kubernetes hosts

## Why GHCR

GHCR stores OCI images outside the test cluster. For this MVP, that means we do not need to deploy and operate a registry Pod, Service, storage volume, or backup pipeline on the SSH hosts. The cluster and builder need outbound HTTPS access to `ghcr.io`.

GitHub currently documents Container registry image storage and bandwidth as free; see [GitHub Packages billing](https://docs.github.com/en/billing/concepts/product-billing/github-packages). Recheck the account's billing page before relying on that policy.

## Application image names

Resolve the GHCR namespace from the connected source repository's owner:

- Organization-owned repository: use the GitHub organization login.
- Personal repository: use the owner's GitHub username. A GitHub organization is not required.

Use one application package per service. The owner portion is the organization login or personal username resolved above; keep package and tag names lowercase. Tag each built version with the full source commit SHA, then deploy by digest:

```text
ghcr.io/<github-org>/summit-app-<service-id>:sha-<git-commit>
ghcr.io/<github-username>/summit-app-<service-id>:sha-<git-commit>
ghcr.io/<resolved-github-owner>/summit-app-<service-id>@sha256:<digest>
```

The two tag examples represent organization-owned and personal repositories. `<service-id>` is the stable platform service ID; `<git-commit>` is the full source commit SHA. Store the resolved owner, package name, and pushed digest with the build result so deployment does not depend on a mutable tag or a later repository-owner change.

The builder image is a separate, platform-owned package, for example `ghcr.io/<platform-owner>/summit-builder:<version>`. Its namespace comes from the Summit team's publishing account, not the customer's source repository. Keep builder and customer application images private by default. Do not put tenant IDs or other customer information in package names or tags.

### Per-owner package permissions

Because application images are published under each source repository owner's namespace, Summit's trusted publisher needs package write access for that owner, and Kubernetes needs package read access to pull the private image. GitHub repository access through the GitHub App does not by itself establish these GHCR package permissions. For personal projects, the user must authorize publishing and pulling from their personal GHCR namespace. Plan a per-owner credential grant and store its secret value through the approved secret provider; do not put it in the platform database or expose a write credential to customer build code. GHCR's documented non-Actions CLI authentication uses a classic personal access token, so this access flow must be agreed before enabling automated application image publishing.

## Responsibilities

- **Priyanshu:** Builds and publishes the builder image; configures the builder's registry integration after the push-auth contract is agreed.
- **Rudra:** Configures Kubernetes to pull the builder and application images from GHCR, checks test-cluster outbound access, and deploys workloads using immutable digests.
- **Arpit:** Confirms the database can persist the final image reference/digest with build and deployment state; never store registry credentials in database rows.

## Authentication boundaries

- GitHub Actions can publish a package associated with its repository using `GITHUB_TOKEN` with `packages: write`. This is the preferred route for publishing the builder image from CI.
- Private image pulls from Kubernetes need read access. GHCR supports anonymous pulls for public packages. For private packages, provision a Kubernetes `imagePullSecret` using a dedicated read-only credential with `read:packages`.
- GitHub Packages' documented non-Actions authentication uses a **personal access token (classic)**. Keep it out of Git, image layers, Docker build arguments, and application environment variables. See [GHCR authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).
- **Open security decision:** Decide how build output is pushed. Do not expose a `write:packages` credential to customer-controlled build commands. Priyanshu and Rudra must agree on a trusted publishing boundary before enabling application image pushes from build jobs.

## First test-cluster milestone

1. Choose the platform publishing account/organization for the builder package and keep it private. Application image owners are resolved per source repository as described above.
2. Publish Priyanshu's builder image from GitHub Actions using `GITHUB_TOKEN` and repository package permissions.
3. Create a read-only GHCR pull secret in the `summit-builds` namespace and verify Kubernetes can pull the builder image.
4. Confirm how the orchestrator will provide the image reference by digest to a test workload.
5. Agree on the trusted push path for built application images before enabling it.

No registry credentials belong in this repository. Create pull secrets directly in the test cluster through an approved secret-handling path; do not commit their values or rendered Secret manifests.
