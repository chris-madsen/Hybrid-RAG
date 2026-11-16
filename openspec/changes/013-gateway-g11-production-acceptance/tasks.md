# Tasks — G11 architecture-derived implementation DAG (planning only)

**Source:** G11 OpenSpec change 013; architecture proposal `design.md` from PR #261. **Status:** PROPOSED / PROVISIONAL; no implementation authorized. All task boxes remain unchecked. The requirements stage is reused from merged PR #255. G02 remains `REVIEW_REQUIRED`; real provider, agent and Harbor operations require separate explicit permission. PR #256 and #258 remain competing Draft candidates and are not modified by this plan.

## Global gates and sizing method

- Owner G02 approval of the architecture and a separate implementation request are required before any product-code phase. A phase's structural checker or PR approval cannot substitute.
- External provider/model/agent, data class, disposable input, budget and egress opt-in are selected separately before each live trial. Missing permission means `BLOCKED/NOT_RUN`, not a substitute mock PASS.
- Current pinned Bifröst source shows `PreLLMHook` is above its internal `executeRequestWithRetries` loop. `C04` is hard-blocked until the owner approves a feasible per-send enforcement boundary or a runtime route configuration proves every inner attempt is disabled.
- **C02 safe single-send prerequisite:** even one incoming request can cause multiple inner Bifröst provider callbacks. Before any live C02 provider egress, C01 must prove for the exact pin/config with a synthetic upstream that every `MaxRetries` and `extraAttempts` path is either disabled with a zero-second-send assertion or independently reauthorized at the actual dispatch seam; otherwise C02 is BLOCKED. This is not C04 retry acceptance.
- Ten chunks were derived from distinct trust/evidence boundaries, not selected to match PR #258's count. Forecast added+deleted handwritten LOC (including tests; other includes scripts/config/hand-edited docs) is approximate, not measured. External evidence-only milestones below 700 LOC remain separate because they require distinct permission and verifiable evidence. Generated/vendor bulk is excluded.
- Predicted total: **7,530 changed handwritten LOC** (source 2,610; tests 3,620; other 1,300). Re-estimate only the unfinished frontier after source inspection; do not pad or weaken tests to fit.

## Dependency DAG and LOC budget

| ID / title | Blocked by | Acceptance IDs | Source / tests / other = total forecast | Observable result |
|---|---|---|---:|---|
| C01 — Final-wire mock and retry-boundary inventory | none | G11-001, 002, 004 | 430 / 520 / 140 = **1,090** | Exact protected request reaches a controlled synthetic upstream after the pinned Bifröst pipeline; route/hook/pin and internal retry behavior are truthfully classified. |
| C02 — Authorized non-streaming real-provider route | C01 | G11-003, 004 | 80 / 160 / 110 = **350** | One explicitly authorized provider/model returns a correlated response on the certified non-stream Chat route. |
| C03 — Streaming, cancellation and partial outcomes | C01, C02 | G11-005, G11-006, G11-007, G11-008 | 420 / 540 / 120 = **1,080** | One exact stream variant preserves projection and correctly distinguishes terminal, cancelled and partial runs. |
| C04 — Per-dispatch same-provider retry authorization | C01 | G11-009, 011, 012 | 470 / 590 / 120 = **1,180** | Every Bifröst inner retry callback is newly authorized, or the route is proven single-dispatch and denies retries. |
| C05 — Changed-destination fallback authorization | C04 | G11-010, G11-011, G11-012 | 380 / 470 / 100 = **950** | A changed provider/model/data-residency target gets a fresh destination-specific decision; denied targets receive zero sends. |
| C06 — Real retry/fallback provider-wire evidence | C02, C04, C05 | G11-009, G11-010, G11-011, G11-012 | 80 / 170 / 130 = **380** | Separately authorized retry/fallback sends and no-send denials are correlated to unique attempt evidence. |
| C07 — Real coding-agent Gateway task | C02 | G11-013, G11-014, G11-015, G11-016 | 160 / 250 / 140 = **550** | One nontrivial task is accepted through agent → Bifröst → ACE → authorized provider, with host-attestation limits explicit. |
| C08 — Harbor attribution and usage/quality contract | C01 | G11-017, G11-018, G11-019, G11-020 | 400 / 500 / 100 = **1,000** | Existing Harbor/evaluation paths require valid attempt evidence, matched arms, complete failures, quality and measured-or-unknown usage/cost. |
| C09 — Exploratory paired real-agent Harbor pilot | C07, C08 | G11-017, G11-018, G11-019, G11-020 | 80 / 210 / 160 = **450** | One explicitly approved exploratory pair is retained with raw trials and independent quality; it is not a frozen-holdout result. |
| C10 — Frozen holdout and route-level owner handoff | C03, C06, C09 | G11-004, G11-014, G11-017, G11-018, G11-019, G11-020 | 110 / 210 / 180 = **500** | Predeclared holdout runs are complete or visibly incomplete; route-specific evidence is handed to the owner without auto-promotion. |

