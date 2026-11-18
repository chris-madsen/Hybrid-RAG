# Tasks — G11 native Responses-only executable implementation plan

This is the **single canonical phase/checkbox ledger** for OpenSpec change 013. The current owner decision selects Hermes → Bifröst `/v1/responses` → ACE Gateway v2 as the sole agent-facing route and retires the previous projection contract and every repository compatibility implementation. C01 local implementation is complete in commit `496e04cad9c9ab0b45606716e6b056fbe452cdd3`; PR #282 is open. Its relevant checks pass except the CodeQL severity gate, which reports seven existing high findings in unchanged main files. Owner approval recorded 2026-11-18 covers C01 design only; external provider egress remains NOT_AUTHORIZED, and live Hermes / Harbor remain NOT_RUN. C02–C08 are not started.

## Dependency DAG and LOC budget

Eight automatically chosen vertical implementation chunks, estimated **handwritten changed LOC = added + removed** including tests and reviewed config/docs. Numbers are forecasts, not measured implementation, permissions or context-window guarantees. Source / tests / other exclude vendored/generated bulk from the handwritten arithmetic but do not exempt them from drift and compatibility review.

| ID / title | Blocked by | Acceptance IDs | Source / tests / other = total forecast | Observable result |
|---|---|---|---:|---|
| C01 — Native-only contract and repository retirement | none | RESP-001, RESP-002, RESP-003, G11-004 | 430 / 430 / 300 = **1160** | TypeSpec-generated v2 is the sole active projection contract; all previous projection routes, DTOs, generated schemas and executable compatibility code are removed. Unsupported ingress and every uncertified physical dispatch fail closed with zero provider sends. |
| C02 — Lossless native context projection | C01 | RESP-004 | 400 / 440 / 100 = **940** | A stateless native Responses request with multi-turn function call/results, reasoning, multimodal items, stream flag and opaque extensions yields exactly one additive untrusted developer evidence item, while all original items are preserved and no provider is contacted. |
| C03 — Single-use physical send guard | C02 | RESP-005, G11-009, G11-011 | 490 / 480 / 100 = **1070** | Every physically dispatched native request, including inner Bifröst retries/extraAttempts, must pass an authenticated, single-use final-send permit for its exact body/provider/model; race/replay cannot reuse a previous decision. |
| C04 — Privacy-safe OAuth and fallback decisions | C03 | RESP-006, G11-010, G11-012 | 400 / 470 / 100 = **970** | Provider-native Hermes OAuth, exact model/effort and final-wire store:false are certified or explicitly blocked; a fallback changing provider/residency requires fresh policy evaluation, and timeouts/secrets never allow passthrough. |
| C05 — Real final-wire route certification | C04 | G11-001, G11-002, G11-003 | 280 / 330 / 160 = **770** | A selected native non-streaming Responses route is certified only after controlled after-hook capture and explicitly authorized real provider acknowledgement on exactly the final outbound bytes. |
| C06 — Native stream completion and cancellation | C05 | G11-005, G11-006, G11-007, G11-008 | 410 / 430 / 110 = **950** | Native Responses SSE retains function-call/result chunks, reasoning, terminal completed/failed/incomplete events and correct usage, while disconnect/abort prevents unauthorized later sends and records partial outcomes. |
| C07 — Real Hermes long agent loop | C05, C06 | RESP-007, G11-013, G11-014, G11-015, G11-016 | 350 / 450 / 140 = **940** | A real Hermes coding session performs a multi-turn Responses reasoning/function-call/tool-result loop through pinned Bifröst and ACE with true source evidence and independently checked task outcome; bypass and hidden state are ineligible. |
| C08 — Paired Harbor quality, cost and owner release | C07 | RESP-008, G11-017, G11-018, G11-019, G11-020 | 320 / 430 / 140 = **890** | Harbor can compare real native Responses Hermes baseline/ACE arms with identical model/effort/tools, exact usage provenance, full failure denominator and independent correctness; no unproved 5x or release claim. |

## Canonical phase tracker

- [x] C01 — Native contract and fail-closed route; executable plan: [C01](phases/C01.md)
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
- C01/C02 are structural contract and synthetic no-send work. The owner approved C01's native-only contract and retirement scope on 2026-11-18; that approval does not approve provider egress. C03 is a mandatory stop until a real per-physical-send seam is proven on a maintained pinned Bifröst; C04 also requires owner review of OAuth/model privacy; C05–C08 require explicit external provider/agent/Harbor permissions where relevant.
- `PREPARED` means locally transformed context, NEVER an outbound-send permit. No non-Responses route or implicit provider fallback. A source SHA/TypeSpec/spec/design change requires phase input fingerprint revalidation and review.
- Each phase owns its exact RED/GREEN and negative security oracles in its linked brief; no separate issue-tracker state or second checkbox ledger is created.
- Size rationale: every forecast is in the flexible 700–1200-LOC band, but trust-boundary risk forces separate C03 (physical attempts), C04 (OAuth/privacy) and C05 (real provider) rather than one superficially “efficient” large PR. Re-slice unfinished phases if source-discovered scope crosses the one-context boundary.
- Owner approval recorded 2026-11-18 covers the C01 native-only contract and repository retirement scope. It does not approve provider egress, model/OAuth routing, real agent trials, Harbor runs, later phase mechanics or production release; obtain those approvals independently where required.

## Stop, rollback and completion conditions

- Keep all physical generation blocked until the native route and final-send controls are independently certified; keep `providerWire: not_certified`. Never reintroduce retired projection contracts or compatibility routes to make tests pass.
- Before implementing each phase: recheck latest main/source owners, previous phase approved output, exact hashes below, accepted ADR/OpenSpec, scope-limited preflight and actual test availability. Do not assume the 2026-11-17 pin is a supported production OAuth/provider version.
- After implementing: independently review BUILD, ARCHITECTURE, SECURITY and PLAN COVERAGE; run exact affected/TypeSpec/Go tests; record release candidate SHA and source-aware evidence. A phase checker PASS means structure/freshness only.
- Cross-phase G11 route certification requires real after-last-mutation attempt wire, native streaming/tool fidelity, real Hermes and quality, and independent owner approval. C08 does not manufacture a fivefold savings claim.
- Older G11 provider-route plans and unmerged prototypes are not implementation authority. Reuse only source-verified behavior that satisfies this canonical plan; do not count prototype tests as provider evidence.
