# ACE SDLC full-conformance remediation plan

**Date:** 2026-11-18  
**Baseline inspected:** `main@601e08ae9f0895c84a88d8e55773a867ccae908b`  
**Purpose:** close the remaining gaps between the repository's declared AI-assisted SDLC / quality-gate architecture and the behavior actually enforced by code, tests, CI, provider evidence and the coding-agent workflow.

> This is an execution plan and evidence ledger, not a higher-priority architecture authority. Current explicit owner decisions, Accepted ADRs, applicable OpenSpec capability contracts, repository `AGENTS.md`, current source and verified evidence retain the precedence defined by the repository. Before implementing any phase, refresh `main`, active PRs, OpenSpec state and current CI; do not assume the 2026-11-18 baseline is still current.

---

> **Execution authority / statuses:** This is a proposal, not the canonical task ledger. OpenSpec 013 `tasks.md` owns phase status/acceptance; the final checklist is a read-only criteria index. After PR #282 merges, re-diff current code before repeating codegen, native verification, or v1 removal. No implementation, test, or acceptance result may be imported from an unmerged PR as if it were on main.

## 1. Goal

Bring ACE to a state where the project can truthfully claim that its AI-assisted SDLC is not merely documented but **executed and enforced end to end**:

```text
Idea / owner intent
  -> bounded requirements discovery
  -> fact-only Research
  -> OpenSpec behavioral acceptance
  -> Event Storming / functional DDD architecture
  -> TypeSpec for public/versioned wire contracts
  -> G02 owner-reviewed design gate for material T2 work
  -> automatically sized executable phases
  -> RED / GREEN implementation
  -> BUILD / ARCH / SEC / PLAN review passes
  -> deterministic retrieval / contract / security evidence
  -> real provider and deployment evidence where required
  -> real coding-agent SDLC trial
  -> Harbor quality / usage / cost evidence where required
  -> exact-SHA CI and release provenance
  -> owner/human approval and merge
```

The target is **truthful closure**. A structural check, generated file, mock, local test, old benchmark, old PR or agent statement must never be promoted to a stronger evidence state than it actually proves.

---

## 2. Current baseline

The inspected repository already contains substantial SDLC implementation:

- harness-neutral R/S/A/P/X/I/V entry and resume through `.agents/skills/ace-sdlc/SKILL.md`;
- pinned OpenSpec strict validation;
- pinned Matt Pocock skills with source manifest, SHA-256/Git-blob verification and ACE compatibility overlay;
- `ace-sdd-prepare`, architecture-design, to-tickets, phase-plan, plan-refinement and staged handoff skills;
- T0/T1/T2 routing and read-only SDLC preflight;
- isolated worktree lifecycle controls;
- Event Storming / functional DDD / Effect architecture guidance;
- Meyer DbC contracts and acceptance IDs;
- TypeSpec Gateway v1 generation, SDK, compatibility and drift checks;
- Gateway-only ownership audit;
- Betterleaks, actionlint and zizmor security gates;
- CodeQL high-severity fail-closed SARIF gate;
- targeted critical mutation testing;
- deterministic retrieval/reranker/ablation/holdout evaluation;
- real Qdrant and non-TypeScript LSP jobs;
- k3s, release/provenance and Harbor-related evidence machinery;
- explicit evidence states separating contract, adapter, real-provider, agent-E2E, benchmark and owner approval.

The remaining work is therefore **closure and reconciliation**, not reinvention.

---

## 3. Non-goals

Do not introduce the following merely to make the SDLC look more elaborate:

- a second orchestration framework or mandatory multi-agent implementation process;
- `mise daemons`;
- a database cleaner framework where ACE has no matching persistence need;
- universal Testcontainers as a replacement for the existing test pyramid;
- full-repository mutation testing when targeted high-value mutations give stronger signal/cost;
- mandatory Prometheus/Grafana/OpenTelemetry/Langfuse before the owner reopens ADR-010;
- one microservice per DDD bounded context;
- mutable OO aggregate classes where readonly ADTs and pure functions are clearer;
- a second specification/task tracker beside OpenSpec;
- a legacy generation-protocol fallback or an alternate direct-provider ACE path;
- Ragas as a replacement for deterministic retrieval metrics, real-provider receipts or Harbor task correctness.