**DAG grammar:** the `Blocked by` column is **only** a comma-separated list of phase IDs or `none`. Owner G02, DEC-G11 decisions, permission and conditional streaming gates are independent prose constraints; never encode them as phantom DAG edges. The phase brief uses the machine-readable `**Phase dependencies:**` field with the same canonical hard edges.

**Frontier after G02:** C01. After C01, C02 and C08 may proceed independently; C03 and C07 then require C02 (C07 also requires C03 only if the selected agent needs streaming). C04 additionally requires an owner decision on the per-dispatch boundary; C05 follows C04, C06 follows C02/C04/C05, C09 follows C07/C08, and C10 follows C03/C06/C09. A missing C03/C06/C07/C09 result blocks only the dependent full-route/holdout claim; it does not justify filtering failures or relabeling partial evidence.

## C01 — Final-wire mock and retry-boundary inventory

- [ ] C01 — Final-wire mock and retry-boundary inventory
- **Status / depends on:** PROPOSED; G02 only. **AC:** G11-001, G11-002, G11-004. **Budget:** 430 source + 520 tests + 140 other = 1,090.
- **Observable outcome:** A pinned Bifröst request reaches a controlled synthetic upstream; the observed final body is compared against the authorized snapshot after all active mutators. The report distinguishes mock-wire from real-provider evidence and binds route/config/source pins.
- **Candidate files:** modify `integrations/bifrost/ace-connector/plugin/main.go`, `plugin/main_test.go`, `connector_test.go`, `integrations/bifrost/ace-connector/README.md`; extend `test/bifrost-plugin.contracts.test.ts`; add a disposable mock-upstream runner only after checking whether pinned Bifröst's existing test/server harness can be reused. Use `scripts/build-bifrost-ace-plugin.sh`; do not create a production proxy.
- **RED/GREEN:** RED if a PreLLM receipt alone certifies final wire, a later mutator/pin change is invisible, or an inner retry callback reuses the single projection without being classified. GREEN if the mock upstream observes exactly the permitted transformation, any additional callback is independently authorized or explicitly blocked, and drift/unsupported routes remain uncertified.
- **Oracles:** existing Go connector tests and static plugin test are the cheapest owners for pure semantics; a pinned-Bifröst mock upstream is the unique runtime/wire oracle. No external provider call.
- **STOP / rollback:** If the pinned Bifröst source exposes no terminal observation/enforcement seam, keep provider wire `not_certified`; do not add a second proxy or infer egress. Plugin build requires the exact Bifröst commit and Go 1.27.3; the current runner has Go 1.18.1, so use a verified pinned CI runner or mark the build `NOT_RUN`.

## C02 — Authorized non-streaming real-provider route

