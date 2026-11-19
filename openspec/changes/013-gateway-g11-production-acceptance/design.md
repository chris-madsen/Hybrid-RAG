# Design — provider-native Responses G11 implementation and acceptance

## Authority, implementation status and evidence

- **Current merged main:** `33f6874ff310f6cea39ec25e3adf2cf3153a5e42`, including PR #282 Native Responses C01/C02 and PR #283 CodeQL filesystem-race fixes, inspected 2026-11-19. Earlier `601e08ae9f0895c84a88d8e55773a867ccae908b` (2026-11-18) remains a historical **planning snapshot**, not the runtime inventory.
- Sole agent-facing route: **Hermes → Bifröst native `/v1/responses` → ACE Gateway v2**. TypeSpec generates the public DTO, TS/Effect owns validation, retrieval and privacy, Go is a thin connector, Harbor owns downstream evaluation. Removed generation contracts/compatibility routes are not implementation options.
- OpenSpec change 010 is historical; change 013 and its specs own native G11 acceptance. Old #271/#273 branches closed unmerged; do not revive their prototypes. PR #282's historical QG6 failure is not retroactively PASS simply because #283 fixed those findings afterward.
- **Evidence state:** C01/C02 implemented and synthetically verified on merged main, C02 G02 mechanics owner-approved after implementation with sequence deviation recorded. Physical send C03, OAuth/privacy C04, real final-wire C05, streams C06, Hermes loop C07 and Harbor C08 remain NOT_CERTIFIED/NOT_RUN. Owner permits controlled native Responses egress through Bifröst for C03–C05 tests but no production route or model choice.

### Current AS-IS source owners

| Source | Observed current state | Remaining gap |
|---|---|---|
| `integrations/bifrost/ace-connector/plugin/main.go` | Native `/v1/responses` ingress, truthful unknown host history, single-workspace boundary; `PreLLMHook` still short-circuits every provider dispatch | C03 physical-attempt authorization; C04 policy; controlled egress |
| `integrations/bifrost/ace-connector/responses.go` | Native v2 digest/protected-field verifier preserving opaque JSON numbers | Bind final serialized body and provider attempt |
| `src/domain/responses-projection.ts` | Uses TypeSpec-generated DTO, stateless `store:false` and no hidden continuation; one source-evidence insertion | Existing C02 owner; do not recreate |
| `src/application/responses-projection-service.ts` | Effect retrieval/policy/audit and typed PREPARED/BLOCK; PREPARED is not a permit | C03 requires a distinct physical-send permit service |
| `src/transport/gateway-projection-http.ts` and `src/bin/ace-runtime.ts` | Authenticated loopback v2 Gateway and runtime composition | No certified attempt-permit endpoint |
| `typespec/responses-v2.tsp` and `src/generated/ace-gateway/v2/**` | Sole active generated native Responses wire contract | Version new wire changes only with reviewed G02 and drift checks |
| `scripts/build-bifrost-ace-plugin.sh` | Pinned Bifröst `fe7634a6c828927d05ffdd57c62be0aaab04193f` builds, but no final-send callback exists in pinned upstream | Narrow upstream transport extension and runtime proof |
| C02 contract tests | Existing deterministic tool/reasoning/opaque-number, policy and no-send tests | Cannot certify real provider |
| Harbor adapters and evaluation | Existing task comparison infrastructure | Real paired task and provider evidence remains C08 |

The original baseline's obsolete Gateway modules, incomplete TypeSpec wiring and seven filesystem-race findings are **historical evidence**, not active source owners. Preserve truthful history, not executable old protocols.

### External Bifröst uncertainty, not an invented seam

Pinned upstream `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f` documents `HTTPTransportPreHook` as once per request and `PreLLMHook` as once per provider attempt/fallback; hook errors alone are non-blocking, while an explicit short-circuit blocks. The transport hook runs before downstream provider serialization/mutation and is not a final-send receipt. **C03 seam:** pinned `core/providers/utils/roundtripper.go:contextTransport.RoundTrip` is a good place to intercept physical attempts, including fasthttp retries. The needed callback is not yet implemented upstream. A callback directly before `req.Write(bw)` is useful for attempt intent but **cannot alone certify the final serialized bytes**: `req.Write` may write buffered/incremental bytes, followed by `bw.Flush()`. C03 must prove no network byte leaves until the exact final serialized request is captured, validated and bound to a fresh atomically consumed authorization; an internal guarded writer or bounded staging is a candidate, not an approved implementation. Never double-serialize one-shot streams; reject routes whose interception cannot be proven. Check standard-HTTP wrappers, redirects, retries, raw-body/streamed paths and all mutators; no second proxy or alternate generator.

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

