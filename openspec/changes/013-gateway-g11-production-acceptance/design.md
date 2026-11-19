# Design — provider-native Responses G11 implementation and acceptance

## Authority, baseline and evidence classification

- Verified repository snapshot: `chris-madsen/Mult-agent-AI-Orchestration@601e08ae9f0895c84a88d8e55773a867ccae908b` (2026-11-18). This document records source-grounded design and observed current implementation; it is not provider-wire evidence.
- Current owner decision selects **Hermes → Bifröst native `/v1/responses` → ACE Gateway v2** as the sole agent-facing route. TypeScript/Effect owns domain/application behavior, TypeSpec owns the generated wire, and Harbor owns task-level comparison. The previous projection contract and repository compatibility implementation are to be removed, not retained as a fallback.
- OpenSpec change 010 remains historical ownership context only. Its previous wire behavior is superseded by this owner decision and must not remain as an active runtime, schema or generated type.
- Existing `openspec/changes/013-gateway-g11-production-acceptance/specs/**` owns G11-001…G11-020; new `gateway-native-responses` spec supplies RESP-001…RESP-008. `openspec/changes/002-harbor-evaluation/specs/agent-benchmarking/spec.md` and ADR-009 remain Harbor quality/usage authority.
- Original #271/#273 branches were **closed without merging**. Their fail-closed code, TypeSpec draft and fixture tests are candidate reuse evidence only, not active ACE code, provider proof or owner approval. This plan does not silently cherry-pick them.

### AS-IS: actual main source owners at the verified baseline

The following rows describe `601e08ae9f0895c84a88d8e55773a867ccae908b`, not the current C01 worktree. C01 removes the listed prior owners; the implementation status remains unverified until its required tests and reviews pass.

| Owner / file | Verified current behavior | Architectural gap |
|---|---|---|
| `integrations/bifrost/ace-connector/plugin/main.go` | `HTTPTransportPreHook` accepts native `/v1/responses` for local preparation; `PreLLMHook` short-circuits every model attempt | No final physical-send authorization; keep all dispatch disabled |
| `integrations/bifrost/ace-connector/connector.go` and `responses.go` | Native v2 projection client exists alongside obsolete contract types and validators | Remove the obsolete owner and retain only bounded native request binding/application |
| `src/domain/gateway-projection.ts` and `responses-projection.ts` | Native Responses ADT exists, while the prior projection ADT remains in the active source tree | Remove the prior domain owner and make Responses v2 the only projection contract |
| `src/application/gateway-projection-service.ts` and `responses-projection-service.ts` | Native context preparation is composed; the prior service remains as dead compatibility code | Remove the prior application owner and keep Effects/errors/policy in the native service |
| `src/transport/gateway-projection-http.ts` | v2 projection is available, but v1 health/capabilities/delivery routes and generated types remain | Move all Gateway operations to v2 and delete every prior projection endpoint/type |
| `src/bin/ace-runtime.ts`, `src/bin/ace-gateway-http.ts` | constructs existing Gateway runtime under `ACE_GATEWAY_HTTP_MODE` | Must compose exactly one native Responses path; no extra proxy/tool |
| `typespec/responses-v2.tsp` and generated outputs | Gateway contract ownership is split across prior handwritten and generated wire artifacts | Make native Responses v2 the sole TypeSpec contract and remove superseded schemas, DTOs and adapters |
| `scripts/build-bifrost-ace-plugin.sh`, `integrations/bifrost/ace-connector/plugin/main_test.go` | exact Bifröst source pin `fe7634a6c828927d05ffdd57c62be0aaab04193f`; compile/fixture confidence only | Pin does not certify OAuth, no-conversion, raw-body `store:false` or per-inner-retry final send |
| `test/gateway-projection*.ts`, `test/bifrost-plugin.contracts.test.ts`, `scripts/real-projection-e2e.mjs` | v1/limited mock and negative contract fixtures | Need native reasoning/tool/stream/attempt tests and one real authorized Hermes evidence run |
| `src/domain/harbor-evaluation-policy.ts`, `src/adapters/harbor-*.ts`, `scripts/collect-feedback-loop.ts` | existing Harbor quality and pairing owners | Need route-bound provider receipts and paired real-agent usage, not a custom benchmark engine |

**Verified limitations:** The current checked-in source has a native local preparation path, but `PreLLMHook` still blocks all model attempts. No live provider egress, OAuth route, exact model/window/counter, terminal streaming, real Hermes multi-turn or Harbor claim has been performed or certified. CodeQL QG6 findings remain a separate security issue.

### External Bifröst uncertainty, not an invented seam