- [ ] C02 — Authorized non-streaming real-provider route
- **Status / depends on:** PROPOSED; C01. **AC:** G11-003, G11-004. **Budget:** 80 + 160 + 110 = 350.
- **Observable outcome:** One disposable synthetic/public-data Chat request is sent through the exact pinned Bifröst route to one owner-selected real provider/model, and its actual response is correlated with final-send evidence.
- **Candidate files:** reuse `scripts/real-provider-evidence.mjs`, `scripts/real-provider-process.mjs`, `scripts/real-provider-runtime.mjs`, `integrations/bifrost/ace-connector/README.md`; create runner/glue only if current helpers cannot drive the pinned Bifröst HTTP server and synthetic input safely.
- **RED/GREEN:** RED if missing opt-in, provider/model mismatch, a fake upstream, absent final-send record or wrong response identity is accepted as real. GREEN is a real provider response correlated to a permitted final body and exact ACE/Bifröst/plugin identities.
- **Oracles:** local deterministic evidence-classification test; separately authorized real provider wire. No provider/model/credential/budget is selected by this plan.
- **STOP / rollback:** No call until the owner supplies provider/model, disposable data policy, credential route and spending/egress opt-in. If absent, record `BLOCKED/NOT_RUN` and preserve `not_certified`. Even with permission, no live C02 send may start unless C01 has proved the pinned Bifröst **single-dispatch** configuration or an owner-approved fresh per-dispatch guard across inner retry/extra-attempt cases; `MaxRetries=0` by itself is insufficient.

## C03 — Streaming, cancellation and partial outcomes

- [ ] C03 — Streaming, cancellation and partial outcomes
- **Status / depends on:** PROPOSED; C01 and C02 for full route acceptance. **AC:** G11-005, G11-006, G11-007, G11-008. **Budget:** 420 + 540 + 120 = 1,080.
- **Observable outcome:** One exact `stream=true` variant preserves request/tool/opaque semantics; ordered chunks, terminal status, cancellation/deadline, truncation and unknown usage remain truthful. Unsupported stream modes are rejected before egress.
- **Candidate files:** modify the existing Bifröst plugin/connector where its pinned stream interfaces allow; add focused tests under `integrations/bifrost/ace-connector/plugin/` and/or `test/` only for unique stream wiring. Reuse Bifröst SSE/stream-chunk APIs, `src/domain/evaluation.ts` usage states and existing Harbor adapters; no custom SSE proxy/parser.
- **RED/GREEN:** RED for stream coercion, missing terminal event, truncation as clean success, cancellation that starts another send, or missing usage as zero. GREEN with controlled stream fixtures and a separately authorized real provider terminal/partial trace.
- **Oracles:** deterministic stream-chunk/cancellation fixtures; real provider stream evidence only when approved. Synthetic stream success is not real-provider acceptance.
- **STOP / rollback:** Keep unverified stream variants unsupported and the non-stream route unchanged. Real stream egress is not authorized in this planning task.

## C04 — Per-dispatch same-provider retry authorization

- [ ] C04 — Per-dispatch same-provider retry authorization
- **Status / depends on:** PROPOSED; C01 plus owner decision `DEC-G11-01/02/03`. **AC:** G11-009, G11-011, G11-012. **Budget:** 470 + 590 + 120 = 1,180.
- **Observable outcome:** The pinned Bifröst inner `executeRequestWithRetries` path cannot issue a second provider callback under an old ACE decision. Each actual callback gets fresh body/provider/model/policy/attempt binding, or the exact route is proven and enforced single-dispatch.
- **Candidate files:** inspect/extend only the existing `integrations/bifrost/ace-connector/plugin/main.go`, `connector.go` and Go tests; candidate ACE owner is `src/domain/gateway-projection.ts` / `src/application/gateway-projection-service.ts`. `typespec/main.tsp` and generated v1 files are conditional only if G02 accepts a wire extension. A Bifröst source change is outside this ACE repo and requires explicit owner/upstream approval.
- **RED/GREEN:** RED with a deterministic mock provider failure that causes Bifröst's internal retry/extra-attempt path and records a second callback without a second authorization. GREEN only when each callback is independently admitted at the selected send seam or the path is provably disabled; test timeout, key rotation, encrypted-reasoning strip, replay and cancellation without sleeps.
- **Oracles:** pure transition/negative policy tests plus pinned Bifröst request-worker/mock-upstream callback counts. No real provider required for deterministic closure.
- **STOP / rollback:** If no supported per-dispatch hook or safe disable mechanism exists, STOP for owner decision; do not claim a gateway PreLLM receipt gates inner retries and do not create a proxy.

