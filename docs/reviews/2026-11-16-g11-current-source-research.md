---
title: "G11 current-source research — staged ACE SDLC trial"
date: 2026-11-16
researcher: "Hermes Agent v2026.9.24"
repository: "chris-madsen/Mult-agent-AI-Orchestration"
branch: "codex/ace-sdlc-pipeline-integration-2026-11-16"
git_commit: "bf9907facabeb50c755cf94e272b4966874e24fb"
status: complete
topics:
  - "G11"
  - "Bifröst Gateway"
  - "current-source-research"
  - "staged-sdlc-trial"
---

# Research: G11 current implementation and evidence

## 1. Question and scope

**Original question:** “Восстанови фактическое состояние G11 и его зависимостей.” This research addresses the G11 investigation scope in `docs/docs/current-prompt`: current modules and runtime composition, Bifröst plugin/connector, Gateway transport, existing tests, Harbor evidence, accepted decisions, and overlapping pull requests.

**Boundaries/exclusions:** facts only. No product code, configuration, OpenSpec requirements, provider credentials, real external provider calls, coding-agent egress, paid Harbor run, PR #256/#258 edits, merge, or production acceptance. Existing design/spec/task text is treated as proposal/requirements evidence, not proof of runtime behavior.

**Relevant accepted decisions (context, not proof):** ADR-007 (data policy and fail-closed denial); ADR-009 (quality-first paired Harbor evidence and honest usage/cost); ADR-012 (real runtime/provider acceptance distinct from adapters); ADR-017 `bifrost-unified-llm-gateway` (Bifröst is the sole agent-facing ACE route); ADR-019 (Functional DDD, Effect application shell, TypeSpec for approved public contracts). OpenSpec change 010 is the current Gateway ownership contract; change 013 is the G11 acceptance source.

**Source identity:** `origin/main` was fetched as `e99e81a1a758fbf6be96599dc09c4440fd51f833`; the open Draft PR #259 head was fetched and verified as `bf9907facabeb50c755cf94e272b4966874e24fb`, with merge base `e99e81a1a758fbf6be96599dc09c4440fd51f833`. The isolated task branch is at the exact PR #259 head. Immediately before authoring this report, its worktree was clean at that HEAD.

**Execution limits:** local Hermes is `v2026.9.24`; Node `v24.15.0`; npm `11.12.1`. Hermes documentation says `.agents/skills` are project-local to sessions launched in that checkout and require an explicit `hermes skills trust` decision. The active TUI is rooted in the separate `/media/ilja/DATA/soft/consillium/harness` checkout, not this PR #259 task worktree; `hermes skills list` from the task worktree and the active session skill index did not expose its project skills. No trust setting was changed in `~/.hermes/config.yaml`; no project-local Skill invocation or context/token telemetry was observed. `ace-sdlc` and `ace-sdd-prepare` instructions were applied manually; reading Markdown is not recorded as Skill invocation.

## 2. Summary

- OpenSpec change `013-gateway-g11-production-acceptance` contains four capability specs covering G11-001 through G11-020; strict validation with pinned OpenSpec 1.17.0 passed all 11 active changes. The structural SDD checker reports `READY_FOR_G02_REVIEW`, `G02=REVIEW_REQUIRED`, and owner approval `NOT_VERIFIED_BY_THIS_CHECK`.
- The current production composition is an ACE TypeScript + Effect Gateway projection service behind the pinned Bifröst Go plugin. It authorizes the configured provider before retrieval and rejects unavailable context; health/capabilities still report provider wire `not_certified`, and `/record-delivery` returns 501.
- The Go connector validates a single additive Chat projection and blocks configured fallback/repeated `PreLLMHook` attempts. Pinned Bifröst also has an internal provider retry loop beneath `PreLLMHook`; retry iterations invoke the provider callback without rerunning the ACE hook. This is a source-level gap against per-send authorization when internal retries are enabled; the effective deployed configuration and network-send count are not observed.
- PR #259 is open Draft at `bf9907facabeb50c755cf94e272b4966874e24fb`; PR #256 (8 proposed blocks) and #258 (10 proposed blocks) are also open Drafts against `main`, neither approved as the canonical plan. PR #255, which added G11 requirements to main, is merged.
- At the exact #259 head, focused TypeScript/contracts, targeted mutation, docs links, Gateway-only audit, secret scan and workflow-security checks passed; QG6 `CodeQL JavaScript/TypeScript` failed on eight high-severity findings in paths outside PR #259's changed-file set. Bifröst plugin build, connector, real Qdrant and real non-TS LSP jobs were skipped for this documentation/process PR.

