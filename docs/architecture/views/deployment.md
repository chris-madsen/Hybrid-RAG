# V-06 — Deployment and operations

**Governing viewpoint:** VP-06 · **Model kinds:** MK-07, MK-08 · **Concerns:** C-06, C-10.

## Deployment topology and constraints

~~~mermaid
flowchart TD
    Agent["Hermes host / task container"] --> B["Bifröst HTTP runtime + Go plugin"]
    subgraph Local["Required colocation / shared network namespace"]
        B <-->|"loopback authenticated RPC"| A["ACE Node.js / Effect process"]
        A --> CBM["Persistent CBM stdio child"]
        A --> W["Embedding / LSP workers"]
    end
    A --> Q["Local Qdrant"]
    A --> S["Workspace + local archive"]
    A -->|"authorized only"| V["Vertex"]
    B -->|"approved model route"| P["ChatGPT provider"]
~~~

The diagram is a placement constraint and development topology, not a certified Kubernetes installation. The current internal RPC listens on loopback by default; a future colocated Bifröst/ACE deployment must satisfy that constraint rather than exposing ACE on an external address.

| Component / concern | Current support | Operational verification still required |
| --- | --- | --- |
| ACE artifact | Clean source build and runtime provenance; Docker packaging | Exact release build/image/signature evidence and deployed runtime identity |
| Local providers | Local Qdrant and FalkorDB manifests; CBM process and external workers | Actual readiness and recovery under the chosen topology |
| Kubernetes | Local dependency manifests, host-worktree design | Accepted ACE/Bifröst deployment, network/resource constraints and real workload lifecycle |
| Crash/recovery | Archive and index publication/reconciliation mechanisms; documented runbooks | Cross-process and real-provider restart/outage evidence for applicable release |
| Observability | Typed status, diagnostics and evidence records | Actual incident/latency/resource observations, not inferred operational SLOs |

## Operational view components

[Local provider infrastructure](../../../infra/k8s/ace-local/README.md), [Dockerfile](../../../Dockerfile.ace), [runtime configuration](../../operations/ace-configuration-and-readiness-matrix.md), [Hermes E2E recovery runbook](../../operations/2026-11-21-hermes-e2e-repair-runbook.md), [archive backup/restore](../../operations/local-memory-backup-restore.md), [Qdrant snapshot crash runbook](../../operations/qdrant-snapshot-crash-real-provider-runbook.md), [supply-chain release evidence](../../operations/supply-chain-release-evidence.md), [ADR-008](../../references/ADR-008-local-kubernetes.md).

The release owner must verify the real deployment and recovery scope; local manifests or a green build alone are insufficient. CR-04, CR-05 and CR-08 apply.
