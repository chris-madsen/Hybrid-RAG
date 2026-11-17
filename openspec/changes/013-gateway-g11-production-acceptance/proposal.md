# Proposal — native Responses-only G11 implementation plan

## Why

ACE on \`main@3b42fbee5168126eda046d47fb2286c633b21e17\` still has a Chat-only Bifröst ACE plugin and Gateway v1 Chat projection. The owner has explicitly selected **Hermes → Bifröst standard /v1/responses → ACE additive context → authorized provider**, with **no Chat Completions translation or fallback**. The old G11 plan's Chat-first acceptance route is therefore superseded. Existing CI and a simulated stage handoff do not prove that a real autonomous Hermes loop or physical provider send works.

## What changes in this planning-only revision

- Reconcile the existing change 013 to the accepted native Responses target instead of creating a parallel issue tracker or second OpenSpec change.
- Retain G11-001…G11-020 acceptance IDs, rewrite Chat-specific premises to native Responses, and add RESP-001…RESP-008 for versioning, legacy-route retirement, native tool/reasoning fidelity, physical-send gate, privacy and agent evidence.
- Replace the previous Chat-first \`design.md\` with an AS-IS verified on current main and a TO-BE functional DDD / TypeSpec v2 / Effect / pinned Bifröst design with G02 decision crosswalk.
- Re-slice the 28 acceptance IDs into a minimal dependency DAG and executable source/test-owned \`phases/C01.md\`…\`phases/C08.md\` using the existing SDLC mechanism. Forecasts are estimates of handwritten changed LOC, not executed work.
- Keep Gateway-only authority (010), Harbor baseline (002), accepted ADR-007/009/017/019 and historical v1 ABI compatibility. Stage replacement as expand-contract, not an in-place v1 rename.

## Boundaries

**Planning only.** No production source, Go plugin, provider route, policy, credential, benchmark or model requests are changed by this proposal. Neither local mock tests nor structural phase checkers prove physical-send security, OAuth compatibility, live Hermes tool calls or owner approval. Legacy Chat compatibility source remains in main until a separately approved fail-closed cutover; it is **not** an acceptable target agent route.

**Accepted architecture direction:** native Responses only; one Bifröst context delivery path; no model-invoked ACE tools or extra reverse proxy; no hidden Chat conversion; \`store:false\` enforced at final egress where private source is involved.

**Open G02/provider decisions:** a supported Bifröst final physical-dispatch hook across retries/extraAttempts, pinned OAuth/model/effort/window/counter, safe provider-held continuation rules and owner-authorized egress are unverified. Any dependent implementation phase MUST stop until resolved and reviewed. The prior #271/#273 heads were unmerged fail-closed prototypes, not accepted or currently active runtime.

## Capabilities and success

Modified in-place: \`gateway-final-wire\`, \`gateway-streaming\`, \`gateway-attempt-reauthorization\`, \`gateway-real-agent-and-economics\`. Added within the same change: \`gateway-native-responses\`.

Success of this **planning PR** means: every G11 and RESP scenario mapped to exactly one canonical chunk, current design/spec fingerprints in every executable brief, no cycles or orphan files, strict OpenSpec and all eight phase structure checks passing, and independent G02 still marked REVIEW_REQUIRED. **No** real agent, provider, Harbor or production acceptance follows.