## 3. Findings

### R-001: G11 requirements are canonical and already have stable IDs

**Source identity:** `codex/ace-sdlc-pipeline-integration-2026-11-16@bf9907facabeb50c755cf94e272b4966874e24fb`.

**Where:**
- `openspec/changes/013-gateway-g11-production-acceptance/proposal.md:5-36`
- `openspec/changes/013-gateway-g11-production-acceptance/design.md:21-34,67-96`
- `openspec/changes/013-gateway-g11-production-acceptance/specs/gateway-final-wire/spec.md:5-32`
- `openspec/changes/013-gateway-g11-production-acceptance/specs/gateway-streaming/spec.md:5-32`
- `openspec/changes/013-gateway-g11-production-acceptance/specs/gateway-attempt-reauthorization/spec.md:5-32`
- `openspec/changes/013-gateway-g11-production-acceptance/specs/gateway-real-agent-and-economics/spec.md:5-52`
- `openspec/changes/013-gateway-g11-production-acceptance/tasks.md:1-58`

**Observed behavior/authority:** the four spec files define final-wire (G11-001–004), streaming (G11-005–008), attempt reauthorization (G11-009–012), and real-agent/economics (G11-013–020) scenarios. The existing proposal states planning-only scope and no provider/model selection. The existing design says `G02 status: REVIEW_REQUIRED` and real provider evidence `NOT_RUN` (`design.md:92-96`). The task ledger remains unchecked and explicitly prohibits product implementation absent separate G02/request/egress approvals (`tasks.md:1-3,53-58`).

**Staleness observation:** the G11 design header names `main@7051a9dd0a516781b2a3f45fcc8c8df126b067e9` (`design.md:5-6`), not the current `origin/main` or PR #259 source. This is a historical source identity in the current artifact, not current-source evidence.

**Checks:** `npm exec --yes --package='@fission-ai/openspec@1.17.0' -- openspec validate --all --strict --no-interactive --report full` — exit 0, 11 passed, 0 failed. `npm run check:sdd-prepare -- --change 013-gateway-g11-production-acceptance --tier T2 --json` — exit 0, `READY_FOR_G02_REVIEW`; it explicitly does not verify owner approval.

**Evidence limits:** structural and strict OpenSpec validation establish artifact validity/linkage only. They do not establish design correctness, runtime behavior, G02 signoff, provider egress, agent E2E or benchmark acceptance.

### R-002: ACE runtime composition authorizes Gateway egress before retrieval and fails closed when retrieval is unavailable

**Where:**
- `src/bin/ace-runtime.ts:1090-1137`
- `src/application/gateway-projection-service.ts:95-134,163-228`
- `src/transport/gateway-projection-http.ts:64-109,129-182`
- `test/gateway-runtime-readiness.test.ts:25-117`

**Entry/dataflow:** the runtime builds Gateway policy from `ACE_GATEWAY_EXTERNAL_LLM_OPT_IN` and `ACE_GATEWAY_ALLOWED_LLM_PROVIDERS_JSON`, creates the existing `ContextTransformService` when context dependencies are available, and otherwise composes an explicit `NOT_READY` transform. It starts the loopback Gateway Projection HTTP service with the configured audit sink. The projection service validates the request, checks destination/provider policy and likely secrets, then calls the existing context transform; a non-ready result returns `BLOCK` instead of an unchanged model request.

