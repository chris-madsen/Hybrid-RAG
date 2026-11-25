> **Superseding owner decision (2026-11-24/25):** native CBM is selected for local code retrieval (#363); Qdrant remains only during migration, not a competing architecture. External LSP and FR-03 remain for deferred independent research (#364). Preserve the original decision below as historical evidence. [Current architecture](../operations/current-architecture.md).

> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-000 — Register of agreed architecture decisions

**Status:** Recorded  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project owner's choices of 2026-10-17.  
**Decision statuses:** `Accepted` — decision approved; `Proposed` — spike/verification required; `Deferred` — consciously postponed.  

> **Document boundary:** This ADR records decisions, alternatives, rationale, and reconsideration criteria. Specific classes, database schemas, API contracts, Kubernetes manifests, and topology are to be defined in the subsequent Architecture Design.

## Project owner's answer matrix

> **2026-10-24 precedence:** retired optional tool-call protocol-first rows and the Hermes retired optional tool-call protocol injection text below are dated historical decisions. ADR-017 now governs planned Bifrost model-bound delivery, ADR-016 documents native Hermes, and retired optional tool-call protocol remains explicit tools only. LangGraph orchestration is external to ACE.

| Question no. | Owner's decision | Recorded in |
|---|---|---|
| 1 | C — independent core; Codex first | ADR-001 |
| 2 | B — hybrid: code intelligence locally, documentation in the cloud | ADR-001, ADR-003 |
| 3 | B — one unified retired optional tool-call protocol; retain the option to study deeper integration C | ADR-001 |
| 4 | Jev as a candidate Strategy Selector; compare it with rules, decision still open | ADR-002 |
| 5 | A — Vertex AI RAG Engine for documentation | ADR-003 |
| 6 | A — Qdrant for local source-code RAG | ADR-003 |
| 7 | C — compare local and cloud embeddings | ADR-003 |
| 8 | B — Tree-sitter / ast-grep for AST | ADR-004 |
| 9 | D — benchmark Serena vs TypeScript Language Service | ADR-004 |
| 10 | C — AST/LSP first; add a graph only if its benefit is demonstrated | ADR-004 |
| 11 | B — incremental indexing + working-tree overlay | ADR-004 |
| 12 | D — staged AST/LSP → data-flow/CFG → runtime/tests when needed | ADR-004 |
| 13 | D, clarification — immutable archive + **Graphiti** (Mem0 is not a mandatory component) | ADR-005 |
| 14 | C — automatic archival and extracted facts; critical decisions require confirmation | ADR-005 |
| 15 | C — extensible imports, Codex first | ADR-005 |
| 16 | B — structured Context Bundle + progressive disclosure | ADR-006 |
| 17 | D — relevance-first, **no fixed token cap**; do not truncate long agent-generated code | ADR-006 |
| 18 | B — fallback to standard Codex tools on technical failures; fail closed on authentication/security and retain audit logs | ADR-007 |
| 19 | B — code stays local by default; cloud embeddings strictly opt-in | ADR-007 |
| 20 | E — existing local Kubernetes; modular monolith; no artificial microservices | ADR-008 |
| 21 | For now, only token accounting and mandatory security/failure logs; other observability separately | ADR-009, ADR-010 |
| 22 | D — baseline + Serena initially, Augment and graph systems in the final comparison | ADR-009 |
| 23 | **Harbor** as the selected framework; token usage from Codex, benchmarks with quality gating | ADR-009 |
| 24 | Cursor-like **hybrid context architecture principles**, but independently selected maintained components; universal retired optional tool-call protocol boundary; Qdrant remains the local code store | ADR-014 |
| 25 | For the current Harbor feedback loop, the primary agent changes from Codex to **Hermes**; GPT remains accessed through ChatGPT/Codex OAuth (`openai-codex`), ACE connects as native Hermes retired optional tool-call protocol, and Codex remains a comparison client | ADR-015 |
| 26 | Event Storming + functional DDD as the default modeling style; TypeSpec as the source language for new/migrated public machine contracts | ADR-019 |

## Open research (not to be confused with unapproved requirements)

- **Jev**: Does it outperform rule-based routing on end-to-end metrics?
- **LSP**: Serena or direct TypeScript Language Service, considering latency, completeness, and licensing?
- **Embeddings**: Which local/cloud option provides the best retrieval quality and total cost?
- **Code Graph**: At what point does an additional engine justify its cost?
- **Context optimisation**: Is relevance-first sufficient, or does an adaptive strategy deliver additional improvement without losing facts?
- **Harbor**: The precise dataset adapters, Codex version compatibility, and complete cost accounting require a technical spike.

## Deferred

Full observability (OTel, Prometheus/Grafana, Langfuse, etc.), broad multi-agent support, enterprise AIOps, and detailed Kubernetes topology design. **Deferred does not mean prohibited.**

## Owner clarification — 2026-10-19 (after PR #2)

- **Ollama rejected as required/selected ACE dependency**. Embedding model and inference backend remain evidence-gated; Codex may compare real local candidates, e.g. Qdrant FastEmbed/ONNX, before production approval. Proposed experiment ADR-013.
- **LSP selection is still open by design**: Codex performs the Serena versus direct TypeScript Language Service comparison required by ADR-004. No new ADR predetermines the outcome.
- **Graphiti + FalkorDB local-first** confirmed; no automatic cloud processing of raw dialogue or extraction payloads. Concrete local inference remains to be verified under ADR-005/007.
- **Vertex RAG** continues as selected docs engine; use already-signed-in host `gcloud CLI` for REST/IAM/corpus read-only probes. No automatic private document import or billable corpus creation. Sign-in is not the same as approved data policy.
- **ADR-012 still Proposed** pending express owner approval of six acceptance rules. Spikes/E2E/Harbor may proceed immediately; 5× remains a target to test rather than a precondition to running tests.


## Owner clarification — 2026-10-21: Hybrid Context Engine

- **ADR-014 Accepted.** ACE is designed as an agent-neutral multi-layer Context Engine through the retired optional tool-call protocol: structural chunks + dense semantic + sparse lexical + optional reranking + LSP enrichment + working-state priors + docs + temporal memory + progressive/delta delivery.
- We **do not copy Cursor's private implementation**. We adopt its architectural principles while selecting our own maintained components.
- **Qdrant retained.** Turbopuffer was not selected for the current local-first developer runtime; reconsider only if a cloud/multi-tenant scale bottleneck is measured.
- After PR #94, the de-bespoke structural/Qdrant/LSP migration was substantially completed; the next retrieval gap was hybrid sparse/BM25 + fusion, reranking, working-state context, and repeated-context suppression.


## Owner clarification — 2026-10-23: Hermes primary feedback agent

- **ADR-015 Accepted.** For the current paired Harbor trials, the primary agent is Hermes rather than Codex.
- The model/subscription does not change automatically with the harness: GPT is accessed via Hermes provider `openai-codex` using Hermes-owned OAuth store `~/.hermes/auth.json` (or explicitly configured `HERMES_HOME` / `HERMES_AUTH_JSON_PATH`); `~/.codex/auth.json` is not reused, and a separate model-provider API key is not required for this route.
- ACE remains an agent-neutral retired optional tool-call protocol service. On the ACE-optional arm Hermes receives `ace_context`/`ace_expand` via native retired optional tool-call protocol registration; the baseline arm does not receive ACE.
- Historical Codex benchmark artifacts remain historical Codex artifacts and are not evidence of Hermes E2E.


## Owner clarification — 2026-10-24: Bifrost and retired optional tool-call protocol roles

- Bifrost is the accepted **planned** LLM model-request gateway for configurable-endpoint agents; thin Go ACE Connector, ACE Gateway Projection API and final provider-wire proof remain unimplemented/unapproved (ADR-017).
- Native Hermes ContextEngine/JSONL bridge already exists (ADR-016), and must not double-project a Bifrost-transformed request.
- retired optional tool-call protocol is the existing **explicit tools plane** (`ace_expand`, status, diagnostics, optional search), not a required route for automatic model-context injection. Previous retired optional tool-call protocol-first statements are retained only as dated historical records.
- Multi-agent scheduling using LangGraph stays outside ACE.


## Owner clarification — 2026-11-05: Functional DDD + TypeSpec public contracts

- **ADR-019 Accepted.** This records the architecture choices already stated in PR #222 and does not change its SDLC stage/gate semantics.
