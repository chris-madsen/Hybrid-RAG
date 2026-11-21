---
title: "Fact-only source inventory: fff lexical SDK versus ACE retrieval"
date: 2026-11-19
researcher: "ChatGPT GitHub-connected session; Hermes host Skill invocation NOT_OBSERVED"
repository: "chris-madsen/Mult-agent-AI-Orchestration"
branch: "codex/015-fff-lexical-research"
git_commit: "5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c"
status: "partial"
topics: [lexical-retrieval, native-sdk, source-freshness, benchmarking]
---

# Research: whether existing fff SDK is suitable for ACE lexical candidate discovery

## 1. Question and scope

> “The second task is to evaluate fff as an existing library for fast lexical search. Do not build a replacement, remove Qdrant/LSP prematurely, or introduce an agent-invoked protocol server where ACE can use the native SDK directly.”

**Selected ACE SDLC stage:** **R / Research**, as requested by the owner: evaluate current external implementation and current ACE seams, not implement a new production search provider. Source inspection only; no new TypeSpec, Qdrant/LSP removal, Go/Bifröst gateway change, or LLM tools. An independent experiment on the actual Node SDK is still required before a production decision.

**Source identities, read directly:** ACE `main@5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c`; fff `dmtrKovalenko/fff@ab3002a9bfbef53874dd0b56608e34d281791b4c` (GitHub commit 2026-11-16); OpenCode `anomalyco/opencode@d33b5783338b8b350aafc09f7dc2701eeba52a9a`. These are source inspection pins, *not* a claim that every npm publication shares the fff Git HEAD binary.

**Environment:** GitHub read-only source access and a shell with `rg`/Node but no DNS to github.com or npm; therefore no reproducible side-by-side native fff benchmark has been executed at R stage. Historical upstream published numbers do not prove performance on ACE.

## 2. Executive summary (observed only)

1. **Upstream SDK exists.** fff ships `@ff-labs/fff-node` (`packages/fff-node/src/index.ts`, `finder.ts`, `fff-api.ts`), with native FFI to `fff-c`. Exposes `FileFinder.create({basePath, aiMode})`, `waitForScan`, `fileSearch`, `glob`, `grep` (plain/regex/fuzzy), `multiGrep`, `reindex`, `destroy`. The exact source is MIT licensed (`LICENSE`).
2. **There is a source-of-truth/lifecycle cost.** `fff-api.ts:45-112` exposes in-memory content indexing, mmap warmup and filesystem watching (default), cache budget knobs, optional ignored files and git status; `grep` defaults to maximum file size of 10 MiB, per-file match count of 200 and a result page size of 50 (`fff-api.ts:430-510`). Such candidate results cannot on their own certify ACE's workspace snapshot or exact source digest.
3. **OpenCode usage is narrower than a generic “replaced ripgrep” claim.** OpenCode `packages/core/src/filesystem/fff.node.ts:1-12` dynamically loads the Node SDK; `fff.ts:45-66` exposes a file/directory picker with `fileSearch`, not general `grep`. The standard `packages/core/src/tool/plugin/grep.ts:68-113` and `glob.ts:51-89` use `Ripgrep.Service`. The observed OpenCode code does not support the assertion that all grep/glob operations use fff.
4. **ACE's actual selected retrieval boundary is different.** `src/application/context-transform-service.ts:140-168` asks `ContextProvider.search` for code evidence, then uses `projectContextForDelivery` and `ContextAssembler`. `src/bin/ace-runtime.ts` wires the Qdrant/embedding/structural/LSP pipeline and source-index lifecycle. `src/adapters/qdrant-context-provider.ts` does dense/sparse/hybrid retrieval and optional reranking; it is not a CLI ripgrep wrapper. `src/adapters/local-code-index.ts` builds digest-bound structural code candidates from workspace snapshot and exclusion policy.
5. **Current accepted contracts require independent source verification.** `openspec/changes/003-unified-retrieval/specs/code-discovery/spec.md:9-49` requires Qdrant candidates, lexical fallback, revision invalidation and digest race reporting; lines 62-74 require genuine semantic embeddings/parsed AST spans. `AGENTS.md` directs verification of working-tree bytes over index payload and prohibits new native/runtime frameworks without benchmark evidence.

## 3. Detailed findings (evidence ledger)

