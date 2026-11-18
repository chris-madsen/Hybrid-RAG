# ADR-020 — Native Responses-only ACE Gateway

**Status:** Accepted by explicit owner decision
**Date:** 2026-11-18
**Project:** Adaptive Context Engine (ACE)
**Supersedes:** prior Gateway Projection v1 compatibility and multi-protocol implementation assumptions where they conflict with this decision.

## Context

ACE must preserve one agent-facing context-delivery owner and keep provider dispatch fail-closed until the exact physical-send boundary is independently verified. A prepared context projection is not authorization to send a model request. Maintaining multiple request formats, compatibility adapters, generated contracts and runtime owners increases the risk of silent translation, hidden fallback and false evidence.

## Decision

1. The sole supported agent-facing generation protocol is Bifröst's provider-native `POST /v1/responses` route. ACE exposes one authenticated local projection contract: TypeSpec-generated `ace.gateway.v2`.
2. The previous Gateway projection wire, DTOs, generated schemas, runtime adapters, fixtures and compatibility routes are retired and removed from the repository. Do not add a compatibility alias, translation or fallback.
3. Unknown or unsupported generation routes fail closed before provider dispatch. The Bifröst plugin short-circuits every physical model attempt until a verified per-attempt authorization is implemented for exact final bytes, destination and privacy policy, including retries and fallbacks.
4. `PREPARED` means local context preparation only. It is never an outbound-send permit or provider-wire receipt.
5. C01 implementation approval covers the native-only contract and removal scope. It does **not** authorize external provider egress, a live Hermes session, Harbor runs, or production promotion. Those require their separate evidence and owner approvals.
6. TypeSpec is the single source for the active Gateway wire. OpenSpec owns behavior and acceptance; immutable domain ADTs and pure functions own invariants; Effect owns application I/O and resource/cancellation composition.

## Consequences

- Existing consumers of the retired projection contract must migrate to the native Responses v2 contract; no in-repository compatibility layer will be maintained.
- Provider dispatch remains disabled until the applicable final-send, privacy, route, agent and release gates pass.
- Historical evidence is not a substitute for current source inspection or current-provider proof.
- Bifröst remains the only agent-facing ACE delivery architecture; no additional proxy or model-invoked context interface is introduced.

## Acceptance checks

- TypeSpec-generated v2 artifacts are reproducible and are the only active Gateway projection contract.
- Runtime composition exposes only the native Responses projection route and rejects unsupported ingress.
- Negative tests prove rejected routes and missing authorization cannot reach provider dispatch.
- Real provider, Hermes, Harbor and production acceptance remain separate and are not implied by this ADR.
