# Tasks — G11 one-context tracer-bullet implementation queue

**Planning status:** PROPOSED for owner granularity/dependency review. **G02:** REVIEW_REQUIRED, not approved merely because PR #255 was merged. **Source at decomposition:** `main@badd9301e09a0aee26a324151f84c2f5951fc77a` (2026-11-16; merged PR #255). **Technique:** vendored Matt Pocock `to-tickets`, subordinated to `.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md`. Tickets live **only here**, in canonical OpenSpec; no separate issue tracker, `.scratch` task tree or agent orchestration.

This replaces the previous six broad phases with 28 narrow, owner-reviewable **tracer-bullet vertical slices**. Each produces one independently observable end-to-end behavior or evidence verdict, a negative test, and an outcome that can be verified without completing all other slices. Reuse existing paths/engines. Phase headings preserve `design.md` G02 phase numbers; a phase is NOT itself a single agent job. Tickets are **proposed one-fresh-context targets**, not a promise of success if upstream extension seams, credentials, real provider, agent or Harbor availability are missing.

## Global execution contract (applies to every G11-Txx)

1. **Do not implement now.** Before the first code ticket, the human owner must review/approve G02 decisions and approve this decomposition. A merged OpenSpec document or structural validator is not G02 approval. External provider/model, dataset and cost/egress permissions need an additional explicit owner decision before any real run.
2. For each ticket: re-check `main` SHA, scoped `AGENTS.md`, owner decisions, current source/testing seams and already-merged blockers; run ACE `sdlc:preflight` at the correct T2 stage and the existing worktree preflight. **One agent, one bounded ticket per fresh context, one focused PR**, no direct edits to `main`. A blocked prerequisite means do not start the dependent ticket.
3. Make the slice vertical: observable ingress/request → relevant ACE policy/connector/provider/Harbor boundary → accepted output or safe denial → cheapest real owning test. No standalone unused interface or fake "completed" internal stub. Before code, inspect exact pinned Bifröst seam and existing maintained utilities; no new proxy, Go ACE service, model-invoked ACE tool, bespoke SSE parser or second benchmark orchestrator.
4. Before editing write the specific RED test or a documented fixture/evidence rejection; GREEN means the same scope passes while the original negative still fails. Run `npm run test:affected` on code slices and bounded `npm run verify:pr` for a PR handoff; add pinned Go tests and TypeSpec compatibility only when actual surfaces are touched. Complete sequential **BUILD / ARCH / SEC / PLAN** reviews. An infrastructure/real-provider experiment may use a reproducible evidence oracle rather than fictional unit-test RED/GREEN.
5. Retain exact **source branch HEAD, actual CI checkout/tested SHA, Bifröst upstream commit, provider/model/route/stream configuration, task/data-class policy and evidence hashes**. Mark PASS/FAIL/BLOCKED/UNKNOWN/NOT_RUN separately for deterministic, mock upstream, real provider wire, real coding-agent, Harbor and owner review. Ignore self-attested success labels that lack underlying evidence.
6. **Gateway-only** is invariant; default nonstreaming Chat and current retry/fallback fail-closed behavior stay intact until their specific new path has been verified. No public `ace.gateway.v1` contract edit unless separately designed, TypeSpec-authored and approved. A mock cannot promote a real provider stage, a receipt cannot prove final wire, and Bifröst cannot attest agent durable transcript/compaction.
7. Technical failure, absent API/credentials, provider refusal, unsuitable real coding-agent, missing final-send seam or inability to isolate the task: **STOP the one pass**, record observed failure and a precise next prerequisite; do not fill remaining context with speculative code. External trial without opt-in is BLOCKED (never "dry-run passed").
8. Before starting a ticket, lift its six statements below into the existing ACE `docs/research/sdlc/source/templates/phase-template.md` structure **inside its PR/worktree execution evidence**, with current exact file/test owner map. Do not create another persistent plan outside canonical OpenSpec. Close the ticket checkbox only after evidence and owner merge; then the next real DAG frontier becomes eligible.

## Dependency frontier