---

## 4. Conformance principles

Every phase in this plan must preserve these rules.

### 4.1 Evidence states never collapse

Keep these distinct:

```text
contract-designed
-> adapter-implemented
-> real-provider-tested
-> agent-E2E-tested
-> benchmark-evaluated
-> owner-approved
```

Do not replace them with one `done` flag.

### 4.2 Exact-source evidence

Evidence used to close a gate should identify, where applicable:

- source commit;
- fixture/input digest;
- provider/runtime/model identity;
- command/procedure;
- request/correlation IDs;
- retained artifacts;
- observed result;
- limitations;
- owner decision.

Evidence from one SHA/configuration does not silently transfer to another.

### 4.3 Current code outranks stale status documents

Before declaring a gap or completion:

1. inspect current implementation;
2. inspect runtime composition;
3. inspect tests and CI;
4. inspect retained evidence;
5. only then reconcile plans/OpenSpec/docs.

### 4.4 Fail closed at trust boundaries

Unknown or unavailable provider identity, missing authorization, stale source, secret detection, unsupported protocol, replayed authorization, malformed evidence or unavailable final-send guard must not become implicit success.

---

# 5. Dependency DAG — independent work stays independent

This is **not** a mandatory linear pipeline. Route from the owner's requested stage, reusing current work as specified in `AGENTS.md` and `docs/operations/implementation-entry-resume.md`. Refresh current `main` and PRs **before every node**. A finished step in another PR is not repeated or treated as merged prematurely.

```text
              ┌─ P0-A OpenSpec 013/G02 reconciliation ───────────────────┐
              │                                                        │
main + PRs ───┼─ P0-B deterministic + real-Qdrant fixture checks ──────┤
              │                                                        ├─ G11 C03→C04→C05→C06→C07→C08
              ├─ P0-C CodeQL fixes / exact-source security evidence ────┤     (phase-specific G02
              │                                                        │      + egress/oracle gates)
              ├─ P1-A v2 TypeSpec/runtime contract reconciliation ──────┤
              │                                                        │
              ├─ P1-B real harness R/S/A/P/X/I/V/resume trials (separate)┘
              └─ P2-B OpenSpec/docs status cleanup (independent)

Optional/advisory, not on the acceptance critical path:
  P2-A Ragas (only if owner retains it)   P3 selective advisory quality rules
  P2-C CI evidence/review ergonomics (never required merge checks)
```

**Hard edges are capability-level, not row-order dependencies:** C03 requires current C02 behavior and an actual per-send interception seam; C04 needs C03 authorization before certifying fallback; C05 requires C03/C04 and real provider consent; C06 requires an authorized streaming path; C07 requires working provider + streaming/tool fidelity; C08 requires real agent outcomes. TypeSpec v2 and clean source/contract evidence are required for the specific G11 acceptance claiming them. CodeQL findings must be honestly resolved/triaged for security acceptance, but do **not** force unrelated offline planning or docs to wait. G02 applies to each material implementation decision and cannot be inferred from an old crosswalk. No node may claim a stronger evidence state than was actually observed.

**Owner merge policy is authoritative:** owner may merge any PR at their discretion. This plan must not propose branch protection, required status checks, rulesets or mandatory PR approvals. Inform about failures without blocking the merge via GitHub settings.

---

# 6. P0-A — Reconcile OpenSpec change 013 and G02 with actual `main`

## Problem

The current source contains native Responses implementation such as:

- `typespec/responses-v2.tsp`;
- `src/domain/responses-projection.ts`;
- `src/application/responses-projection-service.ts`;
- `integrations/bifrost/ace-connector/responses.go`;
- runtime composition through `makeResponsesProjectionService(...)`.

At the same time, `openspec/changes/013-gateway-g11-production-acceptance/tasks.md` still shows C01-C08 unchecked and its design records G02 as `REVIEW_REQUIRED`.

That creates an SDLC truth conflict. Either implementation progressed before the required G02 decision, or the canonical ledger is stale. Neither condition may be hidden.

