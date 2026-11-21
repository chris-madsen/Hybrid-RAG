# ACE current runtime architecture and verification boundary

**Source baseline:** `main@8591adc9da77f8eb395df43ea7a51eea16e78062` (20–21 November 2026). This is a **source-inspected documentation snapshot**, not a claim that local services, real providers or the latest remote HEAD have been retested. Revalidate against actual HEAD after merges.

## Runtime composition (implemented vs certified)

```text
Hermes native Responses client
      -> Bifröst /v1/responses + Go ACE connector
      -> authenticated ACE Gateway projection (TypeSpec ace.gateway.v2)
      -> ACE TypeScript/Effect application
           code       CBM v0.12.1 native index/AST/graph/semantic/BM25 discovery
                      + currently required Qdrant dense/sparse code retrieval
                      + optional external LSP exact symbol validation
           documents  Vertex AI RAG, only for authorized project_document
           memory     immutable archive + Graphiti/FalkorDB (derived temporal state)
      -> original source reread + SHA-256/UTF-8 span + policy/receipt checks
      -> Bifröst physical-send guard -> selected provider (NOT CERTIFIED)
```

**Codebase Memory is the only active structural/code-graph engine.** ACE runs the pinned native `codebase-memory-mcp` CLI (`index_repository`, `get_file_outline`, `search_graph`, `trace_path`, `query_graph`, `detect_changes`). No active ast-grep parser or bespoke RepoMap ranking/graph engine remains. The ast-grep CLI remains an *SDLC architecture linter only* through `check:arch` and `test:arch-rules`. CBM also performs semantic retrieval and SQLite FTS5/BM25: this **overlaps** with Qdrant's retrieval function.

**Qdrant has NOT been removed.** At this source baseline the real code-retrieval runtime is composed only when `ACE_ENABLE_EXPERIMENTAL_QDRANT=true`; `src/bin/ace-runtime.ts` constructs the CBM structural adapter, the Qdrant SDK, embedding workers and the independent LSP in that branch. There is **no verified production CBM-only runtime mode**. CBM-only versus CBM+Qdrant is an *open benchmark decision*, not an approved removal or demonstrated necessity. The CBM adapter currently calls `index_repository` with `persistence: false`; check upstream process/index lifecycle costs before changing it.

**LSP is independent validation, not vector semantic search.** ACE uses a real external server for `documentSymbols` selection ranges and `definition` confirmation on the verified source. Whether CBM Hybrid LSP makes part of this redundant remains to be measured; do not silently delete LSP verification.

**Source ownership:** ACE must reread current source bytes and verify source digests and ranges. Neither CBM graph hints nor Qdrant payload alone can establish current source facts.

**Data ownership:** Vertex AI RAG is the selected documentation search source, subject to both `ACE_ENABLE_VERTEX=true` and `ACE_CLOUD_DOCS_OPT_IN=true`. Graphiti/FalkorDB covers temporal/project memory derived from an immutable archive. Do not repurpose Qdrant for those domains merely to justify its retention.

## Readiness — code merged is not accepted E2E

- Native Responses v2 TypeSpec/Go/TS contracts and offline implementation candidates for OpenSpec 013 C01–C07 are present on the inspected SHA. The canonical [C01–C08 tracker](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) distinguishes local implementation, G02 approvals and **real final-wire/Hermes/Harbor acceptance that remains open**. C08 paired agent economics is not a completed production acceptance.
- OpenSpec 014 AR01–AR10 describes 22 audit requirements, some implemented in merged PRs; its unchecked tracker is **not proof that all code is absent**, and merged PRs are **not proof that all acceptance criteria passed**. [AR01–AR10 tracker](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md).
- Dedicated real-CBM CI: `.github/workflows/ace-codebase-memory.yml` installs pinned CBM v0.12.1 and runs `ACE_TEST_REAL_CBM=true npx tsx --test test/codebase-memory-graph.contracts.test.ts test/codebase-memory-structural.contracts.test.ts test/cbm-graph-delivery.contracts.test.ts`. It is **not** a provider-wire or actual Hermes coding-task certificate.
- Local deterministic gates: `npm run verify:pr`, `npm run verify:full`, `npm run check:gateway-only`, `npm run check:arch`; `npm run test:real-projection` and variants are opt-in real local Qdrant checks, not external model egress.
- Independent benchmarks to run *separately*: upstream Agent Retrieval Bench, ContextBench, CodeGraph Bench, and Harbor with Hermes under the same frozen task/model/source budgets. Use upstream evaluators. No measured CBM-only-vs-Qdrant verdict or proven 5× reduction is claimed here.
- Never enable ordinary generation without applicable C03–C05 physical-send, privacy and route certification. `PREPARED` is not a send permit. External probe approval is narrower than production approval.

## Operator navigation

- [Root README](../../README.md) — entry point and verified source boundaries.
- [CBM provider](codebase-memory-provider.md) — current native integration and tests.
- [Runtime flags/readiness](ace-configuration-and-readiness-matrix.md) — current Qdrant-dependent composition.
- [Testing strategy](testing-strategy.md) — deterministic vs provider vs independently scored agent tests.
- [ADR-020](../docs/references/ADR-020-native-responses-only.md) — accepted Responses-only boundary.
- [Historical retrieval plans](../plans/README.md) — source decisions, not an alternative active queue.

## Documentation reconciliation policy

Current instructions (`README.md`, `AGENTS.md`, this runbook, operational runtime docs) must describe implemented code. Accepted ADRs are **historical decision records**: annotate a superseding implementation but do not rewrite the original decision. Historical research, old benchmark reports, dated plans and prior change descriptions must retain their source-SHA context; do not claim that their old commands work on current `main`. Reconcile acceptance checkboxes only with actual retained evidence, not a documentation cleanup.
