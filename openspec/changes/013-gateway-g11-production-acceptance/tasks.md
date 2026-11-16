# Tasks — G11 staged implementation (planning only)

This change records proposed tasks, not work performed. All boxes remain unchecked. Phases 1–5 require a separately approved implementation request after owner G02; external provider calls additionally require explicit credentials/egress opt-in. Existing 010 Gateway-only contract and 002 Harbor contract remain sources of truth.


## 0. Acceptance baseline and G02

- [ ] 0.1 Acceptance: All G11-001 through G11-020. Re-read main, scoped AGENTS, ADR-007/009/012/017/019, 010/002 OpenSpec and actual plugin/wire/Harbor code; list supported/unsupported paths and exact pinned versions; obtain owner G02 review before any runtime change. Structural checker and strict OpenSpec must not be mistaken for approval.
- [ ] 0.2 RED/GREEN and real-provider oracle: Source inventory/red-flag matrix; negative stale evidence fixture; no provider calls.
- [ ] 0.3 BUILD / ARCH / SEC / PLAN: one-agent sequential reviews; exact branch HEAD versus CI-tested checkout SHA; scope-limited PR checks, not blanket full suite.
- [ ] 0.4 Rollback/stop condition: No product code; revert this planning change if scope rejected.


## 1. Terminal final-wire proof

- [ ] 1.1 Acceptance: G11-001, G11-002, G11-003, G11-004. Use the existing pinned Bifröst native plugin, Go connector and provider test fixtures; observe terminal custom hook order and final send using a controlled synthetic upstream. Separately conduct an explicitly authorized real provider trial with correlated pre-TLS send evidence and provider ack. Preserve current Gateway v1.
- [ ] 1.2 RED/GREEN and real-provider oracle: RED: later mutator/protected field mismatch/pin drift/synthetic receipt passed as real; GREEN: exact outbound final-send equivalence and real-provider manifest. No raw private code in exported evidence.
- [ ] 1.3 BUILD / ARCH / SEC / PLAN: one-agent sequential reviews; exact branch HEAD versus CI-tested checkout SHA; scope-limited PR checks, not blanket full suite.
- [ ] 1.4 Rollback/stop condition: Disable affected route and retain providerWire not_certified on failure.


## 2. Streaming variants, errors and cancellation

- [ ] 2.1 Acceptance: G11-005, G11-006, G11-007, G11-008. Only after phase 1 proof, add route-scoped stream capability with exact parser/SSE/tool/opaque extensions; provider cancellation and partial error/usage preservation. Use existing Bifröst streaming rather than a second proxy.
- [ ] 2.2 RED/GREEN and real-provider oracle: RED: stream coercion, missing terminal event, client disconnect leaving unauthorized future attempt, truncation reported success; GREEN: synthetic stream fixtures and authorized real streaming provider trace.
- [ ] 2.3 BUILD / ARCH / SEC / PLAN: one-agent sequential reviews; exact branch HEAD versus CI-tested checkout SHA; scope-limited PR checks, not blanket full suite.
- [ ] 2.4 Rollback/stop condition: Mark stream variant unsupported and preserve non-streaming route.


## 3. Attempt-local retry and fallback authorization

- [ ] 3.1 Acceptance: G11-009, G11-010, G11-011, G11-012. Review Bifröst per-attempt hooks and design fresh policy-bound decision/receipt per actual outbound attempt; TypeSpec change only if new public DTO is really necessary. Validate concurrency, single-use, replay, deadline and changed provider/model/data-class. Current block on second attempt persists until full provider proof.
- [ ] 3.2 RED/GREEN and real-provider oracle: RED: previous receipt permits retry, changed fallback destination bypasses policy, race permits double send; GREEN: deterministic barriers and authorized real retry/fallback final-send/no-send outcomes.
- [ ] 3.3 BUILD / ARCH / SEC / PLAN: one-agent sequential reviews; exact branch HEAD versus CI-tested checkout SHA; scope-limited PR checks, not blanket full suite.
- [ ] 3.4 Rollback/stop condition: Turn new retry/fallback support off; retain existing fail-closed PreLLM.


## 4. Real coding-agent G11

- [ ] 4.1 Acceptance: G11-013, G11-014, G11-015, G11-016. Select a real coding agent with owner, configure it to the verified Bifröst endpoint without optional ACE tool paths, run retrieval-needed disposable tasks. Bind agent result to real provider send and task-quality oracle; do not fabricate host-compaction attestation. Host-attestor/exclusive-context is a separate option.
- [ ] 4.2 RED/GREEN and real-provider oracle: RED: direct-provider bypass, hidden continuation, bad session correlation, secret-bearing prompt, false attestation; GREEN: supported nontrivial task via full real chain.
- [ ] 4.3 BUILD / ARCH / SEC / PLAN: one-agent sequential reviews; exact branch HEAD versus CI-tested checkout SHA; scope-limited PR checks, not blanket full suite.
- [ ] 4.4 Rollback/stop condition: Stop trial and keep agent-E2E NOT_RUN/BLOCKED on any missing mandatory evidence.


## 5. Harbor quality/token/cost and owner acceptance

- [ ] 5.1 Acceptance: G11-017, G11-018, G11-019, G11-020. Reuse existing Harbor and 002 agent-benchmarking specs. Freeze strong matched baseline/ACE arms, include failures and total usage plus supporting providers/cost, validate quality and receipt causality. Do not gate normal queries on estimated tokens. Owner signs off per route separately.
- [ ] 5.2 RED/GREEN and real-provider oracle: RED: fake 5x from add-only or failed task, double-count cached tokens, missing usage converted to zero; GREEN: matched repeated holdout, real provider receipts, raw redacted evidence and quality-gated report.
- [ ] 5.3 BUILD / ARCH / SEC / PLAN: one-agent sequential reviews; exact branch HEAD versus CI-tested checkout SHA; scope-limited PR checks, not blanket full suite.
- [ ] 5.4 Rollback/stop condition: Withdraw savings/production claims; keep telemetry informational and routes unpromoted.

## Cross-phase and evidence gates

- [ ] Confirm all G11-001 through G11-020 have an identified test owner, exact source SHA, positive/negative assertions and honest PASS/FAIL/NOT_RUN/UNKNOWN; never mark future work as completed.
- [ ] After each phase inspect live source, plugin order, TypeSpec compatibility (only if changed), OpenSpec strict validation and real provider/protocol evidence at the delivered SHA; preserve raw evidence hashes and safe redactions.
- [ ] After final approved slice, owner separately evaluates G11 route certification and release readiness; no automatic promotion from CI, checker or Harbor summary.
- [ ] Continue to reject optional agent ACE tools, a second proxy or Go ACE business server; automatic Gateway remains the sole delivery path.
