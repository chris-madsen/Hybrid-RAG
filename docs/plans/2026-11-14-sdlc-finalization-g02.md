# ACE SDLC finalization — request-bound Bifröst host binding and closure audit

**Date:** 2026-11-14  
**Risk:** T2 — agent/provider boundary, request identity, architecture acceptance.  
**Source baseline:** `main@7c9178ddbfff09ee02f328b61356bdc6fc54b995`  
**Owner direction:** finish the remaining SDLC/architecture refactor; do not reintroduce optional agent tools or mutate main directly.

## Research facts

1. PR #246 is merged. The Gateway-only path is the sole supported agent-facing ACE delivery route.
2. The ACE Bifröst plugin currently requires custom context keys `ace.session_id`, `ace.attempt_group_id`, `ace.provider` and `ace.host_attestation`, but no repository integration populates them; normal agent traffic therefore fails closed.
3. Pinned Bifröst `fe7634a6c828927d05ffdd57c62be0aaab04193f` already places the resolved coding-harness session under `BifrostContextKeySessionID`, the HTTP request ID under `BifrostContextKeyRequestID`, and all request headers under `BifrostContextKeyRequestHeaders`.
4. The HTTP transport sees the exact pre-provider JSON body, but Bifröst cannot truthfully attest whether the coding host compacted or rewrote its own durable transcript before constructing that request. Request-byte binding and host-transcript attestation are separate guarantees.
5. QG0–QG2, QG4 report-only, QG5 compatibility, TypeSpec Gateway v1 codegen and selected QG6/nightly checks are installed, but current SDLC catalog/architecture ledger still describe several merged gates as proposed/pending.

## G02 crosswalk

| AC | Owner / decision | Interface/state | Implementation | Deterministic oracle | Real-provider obligation |
|---|---|---|---|---|---|
| SF-01 | Gateway-only owner decision | Bifröst HTTP request → ACE projection | derive request/session/attempt identity from trusted Bifröst context | Go tests: missing session/request blocks; populated context projects | real agent Bifröst run still separate |
| SF-02 | no fabricated transcript state | `GatewayHostAttestation` | bind exact visible request while setting host transcript/compaction state explicitly unattested/unknown | fixture rejects `hostTranscriptAttested=true` from Bifröst and preserves unknown epoch | authenticated host attestor required for exclusive-context claim |
| SF-03 | provider identity and destination policy must not drift | explicit provider/model + ProjectDataPolicy + PreLLM selected route | reject unprefixed models; authorize exact provider/private-source egress before retrieval; compare selected provider/model in PreLLM | provider allowlist/cloud-opt-in/secret/provider-swap negative tests | real configured provider run |
| SF-04 | no second integration plane | plugin remains sole Bifröst seam; no proxy/tool bridge | delete requirement for external `ace.*` request context | source/contract regression | no |
| SF-05 | SDLC truthfulness | catalog, adoption plan, remediation ledger | mark merged/active gates accurately; distinguish report-only/nightly/not-run | docs link + closure audit | no |
| SF-06 | closure is evidence, not fiction | machine-readable closure command | add deterministic closure audit for installed SDLC/architecture invariants | positive + intentional negative fixture | cannot replace G11 real provider/agent acceptance |
| SF-07 | no unauthorized source egress | Gateway application security + explicit Bifröst route | use existing `ProjectDataPolicy` (`other_external/private_source`), exact provider allowlist and secret guard before projected body construction | deterministic policy-denial and secret fixtures | final provider wire remains G11 |

## Accepted design

- Bifröst is trusted for the request bytes and request/session identity it actually observes; it is **not** trusted as evidence of coding-host durable transcript/compaction state.
- Session identity comes from Bifröst's existing coding-harness session resolver; request ID is the attempt-group identity for the physical HTTP request.
- Gateway v1 still requires durable-transcript-shaped fields, so the Bifröst connector fills them only as non-authoritative request markers: `hostTranscriptAttested=false`, `hostCompactionEpoch="unknown"`, `activeEngineId="bifrost-visible-request-only"`, and `durableActiveTranscriptRevision="unattested:<request-id>"`; the digest binds the exact visible request body.
- ACE allows additive evidence delivery in that explicitly lower-assurance state. A future authenticated host-side attestor may set `hostTranscriptAttested=true`; only then does the strict no-compaction invariant apply. Production/benchmark claims of exclusive context ownership remain blocked until that evidence exists.
- Provider must be explicitly encoded as a Bifröst `provider/model` route. Gateway Core authorizes the exact provider against `ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON` plus `ACE_GATEWAY_EXTERNAL_LLM_OPT_IN=true` and `ProjectDataPolicy` before retrieval; PreLLM blocks any provider/model drift.
- Workspace remains configured deployment identity, not caller-controlled state.
- This slice does not claim external provider byte certification, streaming/fallback certification, or task-quality economics.

## Four gates

- **BUILD:** Go plugin/unit tests, TypeScript verify:pr, TypeSpec compatibility.
- **ARCH:** no external host bridge or second agent plane; TypeScript boundaries remain inward.
- **SEC:** exact body/session binding, no caller-supplied static transcript attestation, provider/model drift blocks.
- **PLAN:** closure ledger marks PASS only for installed deterministic gates and NOT-RUN for real provider/agent evidence.
