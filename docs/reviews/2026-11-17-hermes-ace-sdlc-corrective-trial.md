---
title: "Hermes ACE staged SDLC corrective trial"
date: 2026-11-17
status: "PARTIALLY_VERIFIED"
repository: "chris-madsen/Mult-agent-AI-Orchestration"
plan: "docs/plans/2026-11-16-hermes-ace-sdlc-corrective-trial.md"
plan_ref: "PR #264, codex/ace-sdlc-pipeline-phase-plans-g11-2026-11-16@f6107907b1152b3d3d73a13aa6076105664fe240"
main_ref: "origin/main@e99e81a1a758fbf6be96599dc09c4440fd51f833"
---

# Hermes ACE staged SDLC corrective trial

## Verdict

**PARTIALLY_VERIFIED.** The deterministic phase-checker, negative fixtures, OpenSpec structure, stacked-PR ancestry, and disposable STALE/squash/restack experiment were observed. The live project Skill invocation was **NOT_OBSERVED**. G02 is still `REVIEW_REQUIRED`; C02, C04, and C07 remain blocked; no G11 Apply, product implementation, ACE provider/model egress, real-agent E2E, paid Harbor run, or private-source egress occurred.

This report records process/evidence findings only. It does not mark any G11 acceptance ID complete or promote any production, benchmark, or owner-approval claim. No ACE/Bifröst provider request, additional Hermes model-backed session, real-agent E2E, or Harbor run was made.

## 1. Identity, synchronization, and scope

- Local date/time zone at report creation: 2026-11-17 EET.
- `origin/main` and local `main`: `e99e81a1a758fbf6be96599dc09c4440fd51f833`; remote `main` was unchanged during this trial.
- User checkout `/media/ilja/DATA/soft/consillium/harness`: branch `docs/extend-ace-sdlc-security-gates-2026-11-15`, HEAD `b637e7ba57d92390898b9c386aab342727523236`; its tracked tree equals `origin/main`. The unrelated untracked `docs/docs/current-prompt` and `log.log` remain untouched. The local branch is ahead of its old remote feature branch by six commits because of the prior local main sync; no push was made to that legacy branch.
- Correct plan checkout: `/media/ilja/DATA/soft/consillium/ace-sdlc-pipeline-phase-plans-g11-2026-11-16`, branch `codex/ace-sdlc-pipeline-phase-plans-g11-2026-11-16`, clean at `f6107907b1152b3d3d73a13aa6076105664fe240`, equal to live PR #264 HEAD.
- PR #259 HEAD `bf9907facabeb50c755cf94e272b4966874e24fb` is an ancestor of #264. PR #265 was squash-merged into the #264 branch at `e55c5d68a421708a16a282edfa088a4e0aa7b346`; #264 then advanced to `f6107907b1152b3d3d73a13aa6076105664fe240`.
- `npm run worktree:audit` observed 17 registered worktrees. The #264 and clean-main worktrees were clean; several unrelated active/legacy worktrees were dirty or stale and were left untouched.
- The governing plan is planning-only and explicitly prohibits G11 product implementation and external provider/agent/Harbor egress. No ACE provider/model/agent or Harbor call was made, and no `openspec-apply-change` was run.

### Live stacked PR state and stage-diff audit

| PR | State / base → head | Exact head | Three-dot stage diff | Observed checks |
|---|---|---|---|---|
| #259 | OPEN Draft / `main` → `feat/ace-staged-sdlc-skills-handoff-2026-11-16` | `bf9907facabeb50c755cf94e272b4966874e24fb` | Initial skill pipeline | 8 pass, 1 fail (`CodeQL JavaScript/TypeScript`), 6 skipped |
| #260 | OPEN Draft / #259 branch → `codex/ace-sdlc-pipeline-integration-2026-11-16` | `e3533e75b1abfb31f0193390d3d320e0012eab52` | Source research | 5 pass, 0 fail, 6 skipped; focused TypeScript/contracts skipped |
| #261 | OPEN Draft / #260 branch → `codex/ace-sdlc-pipeline-architecture-2026-11-16` | `83c4b134302786e2f5ad65a925722aad5b0a7b4b` | `design.md` only | 7 pass, 0 fail, 5 skipped |
| #262 | OPEN Draft / #261 branch → `codex/ace-sdlc-pipeline-plan-g11-2026-11-16` | `435b79245315ce232fbbe7a432145ff053a725f2` | `tasks.md` only | 7 pass, 0 fail, 5 skipped |
| #263 | OPEN Draft / #262 branch → `codex/ace-phase-dependency-validation-2026-11-16` | `ac2224954360c8858ff74fb12ecb678fc025c28d` | `scripts/ace-phase-plan-check.mjs`, `test/ace-sdlc-pipeline.test.mjs` | 8 pass, 1 fail (`CodeQL JavaScript/TypeScript`), 6 skipped |
| #264 | OPEN Draft / #263 branch → `codex/ace-sdlc-pipeline-phase-plans-g11-2026-11-16` | `f6107907b1152b3d3d73a13aa6076105664fe240` | C01–C10 phase briefs, task links/cross-phase handoff, and the corrective-trial plan added by merged #265 | 9 pass, 1 fail (`CodeQL JavaScript/TypeScript`), 6 skipped |