## Required work

1. Refresh current `main` and all open G11/Responses PRs.
2. Map actual reachable source and tests to each change-013 acceptance ID:
   - RESP-001..RESP-008;
   - G11-001..G11-020.
3. For C01 and C02 in particular, determine:
   - what is actually implemented;
   - what deterministic tests exist;
   - which design decisions were owner-approved;
   - what remains merely proposed;
   - whether implementation differs from the approved/proposed design.
4. Re-run the G02 crosswalk against **current source**, not the old planning SHA.
5. Obtain explicit owner review for every material unresolved T2 decision.
6. Update change 013 only after the evidence is reconciled.
7. Mark a phase `[x]` only when its acceptance IDs and required evidence are genuinely complete.
8. If existing merged code violates the final owner-approved G02 design, create explicit remediation phases; do not retroactively label the old implementation approved.

## RED oracle

A reconciliation test/review must fail if:

- a phase is checked while an acceptance ID lacks an oracle/evidence link;
- G02 is called PASS only because `design.md` exists;
- current code is absent from the phase crosswalk;
- an owner decision is still `UNKNOWN`, `BLOCKED` or `REVIEW_REQUIRED`;
- provider evidence is inferred from deterministic/mocked tests.

## Acceptance

- change 013 describes the actual current implementation state;
- C01/C02 status is evidence-based rather than inherited from an old plan;
- G02 owner decision is explicit for any code that requires it;
- no C03+ production/provider claim is made without its own evidence;
- the plan/source fingerprints are refreshed to the accepted current source.

---

# 7. P0-B — Restore a green deterministic and real-Qdrant baseline on current main

## Problem

The scheduled verification for `main@601e08ae9f0895c84a88d8e55773a867ccae908b` failed in two important areas.

### Stale architecture/runtime regression expectation

`test/architecture-regressions.test.ts` expects the old composition shape:

```ts
runGatewayProjectionHttp(makeGatewayProjectionService(...))
```

while current runtime intentionally uses native Responses:

```ts
runGatewayProjectionHttp(makeResponsesProjectionService(...))
```

### Stale v1 readiness / real-projection fixture

`test/gateway-runtime-readiness.test.ts` and `scripts/real-projection-e2e.mjs` still exercise an old Gateway v1 Chat-Completions-shaped route and expect success. The current Responses-only architecture correctly disables that legacy path, producing 503/BLOCK.

The real Qdrant service itself starts successfully; the observed failure is an acceptance-fixture migration problem, not evidence that Qdrant is unavailable.

## Required work

### 7.1 Architecture regression test

Replace implementation-string coupling with the intended invariant:

- runtime composition must use the supported Responses projector;
- no retired Chat projection service is reachable;
- no optional model-tool transport is started;
- Gateway-only ownership remains enforced.

Prefer testing an architectural property over one brittle exact constructor string.

### 7.2 Legacy Chat negative fixture

Keep a deliberate old v1/Chat request and assert:

- explicit unsupported/not-ready/BLOCK status;
- zero provider send;
- no fallback to Chat;
- no silent v1 compatibility path becomes agent-facing again.

### 7.3 Native Responses real projection

Create/update the real projection fixture to use the versioned native Responses v2 route and body.

The real Qdrant E2E should prove:

```text
native Responses request
-> authenticated local Gateway v2 projection
-> real Qdrant + real embedding + structural/semantic providers
-> verified current context selection
-> PREPARED native Responses body
```

It must still state that this is **not final Bifröst/provider-wire certification**.

### 7.4 Readiness semantics

Update readiness tests so they distinguish:

- Gateway process liveness;
- Responses projection readiness;
- retrieval-provider readiness;
- final provider-wire certification.

A reachable Gateway may be healthy while final provider wire remains `not_certified`.

## Required commands/evidence

At minimum:

```bash
npm run verify:full
npm run test:real-projection
npm run test:real-non-ts-lsp
```

and the scheduled workflow on the exact repair SHA.

## Acceptance

- full deterministic suite is green on exact current SHA;
- real Qdrant projection job is green using native Responses;
- old retired legacy generation route is tested as a negative zero-send path;
- evidence does not claim Bifröst/final-provider certification.

