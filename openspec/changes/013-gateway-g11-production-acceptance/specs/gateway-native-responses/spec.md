# gateway-native-responses — Spec Delta

## ADDED Requirements

### Requirement: Agent route must be provider-native Responses

ACE SHALL use Bifröst's certified provider-native Responses transport for its only agent-facing context delivery. Legacy Chat compatibility must not authorize model egress or silently downgrade an agent's input.

#### Scenario: RESP-001 — Native Responses only, no Chat fallback
- **WHEN** Hermes sends a model request to the configured ACE/Bifröst endpoint
- **THEN** only the independently certified native /v1/responses path can become eligible for generation
- **AND** legacy Chat Completions aliases, internal Responses-to-Chat converters, automatic provider substitution and custom Codex passthrough are blocked before external egress.

#### Scenario: RESP-002 — Explicit fail-closed capability surface
- **WHEN** the native route, model, auth, privacy or final-send guard is not certified
- **THEN** Gateway readiness advertises the capability as unavailable/not_certified and refuses generation or a direct v1 Chat projection
- **AND** missing retrieval, failed policy, untrusted plugins or invalid body cannot silently forward unprojected requests.

#### Scenario: RESP-003 — Versioned TypeSpec contract migration
- **WHEN** ACE introduces the native Responses projection request/decision/receipt wire
- **THEN** the new v2 operation and DTOs originate in TypeSpec with pinned generated output, typed mapping and negative compatibility tests
- **AND** accepted Gateway v1 wire remains unchanged as an archived migration baseline until an explicit retirement gate; no dual active projection owners exist.

### Requirement: Preserve the real long agent loop without provider-held implicit state

ACE SHALL preserve all original Responses input items, reasoning and tool-call relations during additive context projection; hidden provider-managed history MUST NOT be treated as verified agent history.

#### Scenario: RESP-004 — Lossless Responses multi-turn input projection
- **WHEN** Hermes submits stateless Responses input with function_call, function_call_output, matching call_id, reasoning/opaque content, multimodal blocks, streaming and vendor extensions
- **THEN** ACE inserts only clearly marked untrusted verified source evidence while preserving the full original input-item order and protected provider parameters
- **AND** does not rewrite into Chat messages, invent a truncated history, drop model controls or claim a real Hermes loop from synthetic replay alone.

### Requirement: Provider network sends require independent authorization

ACE SHALL authorize every final physical outbound provider attempt independently, with single-use identity, protected payload binding, applicable privacy/egress policy and auditable denial on uncertainty.

#### Scenario: RESP-005 — Final physical-send authority
- **WHEN** the pinned Bifröst dispatches, retries, re-routes, internally falls back or applies another mutator
- **THEN** every actual physical provider-bound send has a fresh single-use ACE decision bound to final exact bytes, provider/model/destination, source policy and audit identity
- **AND** an outer HTTP/PreLLM hook, a prior receipt or an unverified internal retry never grants send permission.

#### Scenario: RESP-006 — OAuth, privacy and exact model invariants
- **WHEN** the configured Hermes OAuth/native Responses route is selected for private or project source
- **THEN** verify exact provider/model/reasoning, effective token counter/window, caller authorization and `store:false` on the actual final wire even across raw-body rewrites
- **AND** fail closed on unsupported subscription routing, hidden continuation, secret content, unapproved destination or incomplete privacy evidence.

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