At these PR heads, no required status checks were configured. The observed `CodeQL` check passed where present; the distinct QG6 `CodeQL JavaScript/TypeScript` result failed at #259, #263, and #264. Bifröst plugin/connector, real Qdrant, and real non-TS LSP jobs were skipped on the planning PRs. PR #259–#264 were not merged or closed.

H-03 path and blob checks confirmed that #261 changes only `design.md`; #262 changes only `tasks.md`; #263 changes only the checker and its tests; and #264 changes its phase files, task links/handoff, and the corrective plan from #265. The design Git blob is identical at #261–#264 (`23f6edfc3110c093bbb777d59629c4ea19ac2984`); the checker and test blobs from #263 remain unchanged in #264 (`4582746e0895165e6ffe931b6822e23446ce650a`, `d422afa63401e71f49b33a4aba8adc468cfd39e7`). The #262→#264 `tasks.md` delta is the ten phase links plus the cross-slice compatibility/handoff section; it does not revise C08–C10 ownership or the DAG.

## 2. S0 — host and worktree preflight

- Hermes CLI: `/home/ilja/.local/bin/hermes`, `v2026.9.24`, upstream `e3dd27ee`; Node `v24.15.0`; npm `11.12.1`.
- Active agent/TUI process root observed at `/media/ilja/DATA/soft/consillium/harness`, not at the #259-descendant phase worktree. The #264 project worktree itself was clean and its worktree preflight returned `action: reuse`.
- `hermes skills list --help` and `hermes skills trust --help` were checked. `hermes skills list` from the #264 checkout listed profile-installed skills but did not expose the ACE project-local Skills. `skills_list` in the active session likewise did not contain them.
- No project trust was added or modified. The command that changes project trust was not run without owner approval.
- `npm run sdlc:preflight -- --tier T2 --stage research --json` at #264: exit 0, verdict `REVIEW_REQUIRED`, `G02=REVIEW_REQUIRED`.
- `npm run worktree:preflight -- --task-id ace-sdlc-pipeline-phase-plans-g11-2026-11-16 --json`: `ok:true`, `action:reuse`, clean worktree, live PR #264.
- Worktree preflight from dirty `/harness` refused sibling-worktree creation with `CURRENT_WORKTREE_NOT_CLEAN`; no creation was attempted there and no files were changed. Subsequent isolated worktrees were started from the clean `origin/main` worktree at e99.

## 3. S1 — Skills runtime smoke

The six requested project Skills were read manually in the correct #264 checkout, but this is **not** recorded as invocation:

| Project Skill | Discovery in active Hermes index | Invocation | Evidence status |
|---|---|---|---|
| `ace-stage-handoff` | Not observed | Not observed | MANUAL_READ |
| `ace-architecture-design` | Not observed | Not observed | MANUAL_READ |
| `ace-to-tickets` | Not observed | Not observed | MANUAL_READ |
| `ace-phase-plan` | Not observed | Not observed | MANUAL_READ |
| `domain-modeling` | Not observed | Not observed | MANUAL_READ |
| `codebase-design` | Not observed | Not observed | MANUAL_READ |

**HTEST-01 is PARTIAL; HTEST-02 is NOT_OBSERVED.** The running TUI root was the separate `/harness` checkout, not the #259-descendant worktree; the CLI listing from the correct worktree still showed no ACE project Skills. The global/project trust state was not changed and no second model-backed Hermes session was launched, in accordance with the plan's trust/egress limits. No live handoff trace exists.