- **First after G02 approval:** G11-T01. **Next independent branches once T01 lands:** G11-T02 (wire) and G11-T06 (unsupported streaming rejection).
- Mock/provider wire G11-T02 → T03 → T04 → T05. Stream G11-T06 + T02 → T07 → T08/T09 → T10 after T05.
- Attempt authorization G11-T03 → T11 → T12/T13 → T14 → T15 → T16/T17 (plus T05 for real calls).
- Real coding-agent G11-T05 → T18 → T19 → T20. T10 is **conditional** only if the selected agent requires streaming; otherwise do not block the supported nonstreaming path.
- Harbor G11-T18 → T21; T04+T21 → T22; T21 → T23/T24. T20+T21..T24 → T25 → T26 → per-shard T27 → T28. G11-T28 also waits for T10/T16/T17 for **full-scope** G11; a partial route-specific verdict must still label others NOT_RUN/BLOCKED.

## Phase 1: Terminal wire and first real non-streaming provider

### G11-T01 — Route evidence ledger rejects unsupported certification
**Status:** PROPOSED / unchecked. **Blocked by:** None after owner G02 approval. **Spec acceptance:** G11-004, G11-020.
- [ ] **One-pass deliverable:** A local G11 evidence query for the exact ACE SHA, Bifröst SHA, plugin order, route and provider/model returns NOT_CERTIFIED by default; mock-only, stale or missing proof cannot promote it.
- [ ] **Owning seam:** Gateway health/readiness reporting plus a narrow evidence validator and a negative fixture; preserve the existing public v1 DTO unless a separately approved contract change is needed.
- [ ] **RED:** A synthetic `real_provider` label backed by mock evidence or changed source/config is incorrectly accepted.
- [ ] **GREEN:** Known valid fixture is classified only at its actual stage; unknown/changed tuple remains NOT_CERTIFIED, with a nonzero failure for false promotion.
- [ ] **Evidence / oracle:** Deterministic fixture outcomes and exact manifest hashes; real-provider NOT-RUN.
- [ ] **Fail-closed / stop:** No new external call, no production-ready label.

### G11-T02 — Pinned Bifröst mock provider sees exact projected wire
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T01. **Spec acceptance:** G11-001.
- [ ] **One-pass deliverable:** One non-streaming Chat request traverses the compiled native plugin and pinned Bifröst to a controlled mock upstream; the observer compares final bytes/semantics and ties them to receipt, destination and request ID.
- [ ] **Owning seam:** Existing Go plugin/connector, pinned build script and mock-upstream contract setup; do not implement a second proxy.
- [ ] **RED:** Omitted ACE message, changed original field/tool or wrong final body digest must fail the observer.
- [ ] **GREEN:** The controlled upstream captures exactly one ACE context addition and unchanged protected fields at the final send path.
- [ ] **Evidence / oracle:** Mock-only final-wire record with Bifröst/ACE pin, receipt and digest; label MOCK_WIRE_VERIFIED only.
- [ ] **Fail-closed / stop:** If the pinned Bifröst version has no observable final-send seam, record BLOCKED and the exact missing upstream hook.

### G11-T03 — Terminal plugin order and later-mutator negative proof
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T02. **Spec acceptance:** G11-002.
- [ ] **One-pass deliverable:** A deployment candidate with a late custom request mutator is rejected or explicitly remains uncertified before real-provider use; acceptable terminal plugin order has retained effective configuration evidence.
- [ ] **Owning seam:** Bifröst loaded plugin configuration plus the existing Go PreLLM guard and a mock post-hook mutator fixture.
- [ ] **RED:** A later plugin mutation passes the certification check or reaches mock upstream as an apparently valid ACE send.
- [ ] **GREEN:** A negative post-ACE mutator/order fixture blocks qualification, and positive terminal order is verifiable by effective runtime config.
- [ ] **Evidence / oracle:** Loaded ordering, negative mock-wire observation, no real-provider claim.
- [ ] **Fail-closed / stop:** If pinned upstream cannot enforce an uncontested final guard, stop for explicit design/owner decision; never assert hook receipt is final-wire proof.

### G11-T04 — Real-provider evidence cannot be forged by a mock receipt
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T02, G11-T03. **Spec acceptance:** G11-003, G11-004.
- [ ] **One-pass deliverable:** An evidence packet verifier accepts only provenance-complete, per-attempt final-send observation plus correlated real-provider response; synthetic upstream or header-only success is rejected as G11 provider proof.
- [ ] **Owning seam:** Reuse existing real-provider evidence scripts and Gateway receipt/provenance semantics; keep restricted bytes private.
- [ ] **RED:** A mock `200 OK`, missing final-send digest, absent provider response or changed pin is promoted to real-provider PASS.
- [ ] **GREEN:** The evidence validator rejects negatives and generates an honest redacted proof manifest from a complete fixture.
- [ ] **Evidence / oracle:** Negative/positive fixture validation; actual real-provider trial still NOT-RUN.
- [ ] **Fail-closed / stop:** Do not change `/record-delivery` 501 or TypeSpec Gateway v1 incidentally; public protocol changes require their own accepted design.