---

# 8. P0-C — Close the CodeQL high-severity gate

## Problem

The configured CodeQL `security-extended` gate correctly fails on high/critical findings. The latest inspected failing analysis reported:

- seven `js/file-system-race` findings;
- one `js/user-controlled-bypass` finding.

The SARIF gate itself is working as intended and must not be weakened to obtain green CI.

## Required work

For every finding:

1. identify the exact source path and entry point;
2. establish attacker/user control and actual trust boundary;
3. classify:
   - real vulnerability/race;
   - correctness race with security impact;
   - unreachable/false positive;
4. create a deterministic negative regression where practical;
5. repair real findings;
6. use a narrow finding-specific reviewed justification only when the finding is demonstrably non-exploitable;
7. rerun CodeQL on the exact repaired SHA.

Expected repair patterns may include, where appropriate:

- atomic exclusive creation instead of check-then-write;
- fd-based read/stat or equivalent post-open identity validation;
- canonical containment validation at the operation boundary;
- centralized authorization before sensitive dispatch;
- negative route/method/encoding tests.

Do not disable `security-extended`, lower the threshold or broadly exclude source directories.

## Acceptance

- CodeQL analysis succeeds;
- SARIF gate returns no untriaged security-severity >= 7 findings;
- regression tests exist for real fixed classes where practical;
- any suppression is narrow, documented and reviewer-approved.

---

# 9. P1-A — Complete TypeSpec Responses v2 as real generated contract authority

## Problem

Gateway v1 already has a mature TypeSpec/codegen pipeline. Native Responses v2 currently has `typespec/responses-v2.tsp`, but the repository explicitly states that v2 generation + SDK/validators are not yet certified or wired as the codegen authority.

## Target

Apply the same quality standard to v2 that exists for the maintained v1 generated surface:

```text
responses-v2.tsp
-> generated OpenAPI / JSON Schema
-> generated TypeScript client/server types
-> runtime validator or mechanically checked mapping
-> negative compatibility fixtures
-> generated-drift gate
-> real HTTP contract tests
```

## Required work

1. Decide the canonical emitted artifacts for v2.
2. Pin generator/emitter versions in the isolated TypeSpec toolchain.
3. Generate v2 OpenAPI/JSON Schema.
4. Generate or mechanically derive TS DTO types consumed at the real HTTP boundary.
5. Remove duplicate handwritten public wire types where generated authority replaces them.
6. Add exhaustive adapter/domain mapping checks.
7. Add negative fixtures for:
   - unsupported legacy protocol;
   - unknown/unsupported protocol;
   - missing provider/model/session binding;
   - invalid `store` policy;
   - malformed native item variants;
   - unknown enum values where strict;
   - invalid stream/tool/result linkage;
   - unsupported provider route.
8. Add stale/obsolete generated artifact cleanup and mutation/drift detection equivalent to v1.
9. Update `.github/workflows/ace-typespec-codegen.yml` so v2 is not merely `--no-emit`.
10. Keep frozen v1 files only as explicit compatibility/history artifacts; do not allow them to regain agent-facing authority.

## Acceptance

- TypeSpec v2 is the sole public/versioned schema source for the native Responses projection boundary;
- runtime code consumes generated/mechanically checked types;
- generated drift is CI-blocking;
- v1 and v2 authority is unambiguous;
- no new runtime feature is added to the frozen legacy v1 surface.

---

# 10. P1-B — Prove the AI-assisted SDLC with a real coding-agent trial

## Problem

The repository has extensive static/fixture tests for the SDLC, but `docs/operations/sdlc-e2e-trial.md` truthfully records that the live Hermes R->X trial and harness-neutral stage trials are not yet attested.

Static Markdown correctness is not evidence that a real coding agent follows the workflow.

## Trial 1 — real planning pipeline

Use a disposable, no-provider-egress T2 planning change.

One authorized real agent session should execute:

```text
R -> S -> A -> P -> X
```

Observe real skill/stage invocations for:

- ace-stage-handoff;
- ace-sdd-prepare;
- ace-architecture-design;
- ace-to-tickets;
- ace-phase-plan.