Operator continuation, only after the owner explicitly approves persistent project trust and a model-backed Skills smoke:

```bash
hermes skills trust /media/ilja/DATA/soft/consillium/ace-sdlc-pipeline-phase-plans-g11-2026-11-16
hermes --in /media/ilja/DATA/soft/consillium/ace-sdlc-pipeline-phase-plans-g11-2026-11-16 chat
```

In that fresh session, verify the six names in the active project skill list, explicitly invoke `ace-stage-handoff` for one bounded planning handoff, and retain the session/tool trace. Keep the task no-egress and do not run Apply. Do not claim that reading a Skill file is equivalent.

## 4. S2 — phase-plan dry run and S3 — negative fixtures

All phase checks ran separately on source HEAD `f6107907b1152b3d3d73a13aa6076105664fe240`:

| Phase | Command exit | Verdict | Structural/freshness checks |
|---|---:|---|---|
| C01 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C02 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C03 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C04 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C05 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C06 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C07 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C08 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C09 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |
| C10 | 0 | `READY_FOR_PHASE_REVIEW` | 6/6 PASS |

The ten phase files match current input fingerprints: design Git blob `23f6edfc3110c093bbb777d59629c4ea19ac2984`; sorted specs SHA-256 `cf79265f09c2ba8d0bd6354c0473b394534a7ce4993d04d97955c3b9fb2957b1`. Every checker response explicitly returns `g02=NOT_VERIFIED_BY_THIS_CHECK`, `ownerDecision=NOT_VERIFIED_BY_THIS_CHECK`, and `realProvider=NOT_RUN_BY_THIS_CHECK`. These are structural/freshness results only.

Observed deterministic commands at the same source SHA:

| Command | Result |
|---|---|
| `npm run test:ace-sdlc-pipeline` | exit 0, 21/21 passed |
| `npm run test:matt-pocock-skill-vendor` | exit 0, 6/6 passed |
| `npm run test:sdd-prepare` | exit 0, 14/14 passed |
| `./node_modules/.bin/tsx --test test/feedback-loop-experiment.contracts.test.ts` | exit 0, 33/33 passed |
| `npm exec --yes --package=@fission-ai/openspec@1.17.0 -- openspec --version` | `1.17.0` |
| `npm exec --yes --package=@fission-ai/openspec@1.17.0 -- openspec validate --all --strict --no-interactive --report full` | exit 0, 11 passed, 0 failed |
| `npm run check:sdd-prepare -- --change 013-gateway-g11-production-acceptance --tier T2 --json` | exit 0, `READY_FOR_G02_REVIEW`; `G02=REVIEW_REQUIRED`; owner decision not verified |
| `npm run verify:pr` | exit 0; typecheck, lint, deterministic tests, architecture and closure checks passed; `test:affected` selected 0 tests because the #264 checkout had no changed tracked files |

The read-only T2 implementation preflight at #264 with the canonical G11 tasks/design paths returned exit 0 and `REVIEW_REQUIRED`; both artifacts were `PRESENT_NOT_APPROVED`, and G02 remained `REVIEW_REQUIRED`. No Apply command was run. This diagnostic output is not a human approval and is not an end-to-end Apply block proof.

The canonical pipeline test suite passed 21 tests including C100, P01, malformed dependency syntax, cycles, phase-local AC equality, uncovered AC, changed design/spec, missing link, and symlink cases. An additional independent disposable fixture used checker blob `4582746e0895165e6ffe931b6822e23446ce650a` at source SHA `f6107907b1152b3d3d73a13aa6076105664fe240` and ran 12 cases:

