---
title: "ACE completion research: remaining runtime capabilities and acceptance evidence (AS-IS)"
date: 2026-11-15
researcher: "ChatGPT, GitHub source inspection"
repository: "chris-madsen/Mult-agent-AI-Orchestration"
branch: "main (source baseline; report submitted on research branch)"
git_commit: "35a31dab44ac918036c6ef5cde50373746ad9d22"
status: partial
topics:
  - "Bifröst Gateway and G11"
  - "retrieval, context completeness and token accounting"
  - "retained memory and documentation"
  - "Harbor, TypeSpec, quality/release evidence"
---

# Research: what is still unverified or unavailable in ACE

## 1. Exact question, authority and constraints

**Original user question (Russian):** “Хорошо, двигаемся тогда по нашему SDLC - доделываем ACE - сделай research того, что осталось доделать.”

**Scope:** current ACE runtime/acceptance state, not an implementation plan. Four sequential tracks: (1) agent→Gateway→provider path; (2) retrieval and context assembly; (3) memory and documentation; (4) benchmark/contract/quality evidence. Examine existing open work so missing evidence is not confused with absent implementation.

**Authority:** current owner decision, accepted ADRs, active OpenSpec (especially `openspec/changes/010-gateway-only-ownership/`), `AGENTS.md`, `docs/operations/ai-assisted-sdlc.md`. Those documents express obligations; only current code and observed runs establish implementation.