Expected artifacts:

- R: fact-only source research;
- S: proposal/spec requirements;
- A: architecture design;
- P: automatically sized tasks;
- X: executable phase briefs.

Use stacked Draft PRs as currently specified. G02 remains review-required unless the owner actually approves it.

## Trial 2 — direct implementation entry

Prepare an already-approved disposable phase and request implementation directly.

Expected:

- enter I directly;
- reuse existing plan;
- do not regenerate R/S/A/P/X;
- run phase/preflight checks;
- RED/GREEN;
- four reviews;
- one phase PR.

## Trial 3 — negative G02

Use the same shape but leave material T2 G02 `REVIEW_REQUIRED`.

Expected:

```text
I selected
-> BLOCKED_G02
-> zero product source writes
-> no restart at Research
-> no fabricated approval
```

## Trial 4 — resume

Interrupt an unfinished stage, start a fresh session and issue `continue/resume`.

Expected:

- same verified stage;
- same branch/PR;
- input/source hashes rechecked;
- completed non-idempotent actions not replayed;
- stale parent input produces scoped repair/restack, not a fresh duplicate workflow.

## Trial 5 — harness-neutral sample

Where practical, repeat at least one stage-entry/resume check in a second compatible coding harness to prove the repository contract is not secretly Hermes-specific. If unavailable, report NOT_ATTESTED rather than blocking the Hermes acceptance.

## Evidence

Keep private native traces outside the repository when they may contain source/session content. Commit only safe normalized evidence plus independent hashes sufficient for reviewer correlation.

## Acceptance

The repository can demonstrate observed real-agent behavior rather than only tests of instruction files.

---

# 11. P1-C — Complete G11 C03-C08 without weakening fail-closed behavior

This is the major production/agent acceptance frontier. Do not compress it into one PR.

## C03 — Single-use physical send guard

Every physical provider attempt, including retries/fallback attempts, must receive a fresh authorization bound to:

- exact outbound body digest;
- provider;
- model;
- destination;
- physical request/attempt identity;
- policy version/expiry as designed.

Replay/race must fail.

**Hard STOP:** if maintained Bifröst has no trustworthy post-last-mutation physical-send seam, do not invent a second proxy or bypass. Either use a maintainable supported extension or require an owner-reviewed upstream change.

## C04 — Privacy/OAuth/fallback

Certify or block:

- provider-native OAuth path;
- exact effective provider/model/reasoning identity;
- `store:false` on final bytes;
- provider/residency-changing fallback;
- private-source data class authorization;
- secret and policy failure paths.

A fallback is a new egress decision, not reuse of an earlier permit.

## C05 — Real final-wire route

With explicit owner authorization for provider/model/data/budget:

```text
real agent/request
-> Bifröst native Responses route
-> ACE projection
-> final send guard
-> post-last-mutation outbound bytes
-> provider acknowledgement
```

Retain redacted digests and request correlation. A mock terminal receiver does not satisfy this phase.

## C06 — Native streaming/cancellation

Verify:

- native Responses SSE ordering;
- reasoning/function/tool item fidelity;
- completed/failed/incomplete/cancelled outcomes;
- usage accounting;
- disconnect/abort;
- no unauthorized later send after cancellation;
- truthful partial outcome evidence.

## C07 — Real Hermes long loop

Run a real coding-agent multi-turn task through the accepted Responses path:

- reasoning;
- function/tool call;
- tool result;
- additional model turns;
- ACE source context;
- no hidden alternate provider path;
- independently checked task correctness.

## C08 — Harbor quality/economics

Run paired frozen tasks with the same underlying model/provider/reasoning/tool configuration:

- strong unmodified Hermes baseline;
- ACE arm(s);
- full failure denominator;
- exact usage provenance;
- quality gate;
- elapsed time/cost;
- repeated trials where variance matters.

The >=5x token reduction target remains a hypothesis until this phase supplies accepted evidence.

## Acceptance

Only after C03-C08 and owner approval may the repository promote final provider/agent production acceptance beyond `not_certified` / NOT_RUN.

---

# 12. P2-A — Add calibrated Ragas as an offline advisory evaluation layer

