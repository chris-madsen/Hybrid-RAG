# ACE unified production gap review — 20 October 2026

**Historical record, not current implementation instructions.** English editorial reconstruction of the [complete original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/plans/2026-10-20-unified-ace-production-gap-review.md). The original evidence, detailed task lists and source references remain preserved at that immutable revision. No fresh provider tests or acceptance are asserted here. For current authority see [runtime architecture](../operations/current-architecture.md), the accepted ADRs and OpenSpec.

Historical main baseline `560c49b043ef73b6ee08ceaf55b170ff780e4718`. Static review, not a fresh provider run. The review identified acceptance and runtime gaps against the then-current architecture.

| Finding | Severity | Historical observation and requested evidence |
| --- | --- | --- |
| F-01 | P1 | A typed Graphiti error could be interpreted as absence. Reject error-bearing results before decoding evidence; test deletion is not admitted on uncertainty. |
| F-02 | P1 | Concurrent deletion and reconciliation could recreate derived data. Static race hypothesis; require deterministic interleaving and real lifecycle evidence. |
| F-03 | P1 | Crash after archive persistence but before projection intent could strand an episode. Verify restart reconciliation without manual reimport. |
| F-04 | P1 | Lease acquisition could race recursive directory cleanup. Static race hypothesis; reproduce before claiming a provider incident. |
| F-05 | P1 | Arbitrary cost-scope text could satisfy complete-cost inference. Validate measured numeric inputs and exact report/run bindings. |
| F-06 | P1 | Release input validation depth varied by evidence family. Require typed semantics and provenance, not only embedded verdicts. |
| F-07 | P2 | Arbitrary-byte DBC artifacts were loaded as JSON. Hash bytes separately from structured evidence parsing. |
| F-08 | P1 | Domain as-of history did not establish actual Graphiti memory-answer behavior. Require integrated temporal recall tests. |
| F-09 | P1 | Routing did not reliably recognize Russian intent. Test equivalent multilingual queries; this is a runtime input concern, not permission for mixed-language documentation. |
| F-10 | P1 | Embedding startup failures had inconsistent fatal/not-ready behavior. Define truthful failure states. |
| F-11 | P2 | Release approval and evidence identity required stronger binding. |
| F-12 | P2 | Stale prose and ambiguous requirements could cause redundant implementation. |

The original report distinguishes directly observed source paths from inferred concurrency risks (especially F-02/F-04). It did not establish real incidents or current unresolved defects. Its priority was corrective work and real evidence, not new reporting infrastructure. Old Qdrant and worker findings refer to retired components; other findings require verification against present source before reopening.

Current release gates remain scope-specific; see [fitness contracts](../architecture/07-architecture-fitness-contracts.md) and [current architecture](../operations/current-architecture.md).
