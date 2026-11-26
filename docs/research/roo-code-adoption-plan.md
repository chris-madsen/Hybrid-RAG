# Roo Code research and adoption hypotheses for ACE — 22 October 2026

**Historical research record.** English editorial reconstruction of the [complete original document](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/research/roo-code-adoption-plan.md). Detailed original observations, examples, experimental proposals and source citations remain at that immutable revision. This is not a new experiment, implementation plan approval or confirmation of vendor claims.

## Scope

The original report read [Roo Code at b867ec9](https://github.com/RooCodeInc/Roo-Code/tree/b867ec9145750d0ae1ff7f02d35406e9bf2a0b16) and ACE at `66410b246de11af0e559abec70bf5dd96fa8be77`. Roo, ACE and Harbor were not executed as part of this research.

The inspected Roo codebase-search branch combined Tree-sitter-derived chunks, embeddings, dense Qdrant search, score limits and directory scope. Its separate ripgrep search was not evidence of sparse/dense fusion in that specific branch. The historical ACE branch instead composed structural candidates, separate vector and sparse search, source verification and LSP. This was an implementation comparison, not a quality verdict. ACE has since retired that vector stack.

## Candidate experiments

| ID | Original priority | Idea and constraint |
| --- | --- | --- |
| R1 | P0 | Hierarchical structural chunking: inspect oversized and undersized nodes, test candidate coverage without inventing exact ranges. |
| R2 | P0/P1 | Optional explicit directory/package scope and focused-file hints; evaluate scoped versus unscoped recall. |
| R3 | P0 | Calibrate confidence, result selection and diagnostics. Do not transfer a dense similarity threshold to unrelated ranking scores. |
| R4 | P1 | Coalesce updates and bound indexing work; only if profiling identifies a bottleneck. |
| R5 | P1/P2 | Language-aware fallback and Markdown segmentation under separate evidence and trust semantics. |
| R6 | P1 | Index progress and multi-workspace status, with isolation. |
| R7 | P2 | Embedding-provider ergonomics and lazy parser loading; historical alternatives, not requirements. |

The old backlog used inconsistent R-number references in places; the identifiers above follow its titled proposal sections. No new experiment or result is inferred from that ambiguity.

## Measurement protocol

Start with actual accepted-task baseline and inspect delivered evidence, candidate sizes, exact source spans, warnings, coverage and latency. Predeclare one hypothesis and keep source, task, model and agent conditions fixed. Use independent relevance labels and holdout tasks; separate raw retrieval quality from agent correctness and provider usage. For indexing experiments measure cold/warm/change-only and edit-storm behavior. Never relax source identity, disclosure policy or truthful coverage to improve a metric.

Do not copy a second vector store, replace the native provider, add a parser or import UI infrastructure without a demonstrated need. Historical comparisons involving old ACE vector and parser mechanisms cannot establish the quality of current native CBM. See [native CBM cutover](../plans/2026-11-25-native-cbm-cutover-and-legacy-retirement.md). Upstream source paths and license notes are retained in the original record.
