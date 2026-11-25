> **Superseding owner decision (2026-11-24/25, #363):** CBM is the sole native code retrieval engine. The separate vector SDK, embedding/reranking processes and vector publication mechanisms are retired by #378. The former provider-election gates no longer govern code-only release; absolute quality, source correctness, runtime identity and signed owner approval remain required. Independent LSP and FR-03 remain deferred (#364). The original decision below is historical evidence, not current implementation guidance. [Current architecture](../operations/current-architecture.md).

# ADR-003 — Split RAG responsibilities: Vertex AI for documentation, local Qdrant for code

**Status:** **Accepted** — engines selected at the time; embedding models subject to evaluation  
**Decision items:** 2B, 5A, 6A, 7C  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and owner decisions of 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or validation; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale and reconsideration criteria. Detailed classes, schemas, contracts, Kubernetes manifests and deployment topology belong in subsequent Architecture Design.

## Context

Documentation captures requirements and architecture decisions; source code changes during an agent session and requires local, fresh indexes. A single cloud index for both classes conflicts with the chosen local-first code strategy.

## Decision (historical)

1. **Google Vertex AI RAG Engine** is the primary retrieval engine for project documentation, including READMEs, ADRs, specifications, runbooks, contracts and guides, when transmission is authorized.
2. **Qdrant** was chosen for local source-code RAG, using dense and lexical/sparse hybrid retrieval as needed. This **does not mean** Qdrant performs AST or LSP verification.
3. Index code in symbol-aware units—file, symbol and range—with `repo`, `revision`, `working_tree_hash`, language and provenance. Define the exact indexing schema separately.
4. **Embeddings:** evaluate local and cloud models. Cloud embeddings for private code require **project-specific opt-in** (ADR-007).
5. Reconcile stale index hits against the current working-tree overlay (ADR-004); never present an old snippet as current source.
6. Documentation can conflict with implementation. Return both sourced facts rather than silently replacing one with the other.

## Alternatives

- One Vertex RAG index for both documentation and source: simpler cloud pipeline, worse locality and working-tree control.
- LanceDB or SQLite FTS/vector: reasonable alternatives, but **the owner's initial choice was Qdrant**; revisit based on observable quality or operating problems.
- Grep/lexical-only index: useful as a baseline and fallback, but insufficient for discovering unknown behavior semantically.

## Consequences

**Benefits:** Code retrieval remains independent of cloud services; separate data policies and a local overlay support rapid lookup of changes.  
**Costs:** Two retrieval infrastructures, an embedding pipeline, version synchronization, Vertex cost and higher integration complexity.

## Verification criteria

- A "find behavior without knowing its symbol name" query works against source; a "why was this decided?" query works against documentation.
- Private code is not silently sent to Vertex or external embedding APIs.
- Code entries carry exact source/hash/revision evidence; stale data is never labeled current.
- Benchmark lexical baselines against Qdrant and different embedding models, covering relevance, latency, indexing, tokens and task success.
- Total cost includes embeddings, indexing and cloud requests, not just Codex tokens.

## Reconsideration

Revisit if Qdrant underperforms a specialized engine on real tasks with significant operational overhead, or Vertex RAG fails access, versioning or cost requirements.

## References

- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/rag-quickstart
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/samples/generativeaionvertexai-rag-import-files
- https://qdrant.tech/documentation/search/hybrid-queries/
- ADR-004, ADR-007, ADR-009

## Owner clarification — 2026-10-19: Ollama is not required

The selected code retrieval engine is **Qdrant**, not a model-serving wrapper. **Ollama is explicitly not selected or required.** Genuine code embeddings can be produced by a ready-made *local* inference library such as **Qdrant FastEmbed / ONNX Runtime**, with model and inference backend evaluated separately. These are candidates, not a silently approved production model. Codex may run real local candidate E2E and benchmark now; decide production model after measured recall, latency, multi-language behavior, throughput, resource usage, licensing and full agent quality/cost. Keep a distinct Qdrant collection/generation when models, dimensions or preprocessing change. See proposed ADR-013 and ADR-007.

## Owner clarification — 2026-10-21: Qdrant stays, hybrid retrieval becomes first-class

The local code store remains **Qdrant**. The next production retrieval architecture SHALL evaluate and, if quality gates pass, use Qdrant as a **single hybrid data plane** for both dense semantic and sparse/BM25 retrieval with provider-native fusion (initial candidate: RRF). A separate Tantivy/Elasticsearch-style service is not added by default.

**Turbopuffer is not selected for the current ACE runtime.** It is a strong object-storage-native cloud search platform, but ACE currently requires local-first private-code retrieval, offline/local development and already has working Qdrant lifecycle/evidence. Revisit Turbopuffer only if ACE becomes a cloud multi-tenant service or Qdrant becomes a measured scalability/operational bottleneck.

Exact literal retrieval that BM25 cannot cover MAY use a maintained exact-search tool such as ripgrep after benchmark evidence; do not create a custom lexical database.

See ADR-014 and OpenSpec change 007.