| ID | Evidence kind | Directly inspected file:line | Observed behavior | Does not prove |
|---|---|---|---|---|
| R-FFF-01 | EXTERNAL/CODE | `fff@ab3002a:packages/fff-node/README.md:1-90`; `src/index.ts:1-70`; `src/finder.ts:95-163, 203-260, 349-440, 487-523` | Node SDK is a reusable in-process native component with file/glob/grep methods and explicit teardown | That a particular npm artifact/binary works on the ACE runner |
| R-FFF-02 | EXTERNAL/CODE | `fff@ab3002a:packages/fff-node/src/fff-api.ts:45-112, 410-574` | Content index/cache, watcher, configurable ignores, cursor pagination and grep truncation/time controls | Freshness, completeness or full-source fidelity without verification |
| R-FFF-03 | EXTERNAL/CODE/LICENSE | `fff@ab3002a:LICENSE:1-21`; `packages/fff-node/package.json` | MIT license, Node >=18 and `ffi-rs` dependency; platform-specific native binaries | A security audit or runtime stability proof |
| R-OC-01 | EXTERNAL/CODE | `opencode@d33b578:packages/core/src/filesystem/fff.ts:45-66`; `fff.node.ts:1-12` | File/directory finder uses optional fff Node backend | That core grep uses fff |
| R-OC-02 | EXTERNAL/CODE | `opencode@d33b578:packages/core/src/tool/plugin/grep.ts:68-113`; `glob.ts:51-89`; `ripgrep.ts:110-140` | Standard tool grep/glob spawn ripgrep through Effect process adapter | How OpenCode search in other paths/versions works |
| R-ACE-01 | CODE | `ACE@5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c:src/application/context-transform-service.ts:138-168` | One search call through existing context port then provenance-aware evidence projection/assembly | A lexical fff performance improvement |
| R-ACE-02 | CODE | `ACE@5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c:src/adapters/qdrant-context-provider.ts:75-125, 1000-1200` | Dense/sparse/hybrid query embedding + Qdrant, optional reranker and repo map | That fff can replace semantic rankings |
| R-ACE-03 | CODE | `ACE@5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c:src/adapters/local-code-index.ts:179-299` | Uses authoritative workspace snapshot, sensitive path exclusions, digest matching, structural spans | That raw path/grep hits are safe source evidence |
| R-ACE-04 | SPEC | `ACE@5f6d941575b17723bcb8b02b5837a4c2f9c6dc1c:openspec/changes/003-unified-retrieval/specs/code-discovery/spec.md:9-74` | Requires lexical candidate access and source invalidation while retaining Qdrant and true AST/embedding roles | Final approved choice of lexical engine |

## 4. Observed composition

```text
Hermes native Responses
  -> Bifröst -> ACE projection -> context.transform
  -> ContextProvider.search
       -> Qdrant dense/sparse/hybrid candidates
       -> existing structural/RepoMap/LSP integrations
  -> source verification -> context projection/assembly -> additive evidence
```

This diagram is an **observed functional ownership summary**, not a new integration design. Raw fff `fileSearch`/`grep` results are lexical candidate data, not ACE source-verified evidence. No agent-invoked protocol insertion is present in the observed ACE agent-facing architecture.

## 5. External caveats requiring direct experiment

- fff README advertises very large speedups for warm resident indexes; its charts explicitly exclude cold startup/indexing. Published vendor data have different hardware, corpus and shell/SDK comparison overhead; do not copy into ACE benchmark verdict.
- Content indexing, mmap caches and watcher consume resident RAM/fds; native FFI may bring platform-dependent failure modes. Historical fff issues mention native watcher crashes, descriptor leaks and query constraint widening; exact **current** npm candidate and relevant bugfix state must be checked before promotion. Non-ASCII, ignored/sensitive paths, generated files, symlink boundaries, changed/dirty files and giant file limits need explicit negative test cases.
- Fff source `packages/fff-node/package.json` currently reports `0.1.37`, but npm registry publicly presents later stable versions (e.g. `0.11.0`); tag/release/artifact provenance **is not reconciled** by reading HEAD and requires separately pinned npm package digest and native package metadata.

## 6. Test and provider evidence

| Probe | State at R | Evidence | Proves |
|---|---|---|---|
| Direct source review of fff/ACE/OpenCode | DONE | pinned GitHub source paths above | API/ownership facts only |
| ACE-host native fff SDK vs rg cold/warm comparison | **NOT_RUN** | no benchmark log yet | nothing about performance |
| Dirty file watcher, crash/fd/RSS, gitignore sensitive path cases | **NOT_RUN** | none | no lifecycle/freshness guarantee |
| Qdrant/LSP/quality recall comparison | **NOT_RUN** | existing runbook only | no production quality claim |
| Native Hermes + Bifröst provider E2E | **NOT_RUN** | out of scope | no agent token savings claim |
| Host-native Hermes ACE Skill invocation/preflight | **NOT_OBSERVED** | GitHub source reads only | not pipeline certification |

## 7. Questions for subsequent experiment / follow-up stage

1. Which exact npm SDK + native package versions and integrity hashes are available on supported ACE platforms?
2. On frozen small and mid-size fixtures, how do startup+scan, warm literal/regex/filename queries, top-k relevance, RSS, fd count and post-write freshness compare with independently invoked ripgrep?
3. Can every external candidate path/range be validated using ACE's **existing** workspace source/digest and AST rules without a new indexing/locking system?
4. Does an additional resident index actually improve **end-to-end** relevant-candidate retrieval at acceptable resource cost, or only microbenchmarks on repeated shell invocations?

**R-stage verdict:** Source feasibility of a native SDK is OBSERVED; ACE performance/relevance superiority and production eligibility are **UNVERIFIED**. No implementation permission or G02 approval is inferred from this memo.