C02 generated native DTOs/pure validators already exist on merged main. The following **C03 attempt state** remains proposed: `ResponsesInput = {readonly provider, model, input, tools?, reasoning?, stream?, store:false, opaque?}`; `ProjectionResult = Prepared<digest,body> | Blocked<reason>`. Model `AttemptState = Proposed | Authorized<digest,provider,expiry> | Consumed | Denied | Expired` with `AttemptCommand = Evaluate | Consume | Cancel` and typed `DomainError`. Pure `validateNativeInput`, `insertVerifiedContext`, `decideAttempt` return `Result`; `Effect` owns retrieval, audit, identity, cancellation, bounded I/O and CAS/lease at the actual send boundary. Consumed authorization is single-use; concurrency and crash/restart fail closed. These are *domain contracts*, not a new event bus, second persistent state store or FSM framework.

### Meyer DbC and evidence

- **require:** explicit native route, validated session correlation (not authentication), provider/model, source provenance, intact original request hash, valid strict `store:false`, owner permissions and fresh attempt identity.
- **ensure:** precisely one marked untrusted ACE developer-context insertion for a valid visible request; no dropped original items; complete traceability of final send or typed denial.
- **invariant:** no non-Responses fallback, direct bypass, stale source as current, replayed permit, hidden provider-managed history treated as verified, or unauthorized private-data egress.
- **frame:** preserve all original semantic payload items, tools/reasoning/model/opaque extension keys and retained context/Hermes public contract snapshot; no changes to unrelated retrieval, Graphiti, Qdrant or Harbor scheduler.
- **exceptional:** provider mismatch, missing physical-send hook, token/window uncertainty, invalid attestation, hidden continuation, timeout, stream truncation, policy denial or crash yields auditable BLOCKED/UNKNOWN/PARTIAL, never implicit pass-through.

Deterministic oracles: native JSON fixtures with mismatched `call_id`, encrypted reasoning, unknown properties and `stream:true`; mock upstream after all custom hooks; race/replay/changed-provider barriers; invalid `store:false`; unsupported-route and custom passthrough zero-send. Real evidence is separate: independently observed post-last-mutation provider send, correlated provider ack/terminal stream, and real Hermes action/quality traces; retain private originals outside the repo, commit only redacted hashes and judgments.

## Contract ownership / implementation sequence

- OpenSpec = requirement/AC authority; this design = reviewed behavior/interface intent; TypeSpec `typespec/responses-v2.tsp` owns the sole native Responses v2 wire source and all generated outputs.
- TS domain/application owns the native `src/domain/responses-projection.ts` and `src/application/responses-projection-service.ts` with reused `context-transform-service.ts`, `policy-service.ts`, audit/ports; Go stays thin and provider-neutral.
- A single new v2 HTTP handler in existing `gateway-projection-http.ts`; no alternate agent-facing protocol, new reverse proxy or model-invoked ACE tools. Application policy is **not** enough to authorize physical send; add a verified attempt-specific final-send capability or STOP.
- Unmerged prototypes are not source authority. Reuse current merged C02 code. Retired executable artifacts are already gone; preserve labeled source-grounded historical notes rather than deleting unique evidence.
- No new production provider, OAuth shim, retry scheduler, token admission gate or exact model identity is selected by this planning document.

## Stage dependency, release and rollback

C01 fail-closed native contract and repository retirement → C02 source-preserving native context → C03 exact physical-send mechanism → C04 destination/OAuth/privacy reauthorization → C05 **controlled real final-wire proof** → C06 native streaming → C07 real Hermes long-loop → C08 Harbor quality/cost and owner approval. **Controlled test-only C03–C05 provider probes require the already implemented C03/C04 guard and destination/privacy checks, but do not await C05's own certification. Ordinary generation remains unavailable until C05's evidence is accepted.** Any C03/C04 failure still blocks all physical sends. Per-phase rollback restores the previous **fail-closed** state; it never restores a retired protocol or enables an uncertified route. Source or accepted spec changes invalidate dependent plan fingerprints.

