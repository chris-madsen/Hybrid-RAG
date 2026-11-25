# ACE current runtime architecture and verification boundary

**Source baseline:** merged main `49feabfe190cb5f3ab197cedad91a0fa1305278d` (#367–375), 25 November 2026; Harbor migration in #376 is a separate candidate until merged. Real local projection evidence is not real Hermes or provider-wire certification.

## Runtime composition (implemented vs certified)

```text
Hermes native Responses client
      -> Bifröst /chatgpt_passthrough/backend-api/codex/responses + Go ACE plugin
      -> authenticated loopback ACE context RPC (TypeSpec ace.context.v3; no model dispatch)
      -> ACE TypeScript/Effect application
           code       CBM v0.12.1 native index/AST/graph/semantic/BM25 discovery
                      native migration mode: CBM ranked candidates only
                      historical vector composition: Qdrant + workers, pending removal
                      external LSP: independent research deferred
           documents  Vertex AI RAG, only for authorized project_document
           memory     immutable archive/lifecycle code; Graphiti/FalkorDB target
                      (Gateway-native Graphiti currently NOT CONFIGURED)
      -> original source reread + SHA-256/UTF-8 span + policy/receipt checks
      -> Bifröst physical-send guard -> selected provider (NOT CERTIFIED)
```

**Codebase Memory is the only active structural/code-graph engine.** ACE owns one persistent local `codebase-memory-mcp` stdio process, using the existing `vscode-jsonrpc` transport for `index_repository`, `get_file_outline`, `search_graph`, `trace_path`, `query_graph`, and `detect_changes`. The inner Model Context Protocol is **provider-only**: ACE selects each call, never exposes CBM tools to the model, and still delivers all model context exclusively through Bifröst. No active ast-grep parser or bespoke RepoMap ranking/graph engine remains. The ast-grep CLI remains an *SDLC architecture linter only* through `check:arch` and `test:arch-rules`. CBM also performs semantic retrieval and SQLite FTS5/BM25: this **overlaps** with Qdrant's retrieval function.

**Native code retrieval is implemented and locally tested.** Set `ACE_CODE_RETRIEVAL_MODE=cbm`. WorkspaceSync owns source observations; ACE verifies the manifest and exact cited bytes before delivery. The direct native child is owned by ACE; transport loss, cancellation and deadlines invalidate publication, retire the old child and permit a new generation. Real host and isolated container tests include Git transitions, restart and non-Git edits. The historical vector mode still exists and is not the target. Qdrant removal and absolute scale/quality acceptance are open (#363). `persistence: false` omits the portable repo-local export; restart tests do not establish persisted-index reuse.

**External LSP:** the independent adapters and FR-03/OpenSpec contract remain. The code-only RPC does not request LSP evidence and the routed facade lacks `documentSymbols`; startup is not proof of semantic validation. Further research is deferred (#364), not a gate for vector retirement.

**Source ownership:** ACE must reread current source bytes and verify source digests and ranges. Neither CBM graph hints nor Qdrant payload alone can establish current source facts.

**Data ownership:** Vertex AI RAG is the selected documentation search source, subject to both `ACE_ENABLE_VERTEX=true` and `ACE_CLOUD_DOCS_OPT_IN=true`. Graphiti/FalkorDB is the *selected target* for temporal/project memory, with existing immutable-archive/reconciliation code. **The current Gateway runtime explicitly throws if `ACE_ENABLE_GRAPHITI=true`** (`src/bin/ace-runtime.ts`, before provider initialization): the retired tool-server adapter was removed and no Gateway-native memory provider is configured. Thus Graphiti is NOT_READY, not a working full-unified provider. Do not repurpose Qdrant for either docs or memory merely to justify its retention.

## Readiness — code merged is not accepted E2E

- Native Responses with TypeSpec ace.context.v3/Go/TS contracts and offline implementation candidates for OpenSpec 013 C01–C07 are present on the inspected SHA. The canonical [C01–C08 tracker](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) distinguishes local implementation, G02 approvals and **real final-wire/Hermes/Harbor acceptance that remains open**. C08 paired agent economics is not a completed production acceptance.
- The full-unified memory path is currently BLOCKED by the rejected `ACE_ENABLE_GRAPHITI=true` configuration; the archive/reconciliation tests do not certify active Gateway-native temporal recall.
- OpenSpec 014 AR01–AR10 describes 22 audit requirements, some implemented in merged PRs; its unchecked tracker is **not proof that all code is absent**, and merged PRs are **not proof that all acceptance criteria passed**. [AR01–AR10 tracker](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md).
- Dedicated real-CBM CI: `.github/workflows/ace-codebase-memory.yml` installs pinned CBM v0.12.1 and runs `ACE_TEST_REAL_CBM=true npx tsx --test test/codebase-memory-stdio.contracts.test.ts test/codebase-memory-graph.contracts.test.ts test/codebase-memory-structural.contracts.test.ts test/cbm-graph-delivery.contracts.test.ts`. It is **not** a provider-wire or actual Hermes coding-task certificate.
- Local deterministic gates: `npm run verify:pr`, `npm run verify:full`, `npm run check:gateway-only`, `npm run check:arch`; `ACE_REAL_PROJECTION_NATIVE_CBM=true npm run test:real-projection` and the native CI scenarios are real local CBM checks, not external model egress.
- Independent benchmarks to run *separately*: upstream Agent Retrieval Bench, ContextBench, CodeGraph Bench, and Harbor with Hermes under the same frozen task/model/source budgets. Use upstream evaluators. Absolute CBM retrieval/scale acceptance is still required; no competing vector benchmark is mandated. No proven 5× reduction is claimed.
- Never enable ordinary generation without applicable C03–C05 physical-send, privacy and route certification. `PREPARED` is not a send permit. External probe approval is narrower than production approval.

## Operator navigation

- [Root README](../../README.md) — entry point and verified source boundaries.
- [CBM provider](codebase-memory-provider.md) — current native integration and tests.
- [Runtime flags/readiness](ace-configuration-and-readiness-matrix.md) — native migration mode and historical configuration.
- [Testing strategy](testing-strategy.md) — deterministic vs provider vs independently scored agent tests.
- [ADR-020](../references/ADR-020-native-responses-only.md) — accepted Responses-only boundary.
- [Historical retrieval plans](../plans/README.md) — source decisions, not an alternative active queue.

## Documentation reconciliation policy

Current instructions (`README.md`, `AGENTS.md`, this runbook, operational runtime docs) must describe implemented code. Accepted ADRs are **historical decision records**: annotate a superseding implementation but do not rewrite the original decision. Historical research, old benchmark reports, dated plans and prior change descriptions must retain their source-SHA context; do not claim that their old commands work on current `main`. Reconcile acceptance checkboxes only with actual retained evidence, not a documentation cleanup.



**Dependency ownership:** CBM owns structural parsing and native retrieval. Qdrant and embedding workers remain only as transitional runtime code. External LSP is retained for further research. The RepoBench-R adapter uses CBM outlines; immutable historical benchmark identities remain distinct. See [cutover plan](../plans/2026-11-25-native-cbm-cutover-and-legacy-retirement.md).
