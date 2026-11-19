# 2026-11-19 Native Responses visible-evidence echo suppression — T1 focused SDLC

## R — Verified source baseline

- Main: `20ea0422e65cc79415152bbe5c6ee48fb7abe172` (after merged #284). Source inspection: `src/domain/responses-projection.ts:125-142` prepends a developer evidence item to intact original Responses input; the original tool/reasoning/native JSON fields are preserved.
- `src/application/responses-projection-service.ts:87-116` calls `context.transform` without a declaration of visible content. `src/domain/context-delivery.ts:222-340` deduplicates ACE-internal identical verified spans and known receipt identities but cannot identify code already visible in the incoming Hermes message/tool output.
- `src/application/context-transform-service.ts:138-196` searches once per projection and uses existing `projectContextForDelivery` and `assembleContext` owners. No new retriever, provider call, token budget, cache or wire request fields are necessary.

## S — Accepted contract and observable T1 correction

Governed by existing G11 `RESP-004`: stateless provider-native Responses; preserve every original input item and all protected provider parameters; inject one clearly marked ACE evidence developer item. Correct duplicate **delivery**, without altering the original history.

- VE-001 (T1 regression): If a complete, exact UTF-8 code evidence body, with current/direct proof and source digest, already appears in a native Hermes-visible input text segment, ACE sends its citation/receipt without copying the body again. No substring/fuzzy/semantic suppression.
- VE-002: Unseen or unverified snippets remain byte-exact; docs/memory/other source classes remain independent; stale or uncertain evidence is not suppressed. Same file with a different span is not implicitly redundant.
- VE-003: All-known context remains a valid `PREPARED` one-developer evidence item with cited references rather than BLOCK, empty body or optional passthrough. No modification/reordering/truncation of original Responses function_call, tool output, reasoning, multimodal and opaque numeric values.
- VE-004: The comparison is local, deterministic and uses only model-visible user/assistant/developer/system text and function_call_output text present in the *current, stateless* native request. It never infers hidden Hermes/provider history and makes no new LLM/embedding/provider request.
- VE-005: Existing receipt-only contexts retain their current contract; source revision/digest changes and absent exact matching text remain fully transmitted. Observe reduced `reusedContextBytes`/model-visible evidence size on duplicate fixtures; avoid unsupported blanket claims about 5× total tokens.

## A — Minimal architecture / Meyer contract

- **Own the code at its existing boundaries:** `nativeResponsesVisibleText` pure extraction in `src/domain/responses-projection.ts`; optional readonly `visibleNativeInputText` internal transform request in `src/application/context-transform-service.ts`; suppression inside existing `projectContextForDelivery` after receipt identities and before existing assembly. No new public TypeSpec DTO, Go transport callback or state store.
- **Require:** valid decoded and policy-authorized native Responses request with explicit `store:false`, verified source evidence, and a literal matching visible segment.
- **Ensure:** source body omitted **only** on a complete exact match for direct/current/digest-verified code; retain citation, receipt ID, evidence ID, source metadata, original request, and all other evidence untouched.
- **Invariant/frame:** no new user-visible agent tool, token ceilings, double indexing, network LLM calls, guessed hidden history, mutable global state, or loss of original Responses fields. No model-input rewriting outside the already-approved additive developer item.
- **Exceptional:** unprovable match = include existing evidence exactly; original request integrity/policy errors continue to block before retrieval. A duplicated body without new content is a source reference, not a failure requiring user interaction.
- **Event Storming / functional DDD:** `NativeInputObserved` → `ExactEvidenceAlreadyVisible`/ `NewEvidenceSelected` → `SourceReferenceDelivered`/`EvidenceDelivered`. The immutable domain projection owns equality; the existing Effect transformer handles retrieval and assembly. No FSM, persistence, new aggregates or architecture fork.
- **Risk:** T1 contained correction in an existing accepted `RESP-004` additive projection contract; no new external wire shape, provider permission, concurrency state, protocol or auth. T2 G02/owner route selection not re-decided; changing wire result/dispatch or editing original history would require a new T2 design and owner G02 instead.

## P/X — One vertical slice; test-first plan

| Scope | Forecast handwritten changes | RED / GREEN | Evidence |
|---|---:|---|---|
| VE-001…VE-005: native visible text extraction → existing context receipt projection → transformer → context developer item | Source ~100 + tests ~170 + this design ~80 = ~350 LOC | `./node_modules/.bin/tsx --test test/progressive-context-delivery.contracts.test.ts test/context-transform.contracts.test.ts test/responses-projection.contracts.test.ts test/responses-projection-service.contracts.test.ts`; GREEN plus `npm run test:affected`, `npm run verify:pr` | GitHub focused CI at exact SHA; mock contract evidence only; real agent/Harbor NOT_RUN |

**RED first:** add failing fixtures for duplicate vs distinct spans, provider-visible vs opaque text, receipt continuity and native forwarding. **GREEN:** smallest pure helpers, no additional search. Review sequentially BUILD (types/tests), ARCH (single ownership/unchanged input), SEC (no new egress/private logs), PLAN (VE coverage/rollback), then PR. At this planning/pretest commit these are pending, not retrospectively PASS.

## Pipeline provenance and honest limits

ACE skill texts applied sequentially: `ace-sdlc` intent router → focused fact-only R → accepted S → `ace-architecture-design` T1 minimal reuse → `ace-to-tickets` single slice → `ace-phase-plan` T1 inline X → `implement_backend` RED/GREEN → V. Host-native Skill tool invocation and local `worktree:preflight`/`sdlc:preflight` are **NOT_OBSERVED** from the GitHub connector; no claim of actual Hermes execution, independent reviewer, local CLI, or live provider. Use isolated GitHub branch and CI as executable evidence. Change is not a substitute for C03 final-send certification.