**HTTP contract observed:** health reports `providerWire: not_certified`; capabilities report `providerWireCertification: not_certified`; `/internal/ace-gateway/v1/record-delivery` returns 501 (`gateway-projection-http.ts:70-92`). The server authenticates POST `/project` using the shared secret and binds only loopback (`gateway-projection-http.ts:142-170`). These are explicit current statuses, not an inference from an adapter declaration.

**Test evidence:** `gateway-runtime-readiness.test.ts` starts the TS Gateway with experimental Qdrant disabled and a `mock` provider allowlist, then verifies readiness and a `BLOCK/NOT_READY` response. It is a local test with mocked/unavailable retrieval, not a Bifröst or real-provider run.

### R-003: Bifröst ingress binding is request-local; current admission is fail-closed for subsequent attempts

**Source identities:** ACE source as above; exact pinned upstream inspected at `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f`.

**Where:**
- ACE `integrations/bifrost/ace-connector/plugin/main.go:72-132,213-275,295-352`
- ACE `integrations/bifrost/ace-connector/connector.go:223-346,352-416`
- ACE `integrations/bifrost/ace-connector/plugin/main_test.go:13-69`
- ACE `test/bifrost-plugin.contracts.test.ts:5-66`
- pinned upstream `core/schemas/plugin.go:241-263,326-340,406-419`
- pinned upstream `transports/bifrost-http/handlers/middlewares.go:759-821`

**Observed behavior:** the plugin handles `/v1/chat/completions`, rejects unsupported `/v1/*` generation routes, requires explicit provider/model and normalized session correlation, mints a fresh physical request ID, projects the request, and applies an allowed single context insertion. `connector.go` validates receipt identity and the semantic body rewrite; the projected model/tools/stream/unknown fields/original messages are protected by the object comparison and one-message insertion checks. `PreLLMHook` checks provider/model/context and rejects any configured fallback; a request-local marker rejects a second attempt rather than reusing the first receipt (`main.go:312-352`).

**Pinned upstream observations:** the exact pinned Bifröst schema documents HTTP transport pre-hook after authentication, registration-order prehooks, `PreLLMHook` for the primary/each fallback attempt, and separate streaming response chunk hooks (`core/schemas/plugin.go:241-263,326-340,359-390`). The pinned HTTP middleware invokes transport prehooks in order and applies the modified request body back to the HTTP context (`middlewares.go:759-821`). The ACE hook code itself does not capture final provider-bound bytes after every later mutator.

**Internal retry boundary observed in pinned upstream:** `handleRequest` invokes `tryRequest` for the primary and for each outer fallback (`core/bifrost.go:5910-5912,5945-5977`). In the non-stream path `tryRequest` runs `RunLLMPreHooks` before queue dispatch (`:6287`); streaming has the corresponding pre-hook path (`:5334`). The provider worker wraps the provider callback in `executeRequestWithRetries` (`:8219-8220,8352-8380`). That loop iterates to `NetworkConfig.MaxRetries + extraAttempts` (`:7114-7129`) and calls its provider callback again for each dispatched iteration (`:7460-7461`). The code grants additional callbacks for certain permanent per-key failures and encrypted-reasoning stripping (`:7651-7663,7674-7688`). These retries occur below the ACE `PreLLMHook`; the hook is not invoked again by the retry loop. The precise mapping from each callback to physical network sends and the effective deployed retry configuration were not observed. This is static source evidence at the pinned Bifröst commit, not a live provider test.

**Tests:** plugin unit tests cover header precedence, generated physical identity and unattested host state. The ACE TypeScript plugin contract test inspects source text. Connector contract tests exercise local request/receipt validation and semantic projection. These do not load the live agent, prove deployed plugin order, observe a real external provider send, or demonstrate a retry/fallback wire.

### R-004: Streaming and final-wire acceptance remain unproven in current source/evidence

