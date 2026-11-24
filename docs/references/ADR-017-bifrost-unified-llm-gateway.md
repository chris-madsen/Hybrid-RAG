> **Current implementation note, 2026-11-21:** This 2026-10-24 ADR selected Bifröst; its phrase “gateway contract not implemented” reflects that date. Native Responses v2 TypeSpec/Go/TS implementation candidates exist (OpenSpec 013, C01–C07); **physical provider-wire, actual Hermes agent loop and Harbor production acceptance remain unverified**. [ADR-020](ADR-020-native-responses-only.md) is the later protocol authority; [current runtime](../operations/current-architecture.md) records the actual source-inspected composition.

> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-017 — Bifrost as the unified external LLM gateway for ACE

**Status:** Accepted architecture; local TypeSpec v2 context RPC and Bifröst Go connector implemented. **Real subscription provider E2E and production readiness not yet certified.**  
**Date:** 2026-10-24  
**Project:** Adaptive Context Engine (ACE)  
**Scope:** Coding agents using a configurable provider endpoint. The owner decision of 2026-11-14 supersedes all separate agent-facing ACE context paths.

## Context

ACE must remain agent-neutral. Hermes historically supplied a native request-local `ContextEngine.select_context` seam (ADR-016), now retired for ACE delivery; agents instead configure the Bifröst endpoint. Relying on retired optional tool-call protocol tool invocation alone cannot guarantee that ACE controls the actual model-bound request. A gateway can intercept requests where an agent is configured to use it, but cannot see hidden provider-held conversations or requests that bypass the configured endpoint.

The owner selected **Bifrost** as the candidate unified LLM gateway and confirmed Linux as the primary target; macOS is a possible secondary target. Go ↔ TypeScript is an explicit process boundary, not a reason for a TypeScript reverse-proxy tier.

## Decision

1. **Northbound:** Bifrost exposes provider-compatible HTTP(S) endpoints to participating agents. It terminates an agent→gateway connection and creates a separate gateway→provider connection; it does not decrypt a separate end-to-end TLS stream between the agent and provider.
2. **Southbound:** ACE Core remains the existing **TypeScript + Effect** modular monolith. A **thin Go ACE Connector**, loaded by or integrated with a pinned Bifrost build, calls a **versioned, local ACE Gateway Projection API**. No Go dependency, Bifrost DTO or Bifrost-specific policy enters ACE domain logic.
3. **No obligatory middle proxy:** Do **not** build an additional TypeScript reverse proxy or fork Bifrost by default. Escalate an evidenced, narrow Bifrost extension or provider-native transport only if the conformance gates show the required invariants cannot be enforced in the selected hooks.
4. **One context plane:** Bifröst LLM Gateway is the sole agent-facing ACE context delivery path. No model-invoked ACE tool interface, optional explicit retrieval interface, or native Hermes context hook may remain as an alternative or fallback. Retrieval and source expansion are ACE internal capabilities invoked during Gateway projection.
5. **Primary interception:** Prefer `HTTPTransportPreHook` for bounded JSON bodies where it exposes the original body, supports authenticated identity and blocks forwarding with a concrete response/error. Do not assume `PreLLMHook` controls final upstream bytes: it uses normalized request types and executes per provider attempt. `PreRequestHook` may be used for normalized invariants common to fallback attempts.
6. **Payload fidelity is an evidence gate.** Establish compatibility **per protocol × provider × route × Bifrost commit/configuration**, not by an unconditional "raw passthrough" label. Preserve all relevant tool call/result links, reasoning or signed content, multimodal blocks, system/developer controls, usage-visible state and unknown vendor extensions. If Bifrost cannot preserve required semantics, mark that route unsupported for full-context projection and block strict requests.
7. **Admission and egress:** Policy-denied/unauthorized cloud egress, missing required projection or invalid evidence **fail closed**. Technical retrieval failure may produce an explicit authorized degraded result under ADR-007, but not silently forward an untransformed request in a strict experiment. A registration-successful hook is not proof that every provider attempt passed inspection.
8. **Default data policy:** Local original source and conversations do not gain cloud-transfer authorization merely because an agent selects a provider. The gateway enforces destination/data-class policy at the **actual outbound attempt**, including retries and fallbacks; never log raw prompt, code or credentials.
9. **Provider-held history:** `previous_response_id`, implicit thread/conversation state, or comparable continuations cannot be claimed as full gateway context replacement unless an authorized, lossless state reconstruction is explicitly established. Otherwise return a typed unsupported/partial capability.
10. **Scope and evidence:** Linux first, optionally macOS subject to matching Go plugin/Bifrost build verification. Do not silently add a Windows compatibility requirement. Promote to production only after provider-wire capture, security checks, streaming/fallback conformance, real agent E2E, and owner signoff.

