# Proposal

## Why

The owner has repeatedly excluded Chat Completions from ACE. The accepted R6 Responses review already prohibited Chat adapters/fallback, yet later Gateway v1 code and the G11 stage plan continued to treat Chat as the first usable route. This contradictory, non-agentic transport cannot be promoted as the supported architecture.

## What Changes

- Establish the authoritative **Responses-only** agent-facing contract: Hermes owns the iterative agent loop and sends native Responses requests to pinned Bifröst, while ACE automatically supplies bounded, verified source context for each eligible request.
- Immediately disable the existing Chat generation route and any false usable-route advertisement; while native Responses is not implemented, fail closed rather than fall back or pass through.
- Preserve the existing byte-pinned Gateway v1 TypeSpec/generated schema as **historical, non-operational** contract evidence; introduce a separately versioned TypeSpec successor for any native Responses wire.
- Stage provider-native Responses preservation, exact model OAuth/effort, tool call/result correlation, reasoning/opaque fields, context window/token counting, streaming/cancellation, per-physical-send privacy authorization, final-wire receipts, and genuine multi-turn Hermes E2E.
- Reconcile existing G11 planning and historical reviews to this explicit owner instruction before approving G02 or starting product implementation.

## Capabilities

### New Capabilities
- `responses-native-agent-loop`: the sole acceptable end-to-end ACE delivery path and its fail-closed migration.

### Modified Capabilities
None of the frozen v1 contract fields are rewritten in place.

## Impact

- Immediate fail-closed route quarantine in the current Bifröst plugin and local projection HTTP transport; tests and authoritative agent rules.
- Separate owner-reviewed G11/TypeSpec v2 migration follows. No provider keys, network egress, cost authorization, or agent loop is claimed implemented by quarantine.
