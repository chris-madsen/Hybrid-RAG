# ACE lexical fast-path candidate: fff native SDK evaluation (2026-11-19)

**Status:** BENCHMARK_OBSERVED / PRODUCTION_ADOPTION_NOT_APPROVED

**ACE SDLC:** R-stage research in stacked PR #286 (`docs/research/2026-11-19-fff-lexical-sdk-ace-source-inventory.md`), this bounded T1 benchmark in dependent PR #287. These are not full R→S→A→P→X→I→V production integration and do not assert actual Hermes-host Skill invocation. ACE source pinned to `5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c`; inspected fff source `ab3002a9bfbef53874dd0b56608e34d281791b4c`; inspected OpenCode `d33b5783338b8b350aafc09f7dc2701eeba52a9a`. **Actual benchmark artifact:** [GitHub Actions run 44521488727](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/actions/runs/44521488727), runner checkout `0c8cae763f203d9f4a6b52b068a4bed6a90c57a0`.

## Why this investigation

Owner request: evaluate an **existing** `fff` lexical file/content search SDK, with no custom replacement, no Qdrant/LSP retirement and no model-invoked tool server. The benchmark is an isolated experiment, **not** a production ACE dependency or a contract change.

## Actual implementation identity

- Tested **Node.js `v22.23.5` / Linux x64**, `@ff-labs/fff-node@0.11.0`, native binary `@ff-labs/fff-bin-linux-x64-gnu@0.11.0`, `ffi-rs@1.3.7`.
- Package-registry integrity reported by npm: `sha512-/7fX4kgy28pFZghxuXCAcIPQKb2+VqVirpFcDqMKgrFLTz56tVzHjOkFSdKGq7fa6wRb6eS5Dg9SaX1qyCcKxQ==`.
- Reference executable: **ripgrep 15.1.0** installed in runner from Ubuntu apt.
- The SDK/native binary are installed in `$RUNNER_TEMP/fff-sdk`, outside ACE `package.json` and `package-lock.json`. The workflow contains a narrowly documented exception to Zizmor's ad-hoc-install guidance for this one disposable low-privilege research job; no credential or production source is exposed to the package. This exception must not be copied to a production integration.
- The fff **Git HEAD source** and the **published npm artifact** are separately identified; the benchmark has not verified a source-to-release binary digest mapping.

## Measured controlled workload

`scripts/research/fff-lexical-evaluation.mjs` creates 3,000 deterministic TypeScript files in an isolated temporary directory. Both engines search **the same files** for identical case-sensitive literal patterns. Fff uses one resident `FileFinder`, `disableWatch:true`, `disableGit:true`, and content indexing enabled; ripgrep is launched as a new CLI process per query (normal baseline for repeated standalone shell searches). 25 timing repetitions per query, after an untimed warm-up of both methods. Both return normalized `file:line` pairs; the benchmark checks the complete result set for equality and does not infer comparative speed if results differ.

| Exact literal case | Hits in each engine | Equal result set | rg p50 / p95 | fff p50 / p95 | p50 improvement |
|---|---:|---|---:|---:|---:|
| One rare symbol (`SEARCH_UNIQUE_00073`) | 1 | YES | 10.028 / 11.443 ms | 3.348 / 4.449 ms | **3.00×** |
| Common symbol (`SEARCH_COMMON`) | 31 | YES | 10.648 / 14.200 ms | 4.193 / 5.720 ms | **2.54×** |
| Unmatched literal (`SEARCH_ABSENT_XXX`) | 0 | YES | 10.244 / 10.940 ms | 3.257 / 3.364 ms | **3.15×** |

Cold native `FileFinder.create` **5.518 ms** + `waitForScan` **50.093 ms**, exclusive of generating the fixture (76 ms). This is a **single sample** of cold setup, not p50/p95 across many cold restarts. Typo-tolerant file search (`componet-00073`) returned `part-000/component-00073.ts` as the first hit, single observed call **2.402 ms** (not a cross-engine comparable fuzzy benchmark).

Measured **process-wide** RSS: before FFF 65,052,672 B; after indexing 70,107,136 B; after repeated queries 74,887,168 B. Difference from pre-index to post-index ~5.05 MB; pre-index to after queries ~9.83 MB. RSS includes process/runtime + native allocator effects: **do not** interpret as a reusable per-3k-files model. Linux `/proc/self/fd` returned 24 open descriptors at each observed instant in this `disableWatch:true` run; this does not test continuous native watching.

