# Design — audit-driven reliability repair within existing ACE architecture

**Stage:** A / T2 / provisional architecture artifact, not owner G02 acceptance and not a GitHub Draft PR requirement. **Source of facts:** Astra audit PR #290 on §main@bd170d197dcafc5cd30d0b8d6220ba6eca4fde5b§ and its 20 November engineering supplement. **Inherited S:** OpenSpec 014 proposal + five capability specs from PR #292 (S-stage source commit §a4d8192f65bcf3b5706c24053725288d8b8b0655§). **Conflicts:** #291 and #288 remain separate unmerged candidates; before I, compare current HEAD, do not double-implement. Exact product line numbers are in the original audit, not re-proven here.

## Architecture and boundaries — AS-IS versus TO-BE

| Context / existing ownership | AS-IS finding on audited main | TO-BE minimal change (provisional) |
|---|---|---|
| Workspace/source, §node-workspace-port.ts§, §workspace-sync.ts§ | Non-Git size+mtime change hint can miss new bytes; runtime local queue is not a cross-process publication fence (F1/F2) | Explicit verified freshness state; digest reconciliation or partial on uncertain non-Git observation; one authoritative workspace publication writer; never stale-writer delete |
| Qdrant, §qdrant-context-provider.ts§ / §http-provider-boundaries.ts§ | Per-path delete by workspace/path/except-index key can remove newer writer; alias helper not active | Use Qdrant SDK, one workspace writer by default; consider immutable versions+alias only with **separate** generation-fenced promotion; no invented distributed lease daemon |
| Context transformation / Native Responses, §context-transform-service.ts§, §responses-projection-service.ts§ | Mandatory code, optional unverified RepoMap can be emitted as ready, status warning lost (F5) | Request-scoped source plan, optional evidence gated at computation AND emission; required unverified source remains partial/not-ready, never delivered as ready |
| Memory, §file-memory-archive.ts§ + §memory-import.ts§ + §file-projection-outbox.ts§ + §retained-memory.ts§ | Final-file write and follow-up proof are crash-discontinuous; retry created:false skips proof (F3/F4) | Recovered durable original + projection admission/intent transaction boundary, proof positive, no derived absence inferred; conservative unknown, reference-safe tombstone deletion |
| Private retrieval artifacts / legacy façade | New UUID full-file copy per search; unreachable expansion helper persists (F6/F11) | Remove copies on active route lacking a reader; preserve exact source through existing authority; delete dead §ace_expand§ instructions/handlers only after reachability check; use scoped CAS+GC only if a real consumer remains |
| Ranking/trace/identity, §qdrant-context-provider.ts§, §retrieval-benchmark.ts§, §ace-runtime.ts§ | Negative cosine boost can demote; delivered logged before reread; configured LSP identity differs from resolved (F7/F8/F10) | Monotone prior with tested score domain, corrected stage events, actual resolved provider identities |
| Structural/semantic, ast-grep, RepoMap, LSP | CLI/NAPI corpus disparity, map cannot improve recall outside Qdrant shortlist, worker may continue after timeout (R2/R4/R5/F13) | Keep CLI canonical; compare Qdrant grouping/overfetch and real corpus evidence; bound Python worker backlog and late reply association; no speculative provider switch |
| Evaluation/Harbor | Correct total-token predicate alone does not reconcile raw usage events with final model requests/accepted work (F12) | Correlate typed frozen task/arm/trial/model/request/attempt/usage/failure/outcome; preserve unknown, quality-first; change 013 is sole agent egress/Harbor acceptance owner |

## Domain/context map and Event Storming (not a new event bus)

**Source read:** Actor Gateway; Command §ObserveWorkspace§ → event §SourceSnapshotVerified | SourceObservationIncomplete§; policy only current authoritative source can certify complete. §PublishCandidateGeneration§ → §GenerationPublished | PublicationRefused§; workspace-scoped aggregate is the **current committed source version**, not the in-process Promise queue. **Hot spot:** interleaving A(v1) and B(v2), alias atomicity vs stale promotion. Qdrant publication is an external side effect; source bytes remain authoritative.