## C05 — Changed-destination fallback authorization

- [ ] C05 — Changed-destination fallback authorization
- **Status / depends on:** PROPOSED; C04. **AC:** G11-010, G11-011, G11-012. **Budget:** 380 + 470 + 100 = 950.
- **Observable outcome:** A different provider/model/residency target cannot inherit primary-route consent, body digest or receipt; allowed destinations receive a fresh decision and denied destinations receive no call.
- **Candidate files:** existing `src/domain/gateway-projection.ts`, `src/domain/policy.ts`, `src/application/gateway-projection-service.ts`, `integrations/bifrost/ace-connector/plugin/main.go`, connector tests and `test/gateway-projection.contracts.test.ts`; change TypeSpec only after the G02 decision in C04 establishes a new public request shape.
- **RED/GREEN:** RED when an allowed primary provider can send a changed fallback without fresh destination/data-class/secret authorization. GREEN with a provider/model × policy matrix using mock destinations and exact zero-send assertions for denials.
- **Oracles:** existing pure policy/receipt tests plus Bifröst fallback callback tests. Real fallback proof is reserved for C06 and needs per-destination opt-in.
- **STOP / rollback:** Keep all fallbacks disabled for the ACE route until C04 and C05 are reviewed and tested; preserve the existing Gateway v1 route.

## C06 — Real retry/fallback wire evidence

- [ ] C06 — Real retry/fallback wire evidence
- **Status / depends on:** PROPOSED; C02, C04 and C05. **AC:** G11-009, G11-010, G11-011, G11-012. **Budget:** 80 + 170 + 130 = 380.
- **Observable outcome:** A deliberately controlled same-provider retry and a separately approved destination change have distinct fresh ACE decisions and correlated final-send/response evidence; denied attempts produce zero provider calls.
- **Candidate files:** reuse the C01/C02 evidence runner and `scripts/real-provider-evidence.mjs`; add only missing redacted evidence glue. No new gateway or proxy.
- **RED/GREEN:** RED if a second real provider callback lacks a unique attempt decision or a denied destination receives bytes. GREEN with real responses and distinct physical-attempt records for each approved case.
- **Oracles:** deterministic mock no-send matrix plus real provider attempt-level evidence under explicit operator permission.
- **STOP / rollback:** BLOCKED until C04 proves the exact per-dispatch seam and the owner approves every provider/model, test input and budget. Otherwise leave retries/fallbacks unsupported.

## C07 — Real coding-agent Gateway task

