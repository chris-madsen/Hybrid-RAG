# ACE production completion roadmap — 19 October 2026

**Historical record, not current implementation instructions.** English editorial reconstruction of the [complete original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/plans/2026-10-19-ace-production-completion-roadmap.md). The original evidence, detailed task lists and source references remain preserved at that immutable revision. No fresh provider tests or acceptance are asserted here. For current authority see [runtime architecture](../operations/current-architecture.md), the accepted ADRs and OpenSpec.

Baseline: main at `2a4c2f79d958ed8babd28dd14ef339ac0fb9c180` (including PR #8). This earlier roadmap was consolidated into the [unified correctness plan](2026-10-19-unified-ace-correctness-and-production-plan.md). It is not a second active backlog.

## Work packages

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

## Original execution approach

Start with truthful baseline and measured retrieval/provider selection. Establish exact current source and incremental/recovery behavior before treating the code path as ready. Verify documentation and temporal memory independently under the data policy, then their combined agent behavior. Run natural-use comparative tasks early for a useful signal, without claiming release acceptance. Complete applicable contracts and operations evidence on the final revision.

The original plan used Qdrant, separate embedding workers and a former model-invoked integration route. These are historical design choices, not instructions to recreate those components. The current retrieval cutover is [the native CBM plan](2026-11-25-native-cbm-cutover-and-legacy-retirement.md); actual gateway and reliability acceptance are in [OpenSpec 013](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [014](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md).