**Where:**
- `integrations/bifrost/ace-connector/plugin/main.go:213-275,295-357`
- `integrations/bifrost/ace-connector/README.md:5-21`
- `test/gateway-projection-http.contracts.test.ts:54-74`
- `docs/reviews/2026-10-25-bifrost-gateway-wire-e2e.md:1-16,46-63`

**Observed behavior:** current plugin code has an HTTP request projection and a pre-provider guard; its `PostLLMHook` returns the response/error unchanged. The connector preserves the stream request field as part of its protected JSON object, but no current-code evidence observed here captures final upstream bytes after all Bifröst mutators or validates streaming response chunk order, cancellation, terminal events, midstream errors and usage.

**Retained historical evidence:** the 2026-10-25 report is explicitly a mock-upstream pass for one OpenAI Chat route and names exact Bifröst/plugin artifacts and hashes (`2026-10-25-bifrost-gateway-wire-e2e.md:1-16`). It explicitly excludes external provider, real agent, streaming, retry/fallback and other provider routes (`:58-63`). The current connector README also states that agent E2E was not run and final-wire/retry evidence remains unrun (`integrations/bifrost/ace-connector/README.md:5-21`).

**Test evidence:** local HTTP contracts assert `providerWire=not_certified` and `/record-delivery` 501. The retained 2026-10-25 mock result is not reclassified as current real-provider evidence.

### R-005: Existing Harbor domain and tests measure accounting invariants, not a current accepted G11 trial

**Where:**
- `docs/docs/references/ADR-009-harbor-benchmark.md:20-60`
- `test/evaluation.contracts.test.ts:92-237`
- `benchmarks/reports/harbor-natural-use-blocked-7bb3e02.json:1-26`
- `benchmarks/reports/harbor-ace-paired.md:1-33`
- `openspec/changes/002-harbor-evaluation/specs/agent-benchmarking/spec.md` (current source)

**Observed behavior:** existing ACE evaluation contracts cover frozen suite fingerprints, run transitions, exact/unknown usage, no double-counting of cached/reasoning subsets, retaining failed trials, and evidence rendering. The retained natural-use evidence file is `BLOCKED` and says natural provider correlation and complete cost telemetry were not verified. The paired report is a historical forced-use diagnostic and records negative token/cost savings for its scope; it explicitly disclaims production acceptance.

**Evidence limit:** deterministic Harbor contracts and historical exploratory artifacts are not a valid current real-agent G11 paired trial, frozen holdout, or production acceptance. No paid benchmark or provider request was run in this research.

### R-006: Existing research/design and alternative task plans have distinct source revisions and are not approved G11 implementation plans

**Where:**
- `docs/reviews/2026-11-15-ace-main-sdlc-conformance-review.md:3-8,315-322`
- `docs/reviews/2026-11-11-ace-current-main-architecture-inventory.md:20-39`
- G11 `design.md:5-19`
- current G11 `tasks.md:1-58`

**Observed versions:** the 2026-11-11 architecture inventory is bound to `29c09a79...`; the 2026-11-15 conformance review’s original audit is bound to `6413e7d6...` and its addendum references older main `7f3fc5a...`; current main is `e99e81a...` and PR #259 is `bf9907f...`. These reports remain historical evidence, not current-source research at the present SHA.

**Overlapping PRs (GitHub readback):** PR #255 is merged into `main` (head `c1b7bb1...`). PR #256 is open Draft, base `main`, head `3268285...`, and changes only G11 `tasks.md`; it proposes eight blocks. PR #258 is open Draft, base `main`, head `94369cd...`, and also changes only G11 `tasks.md`; it proposes ten chunks and estimates 7,470 changed handwritten LOC. PR #259 is open Draft, base `main`, head `bf9907f...`. Neither #256 nor #258 is marked as owner-approved canonical decomposition; their own text labels them proposals/candidates.

### R-007: Current source identity and preflight/test evidence are bound to the PR #259 head

**Observed commands and results:**