- [ ] C07 — Real coding-agent Gateway task
- **Status / depends on:** PROPOSED; hard DAG edge C02; conditional route gate C03 if the owner-selected agent actually requires streaming. **AC:** G11-013, G11-014, G11-015, G11-016. **Budget:** 160 + 250 + 140 = 550.
- **Observable outcome:** One nontrivial retrieval-demanding task completes through the configured coding agent → Bifröst → authenticated ACE Projection → authorized real provider, with an independent quality oracle and honest host-history status.
- **Candidate files:** existing `integrations/bifrost/ace-connector/README.md`, `scripts/real-provider-runtime.mjs`, `scripts/real-provider-process.mjs`, `scripts/real-provider-evidence.mjs`, `scripts/harbor_hermes_codex_oauth.py`, and `test/feedback-preflight.contracts.test.ts`; add only the minimal task invocation/evidence fixture after agent/route selection. The current Hermes adapter does not configure a Bifröst endpoint and the current plugin accepts Chat Completions only; do not assume this agent route is compatible or bypass Bifröst through a direct provider call.
- **RED/GREEN:** RED for direct-provider bypass, hidden continuation, secret-bearing task, invalid session correlation, false host attestation or failed task labeled accepted. GREEN with exact agent/provider/build/route/source identities, bound receipt and passed independent task checks.
- **Oracles:** deterministic route/config validation; actual agent + provider task E2E only with explicit owner permission. No host compaction claim without an independent attestor.
- **STOP / rollback:** Agent/provider are not selected or authorized. Mark `BLOCKED/NOT_RUN`; no real agent call in this task.

## C08 — Harbor attribution, accounting and quality contract

- [ ] C08 — Harbor attribution, accounting and quality contract
- **Status / depends on:** PROPOSED; C01. **AC:** G11-017, G11-018, G11-019, G11-020. **Budget:** 400 + 500 + 100 = 1,000.
- **Observable outcome:** The existing two-arm Hermes feedback loop reports G11 ACE attribution only when a request-bound Gateway projection is corroborated by independently verified final-send evidence; matched task quality, failures, usage, cost and missing counters remain truthful.
- **Candidate files/tests:** reuse `src/domain/feedback-loop-experiment.ts`, `src/adapters/harbor-feedback-trial-evidence.ts`, `scripts/collect-feedback-loop.ts`, `scripts/feedback-loop-preflight.ts`, `scripts/render-feedback-summary.ts`, `test/feedback-loop-experiment.contracts.test.ts`, and `test/feedback-preflight.contracts.test.ts`. The current adapter intentionally leaves Gateway receipts uncorrelated; extend this owner only from the final-send record established by C01. Do not route G11 through Codex-specific `src/domain/harbor-four-arm*.ts`, `scripts/harbor-four-arm-gate.ts`, or retired-tool four-arm jobs.
- **RED/GREEN:** RED for forged aggregate counters, native baseline contamination, duplicate Gateway IDs, mock/PreLLM receipt promoted as final wire, double-counted cached/reasoning subsets or unknown usage as zero. GREEN with raw-trial reconciliation and separate quality/causal gates.
- **Oracles:** deterministic domain/adapter fixtures at existing owners. This slice does not prove any paid run, final provider egress or savings.
- **STOP / rollback:** If C01 provides no validated final-send evidence, retain `UNKNOWN` and block causal/savings claims. Reuse existing feedback accounting; no second report system, no four-arm Codex substitution and no duplicate tests.

## C09 — Exploratory paired real-agent Harbor pilot

- [ ] C09 — Exploratory paired real-agent Harbor pilot
- **Status / depends on:** PROPOSED; C07 and C08. **AC:** G11-017, G11-018, G11-019, G11-020. **Budget:** 80 + 210 + 160 = 450.
- **Observable outcome:** One explicitly authorized matched baseline/ACE exploratory pair is retained with frozen task identity, exact provider receipts, task quality, full failures, provider usage/cost or `UNKNOWN`.
- **Candidate files:** reuse `scripts/freeze-feedback-task-manifest.ts`, `scripts/feedback-loop-preflight.ts`, `scripts/collect-feedback-loop.ts`, `scripts/render-feedback-summary.ts`, `scripts/real-provider-evidence.mjs`, and the existing Hermes Harbor adapter after its Bifröst route is selected. Raw Harbor artifacts remain outside the checkout under `/tmp/ace-feedback/<run-id>/`; commit only a concise hash-linked summary under `benchmarks/reports/` when authorized.
- **RED/GREEN:** RED for unequal arms, failed cheap answers removed, missing usage treated as zero, or no bound ACE attempt presented as causal. GREEN is a truthful exploratory report with every arm/failure and independent quality result.
- **Oracles:** real paired Harbor trials only after explicit agent/provider/data/spending approval; deterministic byte/manifest validators first.
- **STOP / rollback:** Not authorized here. A small pilot cannot satisfy the frozen-holdout or 5× acceptance gate.