| Fixture | Exit | Observed |
|---|---:|---|
| Valid C01 | 0 | `READY_FOR_PHASE_REVIEW` |
| Valid alternate P01 | 0 | `READY_FOR_PHASE_REVIEW` |
| Unknown C100 | 2 | `BLOCKED:DEPENDENCIES` |
| Malformed `C01; owner G02` | 2 | `BLOCKED:DEPENDENCIES` |
| Dependency cycle | 2 | `BLOCKED:DEPENDENCIES` |
| Foreign phase AC already owned by another DAG row | 2 | `BLOCKED:GRAPH_LINK` |
| Uncovered spec AC | 2 | `BLOCKED:GRAPH_LINK` |
| Missing checkbox | 2 | `BLOCKED:DEPENDENCIES` |
| Missing phase link | 2 | `BLOCKED:DEPENDENCIES` |
| Changed design | 2 | `BLOCKED:FRESH_INPUTS` / `STALE` |
| Changed spec | 2 | `BLOCKED:FRESH_INPUTS` / `STALE` |
| Symlinked phase artifact | 2 | `BLOCKED:ARTIFACTS` |

HTEST-04, HTEST-05, and HTEST-06 are PASS at the structural level. The test script and fixtures were kept outside tracked source; canonical G11 files were not changed.

## 5. S4 — disposable parent drift, STALE, squash, and restack

No real PR #259–#264 was merged, closed, or edited for the experiment. Synthetic fixtures were isolated under `test/fixtures/ace-phase-plan-handoff/` on temporary branches that copied the #264 checker into a disposable base.

- Initial parent input blobs: design `138a964234fd0cf82f74c0f7d7247a2f7bfcd800`; spec Git blob `4c6e112cf5a0adc24adb73badeb28ac751c8fffb`; aggregate specs fingerprint `3737ea3fb536ad8e082d26ef357a448e372a880129def1ad343e2b07887b4916`.
- Mutated parent input blobs: design `833000c348eccbeef6c4e415e8a6455780fefd13`; spec Git blob `ef96f1b253fe4805a6a6d1c1b013410c3b948b14`; aggregate specs fingerprint `0f459119ba8c30de5004bff84e53ef17e0ec0482c68b955af68116e20dc81f01`.
- At child merge HEAD `b7acd2551be2dcb44f05a1d76d7a0ce6c4006ff2`, the unchanged child phase returned exit 2, `FRESH_INPUTS=BLOCKED`, `STALE: design blob differs from plan input`.
- After refreshing only the design fingerprint, the next run returned exit 2, `STALE: spec fingerprint differs from plan input`.
- One intermediate attempt mistakenly wrote the 40-hex Git spec blob in the 64-hex aggregate SHA-256 field. The checker failed closed with exit 2 (`exactly one valid Specs SHA-256 required`). The correct aggregate was recalculated and written; this was a fixture-input mistake, not a checker defect.
- The first parent PR head also had an offline `docs-links` failure because the parent-stage task link pointed to a C01 file that had not yet been supplied by the child. The fixture was corrected to leave the phase link to the child stage; `docs-links` passed at the final parent head `673fe0c4c0018b1b64f26205a931c910c2a9e308`.
- Reconciled child commit `ece6a351766c1ec00f99ab0ff375887fb590ee92` returned exit 0 and `READY_FOR_PHASE_REVIEW`; the committed result was rerun and read back.
- A child checkbox/link was kept in the child stage so the parent PR could remain a P-stage fixture without a broken C01 link. The final child-only three-dot diff after restack is exactly `phases/C01.md` plus `tasks.md`.

Disposable GitHub stack:

| PR | Role | Final state | Base / head | Result |
|---|---|---|---|---|
| #266 | Synthetic parent input fixture | MERGED into temporary base only | `codex/ace-hermes-sandbox-base-2026-11-16` / `673fe0c4c0018b1b64f26205a931c910c2a9e308`; merge commit `fde4751b3730dcc8b8cdce0e894b35414c385e16` | Design/spec parent updated; no merge to main. Final `docs-links` passed. QG6 CodeQL failed on inherited high findings. |
| #267 | Original stacked child | CLOSED | Parent sandbox branch / `f4ed40bf35a322483a21236aa999466dbcff7c74` | Superseded after the squash restack. |
| #268 | Restacked replacement child | CLOSED after readback | Temporary base `fde4751...` / `fe0f973c894ea3674d8a61cc0cee2730f6a3ad35` | Exact three-dot diff was only the synthetic C01 phase and task link; phase checker returned READY. |

The sandbox base branch is `fde4751b3730dcc8b8cdce0e894b35414c385e16`; `main` remained `e99e81a1a758fbf6be96599dc09c4440fd51f833`. No temporary sandbox PR remains open. Remote sandbox branches were intentionally retained for audit because repository policy forbids automatic remote-branch deletion. HTEST-09 and HTEST-10 are PASS for the observed fixture/PR experiment; they do not certify the production stack.

