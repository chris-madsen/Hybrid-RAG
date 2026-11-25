# Tasks — ACE audit remediation single-context implementation DAG

**Change:** §014-ace-audit-reliability-remediation§. **Historical T2 Stage P/X plan and the one canonical acceptance/checkbox ledger.** R originated in audit PR #290, S #292 and A #293. **Current source reconciliation (2026-11-21, `main@8591adc9da77f8eb395df43ea7a51eea16e78062`):** many repair implementations were merged after this plan (e.g. #291, #299, #308–310), and PR #316 replaced the old ast-grep structural runtime / homemade RepoMap with native Codebase Memory. Therefore old branch/Stage-I statements below are historical planning context, **not** a claim that current main lacks every AR implementation. Conversely a merged PR and a deterministic PASS do **not** establish real-provider acceptance, so unchecked boxes are preserved pending evidence-based reconciliation. See [current runtime](../../../docs/operations/current-architecture.md).

## Native-only reconciliation (2026-11-25)

Owner decision #363 selects CBM as the sole code retrieval engine. The old vector, embedding and parser implementation instructions in the historical audit are superseded. AR03, AR07, AR08 and AR09 now own the corresponding native lifecycle, ranking/provenance and quality invariants. AR02 and AR06 retain source delivery invariants. No checkbox is promoted from a source change, no retired provider is to be restored, and no competing vector-provider election is required. Follow the revised phase briefs for current paths and commands; old detailed phase descriptions below are historical where they conflict. Independent external LSP research (#364), remote topology and real Bifröst/agent/Harbor acceptance remain separately scoped.

## Dependency DAG and LOC budget

Automatically sized via §ace-to-tickets§ rules: ten coherent **vertical** one-context slices, approximately 700–1,200 forecast **added + deleted handwritten** source/test/glue lines each, risk boundaries preserved. All REM-001…REM-022 spec IDs appear **exactly once**. No LOC quota on emitted model context; forecasts are not hard token ceilings. Do not write filler to reach a count. Source/test/other columns are estimates, not measured work. One slice = one approved implementation pass and one focused PR followed by STOP.

| ID / title | Blocked by | Acceptance IDs | Source / tests / other = total forecast | Observable result |
|---|---|---|---:|---|
| AR01 — Trustworthy non-Git snapshots and verified-empty | none | REM-001, REM-002 | 340 / 400 / 70 = **810** | Digest reconciliation or honest incomplete state; no stale non-Git empty native pass-through |
| AR02 — Source-plan-gated optional structural projection | none | REM-003, REM-004 | 380 / 400 / 80 = **860** | Code-only Native Responses emits no unrequested structural map; required unverified map is partial |
| AR03 — Native cache coordination and verified publication | none | REM-005, REM-006 | 450 / 480 / 110 = **1040** | Stale native observation cannot certify older bytes or incomplete membership |
| AR04 — Crash-recoverable immutable archive bytes | none | REM-007, REM-008 | 400 / 460 / 90 = **950** | Crash during blob/metadata write recovers exact immutable original or typed quarantine |
| AR05 — Durable archive-only proof and safe deletion | AR04 | REM-009, REM-010, REM-011 | 430 / 500 / 110 = **1040** | Crash after first import and before never-projected marker is recoverable without graph-absence guess |
| AR06 — Remove unreachable source copies and legacy digest/expand paths | none | REM-012, REM-013, REM-014 | 400 / 470 / 110 = **980** | No unbounded source artifact duplication or false ace_expand promise; maintained/versioned digest identity |
| AR07 — Native ranking and truthful delivery/provider traces | AR02 | REM-015, REM-016, REM-017 | 440 / 490 / 120 = **1050** | Native disambiguation preserves source authority; delivered only after exact verification; actual providers identified |
| AR08 — Native graph recall and structural provenance | AR02, AR07 | REM-018, REM-019 | 350 / 390 / 130 = **870** | Measured native multi-file shortlist and exact outline coverage |
| AR09 — Bound native session cancellation and recovery | none | REM-020 | 300 / 430 / 100 = **830** | Cancelled native work cannot indefinitely monopolize a request or contaminate a subsequent generation |
| AR10 — Join Harbor usage and task acceptance evidence | none | REM-021, REM-022 | 410 / 470 / 100 = **980** | Usage/retry/failure events bound to frozen task/model/arm/attempt; 5x measured on total accepted-task tokens |

**AR08 implementation update:** The historical AR08 CLI-vs-NAPI parity, RepoMap and Qdrant-only shortlist rationale was superseded by PR #316 as a *runtime design*. Do not reinstall the retired providers or run the old parity test as if current. Native CBM graph/source retrieval and absolute frozen multi-repository retrieval quality must now be measured; this does **not** itself mark REM-018/019 accepted.

## Canonical phase tracker

