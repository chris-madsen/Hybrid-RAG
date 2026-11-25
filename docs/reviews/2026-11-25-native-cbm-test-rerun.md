# Native CBM acceptance test rerun

Date: 2026-11-25

**Rerun result: PASS for the scenarios listed below.**

**Legacy-stack removal verdict remains: BLOCKED FOR LEGACY STACK REMOVAL.**

## Tested revision and environment

- Repository: [Hybrid-RAG](https://github.com/chris-madsen/Hybrid-RAG)
- PR: [#366](https://github.com/chris-madsen/Hybrid-RAG/pull/366)
- Branch: `codex/cbm-native-retrieval-cutover`
- Source commit tested: `1db95a2512c55791d70f87a098996e5326009694`
- Worktree was clean at test start and at completion.
- OS: Ubuntu 24.04.4 LTS, x86_64.
- Runtime: Node.js `22.23.4`, npm `10.9.9`.
- Real provider: `codebase-memory-mcp 0.12.1`.
- Runner resources observed: 8 vCPUs, 31 GiB RAM, 951 GiB free on the filesystem containing `/tmp`.

Dependencies were installed once with `npm ci --ignore-scripts`; the pinned provider was installed with `npm install --global codebase-memory-mcp@0.12.1`.

## Results

| Scenario | Command | Result |
|---|---|---|
| Full manual verification gate | `npm run verify:full` | PASS, exit 0. The default full suite reported 777 passed, 0 failed, 2 provider-gated skips; lint, build, architecture/SDLC checks and the nightly projection property test also passed (3/3). |
| Entire test suite with real CBM enabled | `ACE_TEST_REAL_CBM=true npm test` | PASS, 779 passed, 0 failed, 0 skipped. |
| Real CBM contracts on ACE | `ACE_TEST_REAL_CBM=true npx tsx --test test/codebase-memory-stdio.contracts.test.ts test/codebase-memory-graph.contracts.test.ts test/codebase-memory-structural.contracts.test.ts test/cbm-graph-delivery.contracts.test.ts` | PASS, 16 passed, 0 failed, 0 skipped. This exercised real indexing/retrieval and the frozen RepoBench mapping scenario. The expected negative dirty-checkout diagnostic was emitted by its passing test. |
| Native CBM Context RPC projection | `ACE_REAL_PROJECTION_NATIVE_CBM=true npm run test:real-projection` | PASS, `projection-pass`; provider process inventory was `codebase-memory-mcp` and `node`; `providerWireCertified` was `false`. |
| Source mutation E2E | `ACE_REAL_PROJECTION_NATIVE_CBM=true ACE_REAL_PROJECTION_NATIVE_MUTATIONS=true node scripts/real-projection-e2e.mjs` | PASS, `native-mutations-pass` for modify, rename and delete. `providerWireCertified` was `false`. |
| Native CBM startup outage | `ACE_REAL_PROJECTION_NATIVE_CBM=true ACE_REAL_PROJECTION_OUTAGE=true node scripts/real-projection-e2e.mjs` | PASS, expected `projection-honest-block` with `NOT_READY`. Assertions confirmed there was no projection receipt or response body. |

## Rerun note

All requested test suites passed on the pinned source revision after installing the required Codebase Memory executable. No product source was changed to obtain these results.

## Evidence limits and remaining acceptance gaps

- The tested source revision is `1db95a2512c55791d70f87a098996e5326009694`. This report is a later documentation-only update; these runs do not claim to have tested its future commit SHA.
- Projection E2E verifies ACE's internal context projection. It does not certify physical provider egress, invoke a live LLM, or establish Hermes agent-level acceptance.
- Exact LSP selection/definition coordinates, the broader alias/import/Unicode/language matrix, scale/performance measurements, extended worktree races, real-provider mid-run restart/recovery/cancellation, and non-local deployment topologies remain open or unverified as recorded in the [acceptance report](2026-11-24-native-cbm-retrieval-acceptance.md).
- No production-readiness or legacy-stack-removal claim changed. Do not remove legacy components, close Issues #363/#364, or merge PR #366 based solely on this rerun.

## Captured local logs

Console logs were captured outside the repository on the test runner under `/tmp/Hybrid-RAG-*.log`; they were not committed. Their SHA-256 digests are:

| Log | SHA-256 |
|---|---|
| `Hybrid-RAG-verify-full.log` | `4afcfc1be39e299af09d4550a46bcbcc8c772b49c644a294d4c1891d12a9acdd` |
| `Hybrid-RAG-full-real-cbm-test.log` | `38ae72bf8dd6bee55ca361e5fff00dd29b42ee5302aaa75bb69201a3745c8877` |
| `Hybrid-RAG-real-cbm.log` | `5914f655cbb5ac0403867e9205f0a4c3572a5369a6c5ce2d8e15bb3e99e3519f` |
| `Hybrid-RAG-native-projection.log` | `079a03a8be49f05662ea21b77439ab4c93eb3c139fc78854bf47b699da43cab5` |
| `Hybrid-RAG-native-mutations.log` | `bd2a69cf2c579cfce28b955a363f87e6b414d9fae922c9b20d3fde55e5d3aee2` |
| `Hybrid-RAG-native-outage.log` | `371329aeea69f557250e291a8b915bcddf4c471d92bb1e15016743209cc3d299` |
