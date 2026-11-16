# G11 implementation plan — eight larger one-context vertical slices

**Planning status:** PROPOSED for owner review of granularity and dependency edges. **G02:** REVIEW_REQUIRED (merging G11 OpenSpec PR #255 is not a human G02 decision). **Decomposition source:** merged `main@badd9301e09a0aee26a324151f84c2f5951fc77a` on 2026-11-16. **Method:** vendored Matt Pocock `to-tickets` + ACE overlay `.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md`. **Canonical location:** this `tasks.md` only.

This consolidates the draft **28-ticket** graph into **8 substantive vertical slices** (`G11-B01..B08`). One slice targets one fresh agent context, one focused reviewable PR, full RED → GREEN → source/CI evidence and an independently demonstrable outcome. The owner has stated that roughly **up to 1,000 changed lines including tests** is an acceptable task size. This is a **sizing heuristic, not a promise or security exception**: the actual upstream hook and external benchmark environment may dominate the time/complexity. No material acceptance criterion, negative policy, provider attestation requirement or owner's production authority is weakened by consolidation.

## Universal execution contract — required for every block

1. **Planning only in this PR.** Before code starts: recorded owner G02 pre-code architecture approval for T2; review/accept this 8-part decomposition. Choose actual real provider/model, budget, safe test data and agent when their block needs external calls. A valid OpenSpec/CI result cannot approve G02, provider egress or production.
2. **One agent, one new context, one block/PR at a time.** Re-inspect current `main` HEAD, actual code, matching `AGENTS.md`, ADRs, accepted OpenSpec, overlap with open PRs, exact pinned Bifröst internals; run required ACE research/implementation preflight and worktree preflight. A task's dependencies must be verified/merged first. Avoid gratuitous cross-layer rewrites to meet a diff target.
3. Follow the existing ACE `docs/research/sdlc/source/templates/phase-template.md` as the per-PR evidence checklist: live file/test map, exact behaviors, actual negative RED, minimal GREEN, owning tests, `npm run test:affected`, appropriate Go tests, focused `npm run verify:pr`, sequential BUILD / ARCH / SEC / PLAN review, repair loop, PR tested SHA. Do not create `.scratch` tickets, GitHub Issues, a second plan tracker, subagents or unapproved installers. A new TypeSpec wire contract is allowed only after explicit design approval and actual codegen/compatibility checks.
4. One vertical slice covers the **real boundary** it promises: agent/request → Bifröst hook → ACE policy/receipt → mock or authorized external provider → evidence/quality, as appropriate. Reuse existing TypeScript+Effect, Go plugin, pinned upstream SSE/attempt machinery and Harbor. Neither a pure interface nor a dummy test passes by itself.
5. **Truthful evidence hierarchy:** deterministic contract tests ≠ controlled mock upstream ≠ real final-send provider wire ≠ real agent task ≠ paired Harbor. Mark PASS / FAIL / BLOCKED / NOT_RUN / UNKNOWN with exact delivered source SHA, CI-tested SHA, Bifröst SHA, route/model/config, attempt digests and privacy-safe supporting records. Revalidate after material runtime/config changes.
6. **Fail closed.** The Gateway-only Bifröst delivery boundary remains; no model-invoked ACE tools, direct Hermes bridge, additional proxy or new Go business server. Non-stream Chat is the initial narrowly qualified route. Unverified streaming, retry/fallback and hidden provider history stay unsupported. Do not treat PreLLM as final provider wire. No silent secret/data policy downgrade, no mock→real promotion, no host transcript/compaction attestation without independent evidence.
7. **Stop precisely.** If a step needs unapproved egress, missing paid credentials, inaccessible live provider, unavailable final-send/per-attempt pinned hook or too much external holdout work, record a real BLOCKED/NOT_RUN outcome, its source/config and missing prerequisite. Preserve current safe operation; never claim an unexecuted test or G11 PASS.
8. Completing a block means: relevant requirements and negative scenarios covered, actual RED/GREEN and provider/Harbor evidence for this block's claimed scope, green relevant CI at its tested checkout SHA, and focused PR merged by the owner. Only then may its checkbox be marked complete and dependents begin. **No automatic merge or production release from this plan.**

## Dependency DAG / available frontier

```text
G02 owner review and explicit acceptance of this plan
    |
    B01  final-wire mock, terminal-order and honest evidence guard
    |\\
    | \\___ B04  attempt-local retry/fallback + mock race/denial
    |
    B02  real provider non-streaming wire
    | \\_____________________
    |                       \\
    B03  streaming mock + real    B05  real retry/fallback  <- B04
    |
    B06  real coding agent E2E (requires B02; B03 only if selected agent mandates stream)
    |
    B07  Harbor strong pair, accounting and exploratory real pilot
    |
    B08  frozen holdout + G11 owner handoff
         (also waits for B03 and B05 for full G11; can report route-specific partial otherwise)
```

**Exact blockers (more precise than the sketch):** B01 none; B02←B01; B03←B01+B02; B04←B01; B05←B02+B04; B06←B02 (conditionally B03); B07←B01+B06; B08←B03+B05+B06+B07 for FULL G11. The absence of B03/B05 must NOT block a truthful *partial non-streaming* status report; it does block blanket G11 acceptance.

## G11-B01 — Final provider-wire: controlled full-path observation and certification guard
**Status:** PROPOSED / unchecked. **Original tickets:** T01–T04. **Design phase:** 1.
**Blocked by:** None (G02 approval is a global pre-code gate). **Acceptance:** G11-001, G11-002, G11-004.

**What is delivered (one vertical slice):** Make one complete non-streaming OpenAI Chat Completions request observable at the final mock-provider send boundary after every Bifröst mutator. Establish the effective terminal plugin order and a route/config/source-bound evidence verdict that cannot mistake a hook receipt, fake provider response, later mutation or stale pins for real-provider certification.

**Implementation and owning seams:** Reuse pinned Bifröst Go connector/plugin, existing Gateway HTTP capability semantics and real-provider evidence scripts. Add only the minimum final-send mock observer + manifest validator needed to bind request ID, destination/model, ingress, ACE APPLY receipt, protected original fields, exactly one ACE message and final-wire digest. Capture negative late-mutator/ordering fixtures. Check whether the pinned upstream actually exposes a terminal guard; if not, record the precise upstream seam and STOP rather than add a hidden second proxy.

- [ ] **RED:** A mock upstream 'success' or PreLLM receipt alone promotes provider-wire, a later mutator changes original fields undetected, unknown stream/route is certified, or a changed source/plugin SHA retains approval.
- [ ] **GREEN:** Pinned Bifröst → ACE → mock upstream yields a reproducible final-send record preserving original messages/tools/opaque fields and exactly one ACE addition; mutation/config drift is rejected. The classification is MOCK_WIRE_VERIFIED only.
- [ ] **Verification / evidence:** Runnable mock-upstream integration and negative mutations; pinned Bifröst/ACE/config identity; redacted digest manifest; exact test commands/exit, CI checkout SHA and separate BUILD/ARCH/SEC/PLAN verdict.
- [ ] **Stop / rollback:** No real provider egress. Missing enforceable terminal hook/order or unverified interception => BLOCKED; keep current providerWire not_certified / HTTP 501 unless a separately approved public behavior design changes it.

## G11-B02 — First authorized real-provider non-streaming send
**Status:** PROPOSED / unchecked. **Original tickets:** T05. **Design phase:** 1.
**Blocked by:** G11-B01. **Acceptance:** G11-003, G11-004.

**What is delivered (one vertical slice):** With explicit operator approval, send a disposable public/synthetic non-streaming Chat request via actual pinned Bifröst → ACE → one named real provider and produce an evidence-backed provider-wire verdict for that exact route; do not assert real-agent completion.

**Implementation and owning seams:** Use B01's final-send observation and existing provider scripts; configure only the chosen provider/model, credentials/data policy, plugin order and allowlist. Verify returned response belongs to the specific authorized attempt and network destination. Harden any missing evidence mapping or safe operator setup without building another API.

- [ ] **RED:** Absent opt-in, secret-bearing prompt, wrong destination/model, unverified order, fake upstream or missing provider response cannot be certified or forwarded.
- [ ] **GREEN:** Exactly the approved provider/model returns a correlated true provider response; final-send digest, ACE receipt, source SHA, plugin pin and privacy-safe artifacts match. Only this non-streaming route reaches REAL_PROVIDER_WIRE_VERIFIED.
- [ ] **Verification / evidence:** Operator approval reference, actual provider/process identity, egress policy, response identity, final-send bytes/digests, safe evidence record, deterministic gate checks and exact CI SHA.
- [ ] **Stop / rollback:** If provider/model/credentials/egress/cost permission are missing, STOP with BLOCKED/NOT_RUN, no unauthorized or simulated real call.

## G11-B03 — Streaming: supported route, SSE completion, cancellation, failures and real send
**Status:** PROPOSED / unchecked. **Original tickets:** T06–T10. **Design phase:** 2.
**Blocked by:** G11-B01, G11-B02. **Acceptance:** G11-005, G11-006, G11-007, G11-008.

**What is delivered (one vertical slice):** Qualify one precisely named stream=true Chat variant end to end: reject unverified vendor/tool/multimedia shapes, preserve request projection and ordered response chunks, classify terminal success vs cancellation/partial/truncation and incomplete usage, then—only with separate approval—observe a real streaming provider response.

**Implementation and owning seams:** Extend the existing pinned Bifröst streaming path and Go/ACE route checks only where actual supported seams exist. Reuse Bifröst SSE framing and Harbor partial/usage handling; do not write a parallel SSE proxy/parser. Cover stream=true, tool deltas, terminal event, client disconnect/deadline, irreversible bytes, transport abort, missing usage and unsupported streams.

- [ ] **RED:** stream=true is silently rewritten to false; post-ACE original body or tools change; unsupported variant egresses; cancel triggers another attempt; truncated SSE is called complete; missing provider usage becomes zero.
- [ ] **GREEN:** Mock upstream demonstrates full supported stream and no-send/partial negative cases; a separately authorized real provider trial completes with request/attempt/chunk/terminal correlation, or remains explicitly NOT_RUN if unavailable.
- [ ] **Verification / evidence:** Mock and permitted real stream traces labeled separately, deterministic cancellations, route-specific verdict, timeouts, exact source/config SHA and failure counters; no private chunk payload in logs.
- [ ] **Stop / rollback:** If effective terminal stream seam is absent or the real model's stream shape is unverified, keep streaming disabled for that variant. Real cancel/abort cases not exercised cannot be inferred from mock outcomes.

## G11-B04 — Retry/fallback: per-attempt ACE authorization, policy and race safety
**Status:** PROPOSED / unchecked. **Original tickets:** T11–T15. **Design phase:** 3.
**Blocked by:** G11-B01. **Acceptance:** G11-009, G11-010, G11-011, G11-012.

**What is delivered (one vertical slice):** Make a second physical provider attempt possible ONLY behind a fresh single-use ACE authorization bound to that attempt's actual body, provider/model, data class and expiry; same-route retry and changed-destination fallback are re-evaluated. Preserve zero egress for denied, replayed, raced, stale or uncertain attempts.

**Implementation and owning seams:** At the existing Go PreLLM/actual Bifröst attempt seam and TS+Effect Gateway policy boundary, model immutable Planned→Authorized→Dispatched/Denied/Partial transitions and one-use concurrency-safe binding; integrate the explicit policy/source freshness/secret checks. Compare exact code with pinned Bifröst upstream to ensure an intercept before every outbound attempt. Reuse existing receipt and Gateway security; use TypeSpec only if a separately approved actual new public wire contract requires it. Include same-provider retry and allowed/forbidden changed-provider fallback in one mock-driven vertical slice.

- [ ] **RED:** Ingress APPLY receipt grants retry; changed provider inherits old allowlist; private data downgrades; old context digest is reused; a concurrent double-send wins; outage, timeout, restart or replay silently becomes APPLY.
- [ ] **GREEN:** Controlled upstream observes two distinct attempt receipts only for authorized retry/fallback; forbidden destinations yield zero sends; repeated/concurrent receipts permit at most one, unavailable ACE denies, and current first attempt remains good.
- [ ] **Verification / evidence:** Deterministic Go+TS integration/contract tests, mock destination/attempt counts, single-use/restart/timeout cases, typed denial, focused CI and source/attempt provenance.
- [ ] **Stop / rollback:** If Bifröst lacks a supported per-attempt before-send hook, don't invent a second proxy or silently enable retries; leave existing default fail-closed until owner reviews an upstream extension.

## G11-B05 — Real provider retry and fallback: separate live attempt and destination proofs
**Status:** PROPOSED / unchecked. **Original tickets:** T16–T17. **Design phase:** 3.
**Blocked by:** G11-B02, G11-B04. **Acceptance:** G11-009, G11-010, G11-011, G11-012.

**What is delivered (one vertical slice):** Verify in a deliberately controlled, explicitly authorized live failure/retry and changed-destination fallback that EACH outbound attempt has its own ACE authorization and final-wire/response evidence; disallowed fallback sends nothing.

**Implementation and owning seams:** Use B04's approved attempt-local semantics and B01/B02's terminal-send observer. Test exact provider/model/attempt binding for a retry after controlled transient failure and one separately approved fallback destination; exercise negative no-send failures. Add only narrow harness repairs if existing observability is insufficient.

- [ ] **RED:** Auto-retry without a fresh receipt, provider drift, forbidden second data recipient, reused body digest or unavailable ACE is promoted as successful.
- [ ] **GREEN:** Provider-wire records show distinct per-attempt identities, fresh policy and observed true network outcomes; denied second attempts never reach any real provider.
- [ ] **Verification / evidence:** Two scoped live scenarios with separate approved provider/model/price/data-policy records, final-send/response hashes and exact route/config pins.
- [ ] **Stop / rollback:** Requires explicit credentials, budget and egress opt-in for each destination plus controllable failure. Missing either -> BLOCKED; mock evidence never replaces the real proof.

## G11-B06 — Real coding-agent E2E: solely Bifröst, honest host state and accepted task
**Status:** PROPOSED / unchecked. **Original tickets:** T18–T20. **Design phase:** 4.
**Blocked by:** G11-B02. **Acceptance:** G11-013, G11-014, G11-015, G11-016.

**What is delivered (one vertical slice):** A real chosen coding agent performs one nontrivial disposable source-retrieval task through its configured Bifröst endpoint, authenticated ACE projection and approved real provider; independently validate the task outcome and ensure no second ACE tool route or direct-provider bypass.

**Implementation and owning seams:** Use actual agent process/client configuration, source/task quality oracle and existing Go host-attestation and Gateway continuation guard. Keep native agent shell/git/test capabilities. Test hidden provider-held continuation and missing authorization; classify durable host transcript and compaction as unattested without a separate authenticated attestor.

- [ ] **RED:** Direct-provider bypass, optional ACE tool route, hidden provider continuation, false host-compaction claim, secret prompt, stale source or failed coding task still earns G11 agent PASS.
- [ ] **GREEN:** One real completed task has end-to-end process/agent/ACE APPLY/provider proof, independently checked test output, correct data policy and honest host/history limits.
- [ ] **Verification / evidence:** Agent version/process/config, task source SHA, real wire attempt, redacted trace hashes, independent task-quality evidence, and explicit limitations.
- [ ] **Stop / rollback:** Agent/provider selection and real egress require owner opt-in. If the selected agent mandates streaming, G11-B03 must be complete before this task; this is a documented CONDITIONAL edge, not blanket serialization.

## G11-B07 — Harbor paired pilot: strong baseline, evidence binding, usage and quality
**Status:** PROPOSED / unchecked. **Original tickets:** T21–T25. **Design phase:** 5.
**Blocked by:** G11-B01, G11-B06. **Acceptance:** G11-017, G11-018, G11-019, G11-020.

**What is delivered (one vertical slice):** Create one verifiable matched Harbor baseline-vs-ACE task pair for the real coding-agent and actually run a bounded exploratory paired trial. A completed comparison must retain failures, preserve baseline native capabilities, use exact task/model/permissions pins, distinguish billed usage from subsets and refuse causal ACE savings without bound final-wire receipts.

**Implementation and owning seams:** Reuse existing four-arm/three-arm Harbor adapters, byte-bound task identity scripts, raw trial reconciliation and quality-first gates. Extend only actual missing provider usage/cached/reasoning/cost and gateway attempt attribution. No new runner or second reporting system. Keep trial manifest and redacted evidence in existing Harbor location.

- [ ] **RED:** Mismatched bytes/agent/effort/tools get paired; no ACE APPLY/final-send gets causal savings; cache/reasoning double counted; unknown tokens called zero; timed-out/failed cheap arm disappears or passes quality.
- [ ] **GREEN:** A frozen one-task pilot pair validates byte-identical tasks and comparable agent/settings, real trial records include ALL attempts, cost/usage availability, independent quality result and a truthful exploratory-only verdict.
- [ ] **Verification / evidence:** Source/task hashes, raw per-arm and failure evidence, provider-reported usage or UNKNOWN, latency/cost, strong baseline settings and no fivefold claim from a single pilot.
- [ ] **Stop / rollback:** Requires explicit budget/egress approval. If the verified agent cannot run Harbor with same native capabilities across arms, report BLOCKED rather than game the comparator.

## G11-B08 — Frozen Harbor holdout and final G11 route-by-route owner handoff
**Status:** PROPOSED / unchecked. **Original tickets:** T26–T28. **Design phase:** 5.
**Blocked by:** G11-B03, G11-B05, G11-B06, G11-B07. **Acceptance:** G11-004, G11-014, G11-017, G11-018, G11-019, G11-020.

**What is delivered (one vertical slice):** Freeze a predeclared held-out set of source/task identities, execute matched baseline-vs-ACE on that set using the accepted Harbor runner, reconcile failures/quality/usage/cost, and produce a per-scenario/per-route G11 ledger for explicit owner production decision.

**Implementation and owning seams:** Use existing Harbor task identity freezer and approved job/byte-binding scripts, with only the least missing report/evidence glue. Define number of tasks, repetitions and bounded shards BEFORE seeing ACE scores; keep holdout independent from B07's pilot. Reuse full real-provider/agent evidence from prior blocks.

- [ ] **RED:** Holdout changes after runs, missing arms/shards, wrong source hash, incomplete/cached usage double-count, failed tasks filtered or mock-only/partial capability promoted to blanket G11 PASS/5×.
- [ ] **GREEN:** All predeclared eligible tasks/shards have actual paired evidence and independent quality scores; exact route × model × Bifröst/ACE SHA verdict is justified or explicitly NOT_RUN/BLOCKED; owner signoff remains a separate action.
- [ ] **Verification / evidence:** Frozen manifest, actual task/agent/provider/runtime identity and raw-trace hashes, complete usage/cost/failure accounting, exact CI-tested source SHA and 20/20 acceptance crosswalk.
- [ ] **Stop / rollback:** Do NOT silently shrink or choose a favorable holdout to fit a context window. If the predeclared benchmark cannot execute/verify in one bounded session, STOP with partial shard evidence and a precise remaining-shard frontier; this is an external trial-volume limitation, not permission for a false one-pass PASS. Owner approval is never inferred from green CI.


## Stable acceptance coverage across all eight blocks

| OpenSpec G11 scenario | One-pass owning block(s) |
| --- | --- |
| G11-001 | G11-B01 |
| G11-002 | G11-B01 |
| G11-003 | G11-B02 |
| G11-004 | G11-B01, G11-B02, G11-B08 |
| G11-005 | G11-B03 |
| G11-006 | G11-B03 |
| G11-007 | G11-B03 |
| G11-008 | G11-B03 |
| G11-009 | G11-B04, G11-B05 |
| G11-010 | G11-B04, G11-B05 |
| G11-011 | G11-B04, G11-B05 |
| G11-012 | G11-B04, G11-B05 |
| G11-013 | G11-B06 |
| G11-014 | G11-B06, G11-B08 |
| G11-015 | G11-B06 |
| G11-016 | G11-B06 |
| G11-017 | G11-B07, G11-B08 |
| G11-018 | G11-B07, G11-B08 |
| G11-019 | G11-B07, G11-B08 |
| G11-020 | G11-B07, G11-B08 |

## Completion / controlled review boundary

- [ ] Owner confirms intended granularity (8 blocks, up to ~1,000 changed lines including tests when appropriate) and the exact DAG.
- [ ] Owner reviews the existing `design.md` G02 crosswalk and explicitly records pre-code T2 G02 decision before B01 implementation; any terminal attempt seam requiring a new upstream API triggers a new decision, not an undocumented workaround.
- [ ] External provider/model, costs and safe synthetic/disposable data are separately authorized before B02, B03 (real stream), B05, B06 and B07/B08. No owner response is treated as silent consent.
- [ ] For B08 freeze task count, repetition count and shard size **before** viewing benchmark outcomes. A holdout too large for one fresh context is honestly split into follow-up executions under owner-reviewed dependency updates, not selectively truncated or falsely marked complete; eight is the intended planning decomposition, not a promise that arbitrarily large external trials complete in eight elapsed sessions.
- [ ] After each block PR merges, recheck latest source and exact runtime pins; update existing OpenSpec task status and evidence without manufacturing a parallel tracker.
- [ ] Final acceptance is per exact route/provider/model/stream mode/ACE+Bifröst SHA and bounded by independent task quality, token/cost evidence and explicit owner production approval. No automatic 5× token savings claim.
