> **ARCHIVED / SUPERSEDED BY PR #316 (CBM migration):** This is retained as historical AR08 experiment evidence. The ast-grep CLI/NAPI structural provider, its 125-file comparison script and its parity tests have been removed from production/test tooling. Do **not** run the commands or treat this as current ACE parser-selection guidance. Use [native Codebase Memory operations](./codebase-memory-provider.md) for the active architecture. Historical corpus disagreement is not evidence about Codebase Memory accuracy.

# AR08 — source recall / ast-grep corpus parity (offline evaluation)

**Status:** observation capability implemented; real local-Qdrant/agent task benefit and provider promotion **NOT_RUN / NOT_APPROVED**. Based on current `main` with AR02/AR07 already merged. OpenSpec 014 owns acceptance IDs **REM-018** and **REM-019**.

## Qdrant shortlist vs overfetch

Use the existing real-local-Qdrant [rank probe](../../scripts/qdrant-hybrid-rank-probe.ts). The frozen holdout remains the **one** set of task/candidate labels. The probe obtains each query's dense and sparse embeddings **once**, then makes two SDK search calls with identical strategy, query, collection, workspace, and vectors: the baseline limit and experimental wider limit. No model or Graphiti request is made.

```bash
export ACE_WORKSPACE_ID=<approved-local-workspace>
export ACE_QDRANT_COLLECTION=<published-local-collection>
export ACE_QDRANT_URL=http://127.0.0.1:6333
export ACE_RETRIEVAL_ABLATION_LIMIT=6
export ACE_REPOMAP_STUDY_OVERFETCH_LIMIT=24
npm run probe:retrieval-rank -- <frozen-retrieval-holdout.json> <local-output.json>
```

See the existing retrieval-ablation runbook for pinned local FastEmbed and sparse-embedding variables; do **not** send private data to a public provider. Disable the experiment by unsetting `ACE_REPOMAP_STUDY_OVERFETCH_LIMIT`; ordinary retrieval, default top-K, and model-bound delivery are unchanged.

Each strategy/holdout case records `repoMapShortlistStudy` containing candidate recall at baseline and overfetch, distinct source identities, paths appearing only in the expanded query, and **separately measured** query latencies. Qdrant's fused top-K can change when the prefetch depth changes; therefore this report also lists baseline candidates absent from the deeper query, rather than assuming prefix stability. These are **indexed candidate identities**, not verified/delivered model evidence.

For source-path recall, an independently labeled case may include optional `relevantSourceIdentities: [{ "repoPath": "src/...", "sourceDigest": "<sha256>" }]` within that **same immutable frozen holdout**. Without such labels, source recall and relevant missed paths remain `null` / UNKNOWN. A string path or an outdated digest cannot establish current-source truth. Overfetch must not be promoted merely because the synthetic test discovers a source outside top-K; adoption requires measured quality, latency, current source verification, license/structural parity and G02 owner review. **No automatic overfetch or SDK grouping is enabled.**

## CLI vs NAPI: 125-file real source corpus

The already-existing [historical parity probe at its original source SHA](https://github.com/chris-madsen/Hybrid-RAG/blob/9464c4a4a420634ea39bd4ae57673a51fc88ed8f/scripts/ast-grep-provider-parity.ts) now compares **the same exact source bytes** through the canonical CLI and experimental NAPI in batches, with a deterministic SHA-256 manifest of (relative path, source digest). Missing/extraction-failed files count as non-equivalent, not skipped.

```bash
ACE_AST_GREP_PARITY_MAX_FILES=125 \
ACE_AST_GREP_PARITY_SUMMARY_ONLY=true \
npm run probe:ast-grep-parity -- src
```

Exit status **0** means every compared file has equal current source digest and exact symbol parity. Exit status **2** means an observed mismatch, failure or missing file; this is a valid negative evaluation result, **not** reason to switch to NAPI. The previous corpus audit on a different SHA found 121 mismatches out of 125; the new tool reports the **current** source SHA and actual matching count rather than repeating that number as a live measurement.

The normal provider selection remains `cli`; `napi` and `auto` remain explicitly selected experimental alternatives and are **not adopted** in this phase. Pinning `@ast-grep/{cli,napi}@0.51.0` in the package lock does not prove cross-file symbol parity or completed license provenance; their promotion requires a separately reviewed evidence decision.

## Verification and stop conditions

Deterministic negative/positive oracles:
- `test/ast-grep-parity.contracts.test.ts` — 121/125 mismatch, missing/duplicate path, actual current 125-file corpus
- `test/repo-map-retrieval.contracts.test.ts` — pinned multi-file relevance beyond top-K, digest-bound source labels, no forged model-visible RepoMap hit
- `test/retrieval-quality-evaluation.contracts.test.ts` — invalid source labels fail closed

Use `npm run verify:pr` on the PR head. Real Qdrant paired corpus measurement, full agent/Harbor acceptance, independent G02, and any paid-model egress are **separate gates**, not successes inferred from unit tests. No new Gateway route or worktree mutation is permitted.