## G02 owner decision crosswalk

| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |
|---|---|---|---|---|---|---|
| RESP-001 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | TypeSpec v2 + native route allowlist | C01 | contract/compiler: only native Responses route is accepted | provider zero-send |
| RESP-002 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | Gateway v2 readiness + universal dispatch block | C01 | readiness and route denial contract tests | provider zero-send |
| RESP-003 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | TypeSpec v2 as sole active wire source | C01 | generation/drift and invalid contract tests | provider zero-send |
| G11-004 | ACE owner | **Approved for C01** by explicit owner instruction 2026-11-18 | native route allowlist + dispatch block | C01 | unsupported route returns explicit denial | provider zero-send |
| RESP-004 | ACE owner | **Approved 2026-11-19:** stateless native Responses with `store:false`; reject provider continuation handles; preserve original items, tool/reasoning/multimodal/opaque values including numeric lexemes; prepend exactly one marked untrusted evidence item; no provider send in C02. Approval occurred after implementation had merged and is not evidence that the pre-code G02 sequence was followed. | Native lossless input/context projection | C02 | input/tool/reasoning, opaque-number, hidden-state, policy and no-send tests | No provider call in C02; full Hermes trace belongs to C07 |
| RESP-005 | ACE owner / G02 reviewer | **Owner decision recorded 2026-11-19 in this crosswalk:** select a narrow Bifröst `contextTransport.RoundTrip` transport extension. The source of the original exact-wording owner approval was not linked in PR #284. Technical review endorses this **seam**, but rejects treating a pre-`req.Write` callback as final-byte proof. Callback design, serialization/actual-write interception, per-attempt consume and crash/replay are C03 G02 REVIEW_REQUIRED. Controlled owner-authorized native Responses C03–C05 egress does not select a provider/model. | Final-send single-use authorization boundary | C03 | retry/race/replay denial | real Bifröst physical send after guard verification |
| G11-009 | ACE owner / G02 reviewer | Existing 2026-11-19 decision record selects `contextTransport.RoundTrip`; final-wire serialization, attempt identity, atomic consume and invocation on each physical attempt remain REVIEW_REQUIRED. Egress is authorized C03–C05; exact target still must be verified. | Final-send single-use authorization boundary | C03 | retry/race/replay denial | real Bifröst physical send after guard verification |
| G11-011 | ACE owner / G02 reviewer | The 2026-11-19 crosswalk records `RoundTrip` as the selected seam; no prior receipt can be reused, and no pre-`req.Write` byte guarantee is inferred. Attempt state, crash/restart and duplicate-ID behavior remain REVIEW_REQUIRED. A mock-wire PASS is not a send authorization. | Final-send single-use authorization boundary | C03 | retry/race/replay denial | real Bifröst physical send after guard verification |
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

**G02 / egress status:** C01's native-only contract/removal scope was approved before implementation on 2026-11-18. RESP-004 mechanics were explicitly approved on 2026-11-19 after their implementation had already merged; this accepts the current C02 behavior but does not retroactively satisfy the pre-code G02 sequence. For C03, the existing crosswalk records the owner-selected `contextTransport.RoundTrip` integration area on 2026-11-19, but PR #284 does not link the original precise approval text. Technical review agrees with the **location**, not a claim that a before-`req.Write` hook observes final serialized bytes. Pinned upstream has no callback. Serialized-byte capture, last-write guard, single-use consume, retries and crash/replay still need G02 review and actual implementation. Do not re-request the same already recorded location; do not claim approval of these missing mechanics. Owner permits controlled disposable native Responses provider tests via Bifröst for C03–C05 after necessary guards; this is not provider/model selection or production certification. C04's OAuth/model/privacy decisions and C05's final-wire route must still be verified. No ACE-invented token ceiling or truncation is authorized. C02 itself makes no provider call; C06–C08, Harbor trials and production promotion remain outside this authorization. No provider-wire, real Hermes-loop or benchmark acceptance is claimed by this design record.