### G11-T05 — First authorized real-provider non-streaming Chat attempt
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T04. **Spec acceptance:** G11-003, G11-004.
- [ ] **One-pass deliverable:** A disposable public/synthetic Chat request reaches one explicitly approved real provider through pinned Bifröst + ACE and returns a correlated provider response with final-send evidence.
- [ ] **Owning seam:** Existing Gateway runtime, pinned connector and approved evidence harness; no new transport implementation.
- [ ] **RED:** A bad opt-in, mismatched provider/model, missing terminal order or missing evidence prevents the attempt or its certification.
- [ ] **GREEN:** One allowed real attempt has source/runtime identity, provider result, request/attempt binding and privacy-safe artifact hashes.
- [ ] **Evidence / oracle:** Real provider wire stage only; agent-E2E and quality benefit remain NOT-RUN.
- [ ] **Fail-closed / stop:** Requires owner-selected provider/model, disposable task, explicit cost/credential/egress permission; without these report BLOCKED and do not send.

## Phase 2: Streaming qualification and failure semantics

### G11-T06 — Unsupported streaming variants reject before provider egress
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T01. **Spec acceptance:** G11-006.
- [ ] **One-pass deliverable:** A stream=true or opaque stream variant not certified for the exact route is denied before outbound network traffic, with no silent stream=false rewrite.
- [ ] **Owning seam:** Bifröst HTTP ingress/ACE route capability and targeted Go + Gateway negative tests.
- [ ] **RED:** An unqualified stream/tool/multimodal request reaches a fake upstream or changes its stream flag silently.
- [ ] **GREEN:** No send occurs; explicit unsupported capability is returned while currently certified non-stream requests remain unchanged.
- [ ] **Evidence / oracle:** One mock-upstream zero-egress test and exact route capability verdict.
- [ ] **Fail-closed / stop:** Keep streaming disabled outside the separately qualified route; no blanket streaming certification.

### G11-T07 — One supported stream completes on a controlled upstream
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T02, G11-T06. **Spec acceptance:** G11-005, G11-006.
- [ ] **One-pass deliverable:** For an explicitly named Chat streaming variant, the pinned Bifröst/ACE path preserves protected request semantics and a controlled SSE response reaches a correct terminal event.
- [ ] **Owning seam:** Existing Bifröst stream path and Go plugin tests; reuse its SSE parser/event framing instead of inventing a proxy.
- [ ] **RED:** Stream flag, tool deltas or request projection mutate, or an incomplete SSE response is marked completed.
- [ ] **GREEN:** One synthetic stream variant preserves request fields, chunk order, completion marker and observed upstream attempt ID.
- [ ] **Evidence / oracle:** Mock-stream PASS only; exact route remains unapproved for live use until T10.
- [ ] **Fail-closed / stop:** If Bifröst cannot preserve the variant, keep it unsupported and record the upstream limitation.

### G11-T08 — Client disconnect/deadline leaves no unauthorized stream attempts
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T07. **Spec acceptance:** G11-007.
- [ ] **One-pass deliverable:** A caller cancel/disconnect during a controlled stream yields a cancelled/partial result and does not spawn a new unauthorised upstream attempt.
- [ ] **Owning seam:** Existing stream cancellation hooks, deadlines and provider attempt guard; deterministic barriers rather than sleeps.
- [ ] **RED:** Post-cancel extra attempt occurs or a partial send is falsely described as rolled back.
- [ ] **GREEN:** Partial/irreversible bytes are acknowledged and a zero-extra-send assertion passes.
- [ ] **Evidence / oracle:** Controlled cancellation trace; live provider cancellation is separately required for production claims.
- [ ] **Fail-closed / stop:** Do not promise remote bytes can be retracted after dispatch.