## Purpose

Ragas is missing from the current repository. Add it as an **additional offline RAG-quality lens**, not as the correctness authority.

## Architecture

Keep Python isolated at the evaluation/tool boundary.

Suggested shape:

```text
benchmarks/ragas/
  frozen-public-or-synthetic-dataset.*
  README.md

scripts/ragas-eval.py
requirements-ragas.txt   # or another pinned isolated Python manifest
```

Optional npm wrapper:

```json
"eval:ragas": "python3 scripts/ragas-eval.py ..."
```

## Dataset requirements

Each frozen case should retain enough information to evaluate the selected metrics without leaking private source to an unapproved cloud judge:

- task/question;
- source/fixture identity;
- expected source evidence/reference where applicable;
- retrieved chunks/evidence;
- generated answer when evaluating answer metrics;
- reference answer where a metric requires it;
- dataset digest/version.

Prefer public/synthetic data for cloud-judge experiments unless explicit policy opt-in exists.

## Initial metrics

Where supported and calibrated:

- context precision;
- context recall;
- faithfulness;
- response relevancy;
- noise sensitivity.

Continue to compute deterministic retrieval metrics first, including Recall@K/MRR/nDCG/source freshness where applicable.

## Evidence

Record:

- Ragas version;
- judge model/provider/version;
- temperature/deterministic settings;
- dataset digest;
- ACE source SHA;
- metric configuration;
- cost;
- repeated-run variance.

## Rollout

1. local/manual;
2. scheduled nightly advisory;
3. calibrated trend reporting;
4. only then consider any blocking threshold.

Do not make an unstable LLM-judge score a PR blocker prematurely.

## Acceptance

Ragas exists as a reproducible, pinned, provenance-rich evaluation layer and remains clearly separate from deterministic and real-agent acceptance.

---

# 13. P2-B — Remove OpenSpec/documentation status drift

## Problem

The active OpenSpec tree still contains historical capability changes whose task files retain old partial status, while the current integration authority has progressed through later changes. Some documentation also refers to retired architecture/rule counts.

Examples to reconcile include:

- `openspec/README.md` current change map;
- `openspec/config.yaml` current active authority text;
- active changes 001-007 with historical/partial tasks;
- changes 011-013 now relevant to the active SDLC/G11 state;
- `docs/operations/architecture-fitness.md` versus actual `architecture/rules/`.

## Required work

For each old active change:

1. determine which requirement remains current;
2. move durable current capability requirements into canonical specs/current accepted change where appropriate;
3. preserve useful historical evidence;
4. create an explicit current backlog item for any real remaining gap;
5. archive the old change only when it no longer owns active acceptance;
6. do not silently mark old unchecked tasks complete.

Update current maps so an agent sees one unambiguous present-tense authority.

Update architecture-fitness docs from actual rule files, not remembered rule counts.

## Acceptance

- no historical change presents itself as a competing active integration authority;
- current OpenSpec README/config points at the real current change set;
- active unchecked tasks correspond to real current work;
- archived evidence remains available without becoming executable authority.

---

# 14. P2-C — Honest CI visibility without GitHub merge restrictions

**Authoritative owner decision (`AGENTS.md`, 2026-11-12):** no branch protection, rulesets, required status checks or mandatory PR approvals. The owner decides when a PR is merged, including with red or incomplete CI. **Do not configure restrictions, create owner-action tickets for them, or perform a blocked-merge test.**

Use GitHub Actions and review reports strictly as **evidence and advice**:
- collect actual status/conclusion at the exact PR head and tested merge SHA, distinguishing NOT_RUN from PASS;
- show failing/high-severity findings and their likely cause clearly without hiding them or falsely declaring release acceptance;
- keep path-filtered jobs and nightly provider/advisory jobs appropriately scoped; no artificial always-present required aggregate;
- recommend fixes and revalidation, while leaving the merge action fully under owner control.

**Acceptance:** clear per-PR CI visibility and accurate risk reporting; **no change** to owner-controlled GitHub merge behavior.
---

# 15. P3 — Promote mature report-only checks selectively

Do this only after current debt and false positives are understood.