| Command | Result | Proves | Does not prove |
|---|---|---|---|
| `npm run sdlc:preflight -- --tier T2 --stage research --json` | exit 0; HEAD `bf9907f...`; `REVIEW_REQUIRED` for G02 | local G00 source/dirty/worktree observations | G02, CI or provider acceptance |
| `npm run worktree:preflight -- --task-id ace-sdlc-pipeline-integration-2026-11-16 --json` | `ok:true`, action `create`, base `origin/main` | task identity and clean main-base prerequisites | stacked PR behavior |
| `npm run test:ace-sdlc-pipeline` | 11/11 passed | skill-file integrity/routing and phase checker’s structural/freshness fixtures | live skill invocation, PR stack, G02 or provider behavior |
| `npm run test:matt-pocock-skill-vendor` | 6/6 passed | vendor manifests, references and ACE overlay assertions | live Skill invocation |
| `npm run test:sdd-prepare` | 14/14 passed | SDD structural checker behavior including owner-decision/G02 blockers | actual owner approval |
| `npm run test:sdlc-preflight` | 11/11 passed | local preflight negative/positive fixtures | remote state or provider acceptance |
| `npm run check:sdd-prepare -- --change 013-gateway-g11-production-acceptance --tier T2 --json` | `READY_FOR_G02_REVIEW`, not G02 PASS | structural linkage of current G11 | semantic architecture or owner signoff |
| `npm exec --yes --package='@fission-ai/openspec@1.17.0' -- openspec validate --all --strict --no-interactive --report full` | OpenSpec 1.17.0; 11 passed, 0 failed | strict OpenSpec validation on `bf9907f...` | design correctness or runtime acceptance |
| `GOWORK=off go test ./...` in `integrations/bifrost/ace-connector` | exit 0 | isolated Go connector package tests | plugin compilation against Bifröst or live egress |

The `ace-phase-plan` regression suite includes stale design/spec fingerprint, unlinked phase, unknown AC, missing section, missing exceptional contract, duplicate task checkbox and symlink negatives (`test/ace-sdlc-pipeline.test.mjs:67-145`). The structural checker explicitly returns `g02: NOT_VERIFIED_BY_THIS_CHECK` and `realProvider: NOT_RUN_BY_THIS_CHECK` (`scripts/ace-phase-plan-check.mjs:7-10,110-132`). It does not exercise a live stacked PR or model-host session.

### R-008: QG6 is RED at current PR #259 HEAD; all eight high findings are outside that PR's changed-file set

**Evidence:** PR #259 head `bf9907facabeb50c755cf94e272b4966874e24fb`; GitHub Actions run `43893465305`, job `133390559411` (`CodeQL JavaScript/TypeScript`); exact run log summary verdict `HIGH_SECURITY_FINDINGS`, zero SARIF extraction errors and zero unclassified findings. The QG6 workflow runs CodeQL `security-extended` and fails on SARIF findings with `security-severity >= 7` (`.github/workflows/ace-code-health.yml:39-68`; `scripts/check-codeql-sarif.mjs:87-111`).

| Finding | Severity | Path:line |
|---|---:|---|
| `js/file-system-race` | 7.7 | `scripts/freeze-retrieval-holdout.ts:182` |
| `js/file-system-race` | 7.7 | `scripts/freeze-reranker-holdout.ts:191` |
| `js/file-system-race` | 7.7 | `scripts/reranker-holdout-to-retrieval-holdout.ts:43` |
| `js/file-system-race` | 7.7 | `src/adapters/node-workspace-port.ts:63` |
| `js/file-system-race` | 7.7 | `src/adapters/node-workspace-port.ts:460` |
| `js/file-system-race` | 7.7 | `src/application/ace-runtime-bundle.ts:30` |
| `js/file-system-race` | 7.7 | `src/application/harbor-byte-binding.ts:56` |
| `js/user-controlled-bypass` | 7.8 | `src/transport/gateway-projection-http.ts:144` |

None of those eight paths is in PR #259's changed-file list. This makes them unchanged-path findings relative to PR #259; it does **not** establish that they are false positives, remediated, or acceptable risk. The exact current SARIF job is red. The separate short `CodeQL` workflow check is green; that does not override the failing QG6 SARIF gate.

