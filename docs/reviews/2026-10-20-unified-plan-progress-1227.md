# ACE extended unified-plan progress review — 20 October 2026

**Historical record, not current implementation instructions.** English editorial reconstruction of the [complete original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/reviews/2026-10-20-unified-plan-progress-1227.md). The original evidence, detailed task lists and source references remain preserved at that immutable revision. No fresh provider tests or acceptance are asserted here. For current authority see [runtime architecture](../operations/current-architecture.md), the accepted ADRs and OpenSpec.

Historical main baseline `38668d3d08c38bae532dccdedaaa735a4a2d9e77`, implementation `7cfe49d24a8c288f4fc97a251bc01623d1f68d70`. Expanded after the 13:25 EEST request. Static review using source, patches, tasks, ledger and retained artifacts; not all files were read in full, and local ignored artifacts, full benchmark corpus and full infrastructure audit were not inspected. No new tests or providers were run.

## Observations

The original review found substantial implementation progress and bounded real scale/crash sub-gates, but not full acceptance. It reported successful PR #82 head CI run 39393955567, not a separately tested main merge commit. The W00 receipt was reported by the ledger, not directly reread. Seven checked and seven open DBC entries were documentary state, not percentage completion.

Historical measurements at `c79afd8`:

| Corpus | Cold | Warm | Change-only |
| --- | ---: | ---: | ---: |
| 1k | 102625 ms | 8402 ms | 10183 ms |
| 10k | 983239 ms | 24814 ms | 33162 ms |

The cited 10k report recorded 9997 reused vectors and zero coverage failures; one host and the retired provider stack. The crash artifact at `07b143b` recorded eight passing checks with distinct roots and a kill before publication. Shared-collection GC was disabled, so it did not prove GC safety or mid-upsert recovery. None of these measurements establishes native CBM performance.

## Findings

| ID | Severity | Observation / limitation |
| --- | --- | --- |
| R1/R2 | P1 | Lease lifetime and fail-closed GC: same-owner shared-root race and ambiguous I/O errors; static inference. |
| R3 | P1 | Harbor cost and design identity: arbitrary scope label, null costs and unchecked source verdict; acceptance gap. |
| R4 | P1/P2 | Different depth of release validation; stale or forged verdict risk with otherwise valid inputs. |
| R5 | P2 | DBC raw artifact and JSON-only loader incompatibility. |
| M1 | P1 | Archive-to-intent crash gap; test exact window. |
| M2 | P1 | Delete/reconcile without episode-level fencing; static resurrection risk. |
| M3 | P1/P2 | Error-bearing typed Graphiti response could appear as successful search or absence. |
| M4 | P2 | Domain decision history not connected to actual Graphiti result; top-50 local filtering did not prove complete historical recall. |

The earlier R6 interpretation was partially withdrawn: the observed snapshot_identity was a retrieval/provider fingerprint, not a content key. A remaining test/diagnostic gap concerned the actual index key and exact changed digest, not a demonstrated stale answer.

## Recommended sequence at that baseline

Reproduce the lease and memory risks, fix acceptance input semantics, run real provider comparisons and held-out retrieval tests, verify combined temporal/document behavior, then collect release-specific evidence. The report did not justify either a numerical completion percentage or a claim of production readiness. See [semantic findings](2026-10-20-semantic-bugs-review.md) and [the historical unified plan](../plans/2026-10-19-unified-ace-correctness-and-production-plan.md). Do not carry historical findings forward as unfixed without checking current source.