## 6. S5 — semantic architecture review, no implementation

### C01/C02/C04 retry boundary

The exact upstream revision in the current design is `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f`. Its `PreLLMHook` is reached from the outer request/fallback path, while the provider worker calls `executeRequestWithRetries` and dispatches the callback inside the inner retry loop. That loop can execute additional callbacks for `extraAttempts` even when `MaxRetries=0`; the callback does not re-enter ACE `PreLLMHook`. ACE plugin code only rejects a repeated *hook* invocation (`integrations/bifrost/ace-connector/plugin/main.go:295-352`), so that marker cannot prove no second inner send.

No pinned-runtime mock-upstream test counted all inner callbacks/sends in this trial. The planned `scripts/bifrost-g11-wire-e2e.mjs` did not exist in the checked-out branch and was not run. Therefore C02 has no single-dispatch proof and remains **BLOCKED**; C04 remains **BLOCKED** pending owner choice among:

- DEC-G11-01: keep the retry route uncertified;
- DEC-G11-02: use a supported, inspected, owner-approved per-dispatch Bifröst extension;
- DEC-G11-03: prove/enforce that every retry and `extraAttempts` path is disabled.

`MaxRetries=0` alone is not adequate proof. No option was selected by this agent.

### C07 Hermes ingress

The installed Hermes v2026.9.24 source maps `openai-codex` to `codex_responses` even when routed through a custom base URL (`agent/model_metadata.py:622-633`, `agent/chat_completion_helpers.py:1848-1849`, `agent/turn_api_call.py:94-106`, `agent/transports/codex.py:638-697`). The current Harbor adapter selects `openai-codex` but does not configure a Bifröst endpoint (`scripts/harbor_hermes_codex_oauth.py:153-187,191-224`). ACE's current plugin accepts `/v1/chat/completions` and rejects other generation routes (`integrations/bifrost/ace-connector/plugin/main.go:213-224`). Thus this Hermes route is **not shown compatible**; C07 remains **BLOCKED**.

Owner-compatible future choices are to keep this route blocked, select an agent/provider configuration that demonstrably targets the current Bifröst Chat route, or separately approve/design/test a Responses-capable Gateway route. No direct-provider bypass or second ACE ingress is proposed.

### C08–C10 feedback ownership

The repository has reusable feedback accounting (`src/domain/feedback-loop-experiment.ts`, `src/adapters/harbor-feedback-trial-evidence.ts`, `scripts/collect-feedback-loop.ts`). However, `ace_optional` remains the arm label; the adapter maps it to the historical four-arm `dense` raw reader; and Hermes ContextEngine receipt IDs are explicitly classified `UNKNOWN` for model-bound delivery (`src/domain/feedback-loop-experiment.ts:457-471`; `src/adapters/harbor-feedback-trial-evidence.ts:17-32`). `scripts/feedback-loop-preflight.ts:70-80,256-263` deliberately reports the Gateway task/runtime as not ready until final-send evidence exists. No Harbor job, agent task, provider send, or economics run was executed.

A review caution: `validateMatchingFeedbackHarborJobs` returns a `gatewayDelivery` label after comparing agent/model/task metadata but does not itself validate an endpoint (`src/domain/feedback-harbor-config.ts:95-115`; the contract test asserts the label for a job fixture without an endpoint at `test/feedback-loop-experiment.contracts.test.ts:458-478`). The preflight still blocks on its separate not-ready runtime/final-send gates, so this label is not treated as delivery evidence here. Future C07/C08 work should bind an actual Bifröst endpoint and final-send record before promoting that identity.

HTEST-03 is PASS for preserving existing ownership and not bypassing G02; it does not make the unresolved route or feedback path accepted.

## 7. S6 — CI, security follow-up, and HTEST matrix

At exact current heads #259–#264, the `CodeQL JavaScript/TypeScript` QG6 check is FAIL on #259 (`bf9907f...`), #263 (`ac22249...`), and #264 (`f610790...`). The separate `CodeQL` check passed where present; it does not override the failed QG6 SARIF result. A separate security issue #269 was opened; no alert was suppressed, fixed, or declared a false positive in this planning-only trial.

