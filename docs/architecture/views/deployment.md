# V-06 — Deployment and operations

**Governing viewpoint:** VP-06 · **Model kinds:** MK-07, MK-08 · **Concerns:** C-06, C-10.

**Identity/version:** V-06 v1.2; ACE-AD-001 v1.2; 2026-11-25. **Perspectives:** SP-02, SP-03, SP-04. **Aspects:** AS-06, AS-04. **Scope:** the entity portion described below, within the [AD boundary](../architecture-description.md).

## Deployment topology and constraints

~~~mermaid
flowchart TD
    Agent["Hermes host / task container"] --> B["Bifröst HTTP runtime + Go plugin"]
    subgraph Local["Required colocation / shared network namespace"]
        B <-->|"loopback authenticated RPC"| A["ACE Node.js / Effect process"]
        A --> CBM["CBM stdio frontend / native daemon"]
    end
    A --> S["Workspace + local archive"]
    A -->|"authorized only"| V["Vertex"]
    B -->|"approved model route"| P["ChatGPT provider"]
~~~

The diagram is a placement constraint and development topology, not a certified Kubernetes installation. The current internal RPC listens on loopback by default; a future colocated Bifröst/ACE deployment must satisfy that constraint rather than exposing ACE on an external address.

| Component / concern | Current support | Operational verification still required |
| --- | --- | --- |
| ACE artifact | Clean source build and runtime provenance; Docker packaging | Exact release build/image/signature evidence and deployed runtime identity |
| Local providers | Native-only runtime and container; separate vector manifests retired; LSP retained separately | Absolute scale, daemon/cache ownership, lifecycle and host-helper topology |
| Kubernetes | Local dependency manifests, host-worktree design | Accepted ACE/Bifröst deployment, network/resource constraints and real workload lifecycle |
| Crash/recovery | Archive and index publication/reconciliation mechanisms; documented runbooks | Cross-process and real-provider restart/outage evidence for applicable release |
| Observability | Typed status, diagnostics and evidence records | Actual incident/latency/resource observations, not inferred operational SLOs |

## Supporting sources and evaluation references

[Local provider infrastructure](../../../infra/k8s/ace-local/README.md), [Dockerfile](../../../Dockerfile.ace), [runtime configuration](../../operations/ace-configuration-and-readiness-matrix.md), [Hermes E2E recovery runbook](../../operations/2026-11-21-hermes-e2e-repair-runbook.md), [archive backup/restore](../../operations/local-memory-backup-restore.md), [supply-chain release evidence](../../operations/supply-chain-release-evidence.md), [ADR-008](../../references/ADR-008-local-kubernetes.md).

The release owner must verify the real deployment and recovery scope; local manifests or a green build alone are insufficient. CR-04, CR-05 and CR-08 apply.

## Identified view components

| Component / version | Contents in this view | Governing model kind |
| --- | --- | --- |
| VC-06A v1.2 | Deployment topology | MK-07 |
| VC-06B v1.2 | Operational verification matrix | MK-08 |

The [versioned catalog](../viewpoints.md) supplies the conventions, construction/analysis methods and interpretation legends. Linked historical source documents are supporting material, not automatically current components. Correspondence methods: CR-04, CR-05, CR-08.

## Known issues

Full production Kubernetes and provider recovery proof remain open. See the [correspondence results and inconsistency register](../correspondences.md). No additional deviation from the governing notation conventions is identified in this documentation review.