**Memory:** Actor local operator/importer; §ImportEpisode§ → §OriginalStaged§ → §OriginalPublished§ → §ArchiveOnlyProven | ProjectionIntentRecorded§; §StartGraphProjection§ allowed only after durable intent; §RequestDeletion§ → §Tombstoned§ only after proven never-projected OR real graph absence, with shared blob refs protected. **Hot spots:** kill between blob/metadata/proof, idempotent created:false replay, Graphiti timeout after side effect. Aggregate is the episode admission/projection/deletion status backed by durable authority, not a guessed in-memory flag.

**Context delivery:** Actor native projection; §PlanRequiredSources§ → §FetchCandidate/OptionalProvider§ → §SourceVerified | SourceUnavailable§ → §Prepared | Blocked§. Source permissions and proof must exist **before** model-bound bytes. No separate model-invoked context command/event bus.

**Harbor:** Actor evaluation runner; §FreezeTask§ → §ObserveAttempt§ → §ReconcileUsage§ → §IndependentlyAcceptTask§ → §EvaluateEconomics§. A receipt is **not** a send and a hash is **not** a semantically reconciled usage event.

## Functional DDD: proposed pure seams, typed states and effects

These are interface **intentions**, not existing signatures. Keep current modules as owners; do not add god-service classes or state-machine framework.

- §SourceFreshness = Verified(snapshotDigest,generation) | Incomplete(reason) | Unavailable(reason)§. Pure §canClaimComplete(freshness, requiredCoverage): boolean§. A request may return verified empty only for §Verified§ and satisfied required sources. Existing Effect workspace file reads own digest verification; no cross-request mutable global.
- §PublicationDecision = Permit(generation) | DenyStale | DenyCompeting | NotReady§; §decidePublish(activeGeneration, attempt, writerAuthority)§ must be **enforced by durable/OS-scoped state at commit time**, not invoked once then trusted across race. §Published§ after Qdrant membership verified; no dependency on wall-clock ordering. No *alias swap = CAS* inference.
- §ArchiveState = PendingOriginal | OriginalDurableNeverProjected | ProjectionIntentDurable | ProjectionUnknown | Projected | Tombstoned§ with pure allowed transitions; persisted authority must survive created:false retries. §mayDeleteWithoutGraph§ iff positively durable never-projected state, no graph attempt possible, and tombstone/fence acquired. Effect application orders I/O; file adapter (or a proposed SQLite metadata transaction after G02) owns atomic state.
- §EvidenceDecision = IncludeVerified | OmitOptionalUnverified | BlockRequiredUnverified§, purely calculated from caller source plan, allowed data class and actual source metadata. The adapter cannot promote model-visible evidence by overwriting coverage status.
- §TaskEconomics = Incomplete(reason) | Reconciled({ totalInput, totalOutput, cachedSubset, attempts, acceptedTasks })§, with acceptance computed from independently bound records, no double counting.

**Retry/cancellation/rescue:** process death is not proof of a negative graph side effect; a timed-out embedding worker's late bytes must be rejected by request identity or worker restarted under a bounded contract. Fail closed with typed error for unsure freshness, unknown deletion, unauthorized egress and unverified final usage; never silently return empty success.

## Decisions