### G11-T09 — Truncated stream and absent usage remain partial/UNKNOWN
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T07. **Spec acceptance:** G11-008.
- [ ] **One-pass deliverable:** A controlled midstream abort, malformed terminal event or absent provider usage is visible as failure/partial, never a clean completion or zero tokens.
- [ ] **Owning seam:** Bifröst stream output handling and existing Harbor failure/usage evidence admission.
- [ ] **RED:** Truncated chunks produce success or a missing usage field is converted to numeric zero.
- [ ] **GREEN:** Failure category and incomplete usage propagate to evidence consumers while preserving observed chunk order.
- [ ] **Evidence / oracle:** Synthetic failure trace and Harbor-facing partial record; real-provider failure proof remains separate.
- [ ] **Fail-closed / stop:** Do not export private chunk content in logs.

### G11-T10 — One real provider streaming route is independently certified
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T05, G11-T07, G11-T08, G11-T09. **Spec acceptance:** G11-005, G11-006, G11-007, G11-008.
- [ ] **One-pass deliverable:** An explicitly approved real-provider Chat streaming request has final-send capture, correctly completed chunks and attempt/usage correlation; the certification covers ONLY its tested variant.
- [ ] **Owning seam:** Approved stream-capable agent/provider endpoint and existing evidence gate.
- [ ] **RED:** Provider lacks expected stream capability/terminal signal or altered route causes a clear FAIL/BLOCKED, not a downgrade.
- [ ] **GREEN:** One real stream completes with redacted proof; separate cancellation/abort claims remain limited to actually observed evidence.
- [ ] **Evidence / oracle:** Real stream trace, final-send digest, provider response and route-specific verdict.
- [ ] **Fail-closed / stop:** No unapproved egress. Unobserved real abort/cancel cases must remain NOT-RUN, not inferred from mock tests.

## Phase 3: Single-use retry/fallback authorization

### G11-T11 — Attempt authorization refuses inherited or missing single-use identity
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T03. **Spec acceptance:** G11-009, G11-011.
- [ ] **One-pass deliverable:** An attempted second send without an independent receipt or with a reused receipt is blocked at the provider attempt seam; the first valid attempt remains unaffected.
- [ ] **Owning seam:** Current Go PreLLM repeated-attempt blocking + ACE request/receipt domain contract; TypeSpec source only if a newly approved public wire shape is actually needed.
- [ ] **RED:** Receipt from ingress or an unrelated attempt permits two sends or a changed attempt body.
- [ ] **GREEN:** Attempt 0 is permitted; attempt 1 without fresh authorization is denied and mock upstream sees no second request.
- [ ] **Evidence / oracle:** Deterministic Go/TS negative request→guard→mock-send trace, no provider calls.
- [ ] **Fail-closed / stop:** Do not weaken current retry/fallback block while the fresh-authorization protocol is absent.

### G11-T12 — Same-provider retry obtains fresh ACE authorization
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T11, G11-T02. **Spec acceptance:** G11-009.
- [ ] **One-pass deliverable:** After a controlled first-attempt transient failure, the same provider/model makes a second mock upstream call ONLY when ACE authorizes a newly bound attempt with its own digest and expiry.
- [ ] **Owning seam:** Bifröst per-attempt integration with existing ACE Effect policy/secret checks and Go connector; preserve single-use semantics.
- [ ] **RED:** Retry skips ACE, reuses attempt 0 receipt or sends after a denied/expired decision.
- [ ] **GREEN:** Two observed mock sends bind to different attempt IDs; denial prevents the second send.
- [ ] **Evidence / oracle:** Fake upstream two-attempt positive/negative sequence and recorded policy decisions.
- [ ] **Fail-closed / stop:** If current pinned Bifröst lacks a pre-send retry seam, STOP for owner design choice; no background retry workaround.

### G11-T13 — Fallback to unknown/disallowed provider is rejected
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T11. **Spec acceptance:** G11-010, G11-012.
- [ ] **One-pass deliverable:** A changed fallback model/provider or data-residency destination not explicitly authorized has zero provider egress, including when the initial attempt was permitted.
- [ ] **Owning seam:** ACE ProjectDataPolicy, external opt-in/provider allowlist and Bifröst fallback attempt guard.
- [ ] **RED:** A fallback inherits original provider approval, downgrades private_source or slips a secret-bearing payload through.
- [ ] **GREEN:** Negative destination/model/data-class matrices deny the changed route and preserve audit metadata without prompt bytes.
- [ ] **Evidence / oracle:** Controlled mock upstream no-send assertions per forbidden destination.
- [ ] **Fail-closed / stop:** Do not enable general automatic fallback while provider identity and policy recheck remain unresolved.

