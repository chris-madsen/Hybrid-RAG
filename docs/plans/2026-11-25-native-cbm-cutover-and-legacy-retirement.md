# Native CBM cutover and legacy retirement — execution plan

Date: 2026-11-25. Owner decision: retire overlapping code retrieval infrastructure, reuse CBM v0.12.1, no competing vector stack. Issues [#363](https://github.com/chris-madsen/Hybrid-RAG/issues/363) and [#364](https://github.com/chris-madsen/Hybrid-RAG/issues/364) own delivery. This is an execution plan, not a second canonical acceptance ledger or a certification. Before each slice refresh main, AGENTS.md, accepted ADRs, OpenSpec and CI. Use T2/G02 for material changes beyond the owner-approved direction; use existing SDLC stages and reviewable PRs. Record requirements in the applicable OpenSpec change, including supersession of obsolete REM-005/006, REM-018/019 and REM-020 mechanisms without erasing their underlying safety obligations. All repository prose in English.

## Owner scope clarification (2026-11-25)

Separate external LSP requires further research (#364). Keep FR-03 and the existing semantic-navigation OpenSpec, adapters, dependencies and tests. CBM-04 static audit is evidence, not final scope disposition; CBM-06 is deferred. Continue CBM-01/02/03/05 without requiring external LSP parity; CBM-07 accepts the vector-only cutover with the independent LSP research explicitly open. Native code-only Context RPC must neither start an unnecessary external server nor claim exact LSP coverage. Preserve the independent implementation and test seams during vector retirement. CBM-08 remains separately gated.

## Baseline and evidence

- Main after merge of PR #366: `f08fc8b5d79c00d96096c49b3cd4cca27bab820f`. Tested PR head `7964a0c1afa8cbc736b80dc0f2b33a046077e9a6`; local rerun source `1db95a2512c55791d70f87a098996e5326009694`.
- [Acceptance report](../reviews/2026-11-24-native-cbm-retrieval-acceptance.md) and [WSL rerun](../reviews/2026-11-25-native-cbm-test-rerun.md): 779/779 real-enabled full tests, 16/16 native contracts, compiled projection, modify/rename/delete and startup outage passed. [Hosted native integration log](https://github.com/chris-madsen/Hybrid-RAG/actions/runs/45584368528/job/139102094645) corroborates real CBM and process inventory. Node 22.23.4, CBM 0.12.1.
- The historical removal verdict was BLOCKED. Merge of the opt-in migration slice does not change that verdict. Legacy runtime remains reachable; native mode is local-only. No live provider egress or economic certification.
- The SHA-256 embedding experiment is independent of production retrieval. Remove its executable, npm command and its own artificial algorithm test; retain unrelated Codex history contract and immutable historical labels/report. Remove stale Knip entry for the already retired ast-grep parity tool. Full CI must confirm no unexpected consumer. If a consumer exists, remove/replace it only after determining its actual obligation. No new fake embeddings.
- The old dependency updates #340 (ONNX) and #357 (typescript-language-server) should remain deferred, not closed until corresponding runtime consumers are gone or a security obligation requires separate action. #354/#355 similarly reconcile after retirement. Do not advance Effect/TypeScript major upgrades in the migration slices.

## Target ownership and non-goals

CBM owns parsing, graph, semantic/BM25 retrieval and its native index/cache. ACE owns registered workspace and source policy, current manifest/generation, exact source bytes/digests, typed provider failure, bounded context assembly, delivery receipts, and physical-send guard. Bifröst remains the only agent-facing boundary; no model-visible CBM tools. Graphiti/FalkorDB temporal memory, immutable archive and authorized Vertex documentation remain distinct capabilities. Preserve vscode-jsonrpc for CBM and ast-grep CLI for SDLC. Do not build new ranking, parser, embedding or graph engine. No Qdrant-vs-CBM competition. No live LLM request needed to accept vector removal. G11/C03–C08 and #171 remain separate.

## Execution DAG and stop criteria

| Slice | Depends on | Observable deliverable |
|---|---|---|
| CBM-01 lifecycle and publication safety | merged #366 | real loss/recovery, cancellation and concurrent source mutation tests |
| CBM-02 worktree and scale | CBM-01 | native incremental source verification, real repo and frozen corpus, measured cost/latency |
| CBM-03 deployment decision and implementation | CBM-01 | approved local/host topology with actual source boundary, clean image |
| CBM-04 LSP independent contract review | merged #366 | actual consumer matrix and owner decision for remaining capability |
| CBM-05 vector retirement | CBM-01/02/03 | one supported native code runtime, no live vector path, dependency or deployment consumer |
| CBM-06 LSP retirement | CBM-04, CBM-05 where shared | remove external servers only if contract withdrawn or satisfied |
| CBM-07 final vector-cutover evidence | CBM-05; CBM-06 deferred by owner | full regression, actual deployment, architecture and dependency checks |
| CBM-08 agent economics (separate) | CBM-07 and G11 approvals | #171 paired accepted tasks, no competing search stack |

Parallelize CBM-04 with CBM-01/02/03; do not let the historical external LSP range requirement block vector retirement if no mandatory independent consumer depends on it. Report each slice as PASS/FAIL/BLOCKED/SKIPPED with exact SHA, commands, exit status, artifacts and provider identity. No claim based on skipped tests, fake telemetry or a random BLOCK. Each slice stops at a reviewable PR after its acceptance; do not change protected main directly.

## CBM-01 — lifecycle, generation and cancellation

Inspect `src/bin/ace-runtime.ts` native rebuild/serialization, `src/adapters/codebase-memory-graph.ts` project identity and onLost, `src/adapters/codebase-memory-stdio.ts` connection lifecycle, and shared source verification in `src/adapters/qdrant-context-provider.ts`. Observed risk: onLost clears graph project; unchanged manifest may not call reconcile. Prove and fix recovery without requiring an artificial source edit. Reuse existing Effect resource/interrupt semantics and upstream session APIs. Current rebuild uses nested Effect.runPromise inside Effect.promise, so test actual interruption and ownership rather than assuming semaphore provides cancellation safety. Hold the mutation boundary until provider work stops or is safely invalidated; late result must never publish a stale generation.

RED/GREEN scenarios: missing CBM at startup (existing PASS); kill actual CBM during search/index with a controlled barrier; unchanged-worktree request after failure; recover/reindex then exact PREPARED; ACE process restart with persisted native cache; deadline/cancel mid-rebuild; parallel requests; source mutation between snapshot, upstream index and final source read; same-size restored mtime and ABA; reject foreign workspace, symlink/out-of-scope, malformed result and partial coverage. Preserve latest accepted manifest only on valid publication. If multiple ACE processes share CBM cache, test stale writer isolation or explicitly constrain supported topology; do not recreate Qdrant publication service. No guessed sleeps as race oracle; use controlled boundaries, trace or real child observation and bounded deadlines. Use existing negative source and security contracts. Empty native top-k is not verified absence.

## CBM-02 — incremental worktree and representative quality

Reuse `src/application/workspace-sync.ts`, domain manifest and node-workspace port. Inspect existing fast observation and its non-Git fallbacks; do not lower source correctness to gain speed. Avoid unnecessary full scans and native reindex on unchanged requests where proven. Add actual fixture for add/untracked, stage/unstage, rename/delete, branch/HEAD change, non-Git tree, ignore rules and secret handling. Preserve exact bytes, UTF-8 and authorization; verify CBM cache scope/permissions and index source lineage. Upstream search hints never become direct evidence without ACE read verification. If CBM cannot bind graph generation to exact manifest, document supported safety constraints and do not assert completeness from pre/post equality alone.

Use existing frozen RepoBench-R mapping and retrieval-quality fixtures, no new benchmark framework. Before execution freeze repository SHA, queries, expected file/symbol/range, relevance oracle and acceptance criteria; include exact symbol, behavioral query, multi-file dependency, test lookup, aliases and negative cases on real ACE plus at least one frozen corpus. Record cold index, warm p50/p95, refresh, RAM peak, CPU, disk footprint, process count and failures with actual runner details and repetitions. Check existing resource-budget/deadline policy; if no quantitative SLO exists record measured values and obtain owner agreement for a practical threshold before promoting a deployment. Do not compare against legacy implementation as an architecture election. Existing positive reports need not be rerun without changes just to duplicate evidence.

## CBM-03 — supported deployment

Inspect Dockerfile.ace, scripts/build-harbor-ace-runtime.mjs, scripts/ace-container-runtime-smoke.mjs, infra/k8s/ace-local, host-worktree helper contracts and actual operator runbook. Native mode rejects ACE_WORKTREE_HELPER_URL. Determine actual required topology: local host ACE with CBM and colocated Bifröst, or remote mTLS helper. If remote is mandatory, use upstream supported native execution on authorized host and existing authenticated boundary, not arbitrary filesystem mounts, shadow source copies or unauthenticated proxy; if unsupported, present explicit owner topology decision. Keep workspace identity/canonical root mapping and private cache boundaries. No invented production k3s certification. Build clean image with pinned native binary, verify release checksum/supply-chain controls, no vector service or embedding subprocess. Validate startup, real source changes, failure/recovery, network isolation, shutdown, restart, and provider trace. No LLM egress.

## CBM-04 — independent external LSP decision

Trace actual callers of SemanticAnalysisPort, documentSymbols/definition, routed-semantic, semantic-snapshot, language-server registry and semantic source requirements; distinguish active Context RPC code-only contract, public/versioned contracts, non-runtime test tooling and historical requirements. Record file/symbol/caller/requirement/observable necessity. Inspect pinned upstream v0.12.1 Hybrid LSP, qualified graph identities and line-only outline response, not just README. Existing report establishes missing exact identifier selection/definition columns; no assertion of full LSP parity. If no active mandatory independent consumer, propose removing that historical requirement in ADR/OpenSpec and update tests truthfully. If mandatory, test same names, imports/reexports/aliases, Unicode byte/UTF-16 positions, cross-file definitions, changed sources, representative non-TS, outage. Retain only the smallest maintained independent provider if approved. Do not implement a substitute LSP, fake columns or silently turn line hints into direct evidence. This decision is separate from #363.

## CBM-05 — physical vector deletion (one supported runtime)

Inventory all consumers with full checkout using git grep, Knip, TypeScript graph, npm scripts, Python import/requirements, shell, Go, Docker, k3s, CI, Harbor runtime/evidence, env example and docs. Do not rely on filename matches alone. For each item record remove/migrate/retain-with-independent-rationale. Remove old composition in ace-runtime.ts and temporary ACE_CODE_RETRIEVAL_MODE/ACE_ENABLE_EXPERIMENTAL_QDRANT alternatives; native only, obsolete configuration rejected explicitly rather than silently interpreted. Extract existing provider-independent source checks, source plan and context assembly from qdrant-context-provider.ts into an accurately named native provider; remove old Qdrant SDK/HTTP vector candidate boundaries, collection/alias/membership/publication, dense/sparse workers, RRF and redundant reranker where unused. Preserve shared HTTP clients, history, Vertex and Graphiti boundaries. Remove qdrant-sdk-adapter.ts, qdrant-publication-authority.ts, process-embedding.ts, process-sparse-embedding.ts, process-reranker.ts, semantic/embedding-specific paths only when their consumers are gone. Trace FastEmbed, ONNX, sentence-transformers, Python worker scripts, model artifact verifier and cache; remove exclusive requirements-embedding-fast.txt / requirements-embedding-st.txt and manifest entries only after checking independent users. Remove @qdrant/js-client-rest and its overrides, regenerate package-lock via npm (no hand-edited lock dependency graph); verify clean npm ci. Remove Qdrant k8s values, Docker installs, Harbor environment/build/probe dependencies, stale configuration and tests/scripts for Qdrant-only implementation. Preserve historical benchmark artifacts (not current authority); migrate useful source/race/policy tests to native behavior, do not delete independent contract coverage. Inspect embedding/reranker comparison and gate scripts, Qdrant rank probe, old ablation paths and provider probe reporting; retire those used only for obsolete alternatives. Keep existing corpus, evaluation evidence tooling and task verifier needed for #171. Update TypeSpec generated contracts only through approved codegen if wire changes required.

Acceptance: clean installation/container without Qdrant SDK or embedding/reranker dependencies (unless independent approved consumer), no native runtime legacy branch, no live references in maintained configuration, real native end-to-end tests and negative contracts pass. Verify process tree and provider trace; deleting a service but retaining required imports is not done. No fallback to old vectors. Close #340/#354 only when superseded; do not prematurely close #363.

## CBM-06 — external LSP cleanup

After CBM-04 decision remove redundant LSP discovery/registry, routed and external process adapter, TypeScript language-server dependency, language-server install/config/probe scripts, obsolete test suites and CI jobs. Keep vscode-jsonrpc for CBM. Preserve semantic evidence contracts only where actually required and validated; update source-plan/readiness without fabricated success. Close #357 and reconcile #355 only after retirement; if retained, document exact remaining consumer and limited scope. No separate language server solely to preserve historical tests.

## CBM-07 — final closure

On final cleaned SHA with Node 22.23.4 and actual CBM v0.12.1, run npm ci, npm run verify:full, ACE_TEST_REAL_CBM=true npm test, focused real CBM suite, and adapted compiled projection/mutation/outage/recovery/race/deployment tests. Commands currently on main: ACE_REAL_PROJECTION_NATIVE_CBM=true npm run test:real-projection; ACE_REAL_PROJECTION_NATIVE_CBM=true ACE_REAL_PROJECTION_NATIVE_MUTATIONS=true node scripts/real-projection-e2e.mjs; ACE_REAL_PROJECTION_NATIVE_CBM=true ACE_REAL_PROJECTION_OUTAGE=true node scripts/real-projection-e2e.mjs. Update invocation after removing temporary mode flag. The historical embedding-delay race is invalid for native CBM. Verify real CI, CodeQL, critical mutation, dependency advisory/Knip and architecture checks. Keep per-physical-send authorization, exact-source proof, receipt/replay protections, store:false and fail-closed behavior. No live provider calls.

Reconcile AGENTS, accepted ADR rationale/supersession, OpenSpec canonical acceptance, architecture description views (runtime, deployment, functional, information, security, quality), concerns, component/model versions, decisions, correspondences and ISO 42010 conformance evidence. Reconcile current architecture, provider/readiness matrix, operations, Harbor setup and README. Do not overwrite immutable historical reports. Review changes to AR03/AR07/AR08/AR09 requirements so removed mechanism is superseded with retained observable guarantees. Record remaining risks, unsupported topology and independent retained components explicitly. Close #363 only with vector-retirement evidence; keep #364 open for separate research until explicit owner disposition. No independent ISO certification claim.

## CBM-08 — separate downstream acceptance

Continue #275 and #323/G11 on exact native Responses subscription path under existing approval limits. Only after cutover and appropriate live-trial gates, use existing Harbor infrastructure to measure #171: matched unmodified Hermes versus Hermes + ACE, independently verified nontrivial tasks, same frozen settings and provider-measured tokens, retries, failures, latency/cost. Target >=5x fewer total tokens per accepted task is a hypothesis, not achieved evidence. Do not postpone vector deletion just to run this comparison.

## Local reproducibility

Use a clean worktree, exact main/PR SHA, Node 22.23.4 and pinned CBM. Keep log artifacts with digest and source SHA; upload reproducible redacted results, not secrets or source outside authorized policy. Actual real-provider integration can require Linux/WSL with Unix sockets; container EPERM is BLOCKED, not product failure or PASS. Fix actual failures, rerun owning contracts and final gate, and record remaining gaps; do not weaken acceptance or invent new infrastructure.

## Historical proposal for requirement supersession — superseded by the revised OpenSpec 014

This historical proposal predates the substantive OpenSpec 014 revision in PR #378. The active 014 specs, tasks and phase briefs now own the native lifecycle and retrieval acceptance requirements; the strict validator checks the revised phase fingerprints. The proposal below is retained as history, not an alternative active requirement or acceptance tracker. No unchecked acceptance is promoted by the replan. FR-03 remains deferred, not withdrawn.

### Proposed replacement requirements and scenarios (for review)

#### Proposed workspace-snapshot-correctness



##### Requirement: Verified freshness for complete source search

A successful complete retrieval SHALL require a trustworthy source observation. Non-Git size/mtime hints alone SHALL NOT prove freshness.

###### Scenario: REM-001 — Same-metadata non-Git mutation
- **WHEN** source bytes change without a size/mtime change, or watcher events are dropped
- **THEN** reconciliation detects the change or represents source coverage as incomplete
- **AND** no empty search is declared verified-current before reconciliation

###### Scenario: REM-002 — Truthful empty Native Responses pass-through
- **WHEN** an authorized request yields a truly complete, fresh, successful empty retrieval
- **THEN** the already approved verified-no-addition response preserves native input bytes exactly
- **AND** stale, denied, partial, failed or unknown results never enter that success path

##### Requirement: Concurrent source publishers cannot roll back newer source

The publisher SHALL preserve workspace-scoped authority that prevents stale writers from erasing or activating older generations. For the owner-selected native CBM cutover, reuse upstream coordination and ACE exact source/generation verification rather than rebuilding the retired vector publication mechanism. A process-local semaphore alone SHALL NOT be treated as cross-process authority. Supported concurrent topology must be proven, or an explicit approved constraint must prevent unsupported publishers from sharing mutable index state.

###### Scenario: REM-005 — Stale writer after newer publication
- **WHEN** process A observes v1, pauses, and process B publishes v2 before A continues
- **THEN** A neither deletes v2 membership nor promotes v1 over v2
- **AND** readers see a complete current generation or an explicit typed unavailable result

###### Scenario: REM-006 — Failed/restarted publication
- **WHEN** publication fails, a writer crashes/restarts or competing writers have the same claimed generation
- **THEN** the system cannot expose a partial or rolled-back snapshot as complete
- **AND** verified newer membership survives restart/cleanup and is not lost by stale pruning
- **AND** index/cache atomicity alone is never mistaken for verified source-generation ownership
- **AND** restart or provider loss requires a fresh verified publication before any result can be declared complete


#### Proposed retrieval-quality-provenance



##### Requirement: Working-context priors preserve documented ranking semantics

Positive working-context preferences SHALL not demote candidates merely because cosine scores can be negative.

###### Scenario: REM-015 — Prior applied to negative/zero/positive score
- **WHEN** Qdrant returns negative, zero or positive ranked scores and a relevant candidate receives a preference
- **THEN** the prior never decreases its intended relative rank under the documented strategy
- **AND** held-out retrieval quality and latency are measured before promotion

##### Requirement: Delivered evidence and provider provenance are accurate

Retrieval metrics SHALL distinguish shortlist from final verified model-visible evidence; provider identities SHALL describe the actual active implementation.

###### Scenario: REM-016 — Stale shortlisted hit excluded from delivered stage
- **WHEN** a hit fails source verification, final reread, dedup or actual delivery
- **THEN** it is recorded as shortlisted/rejected rather than delivered verified evidence
- **AND** delivered recall cannot count its missing code body

###### Scenario: REM-017 — Selected runtime provider identity
- **WHEN** Rust/Go/Python/custom LSP or embedding runtime supplies evidence
- **THEN** trace and receipt carry effective resolved identities where observed
- **AND** unavailable providers never inherit hard-coded TypeScript defaults

##### Requirement: Maintained native structural and ranking provider has measured task quality

Native CBM SHALL own discovery and structural hints in the selected code retrieval architecture. Unobserved paths SHALL NOT count as recall and native outline ranges SHALL NOT be promoted to exact identifier coordinates. Provider identity, corpus quality, source scope and license provenance SHALL be established before acceptance; no independent LSP contract is withdrawn.

###### Scenario: REM-018 — Multi-file path outside native top-K
- **WHEN** a relevant path falls outside initial candidate shortlist on a multi-file coding task
- **THEN** the strategy measures and reports that bound or uses proven provider-native diversity/overfetch
- **AND** no unverified RepoMap text substitutes for exact cited source

###### Scenario: REM-019 — Native structural evidence remains source-bound
- **WHEN** a native CBM outline, graph result or unsupported language supplies incomplete, ambiguous or inconsistent structural evidence
- **THEN** ACE rereads and verifies exact current UTF-8 source ranges or reports typed partial/unavailable
- **AND** corpus quality, provider identity and license provenance are recorded independently
- **AND** no line hint claims exact independent LSP identifier coordinates; FR-03 remains open for separate research

##### Requirement: Timed-out native provider work cannot monopolize the transaction indefinitely

A cancelled client wait SHALL not leave unbounded serial provider work or misattribute stale responses.

###### Scenario: REM-020 — Native CBM timeout and next request
- **WHEN** native indexing or retrieval stalls, is cancelled or times out before a queued healthy request
- **THEN** cancellation/recovery and transaction fencing let the healthy request complete or return typed bounded unavailability
- **AND** the cancelled generation cannot publish and stale late output cannot be attributed to the next request
- **AND** shared upstream jobs or other processes must not invalidate the approved source/generation isolation boundary


## CBM-05 executable worker retirement slice (candidate)

The historical Python dense/sparse embedding and cross-encoder worker environments, launchers, provider benchmark runners and process adapters are removed in this candidate. The original evidence reports and pure historical report validators remain, with no claim of current approval. Replace the old nightly Qdrant projection job with the existing native integration workflow; retain memory/HTTP Python dependency verification and independent real LSP checks. REM-020 operational cancellation evidence is supplied by the real CBM child/deadline tests, not by relabeling old Python-worker tests. The candidate now extracts native source verification into `src/adapters/native-cbm-context-provider.ts`, removes the Qdrant context/SDK adapters and HTTP vector boundary, and migrates mixed-source and exact-source contracts to the native provider. The npm-generated lockfile removes the Qdrant client, its OpenAPI helper and its exclusive undici dependency. Historical AR03 vector-specific executable fixtures are removed; the native cross-process/source-authority requirements remain open in the revised OpenSpec. Release preflight now requires native identities and absolute retrieval quality, but the independent corpus and real final-projection evidence still need to be collected and verified. The owner permits merging the code cutover before local acceptance; this does not authorize release, unsupported topology, or closure of #363.


## 2026-11-25 native scale correction and retirement progress

- PR #379 merged at `2c8d1bf4ae68023b68b6a7a3a9c1429c91eb74b7`. The first real ACE corpus run failed all 20 expected delivery checks. The correction uses bounded explicit-symbol queries against the existing native CBM graph, prioritizes explicit file mentions only among graph-returned candidates, and retains exact-source verification and secret policy. No additional embedding, vector index or ranking service.
- Corrected [native container integration evidence](https://github.com/chris-madsen/Hybrid-RAG/runs/139442186573) (job 139442186573; CI tested source commit `9f3b26e3c865cd20b81ee928a70b28d33c931f35`, corpus tree `f7e87c2943ca3733439c71bbe6f90d8b7de8dce7`): 126 source files, 1,413,120 archived bytes, CBM 0.12.1, Node 22.23.4, four repeated explicit-symbol queries, 20/20 delivered hits, refresh hit true, cold index 1,680 ms, startup 2,469 ms, warm p50 307 ms/p95 325 ms, refresh 1,678 ms, cgroup peak 298,086,400 bytes, native home 18,135,711 bytes. This is development evidence, not a held-out corpus, resource approval, or physical provider-wire certification.
- PR #357 merged at `b2adb6cb95feadbccf372e39174df63b90e1d728` after updating the retained independent TypeScript LSP pin to 6.1.0 and re-running checks. Independent LSP research remains deferred, not withdrawn.
- PR #340 is not a necessary update for the selected native architecture; retire its obsolete ONNX requirement only when the removal lands on main.
- PR #378 implements the native-only runtime, Docker image, Python worker and SDK/lockfile removal, revised OpenSpec/phase bindings and native release-evidence identity checks. Merge requires green applicable checks on the reviewed head; the owner explicitly separates merge from local acceptance. The remaining independent holdout runner and scoring of actual PREPARED projections (not just source-verified retrieval traces), shared-daemon/worker/scope/ABA isolation, and remote host-worktree topology remain open. Local container daemon recovery and cache-conflict refusal do not certify all concurrent topologies. Keep #363 and #364 open, and do not restore the old vector stack.

### CBM-02 native projection evidence slice

The native holdout producer and replay verifier use the existing frozen manifest, Context RPC, native trace and signed projection receipt. They require the actual prepared body and ordered, exact-source candidate bindings; BLOCK is a miss. Acceptance remains open until the frozen independent partitions run and the predeclared absolute policy passes. No new benchmark result is committed. Owner excludes Windows-specific optimization; Linux/colocated scope is the current target. Cross-process/cache and agent boundary remain separate obligations.

The isolated Linux shared-cache scenario uses two real ACE runtimes with separate ACE state, one upstream session-managed CBM daemon, a stopped native frontend with observed queued indexing, a newer same-size source update, a foreign registered root and retained SQLite cache on restart. It does not certify all multiprocess schedules or an independent worker/ABA proof. No custom shared-cache lock or remote deployment support is introduced.

### CBM-02 follow-up: Reuse Before Build audit (2026-11-26)

**Scope and authority:** owner request to audit the native adapter and remove unjustified duplication; #363, REM-018/019/020, current AGENTS.md. Reviewed ACE main `f563ed000732e7c6c09701f51e387f8a332a37b8` (#393), historical migration slice #366 (`f08fc8b5d79c00d96096c49b3cd4cca27bab820f`), this plan's #379 and frozen holdout evidence, the current adapter, runtime, native provider, source coverage and contract fixture. Upstream pinned [v0.12.1 query documentation](https://github.com/DeusData/codebase-memory-mcp/blob/v0.12.1/README.md#querying) establishes the public native search boundary; implementation details were checked against the same release tag. No new parser, graph, ranking service, vector store, benchmark framework, environment knob or agent-facing tool.

| ACE mechanism (baseline path/lines) | Native CBM evidence and decision |
| --- | --- |
| `codebase-memory-graph.ts:336-384`, semantic then BM25 | Native `search_graph` accepts separate modes: `query` and `semantic_query` are mutually exclusive. Keep minimal orchestration for now; #393 covers underfilled distinct source-bound hits. Native continuation (`semantic_has_more`/`semantic_next_offset`, BM25 offset) is available but ACE does not consume these pages. Prefer bounded native continuation/overfetch over new ranking, evaluate on development corpus before adoption. The current single-element whole-query semantic input should be compared with the upstream documented per-keyword input, not guessed to be better. |
| Explicit identifiers / file hints, lines 468-501 | Native graph resolves exact names; existing #379 first real corpus run delivered 0/20 before the fix and 20/20 after. Retain the proven functional capability until a native alternative passes independent quality checks. Compare upstream name/qn/file filters; do not introduce a custom lexical index. |
| `trace_path`, `query_graph`, adjacency and dirty-worktree impact, lines 320-334, 387-420, 503-570 | Native graph diffusion is a ranking signal, not a proof of dependency closure. Native trace and read-only Cypher are separate operations; `include_connected` is a structural-result field, not a combined semantic/BM25/trace ranker. `detect_changes` committed impact does not replace dirty-file graph discovery. Keep source-bound orchestration where independently necessary. CBM documents `INHERITS` and `OVERRIDE`, not ACE's `EXTENDS`/`OVERRIDES` aliases: correct those two literals and add fixture regression. Native trace defaults omit tests and emits truncation/continuation; ACE does not consume trace cursors. Test discovery and optional-expansion omissions need explicit evaluation, not a blanket completeness claim. |
| Three seeds, depth 2, trace limit 24, 40 qns, 50 Cypher rows, 60% direct floor, output caps, lines 320-334, 503-585 | The fixed seed/depth/quota already existed before the native-only cutover (#366); no inspected decision or parameter-ablation evidence justifies these exact values. Native trace defaults (depth 3, limit 100) are not automatically optimal either. The current final quota is ACE selection policy, not CBM native relevance rank. **Candidate for removal**, pending the experiment below; no new config knobs or dynamic ranker. Proven dead work: when direct results fill the request and ceil(0.6*K)=K, linked candidates cannot enter the returned list. Skip expansion on that path while retaining the same graph-generation fence. |
| `ACE_CONTEXT_CANDIDATE_LIMIT` in ace-runtime.ts:234-236 | Already configurable (default 6, runtime range 1-20); the adapter range is 1-100. Context/resource bound is an independent ACE obligation; the exact default and upper limit are not a measured optimum. Do not equate candidate count with provider/model token budget. |
| Exact source mapping, deduplication, freshness/workspace identity, source coverage, cancellation, policy and projection | Retain: these are independent mandatory ACE contracts, not CBM replacement algorithms. `SourceCoverage.complete` checks required sources, not ground-truth task recall. No expansion hint is trusted source evidence. No physical send or E2E certification from this audit. |

**T1 implementation scope:** fix two incorrect native relationship names and remove provably redundant expansion for full direct shortlists without available linked slots. Regression oracles: (1) native `INHERITS` outbound and `OVERRIDE` inbound each return their own distinct source-bound candidate; the old aliases miss both; (2) full valid direct shortlist at K=2 returns unchanged IDs and issues no optional trace/adjacency/impact RPCs; (3) #393's underfilled shortlist still returns four direct plus one linked at K=5, with a second scenario for two linked at K=6; malformed lexical output still fails; (4) final generation/closed/project fence still applies to every successful result. No modification of source verification, policy, protocol, dependencies or scope authorization. Four static review perspectives: BUILD/ARCH/SEC/PLAN reviewed against this narrow diff; executable regression, PR gate, real CBM and holdout **NOT-RUN** in connector-only environment. Not a new G02 decision.

**Remaining decision (not implemented):** remove unsupported selection heuristics before tuning them; preserve independently required discovery and source/security invariants. Use the already existing CBM-02 native projection holdout producer/replay, frozen RepoBench-R and real-source development fixtures; no new persistent runtime modes or extra tracker. First inspect native-only retrieval with source-bound mapping and budget, then ablate exact-name supplement, trace/adjacency/dirty-impact paths and fixed direct/linked quota independently, including provider-native pagination/diversity where documented. Use identical CBM release/index/snapshot, query set, resource/deadline limits and final delivered-byte oracle. Record direct/linked IDs, native continuation/truncation, delivered recall/precision, misses of mandatory dependencies/tests, p50/p95, context bytes/tokens, native RPC count and failures. Predeclare acceptable per-task and aggregate quality/resource limits with owner before selection; no held-out tuning. Select the least complex variant that meets REM-018/019/020 and existing quality gates; if a retained heuristic has no independently demonstrated benefit, delete it rather than expose it in config. Only if justified, use typed configuration for independently necessary operator-controlled bounds. Re-run the frozen holdout only after selecting the strategy, then #171/C08 for paired accepted-task token economics; no live egress without separate authorization. Until measured and reviewed, do not claim full removal, optimal parameters or G02/production acceptance. No Qdrant-vs-CBM competition.

### Owner-directed native-ranking simplification (2026-11-27)

The owner supersedes the earlier proposal to ablate or tune ACE-side retrieval heuristics before removal. The current implementation shall use native CBM ranking as the baseline, without automatic regex-derived exact-name promotion, seed-based trace/Cypher expansion, dirty-path impact expansion, fabricated linked scores or direct/linked quotas. Use the upstream free-text `search_graph(query=...)` BM25 contract for unstructured user requests, native ordering, distinct verified candidate membership, generation fencing and exact source delivery. CBM v0.12.1 documents `semantic_query` as a list of independent keyword strings, not an entire user sentence; the two modes are mutually exclusive (upstream v0.12.1 native tool handlers `handle_search_graph` and `run_semantic_query_core`). Do not generate keywords, choose a mode based on query heuristics, or merge ranked lists in ACE. Semantic search remains a native CBM capability; this baseline does not claim semantic-mode acceptance. The scale fixture preserves every original function observation and the original standalone-variable probe, including its miss count. The pinned upstream BM25 SQL excludes Variable nodes and native vector search is limited to callable/type labels; the automatic exact-name promotion previously obscured that native coverage boundary. To test refresh independently of retrieval type coverage, the fixture adds a new callable marker with an exact delivered source assertion. CI gates on all original callable queries and successful callable refresh; the standalone-variable query is still executed and its outcome included in the original 22-observation quality count, but its hit is no longer a prerequisite of the lifecycle gate. A miss remains a quality gap, not accepted retrieval quality. This is a deliberate scope distinction under the owner-directed removal of non-native ranking; no frozen holdout or release quality threshold changes. The explicit CBM diagnostic operations remain available internally for independently requested diagnostics and conformance tests; they are not automatic ranking steps. No alternate ranker, configurable heuristic mode, or new provider is introduced. REM-018 still requires truthful measurement of multi-file misses; it does not require the removed heuristic. The frozen holdout, representative quality, actual deployment and CBM-07 remain unaccepted until measured on the resulting implementation. Do not change labels or lower acceptance thresholds to pass. No model egress is authorized by this decision.