| ID | Recommended choice / alternative | Reason, removal, risks | G02 status |
|---|---|---|---|
| D01 | **Preferred** one authoritative local writer per workspace and existing Qdrant SDK; **alternative** immutable collections + alias with independent serialized monotonic promotion | Fix F1 without distributed lease; runtime topology unknown; local OS lock not automatically correct across hosts; alias is not CAS | Owner review required for deployment topology / publication authority |
| D02 | Non-Git exact digest reconciliation before authoritative success, with cheap hints/watcher only as optimization | Accurate without inventing watcher-based proof; measure scale cost; unknown => typed incomplete | Owner review required for supported non-Git consistency/cost |
| D03 | Minimal staged file archive + durable admission/projection record; compare **SQLite metadata/outbox** if custom transaction protocol becomes large | SQLite transactions do not include external blobs or graph calls; backup/storage portability and crash guarantees require comparison; do not silently create DB | Owner review required before persistence migration |
| D04 | Gate map by source plan; omit unverified optional map; preserve source-bound exact code evidence | F5 false-ready is urgent and minimal; no new graph engine; F13 overfetch only if measured | Review consistent with accepted source-truth ADR |
| D05 | Remove unused full-source artifacts and inaccessible model-command façade; only add CAS/GC if actual expansion consumer exists | Negative diff, no new storage until consumer verified; preserve host exact file tools | Review existing expansion expectations |
| D06 | Correct ranking provenance, stage semantics and provider identity in existing modules; maintain digest with pinned library | One owner/semantics per field; version digest-based receipts if changed; no hand-built hash | Review receipt compatibility |
| D07 | Keep CLI canonical until NAPI parity; measure candidate recall/diversity on held-out tasks; bounded Python worker | Unknown task benefit; no unapproved provider replacement or worker daemon | No provider promotion from a fixture |
| D08 | Harbor usage/task join, total tokens per accepted task; **leave** real Gateway/agent C03–C08 to change 013 | Strong negative/unknown cases; avoid duplicated evaluation system; external egress separately authorized | G11 remains external authority |

**Architecture risk / rollback:** Each owning chunk must retain old authoritative bytes, typed denials and published manifest semantics. Alternative storage schema, lock choice, identity hashing or external provider implementation requires recorded decision and migration/rollback proof; missing owner G02 blocks the affected I phase. No manufactured §Owner decision: ACCEPTED§.

## Meyer design-by-contract (require / ensure / invariant / frame / exceptional)

**require:** workspace identity, source plan, policy and current generation; for memory, digest-exact episode and authorized operator; for Harbor, frozen task/arm/model/outcome schema. **ensure:** complete only when sources truly verified; never stale publishes; committed archive reopens with exact digest after restart; no private artifact leakage; real usage joined by attempt. **invariant:** private worktree unchanged, no stale model claims, no false graph absence, no provider bypass, no token double-count. **frame:** no additional model calls, no new gateway/protocol route, no automatic deletion of shared memory or worktree writes. **exceptional:** typed §NOT_READY§/§PARTIAL§/§POLICY_DENIED§/§PERSISTENCE_FAILED§/§EVIDENCE_UNVERIFIED§ under failure; never treat timeout as empty success. Existing error taxonomy is authoritative; names here are semantic classifications unless already emitted by code.

**TypeSpec:** no new public Gateway contract in this plan by default; change 013 + §typespec/responses-v2.tsp§ remain owners. If a chosen remediation changes a versioned wire DTO, amend canonical TypeSpec and generated TS/Go semantic fixtures in that owning phase; do not handwrite a competing schema. An internal receipt field is not automatically a new public API.

**External permissions:** offline deterministic testing may proceed after an actual accepted G02 implementation decision; any external provider/real Hermes/Harbor evaluation needs separate user-authorized provider/model/budget/data egress. Simulated projection cannot claim physical provider send.

## G02 crosswalk

| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |
|---|---|---|---|---|---|---|
| REM-001 | Workspace observation | Digest reconciliation before complete | node-workspace-port / workspace-sync | AR01 | Same-size restored-mtime edit => changed or partial | No agent/provider required |
| REM-002 | Context projection | Allow only proven empty | context-transform / responses-projection | AR01 | Stale/unknown empty BLOCK; clean empty unchanged bytes | Native Responses conformance against selected gateway after 013 |
| REM-003 | Retrieval plan | Source-plan gate before optional map | qdrant provider / transform | AR02 | Code-only cannot emit structural text | Bifröst synthetic projection no unrequested bytes |
| REM-004 | Retrieval plan | Verified map or typed partial | sourceCoverage / repo-map | AR02 | Stale requested map not ready | Controlled agent projection only after G11 |
| REM-005 | Workspace publication | Authoritative single writer, conditional alternate | workspace-sync / qdrant deletePaths | AR03 | Two-process stale-A/new-B barrier | Local real Qdrant two process |
| REM-006 | Workspace publication | Generation-fenced visibility/restart | qdrant adapter / published state | AR03 | Kill/restart and same-generation cases | Local real Qdrant |
| REM-007 | Archive originals | Staged durable blob and metadata publish | file-memory-archive | AR04 | Crash inside write cannot yield partial valid episode | OS process kill/restart |
| REM-008 | Archive originals | Validate existing blob and recover or quarantine | file-memory-archive | AR04 | EEXIST corrupt content => rejection/repair | Local physical filesystem |
| REM-009 | Projection admission | Positive durable archive-only proof, prior intent | memory-import / projection-outbox | AR05 | Crash then created:false never infers absent | Process+graph spy; no Graphiti required for negative |
| REM-010 | Deletion fence | Unknown/attempted graph state retained | retained-memory / outbox | AR05 | Unknown + graph unavailable => no delete | Real Graphiti absence later if claimed |
| REM-011 | Shared-blob archive | Reference-safe deletion | file-memory-archive / tombstones | AR05 | Shared survivor digest after deletion | Local process E2E |
| REM-012 | Artifact lifecycle | Stop unused per-request full-source writes | file-artifact-store / qdrant provider | AR06 | N same queries do not multiply blobs | Local gateway retrieval fixtures |
| REM-013 | Agent interface | Remove retired expansion promise/path | context-delivery / context-commands | AR06 | No ace_expand in active payload | Native Responses client fixture |
| REM-014 | Digest compatibility | Maintained SHA-256 + versioned identity | retrieval-benchmark / context-delivery | AR06 | Known vectors and prior receipt compatibility | No external provider |
| REM-015 | Ranker | Monotone working-context prior | qdrant-context-provider | AR07 | Negative-score preference does not demote | Real-Qdrant rank A/B if available |
| REM-016 | Retrieval telemetry | Delivered event after final reverify | retrieval-benchmark / provider | AR07 | Stale shortlisted never delivered | Local real Qdrant/fixture |
| REM-017 | Runtime identity | Resolved active runtime provider identity | ace-runtime / context-transform | AR07 | Rust custom label never TypeScript default | Live Rust LS or explicitly NOT_RUN |
| REM-018 | Retrieval recall | Measure Qdrant shortlist grouping/overfetch | qdrant provider / repo-map | AR08 | Outside-top-K multi-file candidate measured | Held-out real task after physical route |
| REM-019 | Parser canonicality | Keep CLI until corpus parity | ast-grep CLI/NAPI / repo-map | AR08 | Actual corpus mismatch => CLI retained | Real language corpus parity |
| REM-020 | Embedding workers | Bound workers and stale late replies | process-embedding / Python worker | AR09 | Slow work then fast healthy request bounded | Live local Python worker |
| REM-021 | Harbor provenance | Join typed task/arm/attempt/usage events | harbor-four-arm gate / trial reader | AR10 | Wrong arm / missing event blocks evidence | Provider/Hermes via change 013 when authorized |
| REM-022 | Token acceptance | Total input+output per accepted task | harbor-four-arm | AR10 | False 5x counterexample denied | Actual paired Harbor through G11 C08 only |

**Crosswalk note:** Values above represent recommended implementation responsibilities, **not actual owner G02 approval**; this is `READY_FOR_G02_REVIEW` only. PR #291's implementation and PR #288's physical send are independent unmerged work, and implementation must reconcile their actual merged HEAD rather than assume these changes are absent. Each phase below is provisional until stage P approves its exact DAG.

## Handoff / review gates

Stage A must be published in an ordinary stacked Ready-for-review PR (`draft: false`) and may be reviewed before the owner makes G02 decisions. A provisional design verdict is independent of GitHub review state. Stage P must size complete vertical slices using ~700–1,200 forecast changed handwritten lines (source + tests + relevant hand-edited docs), not fixed eight; Stage X must create one full `phases/<ID>.md` per canonical task and bind it to current design blob and sorted spec SHA-256. The independent dual-plan A/B protocol cannot be attested in a single unisolated assistant context: record `SINGLE_PLAN_REVIEW / INDEPENDENCE_NOT_ATTESTED` instead of inventing two agents. Stage I requires a **new explicit implementation request** and actual G02; V and G11 external trials require real observed evidence and owner acceptance.