Pinned upstream `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f` documents `HTTPTransportPreHook` as once per request and `PreLLMHook` as once per provider attempt/fallback; hook errors alone are non-blocking, while an explicit short-circuit blocks. The transport hook runs before downstream provider serialization/mutation and is not a final-send receipt. **C03 STOP:** identify a maintained authenticated final physical-dispatch interception point with proof it runs for every retry and raw-body variant; otherwise keep all Responses generation fail-closed and request an owner-reviewed upstream Bifröst extension. Do not add another proxy, direct provider credential path or uncertified route.

## TO-BE — one agent loop, one Gateway, native Responses only

```text
Hermes owns multi-turn reasoning, tool decisions/results, local conversation and cancellation
  -> configured authenticated Bifröst provider-native POST /v1/responses
    -> ACE thin Go HTTP prehook snapshots inbound native bytes/session correlation
      -> authenticated loopback Gateway v2 TypeSpec projection
        -> TS pure native Responses input ADTs, privacy/source digest rules
        -> Effect retrieval/source revalidation, policy/audit and additive untrusted evidence
        -> PREPARED body (not a provider-send permit)
    -> Bifröst native Responses provider route without protocol conversion
    -> certified final physical-send hook: fresh single-use policy decision for exact bytes,
       provider/model/destination/store:false on EVERY send including retry/fallback
    -> real provider native response/stream, complete/failed/cancelled and usage evidence
  -> Hermes continues tool/response loop, Harbor observes accepted task outcome
```

Invariants: ACE **never** schedules Hermes or owns hidden provider history; the original native input items, reasoning/encrypted or signed blocks, tool `call_id` links, multimodal/opaque vendor fields and request settings remain byte-/semantic-protected. `store:false` and policy must hold on final network bytes after any downstream transform. An unavailable final hook or unknown model/provider blocks before network egress. A mock terminal trace or a `PREPARED` projection is **not** a REAL_PROVIDER_WIRE_VERIFIED receipt.

## Event Storming and functional DDD / consistency boundaries

| Actor / command | Event or fact | Policy / hot spot | Owning context / effect |
|---|---|---|---|
| Hermes: `SubmitResponses(input)` | `IngressObserved` (not durable host transcript) | Authenticated route, explicit provider/model, original SHA | Go Bifröst ingress/transport adapter |
| ACE: `PrepareContext(request)` | `EvidenceSelected` or `ProjectionBlocked` | Source freshness, secrets, privacy, available retriever | TS Gateway domain pure validation + Effect context transform |
| Bifröst: `ProposePhysicalSend` | `AttemptAuthorized` or `AttemptDenied` | Inner retries, changed provider, raw-body mutation, replay | Native final-send adapter + TS policy |
| Provider: `EmitResponsesEvent` | `Completed`, `Failed`, `Incomplete`, `Cancelled` | Preserve terminal ordering and unknown usage | Bifröst stream handler / redacted provider evidence |
| Hermes: `SubmitToolResult` | `ToolResultLinked` | Correct function call ID; no hidden provider conversation | Hermes local agent loop; ACE only sees visible request |
| Harbor: `RecordPairedTask` | `QualityAccepted` or `TaskRejected` | Baseline parity, missing usage, attribution | Existing Harbor adapters/domain |

Immutable pure domain model (proposed, not present on main): `ResponsesInput = {readonly provider, model, input, tools?, reasoning?, stream?, store:false, opaque?}`; `ProjectionResult = Prepared<digest,body> | Blocked<reason>`. Model `AttemptState = Proposed | Authorized<digest,provider,expiry> | Consumed | Denied | Expired` with `AttemptCommand = Evaluate | Consume | Cancel` and typed `DomainError`. Pure `validateNativeInput`, `insertVerifiedContext`, `decideAttempt` return `Result`; `Effect` owns retrieval, audit, identity, cancellation, bounded I/O and CAS/lease at the actual send boundary. Consumed authorization is single-use; concurrency and crash/restart fail closed. These are *domain contracts*, not a new event bus, second persistent state store or FSM framework.

### Meyer DbC and evidence

- **require:** explicit native route, validated session correlation (not authentication), provider/model, source provenance, intact original request hash, valid strict `store:false`, owner permissions and fresh attempt identity.
- **ensure:** precisely one marked untrusted ACE developer-context insertion for a valid visible request; no dropped original items; complete traceability of final send or typed denial.
- **invariant:** no non-Responses fallback, direct bypass, stale source as current, replayed permit, hidden provider-managed history treated as verified, or unauthorized private-data egress.
- **frame:** preserve all original semantic payload items, tools/reasoning/model/opaque extension keys and accepted v1 snapshot; no changes to unrelated retrieval, Graphiti, Qdrant or Harbor scheduler.
- **exceptional:** provider mismatch, missing physical-send hook, token/window uncertainty, invalid attestation, hidden continuation, timeout, stream truncation, policy denial or crash yields auditable BLOCKED/UNKNOWN/PARTIAL, never implicit pass-through.

