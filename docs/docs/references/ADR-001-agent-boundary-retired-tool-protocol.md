> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-001 — Agent-neutral core and the historical optional tool-call facade decision

**Status:** **Accepted**  
**Decision items:** 1C, 2B, 3B, with option 3C left open for investigation  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project-owner selections dated 2026-10-17.  
**Status definitions:** `Accepted` — decision approved; `Proposed` — requires a spike or verification; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale, and conditions for reconsideration. Concrete classes, database schemas, API contracts, Kubernetes manifests, and deployment topology belong in a subsequent Architecture Design.

## Context

> **Update, 2026-10-24:** The optional tool-call-protocol-first model for delivering context to the LLM was **superseded by ADR-016/017**. For agents that support a configurable endpoint, the selected direction was Bifröst LLM Gateway → ACE Gateway Projection API (a plan at that date, not yet implemented). Hermes then used its existing native ContextEngine bridge. The optional tool-call protocol was retained only for explicit tool calls; agents would not need to invoke it for request-local projection. LangGraph orchestration was outside ACE. The decisions below are preserved as an **October 17 historical record**.

The harness initially serves Codex but should remain suitable for other coding agents. If an agent must coordinate multiple independent tool-call servers itself, it may incur unnecessary sequential model/tool round trips. This was a hypothesis, not an established result for our workload.

## Decision

1. Build an **agent-neutral core** with **Codex as the first full adapter**.
2. Offer **one logical integration surface**, historically called the Unified optional tool-call Harness. Internally it may adapt existing code RAG, AST, LSP, documentation, memory, and metrics providers.
3. Keep source analysis and its indexes local. Documentation RAG may use cloud services subject to ADR-003 and ADR-007.
4. Investigate supported deeper Codex integration mechanisms (CLI, SDK, lifecycle) **without committing to adopting them in advance**.
5. Do not implement a new coding agent or fork Codex merely to build the first version.

## Alternatives

- Codex only: fewer abstractions, but strong vendor/agent coupling.
- Multiple independent optional tool-call servers coordinated by the agent: simpler to assemble, but no unified Context Builder.
- A deep management wrapper around Codex: potentially stronger control, but a greater maintenance burden.

## Consequences

**Benefits:** Centralized freshness checks, deduplication, and provenance; reduced dependence on a specific agent.  
**Costs:** Another potential failure point, adapter maintenance, and a requirement to retain ordinary Codex tools as a safe fallback.

## Implementation and verification criteria (historical)

- One attachable optional tool-call endpoint or tool collection demonstrably supported by the installed Codex version.
- Each response includes source provenance, revision, freshness, and incomplete-result status.
- Codex can continue with ordinary tools when noncritical retrieval degrades; authentication and policy failures follow ADR-007.
- Compare independent tool servers with the unified route on tokens, tool calls, task success, and elapsed time.

## Reconsideration

Revisit if Codex or its optional tool interface materially prevents the required context control, or another agent becomes the primary consumer.

## References

- https://developers.openai.com/learn/docs-retired-tool-protocol
- ADR-002, ADR-003, ADR-006, ADR-007
