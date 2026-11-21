# Codebase Memory: native code intelligence for ACE

**Implementation:** PR #316, CBM v0.12.1. Native structural integration is
tested in CI; a real Hermes/Bifröst task and token savings still require
independent, provider-measured acceptance.

See [current runtime ownership and readiness](current-architecture.md). **CBM-only code retrieval is not an active runtime mode yet**: the production candidate is currently composed behind `ACE_ENABLE_EXPERIMENTAL_QDRANT=true`. This document explains the live integration, not a final recommendation to retain Qdrant.

## Architecture

- CBM is the ONLY production code parser and persistent structural graph.
  Native operations: index_repository, get_file_outline, search_graph,
  trace_path, query_graph and detect_changes.
- Qdrant **currently** owns a second code-retrieval index (dense/sparse vectors and publication semantics). CBM **also** provides native semantic/BM25 search; independent matched CBM-only vs CBM+Qdrant testing is required before either declaring Qdrant necessary or removing it.
- An external LSP currently provides exact document-symbol selection ranges and definition validation; its incremental value versus CBM Hybrid LSP remains an open evaluation question.
- ACE owns original-source reads, source policy, SHA-256, exact byte spans,
  Qdrant generations and model-bound context verification.

The homemade RepoMap graph/service/ranker and both ast-grep runtime
providers, the NAPI dependency and the old CLI/NAPI parity tests are
removed. The *ast-grep CLI* executable remains only as the existing
SDLC architectural linter (check:arch and test:arch-rules), not as a
code-intelligence provider. Therefore 123/125 old provider disagreement
is no longer an ACTIVE runtime constraint, not proof of CBM correctness.

## Native data path

1. Before every initial or incremental source-build, ACE waits for CBM to
   index the local root (the current adapter passes `persistence: false`). Index failure blocks publication; no secondary
   parser fallback exists. CBM's process/index persistence cost is a pending benchmark question.
2. CBM get_file_outline provides declaration names and inclusive line spans.
   ACE extracts exact UTF-8 line bytes ONLY from an independently verified
   workspace read; out-of-range native spans fail closed. Declaration-free
   files remain retrievable as bounded raw chunks, not fabricated symbols.
3. Qdrant embeds digest-bound source chunks, persists the published epoch,
   and performs its established hybrid search.
4. CBM semantic/BM25 search can find files outside Qdrant top-K. Native
   trace_path traverses callers/callees, query_graph resolves graph nodes
   to source paths, and detect_changes examines git-based impact. All graph
   results stay candidate hints, not proof of actual source bytes.
5. ACE reopens each selected source, checks independent SHA-256 and the exact
   candidate byte slice, and enforces current worktree+publication fences.

CBM outlines are line-bound (not exact identifier-column AST spans). This
tradeoff changes retrieval chunking and must be checked on real tasks. A
missing graph edge is not evidence that no dependency exists.

## Local host install

Install pinned upstream native executable for the same account running ACE:

~~~bash
npm install --global codebase-memory-mcp@0.12.1
codebase-memory-mcp --version
export ACE_ENABLE_EXPERIMENTAL_QDRANT=true
# Optional export ACE_CBM_COMMAND=/absolute/path/to/CBM-executable
npm run gateway:http
~~~

The native binary is an explicitly allowed third-party package under
ACE's gateway-only audit. This **does not** restore any retired agent tool
transport; CBM is invoked as a local CLI by the ACE runtime. The CI
installation is pinned to upstream v0.12.1 with the release archive
verified by the upstream installer.

CBM local cache and ignored paths are independent from ACE's LLM egress
filters. Review sensitive source in the local index and cache permissions.
CBM_ALLOWED_ROOT restricts CBM to the ACE root; that is not a shared-host
authorization boundary.

## Verification

~~~bash
npm ci
npm run check
npm run lint
npm run verify:pr
ACE_TEST_REAL_CBM=true npx tsx --test \
  test/codebase-memory-graph.contracts.test.ts \
  test/codebase-memory-structural.contracts.test.ts \
  test/cbm-graph-delivery.contracts.test.ts
~~~

The dedicated workflow uses the REAL native CBM binary against the actual
ACE repository. It checks reindex, symbol outline, trace/Cypher/impact,
local-code-index candidate production, and independently verified source
delivery outside Qdrant top-K.

## Required real Hermes acceptance — not yet inferred

Run the repository's existing Harbor/Hermes feedback workflow on a
trusted host with Hermes model credentials and Bifröst + Qdrant + ACE.
Use a nontrivial multi-file coding task with independent verifier, same
task/root SHA, Hermes version, reasoning, tools, cache/compression and
timeouts in native-vs-ACE arms. Record:

- verifier PASS/FAIL, correctness of changes, missing dependencies;
- CBM index freshness and actual graph/trace/impact invocations;
- Bifröst model-bound ACE APPLIED/NO_OP/NOT_USED with request correlation;
- provider-measured input/cached/output tokens, API calls/retries, latency
  and cost, distinguishing unknown fields from measured zero;
- per-successful-task context and model-cost comparison.

A passing CBM tool smoke is NOT a Hermes agent E2E test. Without actual
Hermes OAuth/runtime and provider-bound usage there is no measured token
saving: mark the acceptance BLOCKED, not PASS.