**Source baseline:** remote `main@35a31dab44ac918036c6ef5cde50373746ad9d22` (merge of #247). Remote GitHub contents and PR metadata were inspected; there was **no local checkout/dirty-worktree observation**, no configured coding-agent/provider session, and no new container/Qdrant/Graphiti/Vertex/Harbor run in this Research. `status: partial` reflects unobserved real production paths, **not** missing source inspection of the identified main boundaries. Where cited, PR checks refer to the exact pre-merge PR head, not an invented run at the merge SHA.

**Exclusions:** no change to application code, CI configuration, OpenSpec decisions, cloud policy, production infrastructure or benchmark results; no new architecture proposal. Historical plans and issue statements are labeled historical.

## 2. Executive summary — verified current facts

1. The sole agent-facing delivery path is Bifröst Gateway; the live HTTP surface is an authenticated loopback projection API. It emits an `APPLY` or `BLOCK` decision for a supported Chat route, but the delivery-recording HTTP endpoint explicitly responds `501 PROVIDER_WIRE_NOT_CERTIFIED`. The Bifröst plugin requires a session correlation, fresh ACE request ID, provider/model identity and APPLY receipt, and explicitly blocks receipt reuse in another PreLLM attempt. **Final provider wire and real coding-agent behavior remain unobserved in this research.** [R-01–R-03]
2. The runtime has a real local Qdrant/embedding/structural/LSP composition under `ACE_ENABLE_EXPERIMENTAL_QDRANT=true`, with WorkspaceSync and exact source rereads. The default-disabled path is `NOT_READY`. The agent-facing transform currently requests **code only**, even though the underlying retrieval provider has conditional documentation/history/memory interfaces. [R-04–R-06]
3. Gateway v1 supplies no model budget: the request adapter uses `Number.MAX_SAFE_INTEGER`; runtime constructs the assembler without a model-specific token counter, so reported token count is labeled `character_estimate`. The transform may still be `ready` when evidence coverage is complete; token accounting is explicitly not proof of model-exact fit or savings. [R-07]
4. Local immutable archive/outbox implementations exist. Native Graphiti projection is **not composed**: `ACE_ENABLE_GRAPHITI=true` throws at runtime, and the memory CLI's graph projection factory throws `NOT_READY`. Vertex documentation retrieval is a real, policy-guarded adapter subject to configuration/consent; it is not selected by the current Gateway code-only transform. [R-08–R-09]
5. Harbor gates verify reported task/usage data and reject unsupported five-X claims; this is not evidence of a successful paired real coding-agent→Bifröst→provider benchmark at the current SHA. Gateway v1 TypeSpec is implemented; broader TypeSpec is deliberately staged for an approved new live public contract, not automatically a defect. QG6 depth is **open PR #248**, not merged into the source baseline. [R-10–R-12]

## 3. Runtime composition — actual versus unobserved

| Entrypoint | Selected runtime composition at source baseline | Evidence | Boundary |
|---|---|---|---|
| `npm run gateway:http` → `dist/bin/ace-gateway-http.js` | `src/bin/ace-gateway-http.ts` enables Gateway mode, then `ace-runtime` builds an optional real Qdrant ContextProvider, `ContextTransformService`, `GatewayProjectionService` and loopback HTTP server | `package.json` scripts; `src/bin/ace-gateway-http.ts:1-4`; `src/bin/ace-runtime.ts:990-1089,1090-1137` | Actual TS composition; only source inspected in this study |
| Bifröst loaded native plugin | `HTTPTransportPreHook` → local ACE HTTP `/project` → connector decision semantic checks → rewritten Chat body; `PreLLMHook` validates receipt, correlation, model/provider/context, and refuses second attempt | `integrations/bifrost/ace-connector/plugin/main.go:213-275,295-352`; `connector.go:250-349,351-456` | Pinned compile/Go tests exist; actual loaded plugin order and final provider bytes unobserved |
| `npm run memory:sync` / `memory:reconcile` | `ace-memory` constructs file archive + projection outbox; native Graphiti factory is deliberately unavailable | `package.json`; `src/bin/ace-memory.ts:29-49,85-121,206-226` | Archive code exists; graph materialization is not operational via this composition |
| Vertex documentation adapter | Configured only with `ACE_ENABLE_VERTEX=true`, project/corpus; requires separate `ACE_CLOUD_DOCS_OPT_IN=true`; `VertexRagRetrievalPort` does policy check and official `retrieveContexts` call | `src/bin/ace-runtime.ts:172-199,904-910`; `src/adapters/vertex-rag.ts:23-111` | Connected only to general retrieval when configured, not current code-only Gateway transform |
| Harbor acceptance | `harbor-four-arm-gate.ts` checks evidence bindings and raw trials; five-X eligibility requires quality/cost/raw-trial proof | `scripts/harbor-four-arm-gate.ts:34-50,71-119,120-155` | Artifact validator ≠ new real benchmark run |

### ACTUAL dataflow at code level

`Coding agent model request (external host; not observed)` → `Bifröst /v1/chat/completions` → `ACE HTTPTransportPreHook` → authenticated local `/internal/ace-gateway/v1/project` → `GatewayProjectionService.project` (identity/policy/secret checks) → `ContextTransformService.transform` (code-only search) → `QdrantContextProvider.search` (WorkspaceSync, vector candidates, structural/LSP/source checks) → `ContextAssembler` (render text) → one verified system message / decision → `Bifröst PreLLMHook` (attempt authorization) → `provider attempt (final wire NOT OBSERVED)`.

The flow above describes code ownership, **not** an observed successful end-to-end production request. The local `real-projection-e2e` script starts at ACE's internal HTTP route and does not run the coding-agent/Bifröst/provider part.

## 4. Detailed evidence ledger

### Track A — Gateway, provider wire and host trust

**R-01 (CODE, OBSERVED):** Supported Bifröst model ingress is `POST /v1/chat/completions`. Other `/v1/*` model routes are rejected at the transport hook; `/v1/models` is exempted as an administrative route. Exact provider/model route is mandatory; plugin requires a workspace, normalized session correlation and new server-minted ACE request ID. `ACE_GATEWAY_PROJECTION_TOKEN` and local projection URL are initialized from environment.  
**Sources:** `integrations/bifrost/ace-connector/plugin/main.go:33-52,64-132,213-256`.  
**Uncertainty:** no observed live coding-agent configuration/provider request. Stream mode is not explicitly excluded by an ingress `stream` field check in this hook; actual streaming behavior has not been certified by final-wire evidence.

**R-02 (CODE, OBSERVED):** Gateway HTTP health/capabilities declares `providerWire: not_certified`, and `POST /internal/ace-gateway/v1/record-delivery` returns 501. The projection endpoint authenticates Bearer secret before parsing its private payload and listens only on loopback. Gateway appends exactly one context system message to a Chat body after policy, readiness and secret checks.  
**Sources:** `src/transport/gateway-projection-http.ts:64-109,129-175`; `src/application/gateway-projection-service.ts:163-227`; `integrations/bifrost/ace-connector/connector.go:351-456`.  
**Does not prove:** actual final LLM bytes, cached-input usage, or live plugin ordering.

**R-03 (CODE + NORMATIVE, OBSERVED implementation / NOT-RUN production):** `PreLLMHook` binds the receipt to physical ID and session correlation, requires the original normalized provider/model and inserted context, rejects configured fallbacks and second attempt reuse; `PostLLMHook` is a pass-through. Host durable transcript/compaction is expressly unattested in the plugin. OpenSpec 010 lists unchecked: per-attempt retry/fallback reauthorization, streaming/request certification, authenticated coding-host transcript/config attestor, real coding-agent/Bifröst/external provider G11, Harbor economics.  
**Sources:** `integrations/bifrost/ace-connector/plugin/main.go:104-132,295-356`; `openspec/changes/010-gateway-only-ownership/tasks.md:12-16`; `integrations/bifrost/ace-connector/README.md` terminal custom-plugin ordering limitation.  
**Open fact:** a later custom Bifröst PreLLM plugin can mutate the request unless live deployment order guarantees ACE is terminal; no loaded-order capture is present in this research.

### Track B — retrieval, context completeness and token count

**R-04 (CODE, OBSERVED):** The Qdrant/code ContextProvider is conditional on `ACE_ENABLE_EXPERIMENTAL_QDRANT=true`; disabled/unavailable paths are `NOT_READY`, not a successful empty result. When provisioned, runtime uses real embedding preflight, structural indexing, Qdrant publication and an LSP registry. Startup builds a snapshot; request path uses WorkspaceSync/manifest reconciliation where configured.  
**Sources:** `src/bin/ace-runtime.ts:326-340,477-503,549-600,830-924,980-1089`; `src/adapters/qdrant-context-provider.ts:870-962`.  
**Does not prove:** full real-provider failure matrix, long-running multiwriter health in a live deployment or retrieval task quality.

**R-05 (CODE, OBSERVED):** Code evidence gets last-stage exact source re-read; changed source becomes `changed_during_request`, with one synchronization/reconcile retry. Required source coverage determines `complete`. RepoMap evidence is deliberately labeled `freshness: unknown` where its rendered paths cannot all be exact-reread.  
**Sources:** `src/adapters/qdrant-context-provider.ts:1527-1552,1557-1655`.  
**Does not prove:** that every structural source is current or that ranking is superior on a held-out real task.

**R-06 (CODE, OBSERVED):** The actual `ContextTransformService` queries only `code` (`includeCode: true`, `includeDocs: false`, `includeMemory: false`, `includeHistory: false`). The Qdrant provider *supports conditional interfaces* for documentation/history/memory, with distinct unavailable/empty/partial statuses; this is not an automatically composed multi-source Gateway behavior.  
**Sources:** `src/application/context-transform-service.ts:115-160`; `src/adapters/qdrant-context-provider.ts:1380-1524`.  
**Open fact:** which additional classes should be required for each real coding-agent task has not been accepted as a specific Gateway v1 behavior in this report.

**R-07 (CODE, OBSERVED):** `GatewayProjectionService` currently passes `budgetTokens: Number.MAX_SAFE_INTEGER` because Gateway v1 has no model budget field. Runtime constructs `makeContextAssembler()` without a `countTokens` callback; default `ceil(text.length / 4)` is called `character_estimate`. Complete, untruncated source coverage can still produce `ready` without a model-exact counter; the mode/limitation is explicit.  
**Sources:** `src/application/gateway-projection-service.ts:149-161`; `src/bin/ace-runtime.ts:1103-1117`; `src/application/context-transform-service.ts:173-200`; `src/domain/context-assembly.ts:65-66,90-138`.  
**Does not prove:** model-exact context-window fit, token savings, latency improvement or no extra LLM retries. The absence of a strict model budget is source fact, not evidence of present request failure.

### Track C — archive, derived Graphiti memory and Vertex

**R-08 (CODE, OBSERVED):** File archive and projection outbox have immutable-content/digest and fenced persistence behaviors. `ace-runtime` throws if `ACE_ENABLE_GRAPHITI=true`; the `ace-memory` CLI constructs local archive and outbox, but its graph projection factory throws `Graphiti native projection provider is not configured (NOT_READY)`. `reconcile` and `delete` reach this factory; `import` passes it to the import service, and its per-episode outcomes are printed with explicit projection status/error fields.  
**Sources:** `src/adapters/file-memory-archive.ts:15-53,96-176`; `src/adapters/file-projection-outbox.ts:29-69,111-180`; `src/bin/ace-runtime.ts:326-333`; `src/bin/ace-memory.ts:29-49,85-121,206-226`.  
**Limit:** the source proves a native Graphiti runtime adapter is not configured, not that every possible archival operation is unavailable. Crash/recovery claims for the retained archive/outbox were not freshly exercised here.

**R-09 (CODE, OBSERVED):** The Vertex adapter is real request code: policy-check `project_document` class and query secrets, require OAuth, send `retrieveContexts` to Vertex v1beta1, retry a fresh token once on HTTP 401, reject malformed contexts and mark evidence freshness `unknown`. Composition requires Vertex project/corpus and cloud opt-in; Gateway currently requests no docs.  
**Sources:** `src/bin/ace-runtime.ts:172-199,904-910`; `src/adapters/vertex-rag.ts:23-111`; `src/application/context-transform-service.ts:138-147`.  
**Limit:** no credential, corpus, cloud request, or live authorization trace was accessed during this research.

### Track D — Harbor, contracts, quality gates, already-open work

**R-10 (CODE + ISSUE CONTEXT, OBSERVED gate / NOT-RUN current task):** The four-arm Harbor gate consumes report/job and optional raw-trial evidence, calculates token ratio, and refuses a five-X release claim without verified raw trials and complete quality/cost telemetry. Open issue #171 documents **historical** Codex paired regressions and no attributable ACE use in another smoke; those numbers are not new measured Hermes/Bifröst results for the current Gateway-only architecture.  
**Sources:** `scripts/harbor-four-arm-gate.ts:34-50,71-119,120-155`; `openspec/changes/010-gateway-only-ownership/tasks.md:15-16`; https://github.com/chris-madsen/Mult-agent-AI-Orchestration/issues/171.  
**Limit:** no new Harbor A/B was run. Existing provider/gate scripts are evidence processors, not proof of a pass at this merge SHA.

**R-11 (CONFIG + DOC, OBSERVED):** Gateway v1 TypeSpec schemas, SDK and CI compatibility were integrated previously. The current TypeSpec coverage document calls other public contract migration **staged**, explicitly says there is no other approved live public contract root beyond Gateway v1, and marks retired delivery planes N/A. The present source does not make wider TypeSpec migration a universal unfinished task.  
**Sources:** `docs/research/sdlc/TYPESPEC-CODEGEN-COVERAGE.md:3-7,90-105`; `openspec/config.yaml`; `scripts/sdlc-closure-audit.mjs` TypeSpec/contract authority checks.  
**Limit:** a future approved new public contract can change scope.

**R-12 (GITHUB REMOTE STATUS, OBSERVED):** At the research date, PR #248 `ci(sdlc): complete QG6 with CodeQL and targeted mutation` is **open**, head `ac404c7a8d4685fe9a2aaff9e265c519cbb577eb`, base `codex/sdlc-finalization-2026-11-14@bea113281ef45e36f123e6a700a362db41890590`, not `main`; GitHub reports `mergeable=false` for that stacked branch state. Its own plan documents a CodeQL/SARIF gate and three targeted security mutants. Main's quality-gates catalog still labels G12/QG6 `PARTIAL ACTIVE` (CodeQL/mutation planned), while PR #248 describes its branch as already locally checked. Neither state should be silently substituted for the other.  
**Sources:** https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/248; `docs/plans/2026-11-15-sdlc-qg6-depth.md` **on PR #248 head only**; `docs/research/sdlc/QUALITY-GATES-CATALOG.md:22-38` on `main`.  
**Limit:** no merge, no new head-specific workflow run initiated in this research.

## 5. Existing test and acceptance evidence

| Evidence / check | Source or observed status | What it actually proves | Not established |
|---|---|---|---|
| PR #247 at head `746b97578527e5a5dff6b0a5ede5c267020d35ee` | Previous observed GitHub Actions: all six PR workflows successful, including focused TS, OpenSpec, TypeSpec, security, audit, isolated Go, pinned native Bifröst Go test/build | Structural/process contracts and plugin compiles for that **PR head** | Real coding-agent+LLM provider attempt at the merge commit |
| `scripts/real-projection-e2e.mjs` | CODE inspected; **NOT-RUN in this research**; CI job `real-qdrant` skipped on PR scope | Direct ACE HTTP `/project` + optional real Qdrant/embedding projection, including fixture checks | Bifröst ingress, final external LLM bytes or task outcome; script explicitly says so |
| `test:real-non-ts-lsp` | Scheduled/manual policy; **SKIPPED in PR #247**; NOT-RUN in this research | A real LSP integration run, if executed and retained, can prove its selected cases | Current merged production lifecycle matrix |
| `test:sdlc-closure` / `check:sdlc-closure` | Installed in `verify:pr` / `verify:full`, passed on PR #247 head | Accepted structural/process invariants in source, including corrected request binding and data-class rule | G11, model final bytes, memory Graphiti, benchmark economics |
| Gateway `/record-delivery` | CODE returns `501 PROVIDER_WIRE_NOT_CERTIFIED` | Honest lack of certification in this endpoint | Provider-final-wire attribution |
| Four-arm Harbor gate | CODE inspected, **NOT-RUN here** | Evidence consistency and release-claim policy when supplied with artifacts | A new matched, accepted real-agent paired trial |

## 6. Source index (at `main@35a31dab44ac918036c6ef5cde50373746ad9d22`)

| Current source/range | Role |
|---|---|
| `src/bin/ace-runtime.ts:326-340,980-1137` | Provider flags, Qdrant startup, WorkspaceSync, Gateway policy/composition |
| `src/transport/gateway-projection-http.ts:64-109,129-175` | HTTP supported routes, 501 not-certified, auth and loopback |
| `src/application/gateway-projection-service.ts:83-120,149-227` | Private-source classification, pre-egress policy, code-only transformation and APPLY/BLOCK |
| `integrations/bifrost/ace-connector/plugin/main.go:64-132,213-275,295-356` | Physical request ID, host uncertainty, transport and PreLLM route validation |
| `integrations/bifrost/ace-connector/connector.go:250-349,351-456` | Projection client and permitted additive semantic rewrite |
| `src/application/context-transform-service.ts:115-211` | Code-only retrieval and context readiness/estimate |
| `src/domain/context-assembly.ts:65-66,90-138` | Estimate vs host counter, budgeting and truncation |
| `src/adapters/qdrant-context-provider.ts:870-962,1380-1524,1527-1655` | Workspace reconciliation, optional providers, source freshness and coverage |
| `src/bin/ace-memory.ts:29-49,85-121,206-226` | Archive/outbox composition and not-ready Graphiti |
| `src/adapters/file-memory-archive.ts:15-176`; `src/adapters/file-projection-outbox.ts:29-180` | Persistent original/archive and fenced outbox |
| `src/adapters/vertex-rag.ts:23-111` | Authorized cloud-doc retrieval |
| `scripts/real-projection-e2e.mjs:1-161` | Direct ACE projection, not Bifröst/provider wire |
| `scripts/harbor-four-arm-gate.ts:34-155` | Benchmark evidence/claim gate |
| `openspec/changes/010-gateway-only-ownership/tasks.md:1-16` | Current normative accepted vs unchecked tasks |
| `docs/research/sdlc/TYPESPEC-CODEGEN-COVERAGE.md:90-105` | Stage scope, no unapproved wider wire migration |
| `docs/research/sdlc/QUALITY-GATES-CATALOG.md:22-38` | Current QG6/G12 state in main |

## 7. Contradictions and provenance limits

| Potential conflict | Checked status |
|---|---|
| Old `docs/plans/2026-10-26-retrieval-post-177-execution-plan.md` refers to retired optional-tool/Hermes-native architecture, old Gateway assumptions, and historical outstanding R1/R6 items | Historical baseline only; do **not** carry unchecked old tasks forward as current defects without source inspection. Current runtime shows WorkspaceSync, verified Qdrant publication, and Gateway-only authority. |
| `docs/operations/testing-strategy.md:75-81` still mentions `test:real-provider*`, old standalone tool/container and Graphiti real commands | These names are **document references**, not checked current `package.json` scripts; the current real projection command is `test:real-projection` in `package.json`. This is a factual documentation drift candidate, not proof of a missing runtime implementation. |
| QG6 main catalog says PARTIAL; PR #248 body says ready | Separate revisions and branch states; PR #248 has not merged into main and currently targets a historical stacked branch. |
| Graphiti memory ports/outbox exist, but runtime `ACE_ENABLE_GRAPHITI` throws | Interfaces and archive persist; provider-native graph composition is unavailable in the inspected runtime. |
| Gateway reports source-context `ready` while tokenCountMode can be `character_estimate` | Current contract deliberately separates source completeness from model-exact budget fit. A `ready` result does not certify model tokens or saved cost. |
| Prior PR green check vs current merge SHA | PR #247 checks are exact to head `746b975...`; no production provider/Harbor trial was performed here against `35a31...`. |

## 8. Open factual questions (inputs for subsequent Design, not proposals)

- **Q-01 — G11:** What exact coding-agent runtime, Bifröst binary/config/plugin load order and explicitly authorized LLM provider/model will form the real acceptance environment? Are its final-wire and usage traces observable without exposing private source?
- **Q-02 — External routes:** Which Chat streaming/multimodal/continuation variants are actually issued by the selected coding agent? What does pinned Bifröst send on the final wire for those variants? Does any later mutating custom plugin run after ACE?
- **Q-03 — Host visibility:** Can the selected coding host provide authenticated durable transcript/compaction configuration evidence, or only caller-asserted session headers? What claims must remain G2/additive until then?
- **Q-04 — Retrieval economics:** Which pinned tasks/held-out quality oracle and task-specific evidence requirements are applicable? What are the actual provider usage, retries, latency and artifact digests for native versus ACE?
- **Q-05 — Memory:** Which approved Graphiti/FalkorDB provider-native API and credentials are available locally for derived memory; what exact idempotency/delete/reconcile/crash observations exist on its current source?
- **Q-06 — Docs provider:** Are Vertex project/corpus/credential/policy opt-in present and authorized? Is `freshness: unknown` acceptable for any required documentation source?
- **Q-07 — Retrieval robustness:** Which recent real Qdrant/ast-grep/TS+Rust LSP/cancellation/crash runs are preserved against the **current** deployed runtime rather than historical commits?
- **Q-08 — Open QG6:** What is PR #248's actual diff against current `main` after #247 merged, and what status will its checks report when based on the current source?
- **Q-09 — Contract shape:** Is a new public machine interface approved beyond Gateway v1? Current TypeSpec coverage says no.
- **Q-10 — Deployment scope:** What platform, secrets policy and target release configuration will be used for capability-specific G11/G13 owner acceptance?

## 9. Research completion status

- [x] Read root rules and complete canonical Research procedure and template.
- [x] Inspect current remote main, OpenSpec 010, PR #248 and issue #171.
- [x] Trace four bounded source areas from actual entrypoints and key conditionals.
- [x] Separate code/contract, historical benchmark and real-run evidence.
- [x] Identify current enabled versus unconfigured provider routes.
- [x] Record source file ranges and exact baseline SHA.
- [x] Avoid edits to runtime/design/config; no new architecture proposal.
- [ ] Live coding-agent/Bifröst/external-provider capture — NOT-RUN (no authorized runtime/provider session supplied or observed).
- [ ] New Qdrant/LSP/Graphiti/Vertex/Harbor provider trial — NOT-RUN (Research limited to source/API and retained evidence).
- [ ] Local Git dirty-worktree check — UNKNOWN (GitHub connector remote access, no local clone).
- [ ] Full repo-wide dynamic call graph and exact provider matrix across every historical feature — outside this four-track Research scope; absence must not be inferred.
