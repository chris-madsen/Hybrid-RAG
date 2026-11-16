# Design — G11 production evidence and safe enablement

## AS-IS: verified research facts

Repository: chris-madsen/Mult-agent-AI-Orchestration
Research base: main@7051a9dd0a516781b2a3f45fcc8c8df126b067e9 (2026-11-16; PR #254 already merged at this snapshot).
- AGENTS.md:9-12, 18-31, 87-105: only Bifröst agent delivery; TypeScript + Effect, privacy, token goal is a hypothesis; risk-based T2 and G02.
- .agents/skills/ace-sdlc/SKILL.md:10-30 and .agents/skills/ace-sdd-prepare/SKILL.md:10-52: planning-only Research → Design → Plan, existing OpenSpec authority, G02 review-only.
- openspec/changes/010-gateway-only-ownership/{proposal.md,design.md,tasks.md,specs/gateway-only-ownership/spec.md}: accepted binding, one additive message, mandatory explicit provider/model; blocked retries/fallback; G11 work deferred.
- integrations/bifrost/ace-connector/plugin/main.go:213-277: actual HTTP prehook / projection; 295-350: per-attempt guard and fail-closed repeated attempts.
- integrations/bifrost/ace-connector/README.md:5-44: pinned mock-wire scope; agent-E2E NOT RUN, honest host-history attribution and required live plugin order.
- src/transport/gateway-projection-http.ts:56-92: health/capabilities declare providerWire not_certified and delivery recording returns 501; 110-167: auth and HTTP server; src/application/gateway-projection-service.ts:173-223: body matching/authorization/secret boundary.
- openspec/changes/002-harbor-evaluation/specs/agent-benchmarking/spec.md and docs/docs/references/ADR-009-harbor-benchmark.md: strong paired baseline, total tokens, quality-first, frozen holdout, full failures and economic cost.
- docs/docs/references/ADR-017-bifrost-unified-llm-gateway.md and ADR-007-security-failure-policy.md: owner-approved gateway architecture, privacy, supported-route evidence and safe failures.
- docs/reviews/2026-11-15-ace-main-sdlc-conformance-review.md: G11 provider egress partial/unproven at dated audited SHA; do not carry that verdict forward as today's real runtime test result.

Evidence class: GitHub source/document inspection only. No worktree preflight, CLI, real provider, agent or Harbor trial ran in this planning request.

The current trusted claim is request-bound, additive Gateway projection with a pinned native plugin and repository checks. The mock-upstream provider-wire report predates current code and is not external-provider proof. The local delivery-recording endpoint still returns HTTP 501. The only stated live public protocol is OpenAI Chat Completions; client streaming variants and full agent/provider runs are not certified. A second PreLLM attempt currently fails closed. Bifröst cannot attest durable coding-host history.

## Goal and acceptance boundary

Enable separately certified G11 capabilities without undoing the Gateway-only design. Use statuses per exact route × provider × model × Bifröst commit × ACE commit × plugin configuration: NOT_RUN, FAIL, BLOCKED, MOCK_WIRE_VERIFIED, REAL_PROVIDER_WIRE_VERIFIED, REAL_AGENT_E2E_VERIFIED, HARBOR_EVALUATED, OWNER_APPROVED. These are evidence stage labels, not new public Gateway v1 enum values. A source/config change affecting semantics invalidates claims until revalidated. A failed route remains disabled. Record actual delivered SHA and CI-tested SHA separately.

## Decisions

1. **Preserve 010 as the gateway behavior owner.** This change owns the production acceptance path and new per-attempt/stream semantics only; it does not create another northbound transport, model-invoked tool, proxy or duplicate public API.
2. **One provider-safe initial route.** First validate the existing explicit provider/model OpenAI Chat Completions non-streaming path. Streaming and every other route/provider are independent capabilities. The first real coding-agent and external provider/model are execution parameters requiring separate operator opt-in and approved credentials, not assumed selections.
3. **Two different wire oracles.** Controlled synthetic mock-upstream captures the full outgoing payload after all hooks, testing semantic integrity and negative mutations. Authorized real-provider acceptance additionally needs an observed final-send boundary and correlated true provider response, with privacy-safe evidence. A hook receipt is not final wire; a fake upstream cannot certify actual provider egress.
4. **Terminal guard safety.** Treat custom-hook ordering and post-guard mutation as a production precondition. If terminal enforcement cannot be established for the pinned Bifröst, mark route unsupported or stop for a scoped upstream extension decision; do not add a second middleware proxy silently.
5. **Streaming is not implied by JSON rewrite success.** Test stream=true as its own route variant, including SSE completion, tool delta consistency, disconnects, deadlines and partial failure. No silent switch to non-stream or false clean completion.
6. **Retry authorization is single-use and destination-specific.** Model attempt as immutable facts (physical request, attempt ordinal/nonce, provider/model, body digest, data class, expiration, consumed flag). Before a second attempt, re-evaluate original+ACE content, privacy policy, secret guard, route capability and actual destination; do not reuse the ingress receipt. Until implementation and live evidence exist, current fail-closed retries/fallbacks stay in force.
7. **Host identity honesty.** Ingress session headers remain correlation only. The Bifröst-visible body proves neither the coding-host durable history nor compaction state. An authenticated host attestor and independent tests are mandatory before exclusive-context assertions; do not manufacture host proof.
8. **Harbor is reused, not replaced.** Strong baseline, frozen holdout, failed-run inclusion, quality gate and provider-reported usage come from change 002/ADR-009. G11 only adds gateway attempt-binding and terminal-wire provenance as an attribution precondition. Estimated token savings stay telemetry, never model admission.

## Event Storming and functional ownership (design-level, no Event Sourcing mandate)

Actors: coding agent, Bifröst HTTP transport and custom hook, ACE admission/policy/projection, approved LLM provider, Harbor evaluator, project owner.

Commands: CaptureIngress, ProjectRequest, AuthorizeAttempt, DispatchAttempt, ObserveFinalSend, RecordProviderResponse, CancelAttempt, DecideRouteCertification, ComparePairedRuns, ApprovePromotion.

Meaningful events: IngressBound, ProjectionApplied, AttemptAuthorized, FinalWireObserved, AttemptDenied, StreamPartiallyDelivered, ProviderSucceeded, ProviderFailed, TaskQualityJudged, BenchmarkCompleted, CertificationRevoked. These are proposed logical results, NOT authorization to add a durable event bus or an event-sourced database.

Bounded owners:
- Bifröst + thin Go connector: final transport/plugin ordering, live upstream attempt lifecycle and protected payload observation, never retrieval/policy decisions.
- ACE Core TypeScript + Effect: immutable authorization input/decision ADTs, project data policy, source verification, projection, typed error decisions, cancellation and local evidence receipts.
- Harbor: task/benchmark isolation, strong baseline and quality/usage/cost measurement.
- Owner: G02 for T2 design, per-provider external opt-in, final production promotion.

Proposed pure transition contract for implementation review:
- Attempt = Planned | Authorized(attemptDigest, provider, model, expires) | Dispatched(sendDigest) | Completed(responseEvidence) | Denied(reason) | Partial(failureEvidence).
- authorize(Planned, exactBoundContext) may create Authorized only when all security preconditions pass. dispatch(Authorized) consumes exactly one use. Dispatch from Planned, Denied or previously used Authorized is invalid. Retry means a NEW Planned attempt with independent authorization; fallback must not inherit the old decision.
- Certification = Unverified | MockVerified | ProviderVerified | AgentVerified | BenchmarkVerified | Approved; transitions require stage-appropriate evidence and exact source/runtime identity. Rebuild/config drift invalidates stale evidence, not merely updates a label.

These are functional ADT design candidates; TypeSpec stays authoritative only if an actual new or migrated public wire surface is separately approved. Do not alter ace.gateway.v1 or implement a delivery-record route as a side effect of this planning PR.

## Trust boundaries and negative sequences

1. Agent → Bifröst: authenticated transport and validated scope; session headers used for correlation, never user authorization.
2. Bifröst → ACE loopback: out-of-band Bearer authorization; original body and exact provider/model must match projection input; no private code in diagnostic logs.
3. ACE → Bifröst → real provider: private-source class cannot be downgraded; explicit opt-in/allowlist/data policy and secret scan before retrieval/external send. Recheck at every real attempt, including fallback.
4. Final-send proof: capture only in a controlled synthetic mock upstream or explicitly authorized Bifröst send instrumentation. Retain raw payload locally under restricted access if absolutely required for semantic checks; export SHA, redacted fields and provenance. Never put secrets in PR comments or CI logs.
5. Streaming/abort: a partial upstream send is irreversible; cancel future operations and honestly mark partial/cancelled, never pretend all bytes were retracted.
6. Failed/incomplete capability: BLOCK/NOT_RUN/PARTIAL rather than automatic fallback or fake success; selected provider cannot drift.
7. Hidden provider-held history: reject known continuation pointers; agent-configuration bypass makes that run ineligible rather than falsely declaring ACE authoritative.

## G02 crosswalk

| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |
| --- | --- | --- | --- | --- | --- | --- |
| G11-001 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-final-wire: exact allowed outbound projection | 1 | mock upstream verifies protected fields + digests | real instrumented final-send capture |
| G11-002 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-final-wire: later mutation or unverified plugin ordering | 1 | negative later-mutator/order fixture rejects | live plugin-order capture |
| G11-003 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-final-wire: authorized actual provider trial | 1 | mock/real evidence classification rejects swapped artifacts | explicitly authorized real provider receipt |
| G11-004 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-final-wire: unsupported or changed route | 1 | capability matrix and pin-change invalidation fixtures | route/provider matrix proof |
| G11-005 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-streaming: complete streaming success | 2 | SSE framing and completion regression fixtures | real streaming provider terminal event |
| G11-006 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-streaming: unsupported streaming variant | 2 | unsupported stream/tool/multimodal fixture denies | negative provider-wire zero-egress proof |
| G11-007 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-streaming: client cancellation or deadline | 2 | deterministic cancellation/deadline barriers | actual stream disconnect/partial send evidence |
| G11-008 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-streaming: midstream failure and incomplete usage | 2 | truncated chunks/errors leave partial run | provider streaming abort evidence |
| G11-009 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-attempt-reauthorization: second attempt after transient failure | 3 | retry second attempt must have fresh authorization | real retry provider-attempt wire proof |
| G11-010 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-attempt-reauthorization: fallback changes destination or model | 3 | fallback data-class and model change rejects | allowed/denied fallback real provider proof |
| G11-011 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-attempt-reauthorization: reused, stale, raced or mismatched receipt | 3 | replay/concurrent/out-of-order receipt fixtures | provider zero-send on reused receipt |
| G11-012 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-attempt-reauthorization: uncertain reauthorization result | 3 | unavailable ACE and secret negative fixtures | real provider no-egress denial |
| G11-013 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: end-to-end real coding-agent task | 4 | agent route/config invariants and receipt matching | real coding-agent → Bifröst → ACE → provider task |
| G11-014 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: host context attestation limits | 4 | unattested history cannot promote claim | host attestor trial only if installed/approved |
| G11-015 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: hidden provider-managed state or bypass attempt | 4 | continuation/bypass negative ingress fixtures | real agent-route and hidden-state negatives |
| G11-016 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: authorization and acceptance of real work | 4 | cloud opt-in/allowlist/policy and task-quality denial | authorized provider plus independent task checks |
| G11-017 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: strong paired baseline | 5 | paired task identity and baseline manifest check | paired Harbor real-agent trial |
| G11-018 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: exact usage or unavailable counters | 5 | cache/reasoning subset, UNKNOWN, cost ledger fixtures | real provider/agent usage manifests |
| G11-019 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: quality degradation or failed trials | 5 | failed/aborted/cheap-wrong runs retained | real matched quality-gated Harbor trials |
| G11-020 | ACE owner / G02 reviewer | Existing Gateway/Harbor authority; G11 design review required | gateway-real-agent-and-economics: unverified ace attribution or release claim | 5 | receipt/holdout/evidence gate rejects false 5x | frozen holdout, owner release review |

## Owner / review and provider selection

The accepted ADRs settle the **architecture** (sole Gateway route, explicit egress policy, quality-first benchmark). This document proposes the G11 design for **owner G02 review**; the crosswalk does not constitute a G02 signoff. Choose a concrete real coding-agent, explicit external provider/model, paid/credential opt-in and approved disposable task before the applicable phase 1/4/5 external trial. There is no implicit permission to use credentials or transmit source code. A missing selection pauses only the dependent external experiment; independent deterministic and synthetic-mock work may still be designed/reviewed.

G02 status: REVIEW_REQUIRED. Production evidence: NOT_RUN in this PR. Live skill invocation: NOT_RUN (repository instruction read, not host Skill-tool execution). OpenSpec strict validation and structural checker: PENDING independent execution.

## Evidence and rollback

- Per attempt record exact ACE/Bifröst/plugin source and build digest, route/provider/model, physical request+attempt identity, ingress/authorized/final-send hashes, policy decision and timestamp, live plugin order, provider response/usage type, redaction attestation and test fixture identity.
- Per benchmark record every trial arm, matched environment, model/effort, full agent token usage/cost and failures, independent quality oracle, source commit, privacy-safe artifact hashes and selection bias/holdout status.
- Revoke route-specific certification on source/config drift, provider changes, incomplete instrumentation, later-mutator failures, replay, missing attestation (when claimed), quality failures or policy denial.
- Safe rollback keeps the currently supported non-streaming Chat route under the existing fail-closed contract; new streaming/fallback modes remain disabled or BLOCKED until separately approved and proven.