## Conceptual boundaries

LangGraph (or another external orchestrator) owns multi-agent scheduling; it is neither the ACE runtime nor the context transport. The TypeSpec v2 local context RPC and ACE Bifröst Go hook are implemented, including the existing ChatGPT/Codex subscription passthrough path under [ADR-021](ADR-021-bifrost-single-gateway-ace-context-service.md). **Provider-wire and agent-E2E certification are still open.**

~~~text
Agent (Hermes / OpenCode / Pi / other)
  |
  +-- HTTPS / provider-compatible API ---> Bifrost (Go; pinned)
                                          |
                                          +-- ACE Connector (thin Go adapter)
                                          |       |
                                          |       +-- local HTTP/Unix socket ---> ACE Core (TS/Effect)
                                          |                                   retrieval/policy/projection
                                          |
                                          +-- verified outbound model request ---> LLM provider
~~~

The gateway is an **alternative delivery adapter**, not a second ACE retrieval engine. Runtime composition and deployment must not make ACE Core depend on a specific Bifrost binary.

## Known Bifrost source findings underlying the design

Source inspected on `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f` (branch `dev` at inspection; **not** a selected production pin):

- `core/schemas/plugin.go` defines the HTTP transport and model plugin boundaries; `PreLLMHook` is per attempt whereas `PreRequestHook` is per top-level request.
- `transports/bifrost-http/handlers/middlewares.go` copies `HTTPRequest.Body` and applies modified bytes to `fasthttp.Request`; oversized or streaming/unknown-length bodies can bypass the body copy.
- `core/providers/openai/responses.go` can intentionally rewrite/drop unsupported blocks during provider conversion. This is not lossless provider-native delivery.
- `core/providers/anthropic/requestbuilder.go` can modify fields even when consuming `RawRequestBody`, including `thread` and `model`.
- The transport-level HTTP hook can explicitly terminate a request on error; do not generalize the error behavior of core LLM plugins to it.

These are **static source observations**, not a passed on-the-wire compatibility test. Re-run inspection against the exact Bifrost version selected for implementation.

## Non-goals

- Becoming a generic MITM/intercepting TLS proxy; bypassing agent/provider authentication.
- Embedding ACE retrieval/compaction business logic into Go.
- Claiming support for agents whose HTTP traffic cannot be configured to reach Bifrost.
- Byte-identical JSON across different upstream provider protocols (the guarantee is protocol-valid **semantic fidelity** for protected fields and explicitly documented permitted rewrites).
- Fabricating token savings or signing off production merely from mock tests. Older agent-boundary and native Hermes contracts are superseded wherever they conflict with Gateway-only delivery.

## Required follow-up

- Current implementation and acceptance plan: [OpenSpec 013 — G11 production acceptance](../../openspec/changes/013-gateway-g11-production-acceptance/); the native Responses-only contract is recorded in [ADR-020](ADR-020-native-responses-only.md).
- Add normative OpenSpec capabilities before changing runtime code: contracts for `gateway admission`, `request-local projection`, `protected message groups`, `provider wire equivalence`, `authorization`, `fallback/retry` and `receipts`.
- Stage compatibility as `contract-designed → adapter-implemented → provider-wire-tested → agent-E2E-tested → benchmark-evaluated → owner-approved`, one explicit state per protocol/route. No production approval is conferred by this ADR.

## Related decisions

ADR-001 (superseded agent boundary), ADR-006 (no silent truncation), ADR-007 (security and failure), ADR-009 (Harbor), ADR-014 (hybrid context), ADR-015 (benchmark history), ADR-016 (superseded Hermes-native context delivery).