## C10 — Frozen holdout and route-specific owner handoff

- [ ] C10 — Frozen holdout and route-specific owner handoff
- **Status / depends on:** PROPOSED; C03, C06, C09. **AC:** G11-004, G11-014, G11-017, G11-018, G11-019, G11-020. **Budget:** 110 + 210 + 180 = 500.
- **Observable outcome:** A predeclared immutable holdout is executed/reconciled or its incomplete shard frontier is reported; each exact route/provider/model/source pin gets a separate truthful verdict and owner handoff.
- **Candidate files:** existing `scripts/freeze-feedback-task-manifest.ts`, `scripts/feedback-loop-preflight.ts`, `scripts/collect-feedback-loop.ts`, `scripts/render-feedback-summary.ts`, and `openspec/changes/013-gateway-g11-production-acceptance/tasks.md`; use the two-arm Hermes feedback flow and no post-hoc dataset shrink.
- **RED/GREEN:** RED for changed holdout, missing arms/shards, stale source, filtered failures, mock-only claims or an unapproved release. GREEN when predeclared trials are complete and evidence is bound to exact source/runtime/provider identities, or incompleteness is explicit and no promotion occurs.
- **Oracles:** frozen manifest + raw paired trial reconciliation + independent quality checks; owner route certification is a separate decision.
- **STOP / rollback:** No holdout is frozen or run in this planning task; owner chooses task/repetition/budget before execution. No automatic production or 5× claim.

## Acceptance coverage and plan comparison

The ten proposed chunks retain all 20 stable IDs. C01 owns G11-001 and G11-002; C02 owns G11-003; C01/C02/C10 own G11-004; C03 owns G11-005–008; C04/C06 own G11-009, G11-011 and G11-012; C05/C06 own G11-010–012; C07 owns G11-013–016; C08/C09/C10 own G11-017–020. Every ID is also written explicitly in each owning task's acceptance field. Each phase brief in the X stage will include its exact IDs, paths, RED/GREEN command/result, oracles, frame conditions, rollback and input fingerprints.

- **PR #256 (8 blocks):** fewer stage boundaries and no per-block LOC forecast. It usefully keeps final-wire, real provider, stream, real-agent and holdout evidence separate, but combines same-provider attempt authorization with changed-destination fallback and combines Harbor accounting with its pilot. The current pinned source reveals a deeper split is needed: outer fallback re-enters `tryRequest`, while internal retry callbacks occur beneath the ACE `PreLLMHook`.
- **PR #258 (10 chunks / 7,470 forecast LOC):** useful automatic budgets and separate same-provider retry, fallback, Harbor accounting, pilot and holdout. Its internal-retry phase still treats the PreLLM/attempt hook as the actual provider-attempt seam; the pinned source shows that `executeRequestWithRetries` can call the provider callback below it. Its budgets remain estimates, not observed diffs.
- **This independent candidate (10 chunks / 7,530 forecast LOC):** retains the genuinely separate external/evidence boundaries but redefines C01/C04 around the observed inner retry loop and blocks that implementation frontier pending the owner decision. It does not select ten because another PR did; the count follows the trust/evidence boundaries and flexible size forecast. If the approved upstream seam changes the blast radius above ~1,500 handwritten lines, reslice only C04's unfinished frontier before code.

All estimates are forecasts, not proof of one-context fit. All checkboxes remain unchecked. Strict OpenSpec/SDD structure and PR checks cannot approve G02, per-send behavior, provider egress, agent E2E, Harbor economics or production readiness.