## 15.1 Architecture fitness

Current syntax rules are useful but some remain report-oriented. Candidate rules for future blocking promotion should satisfy:

- deterministic valid/invalid fixtures;
- low false-positive rate;
- actual current code passes;
- representative PR observation;
- owner approval.

Do not encode semantic architecture judgments with brittle regex/AST rules merely to increase the gate count.

Keep semantic ARCH review responsible for:

- misplaced business invariants;
- wrong bounded-context ownership;
- provider DTO leakage;
- accidental second source of truth;
- unnecessary ports/services;
- custom reinvention of maintained upstream behavior.

## 15.2 Dependency/advisory findings

Knip/OSV reporting may remain advisory until debt policy and false-positive/upgrade strategy are explicit.

Promotion should be risk-based, not “all reports must fail CI”.

---

# 16. PRD / requirements-discovery routing refinement

The selected Matt Pocock skills are now present and pinned. Make their ACE usage intent explicit.

Recommended routing:

```text
raw idea / insufficient PRD
  -> grill-me

existing proposal/spec/docs that need challenge
  -> grill-with-docs

material T2 domain ambiguity
  -> domain-modeling / Event Storming

sufficient accepted requirements already exist
  -> skip redundant questioning
```

Preserve the ACE overlay:

- at most three independent decision questions per round;
- at most two rounds per scoped task;
- never repeat an answered question;
- never ask the owner for facts resolvable from source/tools;
- unresolved decisions remain explicit;
- no second tracker;
- no upstream multi-agent implementation orchestration.

Acceptance: one small documented walkthrough proves raw idea -> bounded questioning -> OpenSpec acceptance IDs without redundant interview.

---

# 17. Release / supply-chain closure

The repository already has release/preflight/supply-chain evidence code. Do not create a new release system.

For the first release that claims full SDLC conformance, retain one source-bound release evidence bundle covering:

- exact release commit;
- lockfile/dependency identity;
- build provenance;
- SBOM;
- license review;
- image/base-image digest identity where applicable;
- relevant security-gate results;
- deterministic verification;
- provider/agent evidence state;
- owner release decision.

A signed artifact does not make a mismatched source/SBOM/config valid.

---

# 18. Observability disposition

No new full observability stack is required by this remediation plan.

ADR-010 remains the authority unless the owner explicitly reopens it.

Continue to retain minimum evidence required for diagnosis/benchmarks:

- request/correlation identity;
- provider/model/runtime identity;
- safe auth/policy/degraded events;
- elapsed time;
- token/usage/cost where available;
- benchmark result;
- safe local JSONL/CSV/artifacts.

Do not add Grafana/Prometheus/OTel/Langfuse solely to claim SDLC completion.

---

# 19. Verification matrix

| Area | Required final evidence | Must not be substituted with |
|---|---|---|
| OpenSpec/G02 | current acceptance-ID crosswalk + explicit owner decision | file existence |
| Deterministic CI | green `verify:full` exact SHA | older green run |
| Qdrant | real service + native Responses projection | mock adapter |
| CodeQL | current-SHA clean/triaged SARIF | disabled query or threshold |
| TypeSpec v2 | generated artifacts + drift + runtime mapping | compile-only `--no-emit` |
| SDLC agent flow | observed real agent stage/tool behavior | Markdown unit test |
| Final provider | post-last-mutation real outbound evidence | local/mock terminal |
| Streaming | real native stream terminal/cancel evidence | non-stream fixture |
| Hermes agent E2E | real multi-turn task correctness | provider HTTP success |
| Harbor | matched paired quality + usage/cost evidence | retrieval score alone |
| Ragas | pinned dataset/model/metric provenance | unversioned judge score |
| CI evidence visibility | exact-head outcomes and owner-visible failures | workflow YAML presence or invented required checks |
| Release | exact-SHA supply-chain/owner evidence | generic signed artifact |

---

# 20. Suggested implementation PR sequence

Keep these as separate reviewable PRs unless current source discovery shows a safer smaller split.

### PR-A — G02/OpenSpec reconciliation

Artifacts/status only unless reconciliation discovers a required safety repair.

Exit: truthful C01/C02/G02 state.

