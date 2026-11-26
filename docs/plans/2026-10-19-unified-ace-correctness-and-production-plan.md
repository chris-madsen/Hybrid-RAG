# ACE unified correctness and production plan — 19 October 2026

**Historical record, not current implementation instructions.** English editorial reconstruction of the [complete original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/plans/2026-10-19-unified-ace-correctness-and-production-plan.md). The original evidence, detailed task lists and source references remain preserved at that immutable revision. No fresh provider tests or acceptance are asserted here. For current authority see [runtime architecture](../operations/current-architecture.md), the accepted ADRs and OpenSpec.

Baseline: main at `f935ded2159b88859204e03a44033969a5f2c468`. This was a unified historical backlog combining the production roadmap and the earlier correctness review. Implementation and acceptance were distinct; no final production or 5× result was asserted.

## Correctness tracks

| ID | Original invariant and proposed acceptance |
| --- | --- |
| C-A | Isolate source snapshots, publish only verified membership, coordinate leases and garbage collection, and recover after interrupted publication. Test competing writers/readers, distinct roots, process death and stale receipts. The old Qdrant mechanism is retired; source validity and native lifecycle invariants remain. |
| C-B | Bind semantic claims to exact declaration identity and verified source bytes; reject same-name collisions and invalid ranges. Independent LSP research remains separate. |
| C-C | Required-source coverage must reflect missing, stale, denied and failed evidence. An optional source is not equivalent to a required one; no false complete result. |
| C-D | Resolve one effective embedding configuration; verify actual worker artifact/runtime identity before using data. The separate embedding-worker implementation is retired. Preserve actual provider identity. |
| C-E | Retain original episodes and valid-time decision history; support as-of recall, supersession, deletion and explicit uncertainty. Do not equate domain history with real temporal-provider delivery. |

The historical sequencing treated C-A through C-D as prerequisites for claims about the old code pipeline. C-E was required for memory, not a reason to block every limited code-only experiment.

## Consolidated W00–W16 packages

| ID | Original work package | Current interpretation |
| --- | --- | --- |
| W00 | Establish source and evidence baseline; reconcile status. | Bind claims to exact source and actual observed artifacts. |
| W01 | Select local production embeddings by quality, runtime and license. | Standalone worker selection retired by #378; native retrieval quality still required. |
| W02 | Compare Serena and TypeScript language-service accuracy. | Historical comparison; independent semantic-provider research remains #364. |
| W03 | Retrieval quality, hybrid ranking and compact context. | Native CBM absolute holdout and verified evidence, not a restored competing vector engine. |
| W04 | Incremental index, freshness and crash-safe publication. | Native lifecycle, exact source and cache/topology acceptance remain #363. |
| W05 | Vertex document retrieval, provenance and source conflict. | Separate authorized adapter; actual combined delivery remains unproven. |
| W06 | Local Graphiti extraction and temporal recall. | Memory delivery is not active in native Responses. |
| W07 | Archive/outbox durability, deletion and recovery. | Preserve lifecycle and original-source integrity; do not infer Graphiti acceptance. |
| W08 | Unified agent context with code, documents and memory. | Current native projection is code-only; full unified acceptance remains separate. |
| W09 | Memory admission quality and economics. | Evaluate only with authorized real memory path and complete usage. |
| W10 | Deterministic routing; optional Jev research. | No optional cloud route is automatically authorized or required. |
| W11 | Local k3s and host worktree access. | Old remote helper unsupported by native runtime; topology still open. |
| W12 | End-to-end failure and security behavior. | Preserve fail-closed data and per-attempt authorization. |
| W13 | Harbor natural-use comparison, correctness and complete cost. | Matched Hermes comparison under #171 and OpenSpec 013. |
| W14 | DBC-01 through DBC-14 acceptance. | Evaluate exact release and applicable scope, not historic checkbox counts. |
| W15 | Release build, operations, supply chain and owner approval. | No release without actual scope-bound evidence. |
| W16 | Deferred work outside critical path. | Do not expand scope into speculative infrastructure. |

## Acceptance strategy

- Preserve real negative results; do not count mocked tests, generated receipts or planned tests as observed provider behavior.
- Keep source snapshots, provider identity, query/attempt correlation, required coverage and raw evidence verifiable.
- Compare real matched tasks with independent correctness, actual usage and failed attempts included. Report unknown telemetry rather than inventing zero.
- For memory, verify the original archive, durable projection intent, deletion fencing, temporal answers and actual recovery.
- Use explicit owner and data authorization; no unrestricted provider egress is implied by a local check.
- Separate a code-only profile from full code/document/memory acceptance, and keep operational evidence tied to the exact release.

## Current authority

The historical detailed checklist is preserved at the linked original revision. The native CBM cutover removed the old vector/index publication mechanisms and retired the former model tool transport. Use [native CBM cutover](2026-11-25-native-cbm-cutover-and-legacy-retirement.md), [OpenSpec 013](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md), [OpenSpec 014](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md), [#363](https://github.com/chris-madsen/Hybrid-RAG/issues/363), [#364](https://github.com/chris-madsen/Hybrid-RAG/issues/364) and [#171](https://github.com/chris-madsen/Hybrid-RAG/issues/171). The old checklist is not current work authorization.