Deterministic oracles: native JSON fixtures with mismatched `call_id`, encrypted reasoning, unknown properties and `stream:true`; mock upstream after all custom hooks; race/replay/changed-provider barriers; invalid `store:false`; unsupported-route and custom passthrough zero-send. Real evidence is separate: independently observed post-last-mutation provider send, correlated provider ack/terminal stream, and real Hermes action/quality traces; retain private originals outside the repo, commit only redacted hashes and judgments.

## Contract ownership / implementation sequence

- OpenSpec = requirement/AC authority; this design = reviewed behavior/interface intent; TypeSpec `typespec/responses-v2.tsp` owns the sole native Responses v2 wire source and all generated outputs.
- TS domain/application owns the native `src/domain/responses-projection.ts` and `src/application/responses-projection-service.ts` with reused `context-transform-service.ts`, `policy-service.ts`, audit/ports; Go stays thin and provider-neutral.
- A single new v2 HTTP handler in existing `gateway-projection-http.ts`; no alternate agent-facing protocol, new reverse proxy or model-invoked ACE tools. Application policy is **not** enough to authorize physical send; add a verified attempt-specific final-send capability or STOP.
- Existing unmerged prototypes are not source authority. Reuse only source-verified behavior that satisfies this design and the approved TypeSpec contract. Remove all obsolete executable projection artifacts, tests, generated outputs and historical reports in the approved scope.
- No new production provider, OAuth shim, retry scheduler, token admission gate or exact model identity is selected by this planning document.

## Stage dependency, release and rollback

C01 fail-closed native contract and repository retirement → C02 source-preserving native context → C03 exact physical-send mechanism → C04 destination/OAuth/privacy reauthorization → C05 final-wire proof → C06 native streaming → C07 real Hermes long-loop → C08 Harbor quality/cost and owner approval. A hard STOP at C03 or C04 leaves generation disabled. Per-phase rollback restores the previous **fail-closed** state; it never restores a retired protocol or enables an uncertified route. Source or accepted spec changes invalidate dependent plan fingerprints.

## G02 owner decision crosswalk

| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |
|---|---|---|---|---|---|---|
| RESP-001 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | TypeSpec v2 + native route allowlist | C01 | contract/compiler: only native Responses route is accepted | provider zero-send |
| RESP-002 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | Gateway v2 readiness + universal dispatch block | C01 | readiness and route denial contract tests | provider zero-send |
| RESP-003 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | TypeSpec v2 as sole active wire source | C01 | generation/drift and invalid contract tests | provider zero-send |
| G11-004 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | native route allowlist + dispatch block | C01 | unsupported route returns explicit denial | provider zero-send |
| RESP-004 | ACE owner | **Approved 2026-11-19:** stateless native Responses with `store:false`; reject provider continuation handles; preserve original items, tool/reasoning/multimodal/opaque values including numeric lexemes; prepend exactly one marked untrusted evidence item; no provider send in C02. Approval occurred after implementation had merged and is not evidence that the pre-code G02 sequence was followed. | Native lossless input/context projection | C02 | input/tool/reasoning, opaque-number, hidden-state, policy and no-send tests | No provider call in C02; full Hermes trace belongs to C07 |
| RESP-005 | ACE owner / G02 reviewer | G02 mechanics remain REVIEW_REQUIRED. Owner authorizes real Hermes Native Responses egress through Bifröst in C03–C05 (2026-11-19); this does not select a provider/model or bypass the exact per-send guard. | Final-send single-use authorization boundary | C03 | retry/race/replay denial | real Bifröst physical send after guard verification |
| G11-009 | ACE owner / G02 reviewer | G02 mechanics remain REVIEW_REQUIRED. Owner authorizes real Hermes Native Responses egress through Bifröst in C03–C05 (2026-11-19); exact attempt identity and seam still require phase verification. | Final-send single-use authorization boundary | C03 | retry/race/replay denial | real Bifröst physical send after guard verification |
| G11-011 | ACE owner / G02 reviewer | G02 mechanics remain REVIEW_REQUIRED. Owner authorizes real Hermes Native Responses egress through Bifröst in C03–C05 (2026-11-19); a mock-wire PASS is not a send authorization. | Final-send single-use authorization boundary | C03 | retry/race/replay denial | real Bifröst physical send after guard verification |
| RESP-006 | ACE owner / G02 reviewer | OAuth/model/privacy mechanics remain REVIEW_REQUIRED. Real Hermes Native Responses egress is authorized in C03–C05 (2026-11-19), but the exact provider/model/destination and transmission-time policy must be verified; no guessed ACE-side token ceiling/truncation. | OAuth/privacy and fallback decision | C04 | store:false/raw-body/fallback denial | authorized native route and provider-native counter/window evidence |
| G11-010 | ACE owner / G02 reviewer | Fallback/privacy mechanics remain REVIEW_REQUIRED. Real Hermes Native Responses egress is authorized in C03–C05 (2026-11-19); each changed destination still needs fresh policy evaluation. | OAuth/privacy and fallback decision | C04 | store:false/raw-body/fallback denial | authorized native route and provider-native counter/window evidence |
| G11-012 | ACE owner / G02 reviewer | Timeout/denial mechanics remain REVIEW_REQUIRED. Real Hermes Native Responses egress is authorized in C03–C05 (2026-11-19), but uncertainty still fails closed. | OAuth/privacy and fallback decision | C04 | store:false/raw-body/fallback denial | authorized native route and provider-native counter/window evidence |
| G11-001 | ACE owner / G02 reviewer | Final-wire mechanics remain REVIEW_REQUIRED. Owner authorizes real Hermes Native Responses egress through Bifröst in C03–C05 (2026-11-19), after C03/C04 controls and exact target policy are verified. | Exact final wire and route certification | C05 | later-mutation/fingerprint oracle | authorized real upstream |
| G11-002 | ACE owner / G02 reviewer | Final-wire/mutator-order mechanics remain REVIEW_REQUIRED. Hermes Native Responses egress is authorized in C03–C05 (2026-11-19); any unverified later mutator keeps the route blocked. | Exact final wire and route certification | C05 | later-mutation/fingerprint oracle | authorized real upstream |
| G11-003 | ACE owner / G02 reviewer | Owner authorizes a real Hermes Native Responses trial in C03–C05 (2026-11-19); exact provider/model/data class and transmission-time policy still must be bound before the call. | Exact final wire and route certification | C05 | later-mutation/fingerprint oracle | authorized real upstream |
| G11-005 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Native streaming and cancellation | C06 | SSE terminal/partial and abort | real provider streaming |
| G11-006 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Native streaming and cancellation | C06 | SSE terminal/partial and abort | real provider streaming |
| G11-007 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Native streaming and cancellation | C06 | SSE terminal/partial and abort | real provider streaming |
| G11-008 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Native streaming and cancellation | C06 | SSE terminal/partial and abort | real provider streaming |
| RESP-007 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Hermes multi-turn source retrieval | C07 | bypass/host-state/quality rejection | live multi-turn Hermes |
| G11-013 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Hermes multi-turn source retrieval | C07 | bypass/host-state/quality rejection | live multi-turn Hermes |
| G11-014 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Hermes multi-turn source retrieval | C07 | bypass/host-state/quality rejection | live multi-turn Hermes |
| G11-015 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Hermes multi-turn source retrieval | C07 | bypass/host-state/quality rejection | live multi-turn Hermes |
| G11-016 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Hermes multi-turn source retrieval | C07 | bypass/host-state/quality rejection | live multi-turn Hermes |
| RESP-008 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Harbor paired economics and acceptance | C08 | unknown usage/quality and fake savings | frozen repeated paired trials |
| G11-017 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Harbor paired economics and acceptance | C08 | unknown usage/quality and fake savings | frozen repeated paired trials |
| G11-018 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Harbor paired economics and acceptance | C08 | unknown usage/quality and fake savings | frozen repeated paired trials |
| G11-019 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Harbor paired economics and acceptance | C08 | unknown usage/quality and fake savings | frozen repeated paired trials |
| G11-020 | ACE owner / G02 reviewer | G02 review required; no provider/model/egress approval | Harbor paired economics and acceptance | C08 | unknown usage/quality and fake savings | frozen repeated paired trials |

**G02 / egress status:** C01's native-only contract/removal scope was approved before implementation on 2026-11-18. RESP-004 mechanics were explicitly approved on 2026-11-19 after their implementation had already merged; this accepts the current C02 behavior but does not retroactively satisfy the pre-code G02 sequence. Real Hermes Native Responses egress through Bifröst is authorized only for C03–C05 by explicit owner instruction on 2026-11-19. This permission is not a provider/model selection or phase-specific G02 approval: C03's exact physical-send seam, C04's OAuth/model/privacy decisions and C05's final-wire route must still be verified. No ACE-invented token ceiling or truncation is authorized. C02 itself makes no provider call; C06–C08, Harbor trials and production promotion remain outside this authorization. No provider-wire, real Hermes-loop or benchmark acceptance is claimed by this design record.