### PR-B — Responses-only verification repair

Migrate stale regression/readiness/real-Qdrant fixtures.

Exit: green deterministic + real Qdrant baseline.

### PR-C — CodeQL remediation

Security finding fixes and tests.

Exit: current-SHA CodeQL PASS.

### PR-D — TypeSpec Responses v2 generated authority

Codegen, runtime mapping and drift/negative fixtures.

Exit: v2 generated authority installed.

### PR-E — Live SDLC trial evidence

Disposable test change/evidence and any instruction fixes discovered by actual agent behavior.

Exit: real R/S/A/P/X + I/G02/resume behavior observed.

### PR-F onward — G11 C03-C08

One security/acceptance phase per reviewable slice according to the canonical change-013 phase plan and current G02 decision.

### PR-G — Optional Ragas evaluation (only on owner's request)

Pinned offline evaluation, initially advisory.

### PR-H — OpenSpec/docs cleanup and CI evidence visibility

Archive/sync historical status without deleting unique evidence; document observed CI outcomes without mandatory merge rules.

Do not force this exact PR count if current dependencies make a different small split safer. Preserve phase acceptance IDs and negative diff semantics.

---

# 21. Definition of full SDLC conformance

ACE may be called **fully conformant to the repository's target AI-assisted SDLC** only when the following independently evidenced criteria are met. **This is a view, not a second mutable completion tracker:** statuses and phase checkboxes live solely in canonical OpenSpec 013 `tasks.md` and the corresponding owned acceptance/evidence records. Do not separately tick the list here.

- current OpenSpec/G02 accurately describes the reachable Responses implementation;
- no material T2 implementation is treated as accepted without real G02 owner review;
- current exact-SHA deterministic full verification is green;
- current exact-SHA real Qdrant and required real-provider component checks are green;
- CodeQL high/critical gate is green or narrowly reviewed/triaged with no unowned finding;
- TypeSpec native Responses v2 is generated/runtime-checked authority, not compile-only;
- real coding-agent R/S/A/P/X behavior is observed and evidenced;
- direct I entry, negative G02 block and resume behavior are observed;
- G11 final-send authorization and real provider wire are certified;
- native streaming/cancellation is evidenced;
- real Hermes multi-turn agent loop is evidenced;
- Harbor paired quality/usage/cost evidence exists for the accepted release claim;
- the >=5x token target is claimed only if the measured quality-gated evidence actually supports it;
- optional Ragas work, if requested, is calibrated and advisory, never a prerequisite for full SDLC conformance;
- current OpenSpec/docs have no competing active historical authority;
- exact-head CI checks and unresolved failures are visible to the owner; owner retains unrestricted merge control;
- release provenance is bound to the exact accepted source/configuration;
- deferred observability remains explicitly deferred rather than falsely called missing;
- every unavailable provider/agent/benchmark state is reported as NOT_RUN/BLOCKED/UNKNOWN rather than PASS.

---

# 22. Final expected architecture of evidence

```text
Owner intent
   |
   v
R: current-source research --------------+
   |                                     |
S: OpenSpec requirements / ACs           |
   |                                     |
A: Event Storming + functional DDD       |
   |                                     |
   +--> TypeSpec public wire contracts   |
   |                                     |
P/X: tasks + executable phase briefs     |
   |                                     |
G02 owner decision ----------------------+
   |
I: RED -> GREEN
   |
   +--> BUILD
   +--> ARCH
   +--> SEC
   +--> PLAN
   |
   +--> deterministic CI
   +--> generated-contract drift
   +--> CodeQL/security
   +--> real local providers
   |
   +--> Bifröst final-send / real provider
   +--> streaming/cancellation
   +--> real Hermes loop
   +--> Harbor paired evaluation
   +--> Ragas advisory quality trend
   |
V: exact-SHA evidence reconciliation
   |
owner-controlled merge (CI results advisory)
   |
release provenance
```

The key closure criterion is not the number of tools or gates. It is that **each claim has the right-strength evidence, the coding agent actually follows the process, current source and canonical status agree, and missing or failed evidence is reported transparently without restricting the owner's merge decision**.
