# Tasks — G11 source-informed ACE To-tickets auto-sized candidate

**Independent decomposition snapshot:** `main@e99e81a1a758fbf6be96599dc09c4440fd51f833` (2026-11-16, PR #257 merged). **Skill technique:** read/applied `.agents/skills/ace-to-tickets/SKILL.md`, the pinned `to-tickets` and ACE compatibility overlay; **live host Skill invocation: NOT_OBSERVED**. **Status:** PLAN CANDIDATE, not owner G02 approval, not source implementation. This branch deliberately starts from the merged G11 specs and original six-phase `tasks.md`, **not** the prior manually drafted PR #256. The 10 derived chunks below are to be compared before choosing one canonical plan; do not merge competing versions of `tasks.md` independently.

## Default sizing and evidence rules

- Prefer **~700–1,200 predicted handwritten changed lines including tests** per fresh-context pass; ~1,000 is a target, not a quota. Estimated total in this alternative: **7,470 lines** across 10 PR-sized chunks. Sub-700 chunks are retained only for external approval/real-provider/agent/Harbor boundaries where a separately attestable milestone is safer than packing unrelated work into one PR. No filler code and no arbitrary fixed number of chunks.
- For each PR: one agent, one live-source-verified vertical behavior, one fresh context and bounded PR, exact current HEAD/active PR check, read scoped AGENTS/ADRs/entire accepted design and existing relevant providers, run ACE `sdlc:preflight` and `worktree:preflight` before writing. Copy this chunk's details into the existing `docs/research/sdlc/source/templates/phase-template.md` execution format; **do not** create a second persistent ticket tracker.
- G02 T2 review/owner acceptance is a **global gate before any implementation**. The merged OpenSpec change is not itself a signed G02. Each real provider/agent/paid benchmark trial additionally requires its own exact provider/model, safe public/disposable inputs, data policy, credential/budget and external egress approval. No owner approval is inferred from this spec.
- RED first at the cheapest owning seam; GREEN includes protected negative paths. Run targeted Go/TS tests, `npm run test:affected`, appropriate OpenSpec/TypeSpec if modified and bounded `npm run verify:pr`. Capture BUILD/ARCH/SEC/PLAN review findings and actual GitHub CI tested SHA. Provider mock results NEVER stand in for real provider egress, agent E2E or Harbor.
- Preserve the current sole Bifröst Gateway route, unchanged public `ace.gateway.v1` unless separately approved TypeSpec source migration, request-bound additive projection, private-source policy, no model-invoked tools/native Hermes context bridge, and fail-closed unknown stream/attempt routes. Recheck the actual pinned Bifröst hooks, do not implement a second proxy or duplicate SSE/provider/benchmark facilities.
- If an upstream seam, trust boundary or benchmark scale makes a chunk genuinely >~1,200 lines or unsuitable for one context, **reslice just the unfinished frontier**; no silent acceptance downgrade or post-hoc reduction of holdout. A ~1000-line estimate cannot certify context fit.

## Chosen DAG and estimated line budget

| Chunk | Verifiable outcome | Blocked by | G11 scenarios | Estimated code + test + other changed LOC |
| --- | --- | --- | --- | --- |
| G11-C01 | Exact final-wire mock observation and non-certification guard | G02 only | G11-001, G11-002, G11-004 | 420 + 460 + 100 = **980** |
| G11-C02 | Real non-streaming provider-wire trial (external approval boundary) | G11-C01 | G11-003, G11-004 | 90 + 160 + 90 = **340** |
| G11-C03 | Streaming Chat conformance including terminal, cancellation, and partial failure | G11-C01, G11-C02 | G11-005, G11-006, G11-007, G11-008 | 420 + 550 + 110 = **1080** |
| G11-C04 | Fresh same-provider retry authorization with replay/race/outage safety | G11-C01 | G11-009, G11-011, G11-012 | 500 + 580 + 110 = **1190** |
| G11-C05 | Changed-destination fallback reauthorization and safe no-send | G11-C04 | G11-010, G11-011, G11-012 | 380 + 480 + 80 = **940** |
| G11-C06 | Real retry/fallback per-attempt provider-wire acceptance | G11-C02, G11-C04, G11-C05 | G11-009, G11-010, G11-011, G11-012 | 100 + 180 + 120 = **400** |
| G11-C07 | One real coding-agent task through sole Bifröst Gateway | G11-C02 | G11-013, G11-014, G11-015, G11-016 | 170 + 250 + 120 = **540** |
| G11-C08 | Harbor matched-arm accounting, provenance and quality gate | G11-C01 | G11-017, G11-018, G11-019, G11-020 | 390 + 510 + 100 = **1000** |
| G11-C09 | Harbor real paired exploratory pilot with accepted-task oracle | G11-C07, G11-C08 | G11-017, G11-018, G11-019, G11-020 | 140 + 220 + 140 = **500** |
| G11-C10 | Predeclared frozen holdout and G11 route-level owner acceptance | G11-C03, G11-C06, G11-C09 | G11-004, G11-014, G11-017, G11-018, G11-019, G11-020 | 130 + 220 + 150 = **500** |

**Frontier:** after human G02: G11-C01. After C01: C02, C04 and C08 may proceed independently. C03 requires C01+C02; C05 requires C04; C06 requires C02+C04+C05; C07 requires C02, and **conditionally C03** if the chosen coding agent requires streaming. C09 requires C07+C08. **Full G11** C10 requires C03+C06+C09; a narrower, honest nonstreaming-route report may be made before these lanes, but not whole-platform production acceptance.

## G11-C01 — Exact final-wire mock observation and non-certification guard

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 1. **Blocked by:** None after G02 owner approval. **Acceptance IDs:** G11-001, G11-002, G11-004.

**Estimated handwritten changed LOC:** code 420 + tests 460 + scripts/config/docs 100 = **980 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 6 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** A single HTTP Chat request traverses pinned Bifröst and ACE, reaches a controlled synthetic upstream, and yields a final-send snapshot after all effective request mutators. Exactly one ACE context addition is semantically equal to its authorized projection; the original system/user messages, tools, model, stream flag and opaque fields remain intact. A verifier reports only MOCK_WIRE_VERIFIED and denies changed hook order/config/route.

**Likely source / owning tests (recheck current HEAD before code):** `integrations/bifrost/ace-connector/plugin/main.go`, `integrations/bifrost/ace-connector/plugin/main_test.go`, `integrations/bifrost/ace-connector/connector_test.go`, `src/transport/gateway-projection-http.ts`, `test/gateway-projection-http.contracts.test.ts`, `scripts/real-provider-evidence.mjs`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** A PreLLM receipt or forged mock provider success is marked real; late mutator changes protected message/tool/model fields unnoticed; unknown route or changed Bifröst/ACE SHA remains certified.
- [ ] **GREEN — end-to-end demonstration:** End-to-end mock upstream observes exact allowed final semantics with hash-linked ingress → receipt → final body, and rejects negative late mutator/plugin order and drift fixtures.
- [ ] **Evidence and QA:** Controlled upstream transcript digest + effective Bifröst load order, exact code/config pin, redacted evidence; no real-provider certification.
- [ ] **STOP / rollback / owner boundary:** If the pinned Bifröst pipeline has no guaranteed terminal-send interception/order, keep providerWire not_certified and stop for explicit approved upstream extension; no new transparent proxy or fabricated real wire.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C02 — Real non-streaming provider-wire trial (external approval boundary)

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 1. **Blocked by:** G11-C01. **Acceptance IDs:** G11-003, G11-004.

**Estimated handwritten changed LOC:** code 90 + tests 160 + scripts/config/docs 90 = **340 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 4 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** An explicitly approved public/synthetic Chat request travels Bifröst → ACE → a named real provider/model, and a correlated true provider response plus final-send identity is recorded without exporting sensitive raw prompt bytes. Certification is narrow to that exact nonstream route/source/runtime.

**Likely source / owning tests (recheck current HEAD before code):** `scripts/real-provider-evidence.mjs`, `scripts/real-provider-process.mjs`, `integrations/bifrost/ace-connector/README.md`, `test/gateway-runtime-readiness.test.ts`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Missing explicit egress opt-in, incorrect provider/model, fake upstream receipt, missing terminal send or mismatched response is accepted as real-provider proof.
- [ ] **GREEN — end-to-end demonstration:** Approved real provider request/response, final-send digest, route pin and independently verifiable redacted evidence agree; no claim about coding agent or Harbor.
- [ ] **Evidence and QA:** Actual provider response and terminal request hash, exact source/Bifröst SHA, selected provider/model, permission/budget reference and output provenance.
- [ ] **STOP / rollback / owner boundary:** Real run is BLOCKED without explicit operator choice and credentials, policy/secret approval and funds. A mock can't substitute; keep route unapproved.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C03 — Streaming Chat conformance including terminal, cancellation, and partial failure

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 2. **Blocked by:** G11-C01, G11-C02. **Acceptance IDs:** G11-005, G11-006, G11-007, G11-008.

**Estimated handwritten changed LOC:** code 420 + tests 550 + scripts/config/docs 110 = **1080 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 5 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** One exact stream=true Chat route preserves the projected request and tool/opaque semantics, ordered SSE chunks and terminal event. Unsupported variants refuse pre-egress; client cancel/deadline stops new work, and truncation/partial sends with unknown provider usage remain visible. Separately, an explicitly approved real stream demonstrates end-to-end provider delivery.

**Likely source / owning tests (recheck current HEAD before code):** `integrations/bifrost/ace-connector/plugin/main.go`, `integrations/bifrost/ace-connector/plugin/main_test.go`, `src/transport/gateway-projection-http.ts`, `test/gateway-projection-http.contracts.test.ts`, `src/adapters/harbor-four-arm-trial-evidence.ts`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** stream=true silently becomes false; tool deltas go missing; unsupported mode is sent; cancelled stream spawns retries; truncated SSE is recorded clean; absent usage becomes zero.
- [ ] **GREEN — end-to-end demonstration:** Controlled mock stream/cancellation/fault fixture proves chunk order, terminal/partial statuses and zero unauthorized extra attempts. Approved real streaming provider trace reaches valid terminal event for only the named variant.
- [ ] **Evidence and QA:** Mock and real stream packets marked separately; correlated attempt ID, redacted chunk count/order, terminal and usage availability, cancellation and negative fault records.
- [ ] **STOP / rollback / owner boundary:** If the pinned upstream does not preserve SSE or actual provider variant is unverified, leave it unsupported. Real cancellation/errors not observed remain NOT_RUN, not implied by a mock.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C04 — Fresh same-provider retry authorization with replay/race/outage safety

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 3. **Blocked by:** G11-C01. **Acceptance IDs:** G11-009, G11-011, G11-012.

**Estimated handwritten changed LOC:** code 500 + tests 580 + scripts/config/docs 110 = **1190 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 7 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** On a same-provider transient retry, Bifröst requests a NEW ACE policy decision bound to the exact physical send, attempt nonce/index, body digest, destination, data class, expiration and session. Only one authorized dispatch consumes that receipt, including concurrent or restarted execution as applicable; uncertainty/secret/timeouts leave zero second egress.

**Likely source / owning tests (recheck current HEAD before code):** `src/domain/gateway-projection.ts`, `src/application/gateway-projection-service.ts`, `src/transport/gateway-projection-http.ts`, `integrations/bifrost/ace-connector/plugin/main.go`, `integrations/bifrost/ace-connector/connector.go`, `integrations/bifrost/ace-connector/connector_test.go`, `test/gateway-projection.contracts.test.ts`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Initial ingress APPLY authorizes attempt 2; stale/changed body/session/attempt or raced duplicate receipt sends twice; ACE outage/NOT_READY causes a silent retry.
- [ ] **GREEN — end-to-end demonstration:** Controlled upstream sees separate authorized attempts with independent ACE decisions; replay, race, expiry, restart, changed model and outage fixtures deny or permit exactly the expected physical sends.
- [ ] **Evidence and QA:** Pure transition/guard contract tests plus Go/TS boundary and mock upstream counts; typed denial and digest audit; exact path/CI evidence.
- [ ] **STOP / rollback / owner boundary:** Keep existing second-attempt fail-closed behavior until a supported pre-send Bifröst per-attempt hook and fresh authorization are demonstrably in place. TypeSpec/new versioned wire requires separate approved contract design, never improvised DTO.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C05 — Changed-destination fallback reauthorization and safe no-send

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 3. **Blocked by:** G11-C04. **Acceptance IDs:** G11-010, G11-011, G11-012.

**Estimated handwritten changed LOC:** code 380 + tests 480 + scripts/config/docs 80 = **940 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 5 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** A fallback to a newly named provider/model/residency boundary cannot inherit the first provider's approval. The new attempt independently re-evaluates original plus ACE-injected data classification, source freshness, secrets, destination allowlist and final body; an explicitly allowed synthetic fallback reaches its mock target once, all forbidden targets receive zero bytes.

**Likely source / owning tests (recheck current HEAD before code):** `src/application/gateway-projection-service.ts`, `src/domain/gateway-projection.ts`, `integrations/bifrost/ace-connector/plugin/main.go`, `integrations/bifrost/ace-connector/connector_test.go`, `test/gateway-projection.contracts.test.ts`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Approved original provider allows an unapproved fallback; private_source is downgraded; a stale receipt authorizes changed model/body or leaked secret content.
- [ ] **GREEN — end-to-end demonstration:** Controlled two-provider mock destinations prove authorized fallback has a fresh bound receipt, while unauthorized provider/data-class/secret/stale-source cases yield audited no-send.
- [ ] **Evidence and QA:** Positive and negative destination matrix + actual mock upstream request counts, distinct receipt IDs/digests and policy outcomes.
- [ ] **STOP / rollback / owner boundary:** No automatic live fallback before real-provider trial. If target data policy cannot be independently checked pre-send, retain fallback blocked.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C06 — Real retry/fallback per-attempt provider-wire acceptance

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 3. **Blocked by:** G11-C02, G11-C04, G11-C05. **Acceptance IDs:** G11-009, G11-010, G11-011, G11-012.

**Estimated handwritten changed LOC:** code 100 + tests 180 + scripts/config/docs 120 = **400 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 3 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** On operator-approved disposable real provider routes, prove one deliberate same-provider retry and one changed-provider/model fallback have distinct pre-send ACE decisions and final-wire/provider acknowledgments, with no egress for an explicitly forbidden target. Report per-route support separately.

**Likely source / owning tests (recheck current HEAD before code):** `scripts/real-provider-evidence.mjs`, `scripts/real-provider-runtime.mjs`, `integrations/bifrost/ace-connector/README.md`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Provider retry/fallback succeeds without its unique bound authorization, or prohibited fallback reaches any real outbound destination.
- [ ] **GREEN — end-to-end demonstration:** Two scoped real-provider flows retain attempt-local hashes, separate authorization, real provider response and correct deny/no-send result. Any unavailable scenario is NOT_RUN, not inferred from mock.
- [ ] **Evidence and QA:** Per-attempt send and response evidence, effective Bifröst fallback settings, provider/model and cost/egress approval references.
- [ ] **STOP / rollback / owner boundary:** Requires separately approved real-provider destinations and controllable transient failure; without these, stop BLOCKED and retain the prior safe fail-closed setting.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C07 — One real coding-agent task through sole Bifröst Gateway

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 4. **Blocked by:** G11-C02. **Acceptance IDs:** G11-013, G11-014, G11-015, G11-016.

**Estimated handwritten changed LOC:** code 170 + tests 250 + scripts/config/docs 120 = **540 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 4 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** A configured coding agent completes one independently verified nontrivial source-retrieval coding task using only Bifröst → authenticated ACE projection → permitted external LLM. Agent identities and the final provider attempt correlate to task output; the visible request is NEVER presented as a durable host/compaction attestation; hidden continuation and direct-provider bypass remain blocked or ineligible.

**Likely source / owning tests (recheck current HEAD before code):** `integrations/bifrost/ace-connector/README.md`, `scripts/real-provider-runtime.mjs`, `src/application/gateway-projection-service.ts`, `test/gateway-projection.contracts.test.ts`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Unapproved provider/data policy, secret-bearing task, hidden continuation, optional second ACE tool path, route bypass or failed coding output is labeled agent E2E accepted.
- [ ] **GREEN — end-to-end demonstration:** Real agent process/task has observable ACE APPLY, real terminal wire, independently checked task result and honest `hostTranscriptAttested=false`/unknown compaction state.
- [ ] **Evidence and QA:** Agent process/build/config, source SHA, route and receipt proof, real-provider result, task quality test, redacted input/output hashes.
- [ ] **STOP / rollback / owner boundary:** Select and approve agent/provider/credentials and public/disposable input first; if agent requires streaming, C03 becomes an additional prerequisite before its real task.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C08 — Harbor matched-arm accounting, provenance and quality gate

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 5. **Blocked by:** G11-C01. **Acceptance IDs:** G11-017, G11-018, G11-019, G11-020.

**Estimated handwritten changed LOC:** code 390 + tests 510 + scripts/config/docs 100 = **1000 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 7 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** Harbor report acceptance cross-checks frozen task/revision and strong baseline parity (agent/model/tools/permissions), binds ACE attempts to final-wire proof before causal attribution, counts input/output and cached/reasoning subsets once, preserves unknown usage and failed/cheap-wrong trials in the quality denominator. A mocked or additive-only attempt cannot claim 5×.

**Likely source / owning tests (recheck current HEAD before code):** `src/adapters/harbor-four-arm-trial-evidence.ts`, `src/domain/harbor-four-arm-evidence.ts`, `scripts/harbor-four-arm-gate.ts`, `scripts/harbor-task-identities.ts`, `test/harbor-four-arm-trial-evidence-adapter.contracts.test.ts`, `test/harbor-four-arm-evidence.contracts.test.ts`, `test/harbor-evaluation-policy.contracts.test.ts`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Different job bytes are treated paired; mock-only APPLY leads to causal savings; cache/reasoning double counted; missing usage treated zero; failed task excluded from report.
- [ ] **GREEN — end-to-end demonstration:** Negative fixture suite rejects every false saving/quality case and a complete synthetic per-arm report is classified correctly as test-only, with no provider certification.
- [ ] **Evidence and QA:** Deterministic Harbor job-binding, raw-trial and provider-usage fixtures with quality/cost totals, source/config hashes and error classification.
- [ ] **STOP / rollback / owner boundary:** Don't introduce a second runner or change baseline capabilities. If provider usage lacks billable counters, mark UNKNOWN instead of estimating billed amount.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C09 — Harbor real paired exploratory pilot with accepted-task oracle

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 5. **Blocked by:** G11-C07, G11-C08. **Acceptance IDs:** G11-017, G11-018, G11-019, G11-020.

**Estimated handwritten changed LOC:** code 140 + tests 220 + scripts/config/docs 140 = **500 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 4 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** Run one bounded matched real-agent Harbor baseline-versus-ACE task with frozen source/job identities, same provider/model/effort/native tools and independent acceptance tests. Retain both results, failures, actual provider/agent tokens/cost/latency (or UNKNOWN) and proof that any reported difference is not automatically causal ACE improvement.

**Likely source / owning tests (recheck current HEAD before code):** `scripts/freeze-harbor-four-arm-jobs.ts`, `scripts/harbor-four-arm-gate.ts`, `scripts/verify-harbor-four-arm-binding.ts`, `integrations/bifrost/ace-connector/README.md`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Unequal arms, missing trial, different permissions, absent final ACE wire or failed cheap answer produces accepted pilot savings.
- [ ] **GREEN — end-to-end demonstration:** Real paired task finishes with raw full per-arm receipts and quality result, or a truthful FAILED/BLOCKED exploratory report. No frozen-holdout or full 5× claim.
- [ ] **Evidence and QA:** Raw agent/provider/Harbor trace digests, task fixture, job byte fingerprints, trial quality and observed billing/usage.
- [ ] **STOP / rollback / owner boundary:** If live agent cannot run comparable Harbor arms or no explicit spend/egress permission exists, mark BLOCKED. A pilot cannot be represented as release acceptance.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.


## G11-C10 — Predeclared frozen holdout and G11 route-level owner acceptance

**Status:** PROPOSED / NOT_IMPLEMENTED. **Design phase:** 5. **Blocked by:** G11-C03, G11-C06, G11-C09. **Acceptance IDs:** G11-004, G11-014, G11-017, G11-018, G11-019, G11-020.

**Estimated handwritten changed LOC:** code 130 + tests 220 + scripts/config/docs 150 = **500 lines**, counting expected added + deleted; approximate, NOT an observed diff. Expected touching 4 existing owned seams (before reassessment at execution HEAD).

**Complete observable deliverable:** Freeze a task/revision/repetition set before seeing outcomes, run every predeclared matched holdout trial, preserve failures/UNKNOWN usage, compute quality-gated baseline-vs-ACE token/cost outcomes and deliver an exact route × provider/model × ACE/Bifröst/config SHA G11 evidence ledger for explicit owner production decision.

**Likely source / owning tests (recheck current HEAD before code):** `scripts/harbor-task-identities.ts`, `scripts/harbor-four-arm-gate.ts`, `docs/operations/harbor-four-arm-byte-binding.md`, `openspec/changes/013-gateway-g11-production-acceptance/tasks.md`. Reuse maintained Bifröst/Go/TypeScript+Effect/Harbor paths; no new agent-facing proxy.

- [ ] **RED — specific failing oracle:** Post-hoc task selection, missing holdout trial, partial/mock G11 proof, absent provider billing or failed task is labeled full release/5× PASS.
- [ ] **GREEN — end-to-end demonstration:** All declared holdout tasks have auditable paired evidence (or a clear incomplete frontier); every G11-001..020 and route has truthfully scoped PASS/FAIL/BLOCKED/NOT_RUN and no automated owner approval.
- [ ] **Evidence and QA:** Frozen dataset hash, all repeated per-task raw provider/agent traces, quality verdict, cost/usage calculations, exact CI/source/uptime pins, owner review handoff.
- [ ] **STOP / rollback / owner boundary:** External benchmark volume is NOT bounded by lines of code: do not shorten holdout after observing results to claim one-pass completion. If larger than one reproducible run, checkpoint and create explicit per-shard continuation in existing `tasks.md`; no false `DONE` or release claim.
- [ ] **ACE phase closure:** verify observed RED→GREEN or justified E2E proof, affected tests and real required provider/agent/Harbor checks; BUILD/ARCH/SEC/PLAN separately, correct delivered HEAD and CI checkout SHA, PR and human merge. Never mark unrun external tests PASS.



## Exhaustive scenario coverage (same 20 spec ACs)

| Scenario | Owning chunk(s) |
| --- | --- |
| G11-001 | G11-C01 |
| G11-002 | G11-C01 |
| G11-003 | G11-C02 |
| G11-004 | G11-C01, G11-C02, G11-C10 |
| G11-005 | G11-C03 |
| G11-006 | G11-C03 |
| G11-007 | G11-C03 |
| G11-008 | G11-C03 |
| G11-009 | G11-C04, G11-C06 |
| G11-010 | G11-C05, G11-C06 |
| G11-011 | G11-C04, G11-C05, G11-C06 |
| G11-012 | G11-C04, G11-C05, G11-C06 |
| G11-013 | G11-C07 |
| G11-014 | G11-C07, G11-C10 |
| G11-015 | G11-C07 |
| G11-016 | G11-C07 |
| G11-017 | G11-C08, G11-C09, G11-C10 |
| G11-018 | G11-C08, G11-C09, G11-C10 |
| G11-019 | G11-C08, G11-C09, G11-C10 |
| G11-020 | G11-C08, G11-C09, G11-C10 |

## Owner and continuation controls

- [ ] Owner reviews architectural/G02 trust-boundary decisions separately. No code implementation authorized merely by the planning PR.
- [ ] External provider/model, coding agent, approved disposable task and spending are explicit prerequisites to respective live chunks; missing selection yields BLOCKED, not a guess.
- [ ] Select **one** OpenSpec tasks plan after comparing this auto-sized candidate with manual PR #256. Do not merge competing `tasks.md` drafts separately; record chosen lineage in the merged PR.
- [ ] Record actual source and CI-tested SHA at each completed slice and advance only its dependency frontier. Real benchmark acceptance requires independently checked task quality and complete predeclared holdout, not 5× claims from a mock, additive context or selected successful run.
