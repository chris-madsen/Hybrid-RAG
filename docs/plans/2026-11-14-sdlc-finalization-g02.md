# ACE SDLC finalization — request-bound Bifröst host binding and closure audit

**Date:** 2026-11-14  
**Risk:** T2 — agent/provider boundary, request identity, architecture acceptance.  
**Source baseline:** `main@7c9178ddbfff09ee02f328b61356bdc6fc54b995`  
**Owner direction:** finish the remaining SDLC/architecture refactor; do not reintroduce optional agent tools or mutate main directly.

## Research facts

1. PR #246 is merged. The Gateway-only path is the sole supported agent-facing ACE delivery route.
2. The ACE Bifröst plugin currently requires custom context keys `ace.session_id`, `ace.attempt_group_id`, `ace.provider` and `ace.host_attestation`, but no repository integration populates them; normal agent traffic therefore fails closed.
3. Pinned Bifröst `fe7634a6c828927d05ffdd57c62be0aaab04193f` already places the resolved coding-harness session under `BifrostContextKeySessionID`, the HTTP request ID under `BifrostContextKeyRequestID`, and all request headers under `BifrostContextKeyRequestHeaders`.
4. The HTTP transport sees the exact pre-provider JSON body, so Bifröst can truthfully attest the model-bound transcript bytes it is about to project without a second external host bridge.
5. QG0–QG2, QG4 report-only, QG5 compatibility, TypeSpec Gateway v1 codegen and selected QG6/nightly checks are installed, but current SDLC catalog/architecture ledger still describe several merged gates as proposed/pending.

## G02 crosswalk

| AC | Owner / decision | Interface/state | Implementation | Deterministic oracle | Real-provider obligation |
|---|---|---|---|---|---|
| SF-01 | Gateway-only owner decision | Bifröst HTTP request → ACE projection | derive request/session/attempt identity from trusted Bifröst context | Go tests: missing session/request blocks; populated context projects | real agent Bifröst run still separate |
| SF-02 | no fabricated transcript state | `GatewayHostAttestation` | attest exact inbound Chat body digest/revision; no external/static transcript JSON | fixture checks digest/session/revision and body binding | provider wire capture separate |
| SF-03 | provider identity must not drift | requested provider/model vs PreLLM selected route | parse requested provider from model using pinned Bifröst semantics, then compare selected provider/model in PreLLM | provider/model swap negative tests | real configured provider run |
| SF-04 | no second integration plane | plugin remains sole Bifröst seam; no proxy/tool bridge | delete requirement for external `ace.*` request context | source/contract regression | no |
| SF-05 | SDLC truthfulness | catalog, adoption plan, remediation ledger | mark merged/active gates accurately; distinguish report-only/nightly/not-run | docs link + closure audit | no |
| SF-06 | closure is evidence, not fiction | machine-readable closure command | add deterministic closure audit for installed SDLC/architecture invariants | positive + intentional negative fixture | cannot replace G11 real provider/agent acceptance |

## Accepted design

- The trusted attestor is the pinned Bifröst HTTP/plugin process itself because it observes the exact model-bound request bytes.
- Session identity comes from Bifröst's existing coding-harness session resolver; request ID is the attempt-group identity for the physical HTTP request.
- Transcript revision is the Bifröst request ID and transcript digest is SHA-256 of the exact inbound provider body.
- Gateway v1 retains legacy field names `durableActiveTranscriptRevision` / `durableActiveTranscriptDigest`. In this Gateway-only Bifröst seam they identify the **exact visible model-bound request snapshot**, not the agent's private durable transcript store. `hostTranscriptAttested=true` means Bifröst attests the bytes it actually received. `compactionEnabled=false` / epoch 0 mean this Bifröst seam performs no host-side transcript compaction; they do not claim knowledge of any compaction the agent may have performed before constructing the request.
- No host compaction is claimed at this seam: `compactionEnabled=false`, epoch 0, and a constant controls digest identifies that mode.
- Provider is derived from the model using Bifröst's own `ParseModelString` semantics; a later routing mismatch fails closed in PreLLM.
- Workspace remains configured deployment identity, not caller-controlled state.
- This slice does not claim external provider byte certification, streaming/fallback certification, or task-quality economics.

## Four gates

- **BUILD:** Go plugin/unit tests, TypeScript verify:pr, TypeSpec compatibility.
- **ARCH:** no external host bridge or second agent plane; TypeScript boundaries remain inward.
- **SEC:** exact body/session binding, no caller-supplied static transcript attestation, provider/model drift blocks.
- **PLAN:** closure ledger marks PASS only for installed deterministic gates and NOT-RUN for real provider/agent evidence.