The separate security issue #269 tracks these eight open HIGH alerts observed on the current default-branch scan: `src/transport/gateway-projection-http.ts:144`; `src/application/harbor-byte-binding.ts:56`; `src/application/ace-runtime-bundle.ts:30`; `src/adapters/node-workspace-port.ts:63,460`; `scripts/reranker-holdout-to-retrieval-holdout.ts:43`; `scripts/freeze-reranker-holdout.ts:191`; and `scripts/freeze-retrieval-holdout.ts:182`. They were not suppressed, fixed, or declared false positives here. Four MEDIUM alerts were observed separately and are outside issue #269's initial HIGH-severity scope.

HTEST results:

| ID | Status | Evidence / limitation |
|---|---|---|
| HTEST-01 | PARTIAL | Process path/version recorded; active TUI root was `/harness`, not the #259-descendant worktree; project trust/index absent. |
| HTEST-02 | NOT_OBSERVED | No actual project Skill invocation or handoff trace. |
| HTEST-03 | PASS | Existing DDD/Gateway ownership reviewed; no G02 or egress bypass. Route/owner decisions remain open. |
| HTEST-04 | PASS | P01 passes; C100, malformed dependency, and cycle fail closed. |
| HTEST-05 | PASS | Per-phase AC equality, foreign/uncovered AC, and missing checkbox/link negatives fail closed. |
| HTEST-06 | PASS (structural only) | C01–C10 each exit 0 at the same f610 HEAD and matching design/spec fingerprints. |
| HTEST-07 | BLOCKED | No pinned-runtime no-second-send mock proof; C02 cannot proceed. |
| HTEST-08 | PASS | Exact parent ancestry and three-dot stage diffs verified; #265 squash is included in #264. |
| HTEST-09 | PASS | Real sandbox parent design/spec mutation produced `STALE` with exit 2; refreshed inputs returned READY. |
| HTEST-10 | PASS | Disposable parent squash, child restack/replacement PR, and child-only diff verified; sandbox PRs closed/merged as listed. |
| HTEST-11 | PARTIAL / NOT_RUN | Implementation preflight returned `REVIEW_REQUIRED` (exit 0), with plan/G02 `PRESENT_NOT_APPROVED`; no Apply or egress command was run. |
| HTEST-12 | PASS (reporting criterion) | Local tests, OpenSpec, CI passes/fails/skips are bound to exact SHAs; QG6 failure remains explicit. |
| HTEST-13 | NOT_OBSERVED | Session resume after a real disconnect/restart was not tested. |

## 8. Owner decisions and remaining scope

- Approve project trust and a bounded fresh-session Skill smoke, or leave HTEST-01/02 `NOT_OBSERVED`.
- Select no C04 retry alternative until the exact per-send boundary is proven; keep C02 blocked until C01 proves a no-second-send guard or fresh authorization.
- Select a C07 agent/provider ingress compatible with Bifröst, or approve a separate Responses-route design; do not bypass Gateway.
- Keep C08–C10 accounting/Harbor work distinct from actual Gateway delivery and final-send evidence. No provider, agent, Harbor pilot, holdout, spending budget, or egress permission was selected.
- Issue #269 is the separate scoped CodeQL follow-up. No product fix PR resulted from this trial.

**G11 production status:** unchanged. G02 remains `REVIEW_REQUIRED`; provider wire is not certified; no G11 acceptance IDs were marked complete.

## 9. Execution rulings and review note

- **Skill trust/invocation:** do not alter project trust or start a second model-backed Hermes session without explicit owner permission; this follows the plan's trust/egress constraints. Cost if wrong: HTEST-01/02 remain unproven.
- **Parent/child sandbox boundary:** leave the C01 task link for the child stage after the parent-only fixture produced a real `docs-links` failure; the child PR adds the phase/link. Cost if wrong: the disposable fixture's parent stage may not match a different operator preference, but it preserves the tested P→X ownership boundary.
- **Post-squash restack:** publish a replacement child PR (#268) on the disposable base rather than force-pushing the old child head; this follows the no-history-rewrite rule. Cost if wrong: the experiment verifies replacement-PR restacking, not an in-place PR-head rewrite.
- **Review mode:** single-agent self-review only. No independent reviewer or second Hermes agent was used; the owner should decide whether that is sufficient before accepting the evidence.
