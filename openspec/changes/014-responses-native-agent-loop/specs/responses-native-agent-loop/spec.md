# Spec Delta

## Purpose

Prevent a legacy one-shot Chat transport from being silently treated as the ACE agent loop, and define the evidence-bound native Responses migration.

## ADDED Requirements

### Requirement: Responses is the only ACE agent-facing generation protocol

The ACE Gateway SHALL reject legacy Chat generation and remain fail-closed until a native Responses route preserving the coding agent's full iterative loop is available.

#### Scenario: RESP-001 — Legacy and unready routes have no provider egress
- **WHEN** a client requests the legacy Chat path, a known alias or an uncertified native Responses path
- **THEN** Bifröst ACE hooks return a blocking response and never forward the request as a model-generation attempt
- **AND** no Chat, passthrough or alternative direct-provider fallback is silently activated.

#### Scenario: RESP-002 — Gateway does not advertise a usable legacy route
- **WHEN** a caller reads Gateway capabilities or sends a legacy projection request
- **THEN** no Chat route is advertised as available
- **AND** legacy projection fails closed with an explicit unavailable status rather than a fabricated authorization receipt.

### Requirement: Native Responses requires an independently versioned, lossless enough contract

A new ACE Responses projection SHALL use a versioned TypeSpec-owned contract and preserve protected request/agent-loop semantics across all authenticated provider dispatches.

#### Scenario: RESP-003 — Accepted v1 bytes stay immutable
- **WHEN** native Responses projection is introduced
- **THEN** new TypeSpec, emitted schemas and adapters are versioned separately
- **AND** accepted Gateway v1 wire schemas remain unchanged and non-operational.

#### Scenario: RESP-004 — Agent-loop semantics are preserved
- **WHEN** Hermes sends multiple Responses turns with reasoning, function calls/results, tool IDs and opaque items
- **THEN** every accepted projection preserves their order, structure and unknown fields
- **AND** ACE context remains additive and cannot replace the host's durable conversation.

#### Scenario: RESP-005 — Retry/fallback cannot reuse a single authorization
- **WHEN** Bifröst retries, re-sends or changes provider/model at the physical dispatch boundary
- **THEN** every actual send is independently authorized for its exact body, provider, data class and destination
- **AND** a route without a proven per-dispatch seam remains blocked.

#### Scenario: RESP-006 — Exact model, OAuth, privacy and budget are proven
- **WHEN** native Responses is configured for a concrete provider/model
- **THEN** OAuth identity, effective effort/context window, model-compatible pre-send token budget and mandatory provider privacy controls are verified at the actual wire
- **AND** missing proof prevents private-source egress.

#### Scenario: RESP-007 — Multi-turn agent E2E cannot be replaced by one synthetic call
- **WHEN** a Responses route is submitted for agent acceptance
- **THEN** a real Hermes agent performs a multi-step task containing tool calls, tool outputs and follow-up reasoning through Bifröst and ACE
- **AND** stream termination, errors and cancellations are accounted for without a Chat fallback.

#### Scenario: RESP-008 — Economic claims require strong matched evidence
- **WHEN** the native route is benchmarked
- **THEN** an authorized Hermes two-arm paired holdout retains failed runs, raw provider usage and task quality
- **AND** no 5× token reduction or production acceptance is claimed without the required evidence and owner approval.
