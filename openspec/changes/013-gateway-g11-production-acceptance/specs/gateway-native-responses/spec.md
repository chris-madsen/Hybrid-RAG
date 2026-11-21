# gateway-native-responses — Spec Delta

## ADDED Requirements

### Requirement: Agent route must be provider-native Responses

ACE SHALL use Bifröst's provider-native Responses transport for its only agent-facing context delivery. No other protocol, converter, alias or fallback may authorize model egress or silently change an agent's input.

#### Scenario: RESP-001 — Native Responses is the only generation protocol
- **WHEN** Hermes sends a model request to the configured ACE/Bifröst endpoint
- **THEN** only the independently certified native /v1/responses path can become eligible for generation
- **AND** every non-Responses alias, protocol converter, automatic provider substitution and unsupported passthrough is blocked before external egress.

#### Scenario: RESP-002 — Explicit fail-closed capability surface
- **WHEN** a required native route, model, auth, privacy or per-physical-send guard is missing, or general provider-wire certification is incomplete
- **THEN** Gateway v2 readiness advertises ordinary generation as unavailable/not_certified; ordinary agent traffic cannot bypass an uncertified route or a missing guard
- **AND** a separately owner-authorized **disposable PUBLIC C03–C05 certification probe** MAY send on native Responses/Bifröst **only after** the exact physical-attempt guard, C04 transmission-time provider/model/destination/data policy, payload integrity and audit are verified. Its test-only admission does not certify general generation or permit unchecked retries
- **AND** missing retrieval, failed policy, untrusted plugins or invalid body cannot silently forward unprojected requests.

#### Scenario: RESP-003 — Versioned TypeSpec contract migration
- **WHEN** ACE introduces the native Responses projection request/decision wire
- **THEN** the new v2 operation and DTOs originate in TypeSpec with pinned generated output, typed mapping and negative compatibility tests
- **AND** Gateway v2 is the sole active generated projection contract; previous projection schemas, DTOs and runtime routes are removed rather than retained as a compatibility surface.

### Requirement: Preserve the real long agent loop without provider-held implicit state

ACE SHALL preserve all original Responses input items, reasoning and tool-call relations during additive context projection; hidden provider-managed history MUST NOT be treated as verified agent history.

#### Scenario: RESP-004 — Lossless Responses multi-turn input projection
- **WHEN** Hermes submits stateless Responses input with function_call, function_call_output, matching call_id, reasoning/opaque content, multimodal blocks, streaming and vendor extensions
- **THEN** ACE inserts only clearly marked untrusted verified source evidence while preserving the full original input-item order and protected provider parameters
- **AND** does not translate the request into another message format, invent a truncated history, drop model controls or claim a real Hermes loop from synthetic replay alone.

### Requirement: Provider network sends require independent authorization

ACE SHALL authorize every final physical outbound provider attempt independently, with single-use identity, protected payload binding, applicable privacy/egress policy and auditable denial on uncertainty.

#### Scenario: RESP-005 — Final physical-send authority
- **WHEN** the pinned Bifröst dispatches, retries, re-routes, internally falls back or applies another mutator
- **THEN** every actual physical provider-bound send has a fresh single-use ACE decision bound to final exact bytes, provider/model/destination, source policy and audit identity
- **AND** an outer HTTP/PreLLM hook, a prior receipt or an unverified internal retry never grants send permission.

#### Scenario: RESP-006 — Subscription-native provider authentication and exact model/privacy invariants (owner correction, 2026-11-21)
- **WHEN** Hermes is configured to use the single approved ChatGPT/Codex subscription OAuth route
- **THEN** the model provider authenticates the bearer and controls subscription entitlement; ACE SHALL NOT repeat provider OAuth validation, require an otherwise unavailable per-attempt credential-source attestation, or replace the bearer with an API key
- **AND** Bifröst MUST forward the caller's subscription bearer only through a documented supported ChatGPT Codex backend route, not silently to an API-key Responses endpoint; exact allowed provider/model/destination and `store:false` remain verified on the physical attempt
- **AND** preserve native Responses input, requested reasoning effort and all protected payload semantics; let provider-reported context/usage remain UNKNOWN when unavailable (no invented token ceiling)
- **AND** reject changed provider/model/destination, a destination outside the single configured subscription route, hidden continuation, detected secrets or insufficient data-class permission; an upstream 401/403 is a provider error, not a reason for API-key fallback
- **AND** a local ACE `ALLOW` decision and deterministic tests are only evidence of admission logic, not proof that the pinned Bifröst binary supports subscription passthrough or that a real provider response was received.

### Requirement: Acceptance requires full agent evidence and quality

ACE SHALL certify Hermes integration and token-economics claims only from independently checked real agent/provider evidence, strong matched Harbor baselines and explicit owner approval.

#### Scenario: RESP-007 — Real Hermes reasoning/tools/streaming loop
- **WHEN** an owner-authorized disposable repository task runs through real Hermes and pinned Bifröst
- **THEN** independently observe a multi-turn tool call/result loop, reasoning-compatible Responses stream, ACE source evidence, cancellation/error handling and accepted task output
- **AND** distinguish original Hermes trace and real provider receipts from synthetic fixtures, untrusted session headers and normalized event indexes.

#### Scenario: RESP-008 — Quality-gated Harbor and owner release
- **WHEN** a route is proposed for G11 release or a >=5x token claim
- **THEN** use an authorized frozen paired Harbor holdout with matched provider/model/tools/effort, all failures, total external costs and exact usage provenance
- **AND** require explicit owner approval, do not double-count cached/reasoning subsets, and never mistake cost/usage differences for proven ACE causality without physical-send receipts.
