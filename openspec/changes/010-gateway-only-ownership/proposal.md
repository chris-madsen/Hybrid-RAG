# Proposal — Gateway-only ACE ownership

**Status:** Current accepted direction implementing the repository owner decision of 2026-11-14.

## Why

ACE previously accumulated multiple agent-facing delivery experiments: optional model-invoked tools, a Hermes-native ContextEngine bridge, and Bifröst Gateway projection. The owner selected one delivery architecture: coding agents target Bifröst, and Bifröst automatically obtains ACE request-local context before an allowed provider attempt.

This change is the current OpenSpec owner for that integration boundary. Superseded Hermes-native and dual-owner experiments are retained under `openspec/changes/archive/` only as historical evidence.

## Scope

- Bifröst is the sole agent-facing ACE context-delivery path.
- ACE Core remains TypeScript + Effect and owns retrieval, source verification, policy, memory and context projection.
- A thin pinned Go plugin binds a Bifröst request/session to `ace.gateway.v1`, authenticates to the local projection endpoint, and fails closed.
- Only the currently certified OpenAI Chat Completions ingress route is projected. Unsupported generation routes are blocked rather than bypassing ACE.
- Projection may add one verified evidence system message while preserving all other provider-body semantics.
- The first provider attempt is bound to the projection receipt, normalized model/provider and exact inserted context. Retry/fallback reuse is blocked until per-attempt reauthorization is implemented.
- Provider/agent production acceptance remains a distinct G11 evidence stage.

## Out of scope

- Reintroducing model-selected ACE tools or a native Hermes ACE delivery bridge.
- Claiming hidden provider-held history is visible.
- Claiming token savings from additive context injection.
- Certifying retry, fallback, streaming, external provider bytes or task economics without their real evidence.