At the same PR head, GitHub reports focused TypeScript/contracts, targeted critical mutation, docs-links, Gateway-only audit, secret scan, workflow security and affected-check selection as pass. Bifröst plugin build, Bifröst connector, real Qdrant and real non-TS LSP jobs are skipped. No local plugin compile, final-send/provider-wire test, real agent, or Harbor trial was run.

### R-009: Bifröst's internal retry loop is below the ACE `PreLLMHook` gate

**Source identity:** ACE `bf9907facabeb50c755cf94e272b4966874e24fb`; pinned Bifröst `fe7634a6c828927d05ffdd57c62be0aaab04193f`.

**Where:**
- ACE `integrations/bifrost/ace-connector/plugin/main.go:295-352`
- Bifröst `core/bifrost.go:5910-5912,5945-5977,6287,7045-7129,7460-7461,8219-8220,8352-8380`

**Observed call path:** the ACE `PreLLMHook` runs in `tryRequest` before the request is queued (`core/bifrost.go:6287`). In the request worker, Bifröst calls `executeRequestWithRetries`, whose loop invokes its provider callback once for each dispatched retry iteration (`:7129,:7460-7461`); the callback performs the provider handler call (`:8219-8220,:8352-8380`). The source comments state `NetworkConfig.MaxRetries` defaults to zero, but `extraAttempts` are also granted for some permanent per-key failures and encrypted-reasoning stripping (`:7114-7120,:7651-7663,:7674-7688`). Outer provider fallbacks separately call `tryRequest` again (`:5945-5977`), so `PreLLMHook` runs on those outer attempts.

**Observed gap and limits:** the ACE request-local repeated-`PreLLMHook` marker cannot observe an inner retry because the Bifröst retry loop does not re-enter `RunLLMPreHooks`. Therefore the current plugin guard alone does not establish fresh ACE authorization for every Bifröst retry callback. This is a source-level gap relative to G11-009 when the internal retry path is enabled; the effective deployment configuration, mapping from each callback to physical network sends, and whether a specific retry condition occurred are not observed. No external provider request was made.

## 4. Runtime composition

| Entrypoint | Runtime composition/provider | Current evidence | Ambiguity/limit |
|---|---|---|---|
| `src/bin/ace-gateway-http.ts` → `src/bin/ace-runtime.ts` | TypeScript + Effect Gateway projection; existing context-transform service or explicit unavailable transform; configured project policy/provider allowlist | source wiring at `ace-runtime.ts:1090-1137`; local readiness contract test | test uses disabled Qdrant/mock provider and does not prove the complete live composition |
| `src/transport/gateway-projection-http.ts` | loopback HTTP, out-of-band shared-secret auth on `/project`, generated Gateway v1 DTO checks | HTTP contract tests; health/capabilities report `not_certified` | no final-provider delivery recording; `/record-delivery` returns 501 |
| `integrations/bifrost/ace-connector/plugin/main.go` | pinned Bifröst HTTP transport hook + `PreLLMHook`; explicit provider/model, request/receipt/body binding | Go unit/connector tests and source contract test | current PR skips native plugin build; no live ordering or terminal provider-send proof at this source SHA |
| `benchmarks/harbor` + `src/domain/evaluation.ts` / adapters | existing Harbor/evaluation models, frozen suite/run/usage/quality contracts | deterministic tests and historical reports | no valid current G11 real-agent paired/frozen-holdout result observed |

## 5. Exact source index

