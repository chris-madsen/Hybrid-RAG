# Design

## AS-IS, authority and incompatibility

The pinned ACE plugin currently recognizes the legacy `/v1/chat/completions` route, forwards a legacy projection envelope labeled `openai.chat.completions`, and checks `ChatRequest` at `PreLLMHook`. The TypeScript gateway domain and TypeSpec v1 similarly require Chat `messages`. Gateway HTTP advertises that protocol. The current Hermes Codex agent route instead uses provider-native Responses, and the 2026-10-31 R6 review explicitly prohibits Chat conversion/fallback. This newer owner instruction overrides the Chat-first acceptance approach in G11. No valid native Responses ACE projection, certified final provider wire, agent loop E2E, or G02 acceptance exists today.

## TO-BE (two separate boundaries)

1. Hermes **owns the long agent loop**: reasoning, function calls, tool results, retries/cancellation, continuation across many turns and local project state. ACE is not an agent scheduler.
2. Bifröst's provider-native `/v1/responses` route is the **only eligible** ACE generation ingress. ACE Projection is a separately authenticated, bounded request-local context transformation. Preserve every original request field and every tool/reasoning/multimodal/opaque item without replacing original history. Do not rely on provider-held hidden history or an invented full-transcript attestation.
3. Each real physical upstream dispatch must carry a fresh policy decision for the exact provider/model/destination, original+added data classes, payload digest, `store:false` privacy where applicable and observed final-wire evidence. An outer PreLLM hook receipt cannot authorize invisible inner retry/extraAttempts or fallback dispatches.
4. The canonical TypeSpec source of any new wire contract is a new version (v2 or an approved equivalent), not an in-place rewrite of accepted Gateway v1. Historical test fixtures stay only as migration evidence, never as an active supported route.
5. **Migration fails closed:** before a native Responses adapter is implemented and proved, gateway generation returns explicit unavailable/retired responses and advertises no certified route; no automatic Chat fallback, OpenAI API-key bypass or nonstandard passthrough route.

## Negative contract cases

- Legacy Chat requests, alternate Chat alias paths, non-certified native Responses, and custom passthrough generation are denied before any provider dispatch.
- A direct authorized HTTP call to the old projection endpoint cannot project a Chat body while the ingress is quarantined.
- The gateway must not claim provider-wire or agent-E2E certification from unit tests, plugin compilation or fake upstream.
- A new Responses implementation must preserve function_call, function_call_output, call_id, reasoning/opaque content, unknown extension fields, streaming terminal/partial events and model-specific usage. Returning to Chat-style `messages` is a failed oracle.
- Any mismatch in `store:false`, token counter, endpoint/provider identity, protected-body digest, retry per-send guard, or final-send evidence blocks real private-data egress.

## Reuse and ownership

- Reuse pinned Bifröst native Responses converter/passthrough capabilities **only after** checking exact pinned upstream source, OAuth handling, body rewrite and provider route. No custom substitute proxy.
- TypeScript + Effect domain/application own immutable decisions and policy; TypeSpec owns versioned public/wire schema; OpenSpec owns acceptance.
- Reuse the existing Go plugin lifecycle, HTTP transport, source identity, privacy audit, Harbor two-arm Hermes feedback contract and provider-independent negative fixtures.
- No new agent orchestrator, tracker, direct provider bypass or additional context tool.

## G02 decision crosswalk

| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |
| --- | --- | --- | --- | --- | --- | --- |
| RESP-001 | owner | ACCEPTED: native Responses only | Bifröst ingress | 1 | reject Chat and unready Responses | live upstream zero-send |
| RESP-002 | owner | ACCEPTED: no false capability | Gateway HTTP | 1 | no active routes and no Chat projection | N/A |
| RESP-003 | owner | ACCEPTED: versioned contracts | TypeSpec successor | 2 | v1 untouched, v2 emits clean | N/A |
| RESP-004 | owner | ACCEPTED: full agent semantics | Responses input/output | 2-3 | opaque/tool/reasoning preservation fixtures | full loop tasks pending |
| RESP-005 | owner | PROPOSED: physical-send seam requires validation | per-attempt auth | 3 | mock retry/fallback no-send | pinned upstream + owner decision |
| RESP-006 | owner | PROPOSED: OAuth/privacy require proof | native provider wire | 3-4 | store:false, budget/counter fixtures | consented real route |
| RESP-007 | owner | PROPOSED: full-loop validation | Hermes/Bifröst/ACE | 4 | session/tool replay negatives | real multi-turn agent E2E |
| RESP-008 | owner | PROPOSED: quality/economics evaluation | Harbor feedback | 5 | usage/cost/quality accounting | paid holdout only if authorized |

**G02 status: REVIEW_REQUIRED.** Explicit Responses-only is accepted, while the particular supported Bifröst revision, per-dispatch enforcement method, OAuth/model configuration and privacy proof are deliberately unresolved. Do not mark provisional decisions as approved.
