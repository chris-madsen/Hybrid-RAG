# Tasks

## 1. Quarantine the obsolete model route (no provider calls)
- [ ] 1.1 Fail closed on legacy Chat, known aliases, uncertified Responses and passthrough generation in the installed Bifröst ACE plugin; protect PreLLM from bypass. RESP-001.
- [ ] 1.2 Make Gateway HTTP return no active model route in capabilities, reject legacy direct projection, preserve authentication controls, and cover positive/negative tests. RESP-002.
- [ ] 1.3 Record the original Gateway v1 schemas as immutable historical migration artifacts; do not rewrite them to disguise active Chat. RESP-003.

## 2. Design and implement versioned native Responses projection (G02 required)
- [ ] 2.1 Owner reviews upstream Bifröst exact route/commit, OAuth support, body and stream semantics, privacy, context-window/counter compatibility; STOP rather than invent a seam. RESP-003, RESP-006.
- [ ] 2.2 Create TypeSpec Gateway v2 Responses request/decision and generated validators; preserve v1 byte-for-byte, test codegen clean. RESP-003, RESP-004.
- [ ] 2.3 Implement pure TypeScript Responses input/continuation projection and protected-field preservation, additive context and exact-body policy in the Effect shell. RESP-004.

## 3. Bifröst native Responses plugin and physical attempt boundary (G02 required)
- [ ] 3.1 Wire the actual native `/v1/responses` entrypoint, not Chat conversion or a custom substitute proxy. Test function_call, function_call_output, reasoning, opaque blocks, streams and error paths. RESP-004.
- [ ] 3.2 Add or select and verify an authenticated final-send/per-dispatch gate, with replay/retry/extraAttempts/fallback zero-send oracles. If unavailable, leave route disabled. RESP-005.
- [ ] 3.3 Prove privacy-safe `store:false` after any raw-body/large-payload rewrite and separately authorize each actual provider/model. RESP-006.

## 4. Real Hermes long-loop evidence (operator/egress approval required)
- [ ] 4.1 Prove the selected Hermes transport reaches pinned Bifröst Responses without direct provider bypass; validate model/effort/context/token counter. RESP-006.
- [ ] 4.2 Record at least one multi-turn coding task with tool calls/results, reasoning, streaming/partial outcomes and independent quality checks. RESP-007.

## 5. Harbor, cleanup and promotion
- [ ] 5.1 Run the authorized frozen two-arm paired Hermes feedback loop and report actual cost/quality/usage with failures. RESP-008.
- [ ] 5.2 Delete obsolete Chat-only executable adapters/tests after v2 proves equivalent required security, retain only clearly archived immutable v1 contracts/dated research. RESP-001, RESP-003.
- [ ] 5.3 Reconcile active G11 plan/phase briefs and source hashes after architectural acceptance; independently review G02 and release. No unchecked status is auto-promoted.
