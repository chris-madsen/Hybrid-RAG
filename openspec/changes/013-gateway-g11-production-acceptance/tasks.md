# Tasks — G11 native Responses-only executable implementation plan

This is the **single canonical phase/checkbox ledger** for OpenSpec change 013. Prepared on source main `3b42fbee5168126eda046d47fb2286c633b21e17` with the explicitly selected Hermes → Bifröst /v1/responses → ACE Gateway v2 architecture. All stages are planning-only, owner G02 = REVIEW_REQUIRED, external provider egress = NOT_AUTHORIZED, live Hermes / Harbor = NOT_RUN. No status box here is complete.

## Dependency DAG and LOC budget

Eight automatically chosen vertical implementation chunks, estimated **handwritten changed LOC = added + removed** including tests and reviewed config/docs. Numbers are forecasts, not measured implementation, permissions or context-window guarantees. Source / tests / other exclude vendored/generated bulk from the handwritten arithmetic but do not exempt them from drift and compatibility review.

| ID / title | Blocked by | Acceptance IDs | Source / tests / other = total forecast | Observable result |
|---|---|---|---:|---|
| C01 — Native contract and fail-closed route | none | RESP-001, RESP-002, RESP-003, G11-004 | 330 / 340 / 150 = **820** | An attempted Chat, uncertified native Responses, unsupported Codex passthrough or direct old v1 projection produces explicit denial and zero external provider send; a separately versioned TypeSpec v2 wire can be generated without changing the v1 baseline. |
| C02 — Lossless native context projection | C01 | RESP-004 | 400 / 440 / 100 = **940** | A stateless native Responses request with multi-turn function call/results, reasoning, multimodal items, stream flag and opaque extensions yields exactly one additive untrusted developer evidence item, while all original items are preserved and no provider is contacted. |
| C03 — Single-use physical send guard | C02 | RESP-005, G11-009, G11-011 | 490 / 480 / 100 = **1070** | Every physically dispatched native request, including inner Bifröst retries/extraAttempts, must pass an authenticated, single-use final-send permit for its exact body/provider/model; race/replay cannot reuse a previous decision. |
| C04 — Privacy-safe OAuth and fallback decisions | C03 | RESP-006, G11-010, G11-012 | 400 / 470 / 100 = **970** | Provider-native Hermes OAuth, exact model/effort and final-wire store:false are certified or explicitly blocked; a fallback changing provider/residency requires fresh policy evaluation, and timeouts/secrets never allow passthrough. |
| C05 — Real final-wire route certification | C04 | G11-001, G11-002, G11-003 | 280 / 330 / 160 = **770** | A selected native non-streaming Responses route is certified only after controlled after-hook capture and explicitly authorized real provider acknowledgement on exactly the final outbound bytes. |
| C06 — Native stream completion and cancellation | C05 | G11-005, G11-006, G11-007, G11-008 | 410 / 430 / 110 = **950** | Native Responses SSE retains function-call/result chunks, reasoning, terminal completed/failed/incomplete events and correct usage, while disconnect/abort prevents unauthorized later sends and records partial outcomes. |
| C07 — Real Hermes long agent loop | C05, C06 | RESP-007, G11-013, G11-014, G11-015, G11-016 | 350 / 450 / 140 = **940** | A real Hermes coding session performs a multi-turn Responses reasoning/function-call/tool-result loop through pinned Bifröst and ACE with true source evidence and independently checked task outcome; bypass and hidden state are ineligible. |
| C08 — Paired Harbor quality, cost and owner release | C07 | RESP-008, G11-017, G11-018, G11-019, G11-020 | 320 / 430 / 140 = **890** | Harbor can compare real native Responses Hermes baseline/ACE arms with identical model/effort/tools, exact usage provenance, full failure denominator and independent correctness; no unproved 5x or release claim. |

## Canonical phase tracker

- [ ] C01 — Native contract and fail-closed route; executable plan: [C01](phases/C01.md)
- [ ] C02 — Lossless native context projection; executable plan: [C02](phases/C02.md)
- [ ] C03 — Single-use physical send guard; executable plan: [C03](phases/C03.md)
- [ ] C04 — Privacy-safe OAuth and fallback decisions; executable plan: [C04](phases/C04.md)
- [ ] C05 — Real final-wire route certification; executable plan: [C05](phases/C05.md)
- [ ] C06 — Native stream completion and cancellation; executable plan: [C06](phases/C06.md)
- [ ] C07 — Real Hermes long agent loop; executable plan: [C07](phases/C07.md)
- [ ] C08 — Paired Harbor quality, cost and owner release; executable plan: [C08](phases/C08.md)

## Acceptance accounting and ordering

- Eight coherent phases, 28 unique acceptance IDs: RESP-001…RESP-008 and G11-001…G11-020. Every spec scenario belongs to exactly one phase row; all others remain reviewed cross-phase invariants.
- Dependency frontier: C01 → C02 → C03 → C04 → C05 → C06 → C07 → C08; C07 depends on both C05 and C06. A deliberately sequential security-critical gate protects agent/provider requests; parallel independent fixture/test preparation may be performed without claiming that an upstream blocker passed.
- C01/C02 are structural contract and synthetic no-send work; C03 is a mandatory stop until a real per-physical-send seam is proven on a maintained pinned Bifröst; C04 also requires owner review of OAuth/model privacy; C05–C08 require explicit external provider/agent/Harbor permissions where relevant.
- `PREPARED` means locally transformed context, NEVER an outbound-send permit. No active Chat route or implicit provider fallback. A source SHA/TypeSpec/spec/design change requires phase input fingerprint revalidation and review.
- Each phase owns its exact RED/GREEN and negative security oracles in its linked brief; no separate issue-tracker state or second checkbox ledger is created.
- Size rationale: every forecast is in the flexible 700–1200-LOC band, but trust-boundary risk forces separate C03 (physical attempts), C04 (OAuth/privacy) and C05 (real provider) rather than one superficially “efficient” large PR. Re-slice unfinished phases if source-discovered scope crosses the one-context boundary.
- G02 decisions are not automatically approved by this plan or the existing Responses-only owner direction. Implementation needs an explicit subsequent request and human design signoff; paid/real provider trials require independent opt-in, approved provider/model/data and budget.

## Stop, rollback and completion conditions

- Default before approval: deny Chat Completions and uncertified Responses before any provider send, keep `providerWire: not_certified`; never re-enable Chat to make tests pass.
- Before implementing each phase: recheck latest main/source owners, previous phase approved output, exact hashes below, accepted ADR/OpenSpec, scope-limited preflight and actual test availability. Do not assume the 2026-11-17 pin is a supported production OAuth/provider version.
- After implementing: independently review BUILD, ARCHITECTURE, SECURITY and PLAN COVERAGE; run exact affected/TypeSpec/Go tests; record release candidate SHA and source-aware evidence. A phase checker PASS means structure/freshness only.
- Cross-phase G11 route certification requires real after-last-mutation attempt wire, native streaming/tool fidelity, real Hermes and quality, and independent owner approval. C08 does not manufacture a fivefold savings claim.
- Older G11 Chat-first plans in closed PR #264 are historical and are not imported. Closed #271/#273 contained unmerged prototypes; their useful tests may be independently reviewed, not counted as merged behavior.
