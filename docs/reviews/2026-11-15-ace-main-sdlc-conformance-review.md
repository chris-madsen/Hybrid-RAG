# ACE current-main SDLC conformance review — 2026-11-15

**Repository:** [chris-madsen/Mult-agent-AI-Orchestration](https://github.com/chris-madsen/Mult-agent-AI-Orchestration)  
**Audited immutable main SHA:** [6413e7d6e6c483c6d28525151038914ac943874e](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/tree/6413e7d6e6c483c6d28525151038914ac943874e)  
**Target:** Accepted ACE SDLC: PRD/questioning → fact-only Research → Event Storming/functional DDD → OpenSpec/ADR/TypeSpec → G02 Design Consistency → phased RED/GREEN implementation → BUILD/ARCH/SEC/PLAN → capability-specific real provider/agent evidence → Harbor/RAG evaluation and separate release gate.  
**Verdict:** **PARTIALLY CONFORMANT.** Repository architecture, deterministic automation and several integration gates are substantial and real. Historical semantic conformance, current CodeQL security clearance, final Bifröst-provider delivery and complete evaluation/release evidence are **not** demonstrated. It would be false to declare all historical ACE code automatically compliant or production-ready.

> This is a **source and retained-CI-evidence audit**, not a fresh local runtime execution, full line-by-line review of every one of the 892 tracked files, penetration test, or real LLM/provider acceptance. A file, plan, mock or green test proves only its stated scope. The following findings refer to the exact SHA above; re-evaluate after later merges.
>
> The owner's policy explicitly **rejects GitHub branch protection, required status checks and mandatory PR approvals**. This review does not propose imposing them. Non-green gates still require transparent review and remediation under the accepted engineering policy.

## 1. Evidence collected — AS-IS facts

1. Inspected the **complete non-truncated main Git tree** (892 blobs), root \`AGENTS.md\`, \`package.json\`, TypeSpec source/lock/scripts/generated SDK inventory, OpenSpec config and major plans, architecture/SDLC/release/testing/security runbooks, the local agent skill and imported-skill manifest.
2. Inspected all eight active GitHub Actions workflow files: \`ace-contracts.yml\`, \`ace-code-health.yml\`, \`ace-security.yml\`, \`ace-typespec-codegen.yml\`, \`ace-dependency-usage.yml\`, \`ace-openspec.yml\`, \`ace-gateway-only-audit.yml\`, \`ace-gateway-doc-migration.yml\`. Reviewed actual selected TS/Effect, Bifröst Go, adapter, domain, and test code; this **is not** a guarantee of full line-by-line coverage of all modules.
3. Checked up-to-date GitHub Actions for audited SHA: [ACE verification run 43701093838](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/actions/runs/43701093838) **SUCCESS** (real Qdrant, non-TS LSP, TS/Go/plugin jobs), [dependency/advisory run 43705605865](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/actions/runs/43705605865) **SUCCESS** (Knip/OSV configured as reporting), and **[Code health run 43711375461](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/actions/runs/43711375461) FAILURE**, specifically CodeQL's high-severity SARIF gate. Targeted mutation and remote-link signal jobs succeeded.
4. Reviewed [architecture remediation ledger](2026-11-14-ace-architecture-remediation-ledger.md), especially merged #237/#244/#245/#246/#247 versus remaining **G11**. Reviewed \`docs/plans/2026-11-14-sdlc-finalization-g02.md\`, \`docs/plans/2026-11-14-typespec-migration-g02.md\`, and current \`docs/operations/typespec-codegen.md\`.
5. Examined \`src/transport/gateway-projection-http.ts:130-157\` and \`src/adapters/node-workspace-port.ts:48-75,450-480\` around actual CodeQL sites. A scanner finding is not automatically an exploitable security bug; triage must validate the trust boundary.
6. Confirmed no \`ragas\` path, dependency or npm evaluation command in the full current tree/package inventory; no vendored \`grill-me\`/Matt skill directory. Main has the project-owned \`.agents/skills/ace-sdlc/SKILL.md\`, \`ace-typespec-codegen\`, and seven OpenSpec skills.
7. Main at audit was not subject to branch protection; [testing strategy](../operations/testing-strategy.md) records this as an **explicit owner decision**. No open PRs were found during the initial audit. PR #222 was already **merged**, so an earlier “draft PR not merged” narrative is stale.

## 2. Conformance matrix

**Status definitions:** **ACTIVE** = executable source + wired run/CI exists; **PARTIAL** = approved procedure or partial capability without all claimed proof; **NOT INSTALLED** = no implementation in audited main; **DEFERRED** = accepted non-goal; **BLOCKED** = required observed evidence fails or is absent. An automated runner being installed is distinct from observing its pass on the current SHA.

| SDLC concern | Observed repository evidence | Verdict | What remains |
|---|---|---|---|
| Authority / governance | \`AGENTS.md:7-49\`; accepted ADR-019; \`openspec/config.yaml\` | **ACTIVE** | Historical documentation inconsistencies and human source-of-truth review |
| PRD discovery / \`grill-me\` | OpenSpec proposals/specs present; \`MATT-POCOCK-SKILLS.md\` says upstream files **pending import** | **PARTIAL** | Pin/install approved skill, PRD-question→acceptance→OpenSpec trial |
| Fact-only Research | Full \`research_codebase.md\`, \`codebase-researcher.md\`, local \`ace-sdlc\` skill, preflight | **ACTIVE procedure / PARTIAL acceptance** | Observe real agent research + no-solution negative case on current Gateway-only path |
| Event Storming + strategic DDD | \`docs/docs/architecture/01-03-*.md\`, ADR-019, ADT-oriented \`src/domain/\` | **PARTIAL** | Historical decisions/contexts not all re-proven from accepted Event Storming artifacts |
| Functional ADTs, pure core and Effect shell | Domain/application/adapter packages, \`effect@3.22.3\`, seven ast-grep boundary rules | **PARTIAL** | Semantic per-context invariant/transition ownership; syntax rules cannot prove it |
| OpenSpec | Seven native skill files, active change 010, strict pinned OpenSpec workflow and deliberate invalid fixture | **ACTIVE** | Acceptance/implementation traceability for remaining provider gaps |
| ADR decisions | Accepted ADR-019 and accepted Gateway-only owner authority | **ACTIVE** | Reconcile old provider/agent instructions that survive outside archived contexts |
| TypeSpec contract-first | \`typespec/main.tsp\`, pinned TypeSpec 1.17.0 + Hey API 0.99.0, generated OpenAPI/JSON Schema/SDK; generation+drift+compat CI | **ACTIVE for Gateway v1** | Source-of-truth migration only for approved additional wire surfaces; legacy schema/Go DTO compatibility and real routing proof |
| G02 pre-code Design Consistency | \`docs/plans/2026-11-14-{typespec-migration-g02,sdlc-finalization-g02}.md\`; preflight refuses missing T2 crosswalk but never approves human G02 | **ACTIVE procedural / PARTIAL adoption** | Real completed T2 agent trial + human decision evidence |
| Implementation / RED-GREEN / worktree | \`ace-sdlc\` skill, \`sdlc-preflight.mjs\`, worktree lifecycle, \`test:affected\` | **ACTIVE tools / PARTIAL behavior proof** | Actual staged autonomous task evidence, not only source substring audit |
| Deterministic tests / Meyer DbC | \`test/bertrand-contracts.test.ts\`, real contract suite, affected selection self-test, \`verify:pr\`, \`verify:full\` | **ACTIVE** | All 14 DBC production contracts still require scope-specific real evidence |
| Architecture fitness | \`architecture/rules/\`; \`npm run test:arch-rules\`, \`npm run check:arch\` | **ACTIVE REPORT-ONLY** | Confirm false positives, resolve debt; blocking promotion only if owner explicitly authorizes |
| Static docs/security gates | Lychee offline negative/positive; Betterleaks, actionlint, zizmor with pinned binaries; OpenSpec fixtures | **ACTIVE** | Maintain pins; independent CodeQL finding triage remains |
| CodeQL | \`ace-code-health.yml\` + fail-closed SARIF checker | **ACTIVE, CURRENT RED** | Resolve eight high-severity findings or evidence-backed scoped triage; rerun CodeQL |
| Dependency security / Knip | \`knip@6.45.1\`, nightly \`analyze:dependencies\` and OSV | **ACTIVE REPORT-ONLY** | Review findings as debt, not falsely count green report job as no vulnerabilities |
| Mutation quality | Three curated mutations in \`scripts/nightly-targeted-mutation.mjs\` + successful nightly job | **ACTIVE TARGETED** | Optional extension only when a new critical invariant has weak tests; Stryker not mandatory |
| RAG evaluation | Deterministic retrieval quality/holdout scripts, RAG ranking/selection; **no Ragas** | **PARTIAL** | Add reproducible Ragas offline evaluation if approved, without replacing deterministic retrieval or Harbor |
| Real provider acceptance (G11) | Current nightly real Qdrant and non-TS LSP **PASS**; Bifröst plugin compiles | **PARTIAL / GATEWAY EGRESS BLOCKED** | Live Bifröst→Gateway→last PreLLM→final provider proof; selected memory/docs and failures by capability |
| Agent-level Harbor | Harbor tasks, adapters, 3-/4-arm reports and evidence policies | **PARTIAL** | Natural real-agent trials, matched quality/usage/cost at exact source; no 5× claim |
| Local k3s | ADR-008, k3s runner/manifests; older retained K3S-01..09 pass, K3S-10 blocked | **PARTIAL** | Recheck current actual helper containment; do not infer today's production status from October report |
| Release / provenance | Release preflight, SBOM/license/image-digest binding and signed owner gate | **ACTIVE validator / RELEASE NOT APPROVED** | Supply actual evidence and owner-approved exact release SHA |
| Observability | ADR-010 defers full stack; \`provider-trace.ts\` optional JSONL and safe audit/benchmark metrics | **ACCEPTED DEFERRED FULL / MINIMUM PRESENT** | Do not introduce Grafana/OTel as mandatory SDLC compliance |
| \`mise daemons\`, SQL dbcleaner, universal Testcontainers | Owner explicitly rejects mise; ACE is primarily integration/functional code, k3s + lightweight local doubles | **NOT REQUIRED** | Do not introduce redundant orchestration |

## 3. Actionable findings in priority order

### F-01 — P0 / Current CodeQL gate is RED (observed, not speculative)

**Evidence:** [run 43711375461](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/actions/runs/43711375461), CodeQL job 132803454084, \`scripts/check-codeql-sarif.mjs\`: **8** high/critical findings, \`HIGH_SECURITY_FINDINGS\`, exit 1. The SARIF extraction itself succeeded. Other jobs in the same workflow: targeted mutation PASS; scheduled remote links PASS.

The eight findings are **7 × \`js/file-system-race\` (7.7)** and **1 × \`js/user-controlled-bypass\` (7.8)**:
- \`scripts/freeze-retrieval-holdout.ts:182\`: check-then-write of frozen fixture, possible TOCTOU.
- \`scripts/freeze-reranker-holdout.ts:191\`: same frozen-holdout category.
- \`scripts/reranker-holdout-to-retrieval-holdout.ts:43\`: output write after earlier path/state decisions.
- \`src/adapters/node-workspace-port.ts:63\` and \`:460\`: separate metadata/read steps at sensitive source-byte boundary. Some explicit before/after checks already exist; **whether they fully close symlink or replacement races requires review**, not blanket suppression.
- \`src/application/ace-runtime-bundle.ts:30\`: file metadata/read race during runtime artifact digest.
- \`src/application/harbor-byte-binding.ts:56\`: lstat then read at benchmark source-binding boundary.
- \`src/transport/gateway-projection-http.ts:144\`: authorization branch depends on method/URL; it checks POST \`/project\` before a general dispatch. Verify there is **no alternate sensitive route/method or encoded-path ambiguity**. The health/capabilities endpoints may intentionally be unauthenticated; the alert does not itself prove an exploit.

**Fix/acceptance:** triage every finding with entrypoint and attacker control; where real, fix using atomic exclusive creation, fd-based read/stat and appropriately rechecked containment, or centralized route authorization. Add deterministic symlink-swap/race and route/method negative tests. An unavoidable false positive requires narrow reviewed finding-specific justification, **never a broad disabling of security-extended CodeQL**. Rerun the CodeQL job on the repair SHA and retain SARIF. **Do not assert “security gates green” until then.**

### F-02 — P0 for agent/production claims / Bifröst final-wire G11 not certified

**Evidence:** \`src/transport/gateway-projection-http.ts:54-70\` returns \`501 PROVIDER_WIRE_NOT_CERTIFIED\` for \`/record-delivery\`; \`docs/reviews/2026-11-14-ace-architecture-remediation-ledger.md:22-49\` marks final plugin ordering, live final-provider byte capture and real agent/protocol cases NOT-RUN. #247 improved request-bound IDs, exact chosen model/provider and egress authorization **before projection**, but these static Go/TS assertions are not actual external provider proof.

**Fix/acceptance:** controlled real agent → Bifröst post-auth hook → ACE authenticated projection → verified terminal PreLLM order → final outbound provider request/response; capture redacted wire-byte digests, physical request IDs, effective provider/model, policy and APPLY/BLOCK receipt. Exercise provider-swap, retry/fallback, stream and missing-authority paths; preserve fail-closed behavior for unsupported paths. Decide whether record-delivery needs implementation and specify semantics, **not** a fake success. Owner-controlled provider credentials/egress approval required. Until accepted, record G11/agent-E2E **NOT-RUN/BLOCKED**, not production PASS.

### F-03 — P1 / Ragas is missing from the agreed evaluation portfolio

**Evidence:** complete 892-blob tree has **no Ragas source/config/task**, \`package.json\` has no Ragas runner, while retrieval holdout, ranking reports and Harbor exist. No current-file claim is made that Ragas has already evaluated ACE.

**Fix/acceptance:** add **optional, reproducible offline evaluation** job separated from TS runtime (pinned Python dependency/env if chosen). Freeze a public/synthetic multi-repo task set with question, expected source/evidence, retrieved chunks, generation and reference; calculate deterministic Recall@K/MRR/nDCG/source freshness first, then calibrated Ragas context precision/recall, faithfulness, noise sensitivity and response relevancy where reference/answer exists. Log judge model/version/temperature or deterministic configuration, provenance and costs; do not upload private code to a cloud judge without approved data-class opt-in. Repeat on frozen holdout to measure variance; treat judge scoring as advisory/quality-trend until calibrated. Keep **Harbor task success + cost** as independent end-to-end oracle; Ragas is not a replacement for real provider receipt or agent correctness.

### F-04 — P1 / PRD questioning \`grill-me\` and Matt skill set are NOT installed

**Evidence:** \`docs/research/sdlc/MATT-POCOCK-SKILLS.md\` documents selected pinned upstream MIT source and explicitly states that vendoring failed; \`.agents/skills\` has only ACE and OpenSpec skills. No \`grill-me\` skill appears in the tracked main tree. OpenSpec proposal/specs exist, but **a systematic interview→PRD→accepted AC demonstration is not evidenced**.

**Fix/acceptance:** separate reviewable PR for **only needed pinned** Matt skills (\`grill-me\`, \`grill-with-docs\`, \`domain-modeling\`, \`to-spec\`, \`to-tickets\`, \`tdd\`, \`code-review\` as needed), verify exact \`v1.3.2\` files/adjacent references and MIT attribution, preserve existing OpenSpec skills. Introduce a small owner-questioning → PRD/OpenSpec proposal → acceptance-ID example, with bounded/no-repeat question policy. Explicitly prevent upstream \`implement-spec\` multi-agent execution, second spec tracker and unpinned installers. If a minimal ACE-native prompt reproduces the selected skill faithfully and licensing/source rules permit, avoid copying unrelated upstream automation; **do not claim imported skills exist before the file check**.

### F-05 — P1 / Complete functional-DDD historical conformance is NOT proven by structural rules

**Evidence:** ADR-019 establishes Event Storming, readonly ADTs and pure domain functions; domain/application/adapter split exists, and \`architecture/rules\` has seven tested import/IO rules. The current \`check:arch\` is explicitly **warning/report-only**. \`scripts/sdlc-closure-audit.mjs\` checks the existence of known files and literal markers; this proves wired closure evidence, **not that every historical business invariant resides in the correct bounded context**.

**Fix/acceptance:** perform bounded-context-by-context semantic ownership inventory (Gateway Policy, Workspace Truth, Retrieval, Memory, Evaluation). Record commands/events/invariants, \`decide/transition\` owner, imported provider DTO leaks, cross-context assumptions and actual runtime reachability. Fix **only confirmed** dispersed business rules/god-service responsibilities with small RED/GREEN migrations and negative diff, preserving TypeSpec/Effect protocols. Add semantic tests for discovered violations rather than a brittle \`ast-grep\` regex for correctness. Promote a syntax rule from warning only after owner-approved false-positive and current-debt analysis; owner does not want new mandatory merge protection.

### F-06 — P1 / TypeSpec is implemented, but only its approved surface is authoritative

**Evidence:** \`typespec/main.tsp\`, pinned \`typespec/package.json\` and generated files, \`ace-typespec-codegen.yml\` compile, check stale outputs, SDK types, Gateway v1 schema compatibility and negative fixture; generated types are referenced by the actual HTTP adapter. This closes the **real first vertical slice**. \`docs/operations/typespec-codegen.md:35-39\` retains handwritten JSON/Go v1 schema as compatibility baseline and explicitly leaves final delivery unapproved.

**Fix/acceptance:** inventory each **currently active** public Gateway-only protocol/schema owner; migrate only genuinely duplicated wire definitions to TypeSpec behind compatibility/roundtrip tests (missing/null, enum, unknown, errors, auth, mapping completeness). Keep generated routing/SDK/validators where maintained generators support them. Remove hand-written duplicate authority only after every active consumer test passes, with exact deletion trace. Do not resurrect retired optional tool-call or Hermes-native agent delivery merely to expand a generator. Keep pure domain ADTs/authorization decisions outside generated DTOs.

### F-07 — P1 / G02 and single-agent SDLC require one real T2 process demonstration

**Evidence:** \`sdlc-preflight.mjs\` plus \`test/sdlc-preflight.test.mjs\` detect missing plan/G02 and distinguish \`BLOCKED\` / \`REVIEW_REQUIRED\` from PASS; two accepted G02 plans exist. The local runbook is mainly an **operator trial procedure**. Automated preflight intentionally does **not** verify human approval, PR decision quality, or independent review.

**Fix/acceptance:** choose a real bounded T2 change (prefer a noncloud domain/contract fix). Execute full chain with one agent: \`grill-me\` only for unresolved requirements → fact-only source-linked Research → Event Storming (if domain semantics affected) → accepted OpenSpec/ADR/TypeSpec as applicable → G02 acceptance crosswalk + explicit owner decision → phased RED/GREEN → separate BUILD/ARCH/SEC/PLAN findings → actual tests/CI/PR. Keep before/after stage artifacts, exact branch/main/CI SHA and the deliberately failing negative test. Do not count a self-review as independent review. Compare prompt/document overhead and actual useful defects before requiring extra documents for T0/T1.

### F-08 — P1 / Current operational guidance contains misleading retired agent-flow examples

**Evidence:** \`docs/operations/local-agent-sdlc-trial.md:27\` still tells a new agent to research \`ace_context\` registration in retired optional model-invoked tool stdio, while root \`AGENTS.md:9,22,44\` and OpenSpec config declare **Gateway-only**. \`docs/operations/ace-configuration-and-readiness-matrix.md\` includes retired tool/process guidance; \`docs/docs/architecture/06-traceability-and-review.md\` contains historical “Planned” rows later superseded. Historical source is useful but should not be an active task recipe.

**Fix/acceptance:** replace the **active** trial example with current Bifröst → Gateway projection entrypoint (read-only facts, no unsupported external provider claims); classify legacy operational sections as archived with links to current authoritative paths, or move truly historical examples to archived research. Update PRD/architecture traceability using *current* source evidence while keeping old records auditable. Add a focused docs contract/fixture that fails when active runbooks prescribe prohibited agent-facing routes. Do not mass-delete historical review evidence or rewrite retained experiment artifacts.

### F-09 — P1 / k3s isolation and full release readiness remain evidence-dependent

**Evidence:** \`docs/reviews/2026-10-20-w11-w12-k3s-worktree-real.md\` records K3S-01..09 PASS and K3S-10 BLOCKED because an unrelated pod could reach the helper TLS boundary; authorization still rejected it. No newer complete K3S-10 acceptance was established in this audit. \`docs/plans/unified-production-release-preflight.md\` explicitly remains BLOCKED pending DBC 01–14, provider selection, Graphiti/Vertex/K3S, backup/restore, supply chain, Harbor and exact owner approval. Main's nightly Qdrant/LSP PASS does not close these separate external and release obligations.

**Fix/acceptance:** perform safe, site-specific k3s helper containment/NetworkPolicy/firewall validation with owner-selected network details, rerun K3S-10 and bind result to exact source and environment; do not fake reachability denial. Obtain required real Graphiti/Vertex/recovery/backup artifacts and selected providers only when release scope calls for them. Run \`release:preflight\` with actual signed approval/provenance. No automatic production READY based on structural source gates.

### F-10 — P2 / Architecture, dependency and docs quality should reduce overhead, not proliferate tools

**Evidence:** existing architecture rules with negative fixtures, Knip report, OSV report, strict OpenSpec, Lychee links, CodeQL, Betterleaks, actionlint, zizmor and targeted mutation are **already present**. The new CodeQL failure is evidence a real gate is active. Adding duplicate tools by name would be unnecessary.

**Fix/acceptance:** keep Knip/OSV nonblocking as accepted; triage actual findings periodically and remove confirmed dead/duplicate runtime code (not historical artifacts). Consider typed import graph only if an actual type-aware boundary violation evades existing tests; avoid SCIP complexity without evidence. Keep tests minimal, select by affected runtime graph, and use targeted real provider suites only when relevant. No new \`mise daemons\`, SQL cleaner, blanket Testcontainers, whole-project Stryker or full OTel/Grafana by default.

## 4. Testing and observability clarifications

- **Bertrand/Meyer DbC is NOT a test runner.** \`require/ensure/invariant/frame/exception\` specify oracles in the existing unit/contract/integration/provider suites. \`test/bertrand-contracts.test.ts\` contains concrete negative source/policy and byte-exact tests; the production DBC catalog 01–14 requires a stronger observed environment for claims involving provider/agent wiring.
- **Mutation tests already exist.** \`scripts/nightly-targeted-mutation.mjs\` changes the actual policy allowed-data-class lookup, Gateway authorization branch and secret guard in a disposable copy, then runs existing targeted tests; run 43711375461 reported **success** for this job. No generic mutation coverage percentage is claimed. Extend only for newly identified weak source-freshness/completeness guards, not for generated SDK or provider glue.
- **Real infrastructure is not an SDLC stage.** k3s services and namespaces are a test-deployment choice; tiny in-process fakes are sufficient for deterministic failures, and no new orchestration layer is needed.
- **Observability:** ADR-010 intentionally defers a complete metrics/tracing/dashboard/SLO backend. Minimum safe provider trace, request correlation, outcome/error logging and provider-reported usage/cost evidence are still required for affected evaluations. \`src/adapters/provider-trace.ts\` writes optional, explicitly configured JSONL; it is **not** an installed distributed tracing backend. Full OTel/Grafana is not an SDLC defect under the accepted ADR.
- **Ragas versus Harbor:** Ragas (planned offline LLM-judge retrieval/answer-quality analysis) must not be a substitute for deterministic retrieval, authorized source/current digest, provider receipt or Harbor's actual accepted-task success + token/cost reporting. Avoid privacy policy bypass by the judge.
- **CI source SHA:** current main has passing nightly real Qdrant/non-TS LSP and mutation jobs, but a failing CodeQL job. The overall state is **not all-green**. PR checks, schedule checks and release approvals are separate evidence, not one boolean.

## 5. Concrete PR sequence to reach defensible conformance

These are **implementation tasks**, not completed changes. Each PR should contain tests demonstrating the previous deficiency, the smallest repair, actual command results and exact CI-tested SHA; owner makes architecture/egress decisions.

| Order | Proposed PR / scope | Checkable acceptance |
|---|---|---|
| **P0-A** | Investigate/reconcile eight CodeQL findings in files above | Every SARIF alert individually triaged, safe fixes/fixtures or justified narrow disposition; rerun current CodeQL gate **PASS** |
| **P0-B** | Gateway final provider/agent G11 live acceptance | Proven actual provider-bound request, final hook order, authorization, real-agent APPLY/BLOCK and retry/stream behavior where claimed; \`record-delivery\` either correctly specified/implemented or explicit NOT-CERTIFIED |
| **P1-C** | Active documentation truth cleanup | Current Gateway-only research/agent trial and traceability; no active instruction to revive retired context tools |
| **P1-D** | Pinned \`grill-me\`/selected Matt skill import + PRD handoff | Exact tagged upstream files/licenses, local discovery, no duplicate OpenSpec, live PRD→acceptance walkthrough |
| **P1-E** | Real T2 single-agent SDLC trial | Evidence-linked G00/G01/G02, one phase RED/GREEN, separate self-review results, PR/CI and owner acceptance |
| **P1-F** | Context-by-context functional DDD semantic audit | Actual owned ADT/invariant/Effect mapping and per-context regression tests; no class mandate, no wholesale rewrite |
| **P1-G** | TypeSpec remaining active-wire migration | Each selected Gateway-only active schema has one canonical owner, complete mappings, generated drift and old-client compatibility; legacy source removed only when safe |
| **P1-H** | Ragas offline evaluation pilot | Pinned public/synthetic holdout, scored metrics+uncertainty+cost, privacy-guarded judge, repeatable report; existing deterministic and Harbor gates unchanged |
| **P1-I** | Provider/k3s/release evidence renewal | Owner-approved G11/K3S-10/Graphiti/Vertex/Harbor scope, actual SHA-bound outcomes; release preflight only when evidence complete |
| **P0-SEC-A** | Reconcile existing red CodeQL report before adding another SAST | Eight original findings each have threat-model-informed disposition and targeted negative tests; rerun CodeQL on a new SHA; never suppress all high alerts |
| **P1-SEC-B** | Dependabot for actual npm/Go/Python/Actions/Docker manifests | Committed and validated \`.github/dependabot.yml\`, correct directories and owner-reviewed update PR, no auto-merge |
| **P1-SEC-C** | Checkov IaC gate for k3s manifests, Helm rendering and Dockerfile | Pinned offline scanner, intended manifests scanned, deliberately insecure fixture fails and secure fixture passes; PR scope + nightly full report |
| **P1-SEC-D** | ZAP API DAST for **TypeSpec-generated Gateway v1** | Reproducible local disposable Gateway + approved OpenAPI, safe/passive nightly scan, active weekly/on security-relevant Gateway change only in isolated disposable environment; own-auth negative tests |
| **P1-SEC-E** | Release image scan and security evidence binding | Select exactly one image vulnerability scanner after checking existing release tooling; scan built image digest and correlate findings, SBOM, provenance and release SHA |
| **P1-SEC-F** | AI-specific security regression campaign | Explicit denied egress, injected repo content, cross-workspace isolation, secret output, source freshness and fail-closed exceptions covered by DbC/real selected provider tests; scanner PASS alone insufficient |
| **P2-J** | Optional architecture and existing targeted-mutation upkeep | Rule/test improvements driven by observed escapes; Knip/OSV triage; retain the three targeted mutation checks; **no Stryker installation** and no generic new code-analysis platform |

**Readiness declaration rules:**
- “Structural/process SDLC conformance”: may be asserted **only for the explicit installed checks** and their tested SHA; docs and \`check:sdlc-closure\` cannot prove semantic behavior.
- “Security quality gates current PASS”: cannot be asserted while CodeQL run 43711375461 is RED.
- “Full accepted SDLC demonstrated”: requires a real T2 and PRD/Research/Design/Plan/Implement end-to-end evidence trail.
- “ACE provider/agent integration production-ready”: requires G11 real final external provider egress and all applicable selected provider/DbC checks.
- “ACE production-ready”: requires the separate unified release gate and owner approval of exact SHA.
- “ACE achieves 5× savings”: requires frozen paired Harbor accepted-task outcomes; **no such result is established here**.

## 6. Boundaries / deliberate non-recommendations

Do **not** introduce required branch protection or mandatory PR approvals against the owner's accepted choice. Do **not** add \`mise daemons\` beside local k3s, SQL-oriented dbcleaner to a non-relational core, generic rich OO aggregates, an extra AI orchestrator, parallel spec directories, automated Event Sourcing, a second model-invoked ACE route, non-provider-tested “Complete” successes, all-project mutation scanning, or a full observability stack contrary to ADR-010. Do not remove historical artifacts purely because newer architecture made their content obsolete; instead clearly distinguish archives from current operational instructions.

**Final audited conclusion:** ACE is **well advanced in its structural/process SDLC implementation**, and many formerly planned gates are already real. It **does not fully conform to the complete evidence-driven SDLC yet** because CodeQL is failing at the audited commit, the live final provider/agent boundary is unverified, Ragas and pinned questioning skills are absent, functional-DDD/SDLC process adoption is not demonstrated across historical changes, and full release/benchmark gates remain intentionally unfulfilled. Fix observable security/runtime truth first; avoid overengineering the tooling layer.


## 7. Approved DevSecOps extension — 2026-11-15 owner decision (implementation plan, not audit evidence)

**Decision:** Expand the existing ACE SDLC Security and Release quality gates using **Checkov** (IaC), **OWASP ZAP** (DAST against isolated Gateway), **Dependabot** (dependency update PRs), and a **single image vulnerability scanner only if the current release pipeline lacks equivalent coverage**. Keep **CodeQL, Betterleaks, actionlint, zizmor, OSV, existing security/DbC tests, existing targeted mutation script, SBOM/provenance**. **Do not install SonarQube or Stryker.** Do not add another SAST engine simply to accumulate scanners; new tools must address an uncovered threat boundary.

This is a **post-audit approved plan**. The source/CI findings in sections 1–6 are immutable observations about \`main@6413e7d6...\`. At the extension decision, latest observed \`main\` was \`7f3fc5a0a91e48e9d2573f814dfae96d68415577\`; **recheck live HEAD and existing gates before each implementation PR**. The appearance of a tool in this table does **not** mean it has been installed, run or passed.

### 7.1 Security is cross-cutting, not another SDLC step

| SDLC stage | Security work and decisions | Evidence / hard stop |
|---|---|---|
| PRD/\`grill-me\` | Data classification, external provider, public exposure, identity/permissions, failure mode, sensitive data residency, abuse cases and non-goals | Unresolved permission/egress decision goes to human owner |
| Research | Map trust boundaries, actual Gateway routes, HTTP request handling, Bifröst egress, workspace filesystem/provider ports, k3s deployment and existing scanner coverage **AS-IS only** | Source-linked threat inventory at current SHA; no invented controls |
| Event Storming/DDD + design | Map commands/actors/policies to auth/authorization, denied states, immutable ADT error outcomes, replay/side effects; simple STRIDE-like threat review for new external boundary | G02 criterion → owner → threat → contract → negative oracle |
| TypeSpec / API design | Authoritative public schema, exact error/status variants, input limits, runtime decoding, mapping and authorization plan; OpenAPI used by ZAP | Invalid/unknown payloads and denied operations fail closed |
| Implement / TDD | RED tests for unauthorized use, injected input, secret leakage and failure-path handling; Effect send-time policy checks | \`test:affected\`, DbC and relevant focused checks |
| PR gates | Existing SAST/secrets/workflow guards; **Checkov for applicable changed IaC**; Dependabot-generated PRs go through same tests | Actual check status at HEAD; no blanket security waiver |
| Nightly / weekly | Full CodeQL/OSV/Knip evidence; full Checkov and **ZAP safe/passive nightly**, **ZAP active API scan weekly/on relevant Gateway security changes** in disposable environment | Findings report + owner triage, scanned artifact identity/time |
| Release | Secure container config, built image digest vulnerability analysis, SBOM/license/provenance, selected real-provider and API security evidence | Production release not ready while required critical threat or approved gate unresolved |

**Do not** add \`mise daemons\`, Testcontainers as a universal runner, SQL \`dbcleaner\`, systemd services or a second scheduler. Reuse **local k3s for production-like services**, in-process mock/fake servers for small deterministic tests, and the existing GitHub Actions runners. k3s itself is test infrastructure, **not an SDLC stage**.

### 7.2 Exact tool coverage and ownership

| Control | Current status at audited main | Approved implementation/change | Rule for rollout |
|---|---|---|---|
| **SAST / CodeQL** | **ACTIVE; last inspected nightly RED** (F-01) | Keep configured high/critical SARIF gate; triage old 8 separately; prioritize runtime source/route safety and fix/verify | **P0 first**; adding Checkov must not be used to claim CodeQL green |
| **Secret scanning / Betterleaks** | **ACTIVE** PR diff; weekly history report | Retain pinned scanner, redaction and scoped fixture, never send credentials to untrusted network | New confirmed secrets block PR; legacy history tracked with owner |
| **Actions analysis / actionlint + zizmor** | **ACTIVE**, workflow-change scoped | Keep same tools and pinned known-safe action references | Workflow defects remain blocking under current policy |
| **SCA / OSV** | **ACTIVE REPORT-ONLY** nightly and release audit | Retain scanner; compare advisories with **Dependabot** update PRs and existing production npm audit | A green report job is not “zero vulnerabilities”; record findings and expiry |
| **Dependabot** | **NOT INSTALLED** (no \`.github/dependabot.yml\`) | Add weekly grouped **version updates**, keep security advisories/security PRs high priority; cover actual manifests, no auto merge | Bot PR must run normal contract/security/type/codegen tests |
| **IaC / Checkov** | **NOT INSTALLED** | Pin CLI/container digest; scan \`infra/k8s/ace-local/*.yaml\`, rendered Helm output for actual used chart/values, \`Dockerfile.ace\` and relevant Harbor Dockerfiles only when in deployment scope | Valid and intentionally insecure fixtures; scoped PR scan + full nightly; confirmed new dangerous policy failures block after rule calibration |
| **DAST / OWASP ZAP** | **NOT INSTALLED** | \`typespec/generated/openapi.json\` → temporary isolated Gateway. ZAP safe mode at nightly; active API scan separately with approved network/auth policy | Never scan production, user-local host or external LLM providers; no secret/real code in traffic |
| **Image vulnerability scan** | **NOT VERIFIED** as a standalone image-vulnerability gate (SBOM/digest/release checks exist) | First inspect \`release:preflight\` and existing scanner; if absent, pilot **one** pinned Trivy **or** Grype scanning actual built immutable image digest | Reuse existing SBOM/provenance; do not duplicate existing production scanner |
| **AI-specific security/DbC** | **ACTIVE in part** through existing policy/secret/data-class tests | Expand negative cases for prompt-injection text, authorized source identity, cross-workspace, replay/fail-open and final-provider egress | Real result and exact output/no-egress evidence; SAST/DAST cannot certify these invariants |
| **Mutation quality** | **ACTIVE TARGETED** (three curated nightlies) | Preserve \`scripts/nightly-targeted-mutation.mjs\` as-is; extend only if a newly escaped critical policy invariant justifies it | **NO Stryker**, no all-source mutation score mandate |
| **Code quality aggregator** | Not required | **NO SonarQube**; use existing TS/ESLint/Knip/CodeQL/arch rules | No duplicate code-analysis stack |

### 7.3 Proposed PRs and acceptance criteria (new SEC workstream)

#### SEC-00 — reconcile CodeQL P0 first

- **Files of interest:** original F-01 paths and \`scripts/check-codeql-sarif.mjs\`; compare latest changes with original SARIF source SHA before modifying code.
- **RED:** preserve a specifically failing race/symlink and route/method/encoding fixture for every confirmed vulnerability; record why a false positive is not exploitable if triaged out.
- **GREEN:** CodeQL run at repair HEAD, no unresolved confirmed high/critical finding, and all existing source/auth/DbC tests green.
- Do **not** disable the security-extended query set, remove the SARIF gate, or globally suppress rule IDs. Historical scan at \`6413e7d6...\` remains a historical failure even if newer SHA passes.

#### SEC-01 — Dependabot (SCA remediation workflow; P1)

**Commit target:** \`.github/dependabot.yml\`. Inspect supported manifests before writing entries. Initial ecosystems/directories based on the real tree at review:

| ecosystem | directory | rationale |
|---|---|---|
| \`npm\` | \`/\` | ACE TypeScript/Effect \`package-lock.json\` |
| \`npm\` | \`/typespec\` | independent compiler/emitter/SDK generator \`package-lock.json\` |
| \`gomod\` | \`/integrations/bifrost/ace-connector\` | Bifröst Go connector |
| \`github-actions\` | \`/\` | workflow action versions and pins |
| \`docker\` | \`/\` | \`Dockerfile.ace\` base images |
| \`pip\` | \`/\` | existing root \`requirements-*.txt\`; verify supported parsing before enabling |
| \`docker\` | real benchmark Dockerfile directories **only if needed** | avoid a monolithic directory that misses nested build contexts |

- Weekly grouped **nonsecurity patch/minor** updates, small per-ecosystem open-PR limit, no autonomous merge; do not group away or delay urgently required **security** fixes.
- Verify whether repository-level GitHub Dependabot alerts and security updates are enabled; Git-only config cannot certify account settings.
- Do not assume Python requirements with unpinned constraints are fully reproducible; monitor/update but prefer an accepted pinned dependency workflow if necessary.
- **Bad fixture / check:** invalid dependency directory or stale action update must be caught by config validation/PR tests; **good:** one representative bot PR contains expected manifest change, ordinary PR CI and version selection evidence.
- Maintain existing OSV/advisory report and release vulnerability policy; Dependabot opens remediation PRs, it is **not a substitute for a nightly vulnerability scan**.

References: [GitHub Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference), [supported ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-supported-ecosystems-and-repositories).

#### SEC-02 — Checkov IaC gate (P1)

- **Inputs:** Kubernetes YAML in \`infra/k8s/ace-local/\`, rendered Helm manifests using the **actual** \`qdrant-values.yaml\` and corresponding pinned chart/version, \`Dockerfile.ace\`, relevant deployed Harbor images only if in scope. A Helm values file alone is **not** final rendered Kubernetes state.
- **Threats/invariants:** privilege escalation, privileged/root user and added capabilities, hostPath/service-account/RBAC excess, unbounded writable mounts, unsafe image pinning, missing/invalid securityContext and network restrictions. Treat resource/probe recommendations separately from confirmed access/egress vulnerabilities.
- **Tooling:** maintained pinned Checkov release or immutable container digest; avoid optional vendor/cloud reporting or uploading private manifests.
- **RED/GREEN fixture:** synthetic overprivileged Pod must fail on a specifically chosen policy; compliant Pod must pass. Verify the scan actually reads rendered resources, not just the empty chart directory.
- **CI:** PR on changed IaC/Dockerfile/chart inputs (fast, scoped, local), nightly whole deployed configuration (initially report-only with auditable findings). Promote **confirmed new high-risk** policies to blocking after assessing false positives; suppressions only exact rule/resource with reason, owner and expiry.
- **Evidence:** policy ID, manifest and resource location, severity, tool version, original/fully rendered input hash, result artifact tied to SHA, explicit N/A when no changed IaC.
- **No production credentials or live cluster access** are needed to statically scan rendered manifests.

Reference: [Checkov Helm scanner](https://www.checkov.io/7.Scan%20Examples/Helm.html).

#### SEC-03 — OWASP ZAP against the TypeSpec Gateway (P1)

- **Input schema:** \`typespec/generated/openapi.json\` produced by accepted TypeSpec source; preserve exact Gateway v1 contract and use explicit base-url/host override for the **isolated test service**.
- **Target:** temporary **disposable** ACE Gateway and fake/in-process Bifröst/LLM interfaces with synthetic, nonprivate payloads. It may run in an isolated CI container network or a dedicated k3s namespace. Standard GitHub-hosted runners cannot reach a user's local k3s by magic.
- **Nightly:** ZAP **API Scan in safe mode** (\`zap-api-scan.py -t <openapi> -f openapi -S\`) — active scan disabled, passive findings and malformed-response signals only. Store sanitized JSON/HTML/SARIF-compatible output as actual supported by pinned toolchain.
- **Weekly / when a security-sensitive Gateway contract changes:** approved **active API scan**, *without* \`-S\`, against a fresh disposable environment, strict target allowlist and limited time/rate/corpus. Owner explicitly controls activation; no scanning against production or real external LLM/provider URLs.
- **Authentication:** include intentionally authorized and unauthorized synthetic requests using ZAP context/config as appropriate; compare with domain negative tests covering missing/wrong token/scope, method/path variants, invalid JSON/oversized input, unsafe CORS/exposure, unexpected 5xx and information disclosure.
- **Side effects:** do not run active scan against \`/record-delivery\` or other routes capable of irreversible changes unless an explicit safe fixture contract and harmless stub is present; current 501 NOT-CERTIFIED remains distinct from a vulnerability finding. DAST can send repeat/invalid bodies and trigger writes even against “test” APIs.
- **RED/GREEN fixture:** deliberately misconfigured isolated route with no auth should produce the expected test finding; correct secured route and a clean baseline should pass accepted policy. ZAP baseline warnings initially triaged, with confirmed high-severity auth/data exposure blocking before release.
- **Evidence:** scanner image digest/version, source SHA, generated OpenAPI digest, scanned deployment/service identity and readiness, auth mode, permitted target allowlist, report artifact, finding IDs, disposition, cleanup of namespace/fixtures and sanitized logs.

Reference: [OWASP ZAP API Scan](https://www.zaproxy.org/docs/docker/api-scan/). Note: ZAP API Scan normally **actively** attacks API endpoints; \`-S\` is its documented safe/passive mode. Do not accidentally run the active version in the regular nightly job.

#### SEC-04 — image vulnerability/SBOM/provenance connection (P1/release)

- First inspect \`release:preflight\`, supply-chain evidence runbooks and any existing image scanning. SBOM, signature, digest and provenance checks **do not necessarily imply** package vulnerability analysis of the actual final container image.
- If a gap exists, select **exactly one** maintained pinned image scanner (Trivy or Grype), with offline/controlled database freshness handling and a scoped exception policy. Avoid installing both for perceived coverage.
- Test exact immutable built **image digest** (and approved base), not \`latest\`; link image digest, CodeQL/security status, manifest SHA, SBOM, license policy and runtime provenance to one release candidate.
- Deliberately vulnerable synthetic image/package fixture should be detected; benign image should not be marked as containing a critical vulnerability purely due to a stale/unavailable advisory feed.
- Required critical/high findings follow owner-approved release blocking/exception rules, with exploitability and fix availability triage; missing scanner/database produces UNKNOWN/NOT-RUN, never “clean”.

#### SEC-05 — ACE-specific security verification (P1; no extra generic scanner)

Build on **existing** \`test/bertrand-contracts.test.ts\`, \`test/data-class-policy.contracts.test.ts\`, \`test/outbound-secret-guards.contracts.test.ts\` and selected real-provider suites. Add only missing threat-oriented regressions:
- Retrieved malicious README/source text contains forged agent/tool instructions — treat as inert data and do not widen external actions.
- Private source or secret under denied data-class/provider policy — **no token lookup and no outbound request**.
- Cross-workspace/context result contamination; provenance/digest mismatch, stale evidence and forbidden paths.
- Technical provider failure → explicit unavailable/partial, never fabricated empty/complete success.
- Replay, fallback and provider swap must re-check authorization at actual send time; no duplicate paid/external side effects.
- Untrusted path/symlink and HTTP route/path/method edge cases based on SEC-00 alerts.

**Acceptance:** negative tests demonstrate forbidden side effects **never happened**, with selected real Gateway/Bifröst egress proof where required. **CodeQL/Checkov/ZAP PASS is not proof** of these AI-specific contracts. Keep security traces redacted, source digests and provider evidence privacy-safe; do not add full OpenTelemetry/Grafana in contradiction to ADR-010.

### 7.4 Execution and reporting policy

| Trigger | Gate selection | Fail/triage behavior |
|---|---|---|
| **Every PR** | Existing Betterleaks, relevant actionlint/zizmor, current deterministic tests, existing CodeQL policies; **Checkov only for changed IaC** after SEC-02 is installed | New confirmed secret/policy/critical IaC failure blocks; unrelated docs PR does not start k3s or ZAP |
| **Dependabot PR** | Same relevant existing PR checks plus impacted dependency/type/codegen contract tests | No auto-merge, security bump reviewed promptly, no skip because actor is a bot |
| **Nightly** | Existing full CodeQL + OSV reports + curated mutation; new Checkov full and ZAP **safe** against disposable Gateway | Retain reports even when advisory/DAST warnings are not blocking; any tool failure distinct from “no findings” |
| **Weekly / Gateway security change** | ZAP **active** within explicit approved disposable environment; Dependabot version-update schedule separately | Auth/routing high risk triaged; never run active DAST against production |
| **Release** | Selected CodeQL disposition, actual Gateway/DbC/provider boundary results, Checkov rendered deployed config, image digest scan if not already covered, existing SBOM/provenance/license/signature | All release evidence attached to same SHA/image and owner acceptance; no inferred production READY |

**Tool supply chain:** pin tool binaries, container images and GitHub actions to reviewed immutable versions/digests, verify expected hashes where the existing installer pattern applies; avoid \`latest\` in CI. Keep permissions least privileged, no repository write or cloud credentials in scanning jobs unless separately approved. For DAST, an authenticated scan must use disposable synthetic credentials in a segregated network and must not expose a self-hosted runner to untrusted fork PRs.

**Finding state schema:** \`tool | version | gate | HEAD SHA | artifact/manifest/image digest | severity | file/resource/route | evidence | triage: confirmed/false-positive/accepted-risk | owner | expiry | remediation PR | recheck outcome\`. Deduplicate the same vulnerability reported by CodeQL/OSV/image scans; keep its independent evidence links rather than artificially inflating the count.

**Status contract:** \`PASS / FAIL / UNKNOWN / NOT-RUN / N/A\` with exact command, exit and artifact. Report-only scans are **not blocking**, but reported findings still need triage; absence of a CI job does not prove absence of vulnerabilities. Stage owner decisions remain explicit; no required branch protection or mandatory GitHub approval rules are introduced.

### 7.5 Definition of done for the approved extension

1. Existing CodeQL P0 findings are individually triaged and current SHA has a successful applicable run, or any unresolved risk is explicitly documented as blocking the applicable readiness claim.
2. Dependabot configuration is committed, validates against actual manifests, and at least one representative update PR and normal CI route are observed; repository-level alerts/security-update setting is verified.
3. Checkov has a reviewed pinned invocation, real chart render coverage, positive/negative fixture, PR scoped wiring and nightly full wiring, with measured runtime/false positives.
4. ZAP's pinned safe nightly and separately approved active scan run on an isolated Gateway loaded from the generated TypeSpec OpenAPI contract; negative auth fixture and sanitized evidence retained; no real secrets or external production scan.
5. Any extra image scanner is present **only** if existing release checks do not already cover actual image vulnerabilities; a synthetic vulnerable artifact proves detection and release evidence binds the immutable image digest.
6. Existing ACE policy/egress/secret/DbC checks and targeted mutation tests remain active, while **SonarQube and Stryker are absent**; no extra agent orchestrator or full observability stack is introduced.
7. Security report describes the **actual** results at checked HEAD; a documentation-only plan update is never called completed DevSecOps deployment.

**Interview summary once implemented and evidenced:** “ACE runs layered DevSecOps: CodeQL SAST, secret/CI-action checks, OSV + Dependabot dependency maintenance, Checkov IaC scanning, TypeSpec/OpenAPI-driven OWASP ZAP DAST against isolated Gateway, image/SBOM/provenance release gates, plus AI-specific fail-closed/privacy/egress contracts. We scope cheap checks to PRs, heavier tests to scheduled disposable environments, and bind findings to a commit and artifact. Static and dynamic scanners complement rather than replace real provider and DbC evidence.”