## What the result means / does not mean

**Observed:** A real `@ff-labs/fff-node@0.11.0` binary loaded on Node 22/Linux x64 and executed correct exact lexical grep on the synthetic corpus; warm resident searches were around 2.5–3.2× faster in this particular apples-to-apples result-set check than one fresh `rg` process per query. No extra LLM calls. The Node SDK provides fileSearch, glob, plain/regex/fuzzy grep and multiGrep without requiring a model-invoked tool server.

**NOT measured:** 10k–500k file repositories, cold index distribution, cache/watcher long-loop overhead, concurrency, restart and edit freshness, sensitive paths, symlinks, non-ASCII filenames, large files, exact regex compatibility, pagination edge cases, repository-true source digest checking, end-to-end ACE Qdrant/LSP retrieval quality, semantic Recall@k, model tokens or accepted-task costs. The 3000-file fixture is small (~0.6 MB rough generated text) and synthetic. Fff's published warm Chromium numbers and broad speed claims are **vendor evidence**, not validated in this trial. There are historical issues about native crashes/fd pressure and scope/constraint drift; these should be addressed in any future implementation evaluation, not ignored.

## ACE integration seam and constraints (recommendation; NOT implemented)

**Recommendation: allow a scoped next-stage proof-of-concept, not production adoption.**

- Prefer the already published `@ff-labs/fff-node` SDK over custom lexical algorithm or process/protocol server. Use the existing TS/Effect application/provider boundaries to propose **lexical candidate discovery only**, preserving Qdrant dense/sparse/hybrid search, repo map, ast-grep and LSP roles.
- Keep the library instance resident only for an explicitly scoped workspace and manage its lifecycle via existing Effect scope/resources, not a new singleton/stateful service. Any native crash must not corrupt ACE authority or falsely certify source bytes.
- Convert raw fff file/line hits into ACE candidate *hints*, then **re-read authoritative working-tree bytes** using existing trusted `WorkspacePort`; check workspace ID, sensitive path policy, exact digest/revision and line/range, and let existing structural/LSP verification decide semantic/definition claims. Do not trust an indexed line preview as source evidence.
- If watcher or cache cannot prove current source, fallback to existing verified provider path / label stale; never silently treat stale indexed text as current. Avoid inventing a second durable index/CAS/rebuild framework or introducing a compulsory heavyweight FFF index.
- Before selecting a production candidate, run a separate G02-reviewed T2 architecture/phase study (if adding a new production provider) with two controlled arms on frozen multi-repo holdout: current ACE vs ACE+FFF, *identical* Qdrant/LSP pipelines, measuring p50/p95, cold/warm RSS/fds, accuracy/Recall@5/MRR, edit freshness/digest races, source delivery bytes and **end-to-end** task tokens/cost. Use the existing `docs/plans/retrieval-quality-ablation-runbook.md` and contract `openspec/changes/003-unified-retrieval/specs/code-discovery/spec.md`; do not add a new competing OpenSpec tracker merely for evaluation.

## Actual pipeline and quality evidence

| Gate | Observed result | Limit |
|---|---|---|
| Source research R | PR #286 / source pins above | No production code or upstream binary verification |
| `npm run sdlc:preflight -- --tier T1 --stage research --json` | **EXECUTED; verdict REVIEW_REQUIRED**, no unexpected command failure | structural diagnostic, not G02 approval |
| `npm run worktree:preflight -- --task-id 015-fff-lexical-benchmark --json` | **EXECUTED; ok=true in CI checkout** | does not mean `worktree:start` ran |
| Native SDK / ripgrep experiment | **PASS for synthetic equivalent-result queries**, run 44521488727 | no real ACE source/provider E2E |
| BUILD / test reproducibility | Workflow, script and exact native package versions retained; runner run link | only one Linux runner |
| ARCH | Retained production retrieval untouched; benchmark only | no G02 design or implementation approval |
| SEC | Read-only GitHub checkout; empty credentials; disposable synthetic files; production dependencies unchanged; Security workflow must be evaluated at final SHA | temporary package installation under explicit narrow waiver |
| PLAN | No production candidate selection until quality/resource/source-safety comparisons | unrun longer-loop and native watch stress are explicitly NOT_RUN |

**Release/adoption decision:** **NOT APPROVED**. The task requested an evaluation, not a silent change to ACE search strategy. No production source/library registration changed.