### G11-T14 — One allowed fallback gets its own authorized projection
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T12, G11-T13. **Spec acceptance:** G11-010.
- [ ] **One-pass deliverable:** A preapproved fallback to a different explicit provider/model rechecks the exact final body, data class, source freshness and recipient policy and receives a distinct single-use receipt.
- [ ] **Owning seam:** Existing ACE egress decision and Bifröst attempt-local route; no parallel authorization mechanism.
- [ ] **RED:** Allowed original provider but rejected target still sends, or projected source evidence changes without recheck.
- [ ] **GREEN:** Mock upstream observes a second, newly approved destination with exact bound payload; forbidden target is blocked.
- [ ] **Evidence / oracle:** Positive/negative controlled fallback with route/body hashes and policy audit.
- [ ] **Fail-closed / stop:** A different paid provider is not authorized for a real trial merely by this mock qualification.

### G11-T15 — Replay, concurrent retry and ACE outage fail closed
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T12, G11-T14. **Spec acceptance:** G11-011, G11-012.
- [ ] **One-pass deliverable:** Simultaneous/replayed attempts and unavailable/timeout/NOT_READY ACE authorization cannot dispatch more than the single authorized send.
- [ ] **Owning seam:** Go attempt guard and ACE Effect cancellation/timeouts; use deterministic race barriers and process-restart fixture as applicable.
- [ ] **RED:** Two concurrent consumers share a receipt or timeout causes retry via old permission.
- [ ] **GREEN:** Exactly one authorized send (or zero on outage), typed denial and privacy-safe audit for all losers.
- [ ] **Evidence / oracle:** Bounded replay/race/restart and fault-injection tests, no real external provider.
- [ ] **Fail-closed / stop:** Never treat a transport exception as an implicit APPLY.

### G11-T16 — Actual provider retry proves fresh per-attempt wire
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T05, G11-T12, G11-T15. **Spec acceptance:** G11-009, G11-011, G11-012.
- [ ] **One-pass deliverable:** A scoped real-provider retry trial proves both actual outbound attempts have their OWN ACE authorization and final-send receipts; a policy failure has no second outbound send.
- [ ] **Owning seam:** Already qualified retry path, operator-approved synthetic request and recorded provider/attempt identities.
- [ ] **RED:** Unexpected auto-retry, missing attempt identity or replay prevents live qualification.
- [ ] **GREEN:** The controlled failure/retry scenario has separate final-send/provider records and error/no-send evidence.
- [ ] **Evidence / oracle:** Real-provider per-attempt ledger; exact retry configuration and source hashes.
- [ ] **Fail-closed / stop:** Requires explicit spend/egress approval and a controllable retry stimulus; otherwise report BLOCKED/NOT-RUN.

### G11-T17 — Actual provider fallback proves destination-specific policy
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T05, G11-T14, G11-T15. **Spec acceptance:** G11-010, G11-011, G11-012.
- [ ] **One-pass deliverable:** A scoped real fallback trial proves the changed provider/model is individually authorized and its final wire matches that decision; disallowed fallback sends nothing.
- [ ] **Owning seam:** Already mock-qualified fallback integration, two explicitly chosen provider/model identities and live observer.
- [ ] **RED:** Any provider drift, unlicensed destination or incorrect body authorization cancels the trial.
- [ ] **GREEN:** One permitted fallback has its own final-wire and response evidence while denied fallback has zero egress.
- [ ] **Evidence / oracle:** Separate per-provider real-send hashes, policy decisions and restricted redacted artifacts.
- [ ] **Fail-closed / stop:** Requires approval for BOTH destinations and usage/cost; if unavailable retain fallback BLOCKED.

## Phase 4: Real coding-agent through the sole Bifröst path

