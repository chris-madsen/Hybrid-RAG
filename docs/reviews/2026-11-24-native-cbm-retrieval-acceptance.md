# Native CBM Retrieval Acceptance

Date: 2026-11-24

**Verdict: BLOCKED FOR LEGACY STACK REMOVAL**

## Scope and revisions

- Repository: [Hybrid-RAG](https://github.com/chris-madsen/Hybrid-RAG)
- PR: [#366](https://github.com/chris-madsen/Hybrid-RAG/pull/366)
- Tested PR code revision: `7fb0efc5cf5ed7f43240d4b648aee91a44f1fa0d` on `codex/cbm-native-retrieval-cutover`.
- Local implementation checkout used for local-only commands: `dd235eecbc2d643c01251b47341a13f76bf261d2`. The corrected PR revision was subsequently checked by GitHub Actions.
- Runtime: Node.js `22.23.4`, npm `10.9.9`; upstream `codebase-memory-mcp 0.12.1`.
- Local environment: Debian 13, x86_64 container, approximately 9.7 GiB RAM and 20 GiB workspace disk. The container denies Unix-domain socket creation with `EPERM`; CPU model/count was not captured.
- GitHub Actions: Ubuntu runner, Node.js `22.23.4`, CBM `0.12.1`.

## Implemented and verified

- Native mode now reports only its active provider identities. Disabled Qdrant, embedding, sparse-embedding, reranker, and external LSP providers are no longer presented as active in native-mode startup logs.
- Internal CBM calls emit safe provider-trace events with operation, status, pinned version, duration, and optional ContextBundle request ID. Query text, tool arguments, and provider results are not written to the trace.
- Provider-trace receipts recognize native code retrieval as `codebase_memory` plus exact source verification.
- Native projection E2E asserts process descendants, active-provider configuration, and traces; it rejects legacy retrieval processes and provider events.

## Results

| Scenario | Result | Evidence |
|---|---|---|
| Local `npm run verify:pr` | PASS | Completed successfully on the local implementation checkout. |
| Local `npm run build` | PASS | Compiled provenance recorded a clean source tree at local SHA `dd235eec`; Node and build Node were both `v22.23.4`. |
| Focused CBM and trace contracts | PASS | 19 passed, 0 failed, 2 skipped locally; skips are real-provider cases unless explicitly enabled. |
| Nightly Gateway projection property tests | PASS | 3 passed, 0 failed locally. |
| Broad local `test/*.test.ts` regression | BLOCKED | 779 tests: 770 passed, 7 failed, 2 skipped. Six failures spawn `tsx` and hit Unix-socket `EPERM`; one real same-name CBM test returned `NOT_READY` because the CBM daemon could not start. |
| Local real-CBM contract suite | BLOCKED | 14 passed, 2 failed. ACE indexing and frozen RepoBench indexing returned `NOT_READY` after CBM daemon socket creation failed with `EPERM`. |
| Local native outage projection | PASS | `ACE_REAL_PROJECTION_NATIVE_CBM=true ACE_REAL_PROJECTION_OUTAGE=true node scripts/real-projection-e2e.mjs` returned `BLOCK / NOT_READY`, with no projection receipt or body. |
| GitHub native CBM integration on tested PR revision | PASS | Real CBM v0.12.1 indexed ACE and exercised source-bound retrieval plus the frozen RepoBench mapping test; all 16 contract tests passed. |
| GitHub compiled native Context RPC projection | PASS | Real CBM projection returned `PREPARED`; process descendants were `codebase-memory-mcp` and `node`; provider-wire certification remained false. |
| GitHub source modification, rename, and deletion E2E | PASS | Updated bytes were projected, the renamed path replaced the old citation, and deletion blocked stale/empty context. |
| GitHub native startup outage E2E | PASS | The expected `NOT_READY` block produced no projection receipt or sendable body. |
| GitHub focused TypeScript/contracts, full ACE regression, CodeQL, security, Bifröst Gateway, reviewable-docs and documentation-link checks | PASS | All required checks inspected on revision `7fb0efc5cf5ed7f43240d4b648aee91a44f1fa0d` completed successfully. |
| Live LLM provider request or physical send | NOT RUN | No LLM provider was called; the projection E2E reports `providerWireCertified: false`. |

The local CBM limitation is environmental. GitHub Actions successfully ran the real provider path on the tested revision, so native indexing and the required core projection/mutation/outage scenarios have positive CI evidence.

## Issue #364: external LSP requirement

Inspected the exact upstream v0.12.1 source and tool schema. CBM's embedded Hybrid LSP performs type-informed graph resolution; it is a native graph capability rather than a full language-server protocol surface. `get_file_outline` returns only the columns `name`, `label`, `lines`, and `qn`, with line ranges such as `start-end`. It does not return identifier `selectionRange`, UTF-8 byte columns, or an exact definition target range.

References: [v0.12.1 tool schema](https://github.com/DeusData/codebase-memory-mcp/blob/v0.12.1/src/%6d%63%70/%6d%63%70.c#L670-L681), [v0.12.1 outline response encoder](https://github.com/DeusData/codebase-memory-mcp/blob/v0.12.1/src/%6d%63%70/%6d%63%70.c#L13806-L13864), and [v0.12.1 Hybrid LSP description](https://github.com/DeusData/codebase-memory-mcp/blob/v0.12.1/README.md#hybrid-lsp).

ACE's existing independent identifier contract relies on exact language-server selection and definition coordinates. A line-only graph outline is not equivalent evidence. Therefore #364 remains open and the external LSP removal gate is not satisfied.

## Remaining acceptance gaps

- Quality/performance measurements were not collected: no cold-index time, warm-retrieval latency, refresh latency, peak RAM, CPU, disk footprint, or retrieval-failure rate. CI proves functional use, not production-scale performance.
- Native worktree coverage beyond modify/rename/delete was not run: new and untracked files, staged/unstaged transitions, Git revision changes, concurrent edits, and parallel queries during reindexing remain unverified.
- Existing fixture contracts cover provider death, timeout, and reindex behavior, but real CBM mid-run termination, restart/recovery, runtime restart, cancellation after an index mutation begins, and stale-context checks after real recovery were not independently exercised.
- The native runtime path explicitly rejects the host-worktree-helper topology. Container/k3s and other deployment topologies remain unsupported or unverified.
- Exact identifier selection/definition tests across aliases, imports/re-exports, Unicode byte boundaries, supported non-TypeScript languages, and changed-source races were not completed against the real CBM binary.

## Removal decision

No legacy component is approved for deletion by this acceptance run. Native mode demonstrated that its own projection does not start Qdrant, embedding workers, reranker, or external LSP, but the default legacy composition and its repository consumers remain present. #364 is unresolved, and scale, recovery, and broader worktree evidence is incomplete.

Do not remove the legacy stack, close #363/#364, merge PR #366, or treat this run as production readiness. The separate Hermes-versus-ACE Harbor trial remains outside this acceptance.

**Conclusion: BLOCKED FOR LEGACY STACK REMOVAL.**
