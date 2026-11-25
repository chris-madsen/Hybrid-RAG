> **Superseding owner decision (2026-11-24/25, #363):** CBM is the sole native code retrieval engine. The separate vector SDK, embedding/reranking processes and vector publication mechanisms are retired by #378. The former provider-election gates no longer govern code-only release; absolute quality, source correctness, runtime identity and signed owner approval remain required. Independent LSP and FR-03 remain deferred (#364). The original decision below is historical evidence, not current implementation guidance. [Current architecture](../operations/current-architecture.md).

> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-014 — Agent-neutral multi-layer Hybrid Context Engine

**Status:** **Accepted**  
**Date:** 2026-10-21  
**Project:** Adaptive Context Engine (ACE)  
**Decision source:** Explicit owner decision on 2026-10-21: adopt the architectural principles of Cursor-like layered code-aware retrieval, select maintained components independently, and retain a universal optional tool-call integration at that time.

## Context

> **Clarification, 2026-10-24 / ADR-017:** The planned Bifröst Gateway + ACE Projection API was selected for model-bound context delivery. Hermes then used an implemented native ContextEngine. The optional tool-call protocol remained for explicit tool calls, not mandatory LLM context injection. LangGraph was an external orchestrator, not part of ACE. The original tool-protocol-first discussion below is historical.

ACE aims to do more than vector search over code. An agent should not have to reread unchanged files, rediscover the same symbols, or repeatedly ingest the same context across requests.

Token efficiency must not be achieved by reducing engineering quality. Retrieval should combine independent evidence: semantic similarity, exact lexical matches, syntax, LSP relationships, current working-tree state, documentation, and temporal memory.

Cursor is an architectural analogy, **not** a mandatory choice of its underlying technologies.

## Decision (historical)

1. **ACE remains an agent-neutral Context Engine.** Its core does not depend on a specific agent, IDE, LangGraph or adapter. Explicit tool calls originally used the optional tool-call protocol; native/Gateway adapters handled model-bound context (ADR-016/017).
2. **Structural code units:** Use maintained ast-grep/Tree-sitter tooling for boundaries and compact outlines. Do not build custom parsers or node tables without a demonstrated gap.
3. **Hybrid code retrieval:** Qdrant was selected as a local store with at least two independent retrieval paths:
   - dense semantic retrieval;
   - sparse/lexical BM25 retrieval;
   combined with provider-native fusion (RRF as the first candidate).
4. **Reranking:** The fused shortlist **may** use a maintained local cross-encoder/reranker, but select a model only after quality, latency and licensing benchmarks.
5. **Semantic enrichment:** Obtain definitions, references, types and diagnostics from maintained language servers through a generic LSP adapter. LSP does not replace fuzzy retrieval.
6. **Working context:** Treat Git/working-tree state as a first-class retrieval prior. Trusted IDE/agent focus, open-file and range hints may arrive through a native/Gateway adapter or explicit optional tool call. Hints are not authoritative source evidence.
7. **Keep documentation and memory separate:** Vertex serves authorized documentation; Graphiti/FalkorDB stores derived temporal memory; current source bytes remain authoritative for current behavior.
8. **Progressive disclosure:** The initial ContextBundle contains the minimum sufficient verified evidence, with lossless access to the exact original historically provided through `ace_expand`.
9. **Delta delivery:** Stable evidence and bundle identities allow clients to acknowledge previously seen material and avoid retransmitting unchanged large bodies.
10. **Content-addressed reuse:** Embedder reuse is keyed by chunk content and provider identity; publication originally used provider-native immutable Qdrant collections and atomic aliases.
11. **Quality first:** Report token reductions only with maintained or better task quality. The 5× goal remains a measurable hypothesis.
12. **Reuse before build:** Add Merkle trees, separate lexical databases, code graphs, custom routers or other subsystems only after demonstrating a gap in maintained primitives.

## Qdrant versus Turbopuffer (original selection)

Qdrant remained the then-current ACE solution.

Turbopuffer is a capable cloud/object-storage search platform and a reasonable future candidate for multi-tenant SaaS scale. However, the ACE boundary required local-first private-code retrieval and offline development, and already had a working Qdrant lifecycle. The expected benefit did not justify migration cost and risk.

Reconsider if:
- ACE becomes a cloud multi-tenant service;
- the corpus reaches a scale where object-storage economics materially improve cost;
- Qdrant's operating burden or latency becomes a measured bottleneck; or
- the data policy permits the corresponding deployment.

## Maintained component map (historical)

| Capability | Selected/default direction |
| --- | --- |
| Structural parsing/outlining | ast-grep / Tree-sitter |
| Dense retrieval | Qdrant + approved FastEmbed/ONNX embedding |
| Sparse lexical retrieval | Qdrant sparse BM25 |
| Fusion | Qdrant Query API / RRF |
| Reranking | FastEmbed cross-encoder candidate, evidence-gated |
| Semantic relations | Real LSP servers through a generic adapter |
| Working state | Git/worktree + optional host hints via the retired tool protocol |
| Documentation | Vertex RAG under policy |
| Temporal memory | Graphiti + FalkorDB + immutable ACE source archive |
| Model-bound delivery | Bifröst / ACE Gateway Projection API (planned in ADR-017); Hermes native ContextEngine (implemented in ADR-016) |
| Explicit tools | Retired optional tool protocol: `ace_expand`, status, optional `ace_context` search; not mandatory for injection |
| Exact expansion | ACE artifact handle / `ace_expand` |

## Acceptance criteria

- Behavior-without-name, exact-symbol and configuration-key fixtures all reach the fused shortlist.
- Compare hybrid retrieval against dense-only and sparse-only alternatives.
- Retain reranking only when it sufficiently improves relevance or compactness.
- Dirty-tree edits are visible before reporting `complete=true`.
- Focus/open-file hints may change ranking but may not make irrelevant or stale evidence current.
- Unchanged evidence can be represented by a compact already-known reference.
- Reread and verify exact code before delivery.
- Natural-use agent benchmarks report quality, total tokens, avoided duplication, tool calls and failures.
- ACE core requires no agent-specific dependency.

## References

- ADR-001, ADR-003, ADR-004, ADR-005, ADR-006, ADR-009, ADR-012, ADR-013
- https://cursor.com/blog/secure-codebase-indexing
- https://qdrant.tech/documentation/search/text-search/hybrid-search/
- https://qdrant.tech/documentation/fastembed/fastembed-rerankers/
- https://turbopuffer.com/docs/architecture