| File/range | Role | Current SHA verified |
|---|---|---|
| `src/bin/ace-runtime.ts:1090-1137` | provider opt-in, allowlist, context transform and Gateway composition | `bf9907facabeb50c755cf94e272b4966874e24fb` |
| `src/application/gateway-projection-service.ts:95-134,163-228` | egress authorization and projection result | same |
| `src/transport/gateway-projection-http.ts:70-108,129-182` | capability readiness, 501 delivery response, auth and loopback | same |
| `integrations/bifrost/ace-connector/plugin/main.go:213-275,295-357` | route admission, request projection, attempt guard | same |
| `integrations/bifrost/ace-connector/connector.go:223-346,352-416` | local transport/receipt/body semantic validation | same |
| `integrations/bifrost/ace-connector/plugin/main_test.go:13-69` | plugin session/identity unit evidence | same |
| `test/bifrost-plugin.contracts.test.ts:5-66` | static plugin source assertions | same |
| `test/gateway-projection-http.contracts.test.ts:54-127` | HTTP status, loopback and local auth contracts | same |
| `test/gateway-runtime-readiness.test.ts:25-127` | local Gateway unavailable-provider test | same |
| `test/evaluation.contracts.test.ts:92-253` | deterministic Harbor/evaluation accounting | same |
| pinned upstream `core/schemas/plugin.go:241-263,326-390` | hook order and per-attempt/stream hook interface | `maximhq/bifrost@fe7634a6c828927d05ffdd57c62be0aaab04193f` |
| pinned upstream `transports/bifrost-http/handlers/middlewares.go:759-821` | HTTP transport prehook application | same pinned Bifröst commit |

## 6. Contradictions

| Claim A | Claim B | Evidence | Resolution/status |
|---|---|---|---|
| G11 design is a current-source architecture record | Its header records `main@7051a9...`, while current branch is `bf9907...` | `openspec/changes/013.../design.md:5-6`; Git preflight | Source provenance mismatch observed; current code claims above are independently tied to `bf9907...` |
| Hook receipt or connector compilation proves final provider delivery | Gateway health/capabilities say `not_certified`, `/record-delivery` returns 501, upstream permits ordered later mutators | Gateway HTTP code/tests; current pinned Bifröst hook contract; G11-001/002 | Final-wire remains unproven at current source SHA |
| A retry/fallback may reuse initial admission | Current plugin blocks fallbacks and repeated `PreLLMHook`; G11 requires fresh per-attempt authorization | `main.go:312-351`; `gateway-attempt-reauthorization/spec.md:9-31` | Existing behavior is fail-closed; retry/fallback acceptance remains unimplemented/unrun |
| Current CI is wholly green | QG6 custom CodeQL SARIF gate fails at PR #259 head while the separate CodeQL action check passes | GitHub run/check readback and retained job log summary | QG6 RED; separate check does not supersede it |

## 7. Open questions / unobserved behavior

- **Q-01:** No live Hermes Skill-tool invocation or project-skill trust transition was observed in this session. Project skill files were read and applied manually; live invocation remains `NOT_OBSERVED`.
- **Q-02:** No deployed Bifröst plugin order, terminal post-mutator state, final provider-bound request or correlated real provider response was observed at this source SHA.
- **Q-03:** No streaming, cancellation, partial-provider-failure, actual second attempt or fallback send was executed; the user prompt expressly prohibits real provider calls absent separate authorization.
- **Q-04:** No real coding-agent task or valid current paired Harbor/frozen-holdout run was executed; paid benchmark scope was expressly prohibited in this task.
- **Q-05:** Hermes context/token telemetry was not available to this report; context/token efficiency is `NOT_OBSERVED`.
- **Q-06:** QG6's eight current high findings are identified and located, but no remediation/false-positive disposition or rerun was in scope. They remain a failing gate, not a passed baseline.

## 8. Completion check

- [x] Material current-code claims have path:line coordinates and source SHA.
- [x] Runtime wiring is distinguished from provider adapters, unit tests and static source checks.
- [x] Historical PR/review artifacts are source-bound and not promoted to current provider evidence.
- [x] All 20 G11 acceptance IDs are retained in the existing OpenSpec change.
- [x] Tests, OpenSpec, GitHub check states, provider evidence and owner decisions are reported separately.
- [x] No provider egress, paid benchmark, product implementation, merge or owner approval was performed.
- [x] Missing evidence and the exact CodeQL failure are explicit.