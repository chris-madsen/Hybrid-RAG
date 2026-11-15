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
| **P2-J** | Optional architecture and mutation depth | Rule/test improvements driven by observed escapes; Knip/OSV triage; no blanket new toolchain |

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