### G11-T18 — Real coding-agent endpoint uses only Bifröst route
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T05. **Spec acceptance:** G11-013, G11-015.
- [ ] **One-pass deliverable:** One real coding-agent process with a configurable provider endpoint produces a model request through Bifröst with the ACE request-bound receipt, and cannot accidentally use a second ACE delivery path.
- [ ] **Owning seam:** Agent's real endpoint configuration plus Bifröst/ACE native plugin; use the currently verified non-streaming route if the agent supports it.
- [ ] **RED:** Direct-provider bypass, absent normalized session correlation or obsolete ACE agent tool config makes the routing check fail.
- [ ] **GREEN:** Agent-executed request has agent process identity, authenticated ACE projection and matching real provider response.
- [ ] **Evidence / oracle:** Real process/version/config, route trace, hashes and provider response; not yet a coding-task quality claim.
- [ ] **Fail-closed / stop:** If chosen agent mandates unverified streaming, block this trial until T10; never silently replace the agent/provider.

### G11-T19 — Unattested host history and hidden continuation stay unclaimed
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T18. **Spec acceptance:** G11-014, G11-015.
- [ ] **One-pass deliverable:** Real-agent evidence identifies host transcript/compaction as unattested, and a continuation/bypass fixture cannot masquerade as a complete ACE-visible conversation.
- [ ] **Owning seam:** Go host attestation fields, Gateway provider-managed-history blocker and G11 manifest interpretation.
- [ ] **RED:** An ingress request digest is accepted as durable host attestation, or previous_response_id/thread_id bypasses Gateway.
- [ ] **GREEN:** Unattested/request-only state is preserved in receipts; hidden continuation is BLOCKED; an uncontrolled request remains ineligible.
- [ ] **Evidence / oracle:** Deterministic negative fixtures with one real agent session correlation; no exclusive ownership claim.
- [ ] **Fail-closed / stop:** An actual authenticated host attestor is a separate approved capability, not created implicitly here.

### G11-T20 — One retrieval-needed coding task passes the full real chain
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T18, G11-T19. **Spec acceptance:** G11-013, G11-016.
- [ ] **One-pass deliverable:** An explicitly authorized real coding-agent finishes one nontrivial disposable source-retrieval task via Bifröst → ACE → real provider and has independently checked task output.
- [ ] **Owning seam:** Existing runtime and G11 trace/oracles; unchanged agent native shell/git/test tools; source workspace from approved disposable/public fixture.
- [ ] **RED:** Invalid opt-in, source freshness, secret prompt or false task success prevents accepted E2E status.
- [ ] **GREEN:** Actual completed task has source SHA, ACE APPLY, final-send/provider correlation and independent quality outcome.
- [ ] **Evidence / oracle:** Real task artifact and redacted agent/provider transcript hashes; agent-E2E status for this exact configuration only.
- [ ] **Fail-closed / stop:** Provider/model and dataset require owner opt-in; if selected agent uses streaming, T10 becomes a prerequisite for that run.

## Phase 5: Harbor quality, tokens, cost and release evidence

### G11-T21 — Harbor produces matched baseline and ACE job identities
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T18. **Spec acceptance:** G11-017.
- [ ] **One-pass deliverable:** Two comparable Harbor job manifests use the exact same source task, agent/provider/model/effort, permission/toolset and timeout, differing only by documented ACE treatment.
- [ ] **Owning seam:** Existing Harbor job freezing and byte-binding scripts/domain validators, not a new benchmark runner.
- [ ] **RED:** Same task name with different bytes, agent tools or model identity is accepted as a pair.
- [ ] **GREEN:** A frozen one-task pair validates with byte hashes and a preserved strong native baseline.
- [ ] **Evidence / oracle:** Deterministic manifests and mismatch fixtures; no real run or savings claimed yet.
- [ ] **Fail-closed / stop:** Do not disable baseline tooling or change quality criteria to favor ACE.

### G11-T22 — Harbor denies ACE causal attribution without bound APPLY/final wire
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T04, G11-T21. **Spec acceptance:** G11-020.
- [ ] **One-pass deliverable:** The report on a completed run with no valid ACE APPLY receipt or final-send binding can show observed token differences but cannot label those differences ACE-caused.
- [ ] **Owning seam:** Existing Harbor report gate + Gateway evidence ledger, downstream of trial ingestion.
- [ ] **RED:** Mock-only receipt, wrong physical ID, missing ACE message or reused attempt ID still yields `ACE savings` claim.
- [ ] **GREEN:** Unauthenticated/unbound runs are marked not attributable while valid synthetic bindings remain test-only.
- [ ] **Evidence / oracle:** Signed/hashed fixture classification and negative real/provider distinction.
- [ ] **Fail-closed / stop:** Token savings never block a normal model request or count as G11 provider evidence.

