# ADR-005 — Immutable session archive and Graphiti temporal memory

**Status:** **Accepted**  
**Decision items:** 13D (Graphiti), 14C, 15C  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project-owner selections dated 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or verification; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale, and reconsideration criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests, and topology belong in a subsequent Architecture Design.

## Context

Prompt caching and compaction cannot guarantee retention of the rationale behind earlier decisions, rejected alternatives, or verbatim conversations across sessions. Engineering discussions may need to be recovered days or weeks later, and memory must distinguish superseded decisions from current ones.

## Decision

1. Preserve **original Codex conversations as immutable authoritative records**, including session ID, timestamp, project, and references to the exact original content. "Immutable" means stored events are not silently changed; it does not prohibit authorized safe deletion at the owner's explicit request.
2. Use **Graphiti** as the selected temporal knowledge-graph layer for extracted events, decisions, relationships, and change history. **Do not require Mem0.**
3. Archive new sessions automatically and extract potentially valuable knowledge. **Critical ADRs and engineering decisions require independent approval**; an LLM summary is not sufficient to establish them as fact.
4. Use an adapter-based import model so ChatGPT, Gemini, and other sources can be added later; **Codex** is the first implementation source.
5. Memory answers must cite original evidence and label each knowledge item as proposed, accepted, superseded, conflicting, or unknown.
6. Ingestion/extraction errors must not corrupt the immutable archive. Incremental re-extraction is allowed and must be idempotent.

## Alternatives

- Compacted summaries only: may lose details.
- Vector search of history only: retrieves episodes but represents temporal transitions less effectively.
- Mem0: a ready-made memory product, but the owner selected archive + Graphiti.
- Graphiti as the sole store without originals: risks irreversible loss of exact wording and provenance.

## Consequences and security

Graphiti may require a graph backend and model calls for extraction. Licensing, deployment, ingestion costs, and the destinations of private conversations must be evaluated separately. Raw conversations and secrets stay local by default; cloud operations require authorization. Retention, redaction, and deletion mechanisms will be needed.

## Acceptance criteria

- In a new session, Codex can retrieve a discussion from "two weeks ago," including the correct alternatives, rationale, and links to original messages.
- Superseding a decision preserves the historical fact of the former choice; history is not silently overwritten.
- `proposed` is not presented as `accepted`; conflicting evidence is explicit.
- Extra tokens and costs for storage, extraction, and retrieval are included in the total evaluation.

## Reconsideration

Revisit if temporal retrieval is inaccurate, Graphiti or its backend imposes unacceptable limitations, cost becomes excessive, or local-only processing requirements cannot be met.

## References

- https://github.com/getzep/graphiti
- ADR-007, ADR-009

## Owner confirmation — 2026-10-19

**Graphiti + FalkorDB local-first is the accepted storage/privacy direction.** Raw Codex sessions and extracted facts stay local unless explicitly authorized for a particular cloud project and data class. Graphiti may need extraction-LLM, embedding and reranker backends: do not infer that a local FalkorDB alone proves extraction is local. Codex must probe actual processing/inference endpoints and enforce outbound policy; select/test a real local extraction backend using existing components and pin its model/version. No mandatory Ollama service. Preserve source pointers and pending/processed distinctions; test projection acknowledgements, restart reconciliation, temporal search and derived deletion. Missing extraction backend means honest `not_ready`, not synthetic success. **This does not require a new owner choice before experimentation:** Codex/agents are authorized to select, install and test a supported local-only experimental inference configuration themselves, based on the installed Graphiti version and host capabilities. Prefer a maintained local OpenAI-compatible endpoint/factory that Graphiti actually supports; verify the installed factory rather than assuming README examples. No raw dialogue may leave the host. Production promotion still requires measured evidence and owner review, but local experimental backend selection must not become a coordination deadlock.
