> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-008 — Local Kubernetes and a modular monolith instead of unnecessary microservices

**Status:** **Accepted (deployment constraints)**  
**Decision item:** 20E — explicit owner clarification  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and owner decisions of 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or validation; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale, and reconsideration criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests, and topology belong in subsequent Architecture Design.

## Context

The project owner **already runs a local Kubernetes cluster**. The harness mainly serves one user and their current projects. Splitting every internal capability into separate microservices is not justified without an operational need. Deployment should be reproducible and economical on local hardware.

## Decision

1. Deploy the harness to **the existing local Kubernetes cluster**; do not require a new cluster.
2. Build the historical Unified optional tool-call Harness as a **modular monolith**. Routing, code retrieval, AST/LSP, documentation and memory adapters, Context Builder, and usage collection are internal modules, **not standalone microservices by default**.
3. Allow Qdrant and the graph backend used by Graphiti to run as **separate stateful dependencies** when running in-process is not practical. Vertex AI is an external managed service.
4. Investigate how the indexer accesses the Codex workspace, uncommitted changes and local filesystem events. **Do not prematurely mandate** PVC/PV topology, CSI, hostPath mounts or sidecars.
5. Do not introduce cloud Kubernetes, autoscaling or distributed queues in the initial phase without a workload that justifies them.
6. Support restarts and reconnection without losing long-term knowledge or indexes unless an explicit operating policy allows deletion.

## Alternatives

- Docker Compose: simpler for the first deployment, but the owner chose an existing Kubernetes cluster.
- Multiple specialized microservices: unjustified at the initial scale.
- A single process for all components, including Qdrant/Graphiti storage: impractical or impossible for some established dependencies.

## Verification criteria

- Required processes run on the existing cluster without mandatory external multi-node infrastructure.
- The number of Deployments and StatefulSets is minimal and justified by actual dependencies, not domain labels.
- Access to the current working tree is tested after Codex changes; unsafe mount permissions are prohibited.
- Configuration is reproducible and the archive/indexes recover after a pod restart.

## Harbor note

**Harbor is an isolated benchmark runner**, not a required production Kubernetes service. Its local execution usually relies on Docker environments. Do not claim that Harbor works inside K8s out of the box without confirming a supported environment provider. Evaluation deployment is separate from the historical production harness (ADR-009).

## Reconsideration

Revisit only if measurable requirements for scale, isolation, reliability or operating cost justify a different deployment.

## References

- https://github.com/harbor-framework/harbor
- ADR-003, ADR-005, ADR-007, ADR-009