### G11-T23 — Provider usage, cached tokens and total cost do not double-count
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T21. **Spec acceptance:** G11-018.
- [ ] **One-pass deliverable:** A Harbor trial report correctly separates input/output, cached-input subset, reasoning-output subset, external service costs and latency; unavailable measurements remain UNKNOWN.
- [ ] **Owning seam:** Existing Harbor trial evidence adapter, four-arm economics gate and provider usage raw events.
- [ ] **RED:** Cached or reasoning tokens are added twice, missing input is made zero, or estimated tokens are presented as billed usage.
- [ ] **GREEN:** Fixture-derived totals and cost fields match provider-reported contracts; missing/heterogeneous usage is UNKNOWN.
- [ ] **Evidence / oracle:** Deterministic usage fixtures plus a schema for real provider events, not yet a savings claim.
- [ ] **Fail-closed / stop:** Do not invent provider prices, exchange rates or estimated billed tokens.

### G11-T24 — Failed and cheap-but-wrong tasks remain in Harbor quality
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T21. **Spec acceptance:** G11-019.
- [ ] **One-pass deliverable:** An aborted, timed-out or test-failing run remains in the paired trial dataset, and lower token use cannot override the independent task-quality failure.
- [ ] **Owning seam:** Existing Harbor raw-trial reconciliation and independent quality gate.
- [ ] **RED:** Failed trials disappear from pass-rate, quality comparison or per-task cost denominators.
- [ ] **GREEN:** Fixture with one failed/one successful trial retains both and refuses an invalid fivefold claim.
- [ ] **Evidence / oracle:** Raw trial admission + quality denominator assertions; no external run claimed.
- [ ] **Fail-closed / stop:** Do not switch to success-only filtering, or hide cancelled runs.

### G11-T25 — One Harbor paired exploratory real-agent task
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T20, G11-T21, G11-T22, G11-T23, G11-T24. **Spec acceptance:** G11-017, G11-018, G11-019, G11-020.
- [ ] **One-pass deliverable:** A single bounded exploratory Harbor task runs strong baseline vs ACE-Gateway using approved real providers, records all attempts and independent tests, and emits a truthful comparative report.
- [ ] **Owning seam:** Existing Harbor runner/adapters and verified coding agent/provider path; reuse byte-bound task/jobs.
- [ ] **RED:** Differing tool permissions, incomplete receipts, missing usage or cheaper incorrect outcome prevents causal/5x acceptance.
- [ ] **GREEN:** Raw redacted evidence for both arms, actual quality outcomes, token/cost/latency availability and explicit exploratory-only status.
- [ ] **Evidence / oracle:** One actual paired trial with full hashes; frozen holdout and production/savings claims remain NOT-RUN.
- [ ] **Fail-closed / stop:** Requires explicit provider budget/egress permission and available Harbor environment; otherwise mark BLOCKED.

### G11-T26 — Freeze holdout task identities and enumerated shards
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T25. **Spec acceptance:** G11-017, G11-019, G11-020.
- [ ] **One-pass deliverable:** A held-out dataset is immutable, versioned, retrieval-relevant and split into finite named shards; no shard is selected after inspecting ACE-vs-baseline scores.
- [ ] **Owning seam:** Existing Harbor task identity freezing and byte-binding utilities; keep exploratory data separate.
- [ ] **RED:** Post-freeze task mutation, duplicated task or opportunistic selection is accepted.
- [ ] **GREEN:** Dataset hash, source revision, task baselines, shard list and exact agent/permission matching validate.
- [ ] **Evidence / oracle:** Frozen holdout manifest, per-shard work queue; no benchmark result fabricated.
- [ ] **Fail-closed / stop:** If the holdout includes multiple shards, create explicit T27-<shard> entries in THIS tasks.md before execution; one shard per fresh-context run.

### G11-T27 — Run one frozen holdout shard with full quality and cost evidence
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T26. **Spec acceptance:** G11-017, G11-018, G11-019, G11-020.
- [ ] **One-pass deliverable:** Exactly ONE pre-frozen shard (or a single task shard) completes paired agent baseline vs ACE with all failures, quality oracle and cost/usage receipts retained.
- [ ] **Owning seam:** Previously approved Harbor configuration and route; no dataset change or tuning in holdout runs.
- [ ] **RED:** Absent partner arm, uncaptured failed run, route bypass or changed task bits makes the shard unaccepted.
- [ ] **GREEN:** A per-shard report verifies source/config pins, independent quality and real provider usage status.
- [ ] **Evidence / oracle:** One redacted full evidence pack per shard; no claim about unexecuted shards.
- [ ] **Fail-closed / stop:** For more than one shard this is a TEMPLATE to instantiate as T27-<shard-id> in OpenSpec before running; T28 waits for EVERY shard.