- [ ] AR01 — Trustworthy non-Git snapshots and verified-empty; see [AR01](phases/AR01.md).
- [ ] AR02 — Source-plan-gated optional structural projection; see [AR02](phases/AR02.md).
- [ ] AR03 — Native cache coordination and verified publication; see [AR03](phases/AR03.md).
- [ ] AR04 — Crash-recoverable immutable archive bytes; see [AR04](phases/AR04.md).
- [ ] AR05 — Durable archive-only proof and safe deletion; see [AR05](phases/AR05.md).
- [ ] AR06 — Remove unreachable source copies and legacy digest/expand paths; see [AR06](phases/AR06.md).
- [ ] AR07 — Native ranking and truthful delivery/provider traces; see [AR07](phases/AR07.md).
- [ ] AR08 — Native graph recall and structural provenance; see [AR08](phases/AR08.md).
- [ ] AR09 — Bound native session cancellation and recovery; see [AR09](phases/AR09.md).
- [ ] AR10 — Join Harbor usage and task acceptance evidence; see [AR10](phases/AR10.md).

Check boxes remain empty until code actually implements that slice and its required tests/review gates pass. A green structural phase check does not mark a task implemented.


**Staged artifact rule:** P deliberately omitted unresolved phase links; this X-stage version adds the ten concrete `phases/<ID>.md` links after publishing those briefs. This is the one canonical task ledger, not another tracker. The X-stage checker must verify all links, hashes and acceptance ownership before implementation.

## Phase implementation contracts and evidence boundaries

### AR01 — Trustworthy non-Git snapshots and verified-empty

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-001, REM-002.
- **Changed handwritten LOC forecast:** 340 source + 400 tests + 70 glue/docs = **810**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** node-workspace-port.ts, workspace-sync.ts, context-transform-service.ts; owning observation/projection contracts.
- **RED:** Same-size restored-mtime mutation passes incorrectly; unverified empty PREPARED.
- **GREEN:** Mutation blocks or reconciles; proven current empty preserves exact native bytes.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR02 — Source-plan-gated optional structural projection

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-003, REM-004.
- **Changed handwritten LOC forecast:** 380 source + 400 tests + 80 glue/docs = **860**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** qdrant-context-provider.ts, context-transform-service.ts, responses-projection-service.ts; repo-map and gateway contracts.
- **RED:** Active stale RepoMap appears in ready projection.
- **GREEN:** Requested and verified source only; no warning-washing.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR03 — Native cache coordination and verified publication

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-005, REM-006.
- **Changed handwritten LOC forecast:** 450 source + 480 tests + 110 glue/docs = **1040**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** workspace-sync.ts, qdrant-context-provider.ts, http-provider-boundaries.ts; real Qdrant multi-process test.
- **RED:** Two-process A/v1 pause, B/v2 publish, A resumes and deletes/promotes v2.
- **GREEN:** Only committed newer generation visible; restart/same-generation fail closed.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR04 — Crash-recoverable immutable archive bytes

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-007, REM-008.
- **Changed handwritten LOC forecast:** 400 source + 460 tests + 90 glue/docs = **950**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** file-memory-archive.ts; archive process failure tests.
- **RED:** Partial existing digest path accepted after EEXIST or malformed episode blocks retry permanently.
- **GREEN:** Temp+verify+atomic publish/recover; no false successful episode.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR05 — Durable archive-only proof and safe deletion

- **Blocked by:** AR04; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-009, REM-010, REM-011.
- **Changed handwritten LOC forecast:** 430 source + 500 tests + 110 glue/docs = **1040**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** memory-import.ts, file-projection-outbox.ts, ace-memory.ts, retained-memory.ts; process/failpoint tests.
- **RED:** Created:false replay cannot ever recover marker; graph attempt races delete; shared survivor lost.
- **GREEN:** Positive durable proof or typed unknown; graph intent before call; tombstone/shared blob safe.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR06 — Remove unreachable source copies and legacy digest/expand paths

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-012, REM-013, REM-014.
- **Changed handwritten LOC forecast:** 400 source + 470 tests + 110 glue/docs = **980**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** file-artifact-store.ts, qdrant-context-provider.ts, context-commands.ts, context-delivery.ts, retrieval-benchmark.ts.
- **RED:** Same source reread creates repeated private .bin; retired expansion advertised; bad hash vector.
- **GREEN:** Remove inactive writes/tools, preserve real exact reads and test receipt compatibility.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR07 — Native ranking and truthful delivery/provider traces

- **Blocked by:** AR02; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-015, REM-016, REM-017.
- **Changed handwritten LOC forecast:** 440 source + 490 tests + 120 glue/docs = **1050**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** qdrant-context-provider.ts, retrieval-benchmark.ts, ace-runtime.ts; ranking/identity contracts.
- **RED:** Negative score preference demotes; stale shortlisted logged delivered; Rust labeled TypeScript.
- **GREEN:** Monotone prior, finalized delivery stage, runtime effective instance identities.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR08 — Native graph recall and structural provenance

