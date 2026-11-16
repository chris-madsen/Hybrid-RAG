# Proposal

## Why

The merged Gateway-only migration (OpenSpec change 010, PR #246) and structural SDLC closure (PR #247) are not real coding-agent or production-provider acceptance. The Bifröst connector is pinned and compile-tested, but live terminal plugin order, final-send bytes, streaming, fresh retry/fallback authorization and paired real-agent Harbor economics remain uncertified. Treating repository checks or mock-wire tests as production proof would be misleading.

This is a new **G11 acceptance** capability and staged future implementation, not a replacement for 010's accepted request-binding and fail-closed Gateway contracts or change 002's Harbor benchmark rules. Existing 010 tasks explicitly defer these obligations.

## What Changes

- Specify terminal custom-hook order, final provider-send verification, synthetic mock-upstream versus authorized real-provider evidence and per-protocol/route certification.
- Specify streaming success, partial output, cancellation, hidden fields and unsupported-mode behavior.
- Specify fresh single-use attempt authorization before enabling retry/fallback; the existing fail-closed behavior remains the default until evidence-backed implementation.
- Specify one real coding-agent through the sole Bifröst → ACE → authorized provider path, preserving honest host-transcript limitations.
- Specify Harbor quality, token, cached/reasoning usage, total cost and causal attribution under the existing strong-baseline/holdout rules.
- Prepare phase dependencies, RED/GREEN and real-provider oracles and a pre-code G02 crosswalk; do not implement features or approve external egress in this change.

## Capabilities

### New Capabilities
- gateway-final-wire: Final provider wire and route certification.
- gateway-streaming: Streaming request and response conformance.
- gateway-attempt-reauthorization: Request-local retry and fallback authorization.
- gateway-real-agent-and-economics: Real coding-agent acceptance and Harbor attribution.

### Modified Capabilities

None in this planning-only PR. Existing 010 and 002 remain authoritative for their current ownership and accepted benchmarking invariants.

## Impact

Planning artifacts in this OpenSpec change only. Future implementation is expected in the existing Go Bifröst plugin/connector, TypeScript + Effect Gateway, tests, constrained provider evidence harness and Harbor adapters. No new Go ACE server, proxy, agent tool protocol, mandatory branch protection, token-admission gate or TypeSpec v1 edit is authorized here.

## Success and boundary

A strict OpenSpec + structural SDD review may make this change ready for **owner G02 review**, not production-ready. Production claims require an exact-delivered-SHA G11 evidence ledger, real provider/agent runs, and explicit owner approval. No provider/model, paid resources or access credentials are selected by this proposal.