### G11-T28 — Reconcile G11 certification and send to owner acceptance
**Status:** PROPOSED / unchecked. **Blocked by:** G11-T05, G11-T10, G11-T16, G11-T17, G11-T20, G11-T22, G11-T23, G11-T24, G11-T27. **Spec acceptance:** G11-004, G11-014, G11-017, G11-018, G11-019, G11-020.
- [ ] **One-pass deliverable:** A reproducible, redacted acceptance ledger maps each of G11-001..020 and every route to PASS/FAIL/BLOCKED/NOT_RUN and differentiates mock, real wire, real agent, Harbor and owner approval.
- [ ] **Owning seam:** Existing G11/OpenSpec/Harbor evidence and runtime readiness reporting; do not invent a release mechanism.
- [ ] **RED:** Missing holdout shard, unapproved provider, absent live stream/retry/fallback proof or unknown usage is marked full G11 PASS.
- [ ] **GREEN:** All evidence is traceable to actual commit/config/CI-tested SHA and supported routes only; unresolved lanes remain not certified and release is left for owner decision.
- [ ] **Evidence / oracle:** Auditable coverage table, G02 and final owner review records; approval NOT automatic.
- [ ] **Fail-closed / stop:** Full-production verdict requires all relevant live proofs and owner signoff. Per-route partial verdicts may be published without claiming whole-project completion.


## Acceptance coverage — no orphan spec scenarios

| G11 acceptance ID | Proposed owning ticket(s) |
| --- | --- |
| G11-001 | G11-T02 |
| G11-002 | G11-T03 |
| G11-003 | G11-T04, G11-T05 |
| G11-004 | G11-T01, G11-T04, G11-T05, G11-T28 |
| G11-005 | G11-T07, G11-T10 |
| G11-006 | G11-T06, G11-T07, G11-T10 |
| G11-007 | G11-T08, G11-T10 |
| G11-008 | G11-T09, G11-T10 |
| G11-009 | G11-T11, G11-T12, G11-T16 |
| G11-010 | G11-T13, G11-T14, G11-T17 |
| G11-011 | G11-T11, G11-T15, G11-T16, G11-T17 |
| G11-012 | G11-T13, G11-T15, G11-T16, G11-T17 |
| G11-013 | G11-T18, G11-T20 |
| G11-014 | G11-T19, G11-T28 |
| G11-015 | G11-T18, G11-T19 |
| G11-016 | G11-T20 |
| G11-017 | G11-T21, G11-T25, G11-T26, G11-T27, G11-T28 |
| G11-018 | G11-T23, G11-T25, G11-T27, G11-T28 |
| G11-019 | G11-T24, G11-T25, G11-T26, G11-T27, G11-T28 |
| G11-020 | G11-T01, G11-T22, G11-T25, G11-T26, G11-T27, G11-T28 |

## G11 owner review / resume rules

- [ ] Owner confirms G02 (technical design, provider-attempt contract alternatives, live terminal guard), agrees granularity, blocking edges, and implementation launch; document the actual approval separately. No automated checker or author of this plan approves G02.
- [ ] Owner chooses actual coding agent, external provider/model(s), public/disposable dataset and explicit external opt-in/budget **before** T05/T10/T16/T17/T18/T20/T25/T27; absence is BLOCKED on the dependent step only.
- [ ] After each ticket PR merge, refresh `main`, close only the completed box (not whole phase), record exact source/CI-tested SHA and required proof; review whether downstream dependencies remain applicable.
- [ ] When T26 has a real frozen holdout manifest, replace the repeatable T27 placeholder with exactly one named per-shard executable ticket per fresh context and update T28 blockers to ALL shards. Do not squeeze an unknown number of benchmark trials into a falsely "single-pass" job.
- [ ] Deliver a capability-/route-specific result; partial supported nonstreaming Chat does not imply streaming, retry/fallback, hidden-history attestation, entire production platform or fivefold savings are accepted.