- **Blocked by:** AR02, AR07; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-018, REM-019.
- **Changed handwritten LOC forecast:** 350 source + 390 tests + 130 glue/docs = **870**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** repo-map.ts, qdrant-context-provider.ts, ast-grep tests, retrieval-quality-evaluation.ts.
- **RED:** Outside-K needed path missing while map claimed recall; N-API mismatch wrongly treated equivalent.
- **GREEN:** Conformant corpus or explicit no-switch; provider-native diversity/overfetch only if task benefit proven.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR09 — Bound native session cancellation and recovery

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-020.
- **Changed handwritten LOC forecast:** 300 source + 430 tests + 100 glue/docs = **830**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** process-embedding.ts, Python FastEmbed worker; process timeout/abort tests.
- **RED:** Worker keeps computing after caller deadline; next healthy request stalls.
- **GREEN:** Bounded recovery and request identity; no unsolicited extra worker daemon.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.

### AR10 — Join Harbor usage and task acceptance evidence

- **Blocked by:** none; external review/G02 additionally applies where material.
- **Acceptance IDs:** REM-021, REM-022.
- **Changed handwritten LOC forecast:** 410 source + 470 tests + 100 glue/docs = **980**; generated/vendor lines excluded but still reviewed.
- **Known owning seams (recheck live HEAD):** harbor-four-arm-gate.ts, harbor-four-arm-trial-evidence.ts, harbor-four-arm.ts; trial fixtures.
- **RED:** Wrong arm/duplicate/missing events still produce complete evidence or input-only false fivefold.
- **GREEN:** Independent correlation, missing UNKNOWN, correct 1000+100 vs 200+1100 denial.
- **Proof type:** actual local owning contract/process/provider test as appropriate; synthetic Go/TS/Hermes tests do not certify egress. Independent external provider/economics evidence only through existing change 013.
- **STOP / rollback:** refuse unsafe unknown/stale/cancelled state; preserve prior verified originals and deny unsupported source/graph/provider operations. If material owner G02/pin or dependent PR integration is not approved, leave I blocked, keep this as provisional planning.


## Critical path, independent frontiers, and external integration

- **Initial independent frontier:** AR01, AR02, AR03, AR04, AR06, AR09, AR10. Each has its own ownership, scope and tests; process isolation, G02 and unresolved provider policy still apply.
- **AR04 → AR05:** never-project proof depends on a crash-safe original episode authority; reconcile #291's M1 fix and missing created:true/crash/created:false test, not a duplicate implementation.
- **AR02 → AR07 → AR08:** first eliminate unverified structural model text, then make retrieval telemetry honest, only then compare RepoMap shortlists/extractors. AR08 also depends directly on AR02; **no N-API switch is assumed**.
- **AR03** may need a specific owner choice on publisher topology. If no supported multi-host writer model exists, prefer singleton per workspace; if multi-host explicitly required, treat native aliases as atomic pointer updates, not CAS.
- **AR10** can implement **offline** schema/event reconciliation before G11; a live real-agent/Harbor claim requires **external** existing change 013 C03–C08 provider/agent/egress approval and final-wire proof. Do not reproduce G11 C07/C08 tasks in this tracker.
- **Phase I entry:** explicit owner implementation request + material G02 decision + actual predecessor completion + fresh `design.md` Git blob/spec fingerprint + preflight and isolated worktree. A subsequent I pass handles exactly **one** phase and stops.
- **Stage V:** after selected integration, use `openspec-verify-change` plus BUILD/ARCH/SEC/PLAN and external oracles where applicable. Not all historical ACE code is automatically architecturally compliant merely because these ten fixes pass.

## Sizing rationale and known unknowns

AR08 is a measured **conditional adoption/ablation** slice: it may legitimately finish with no provider substitution and clear negative evidence. AR09 worker lifecycle is isolated due to real subprocess cancellation risk. AR03/AR05 are high-risk even at ~1k LOC. AR06 combines only legacy exact-evidence/identity cleanup; if active callers or wire compatibility force a larger migration, reslice only AR06 by expand–contract, without inventing new tracking sources. No phase needs one large full-repo context: the linked X briefs name exact files, tests, RED/GREEN and return conditions.

## Validation and approval record

**Stage:** P / PROVISIONAL planning artifact (ordinary Ready-for-review PR). **G02:** REVIEW_REQUIRED; a crosswalk is not signoff. **Provider calls:** NOT_RUN. **Skills:** repository files read/applied; host invocation NOT_OBSERVED. **Independent free-form A vs skills B:** INDEPENDENCE_NOT_ATTESTED in this single current context. For T2, the `ace-plan-refinement` protocol remains required for actual independent A/B evidence; without isolated sequential contexts this remains `SINGLE_PLAN_REVIEW` and must not be labeled a successful A/B/C synthesis. Stage X may create truthful provisional B briefs, with a separate human/material decision before I. **OpenSpec/preflight/phase checks:** run on actual checkout/CI; absence of a local checkout is NOT_RUN, not PASS.
