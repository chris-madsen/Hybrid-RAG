# Hermes: Complete the ACE Staged SDLC Integration Trial

**Type:** An execution plan for testing the SDLC pipeline itself, **not** a second G11 task tracker. **Status:** planning-only; G02 = `REVIEW_REQUIRED`. G11 product implementation and external provider/agent/Harbor egress are **NOT authorized**. **Executor:** one Hermes agent in an active session.

**Communication and repository language policy:** Communicate with the owner in **Russian**. Write **all content committed or posted to GitHub in English**: Markdown plans/reports, code and test comments, commit messages, PR titles/descriptions/comments, and other repository artifacts. The final conversational report to the owner should be in Russian; if the same report is committed to the repository, its committed version must be in English.

## 1. Project Context and Current State

ACE is a TypeScript + Effect modular monolith using Functional DDD, bounded contexts, pure/immutable domain state, Event Storming, TypeSpec as the source of truth for selected public wire contracts, and Bertrand Meyer's Design by Contract. **Do not redesign ACE from scratch.** Verify the current implementation and the smallest necessary AS-IS → TO-BE architecture delta. Do not duplicate domain owners, services, the Gateway, or benchmark runners.

The pipeline is: Research → existing OpenSpec Requirements → `ace-architecture-design` → owner-controlled G02 decision → `ace-to-tickets` (approximately 1,000 changed handwritten lines, including tests; flexible budget) → `ace-phase-plan` (detailed `phases/<ID>.md`) → one approved Apply phase only with separate authorization → Verify. `ace-stage-handoff` allows **nonblocking stacked Draft PRs during planning stages**, but does not grant automatic G02 approval, merging rights, or provider egress authorization.

Read the following **in full, from the current checkout**: `AGENTS.md`, `docs/operations/staged-sdlc-pipeline.md`, `docs/operations/ai-assisted-sdlc.md`, `.agents/skills/ace-sdlc/SKILL.md`, `.agents/skills/ace-stage-handoff/SKILL.md`, `.agents/skills/ace-architecture-design/SKILL.md`, `.agents/skills/ace-to-tickets/SKILL.md`, `.agents/skills/ace-phase-plan/SKILL.md`, `.agents/skills/domain-modeling/SKILL.md`, `.agents/skills/codebase-design/SKILL.md`, the compatibility overlay, accepted ADR-007/009/012/015/017/019, and OpenSpec changes 002, 010, and 013.

Inspect the **live GitHub state and SHA** of each PR:

- [#259](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/259): the initial skill pipeline infrastructure (previously Draft; verify current state).
- [#260](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/260): source-grounded G11 Research; existing G11 Requirements from merged #255 were reused.
- [#261](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/261): provisional G11 architecture and unresolved G02 decisions.
- [#262](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/262): architecture-informed C01–C10 DAG in canonical `tasks.md`.
- [#263](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/263): phase checker and negative regression tests.
- [#264](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/264): ten linked executable phase briefs and X-stage handoff; **not** G11 product implementation.
- [#265](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/pull/265): this corrective execution plan was merged **into the #264 branch, not directly into `main`**. Confirm current branch ancestry before proceeding.

Do **not** combine this stack with alternative #256 (eight slices) or #258 (ten slices).

**Goal:** Prove that the **actual Hermes Skills runtime** can execute this pipeline, preserve dependencies and versioned inputs, run real checks, and avoid unauthorized G11 implementation.

## 2. Deficiencies in the First Trial: What Was Corrected and What Is Still Missing

### H-01: No Actual Skills Invocation Was Observed (Main Blocker)

Your Research in #260 states that Hermes v2026.9.24 ran from `/media/ilja/DATA/soft/consillium/harness` while the new `.agents/skills` were in another checkout. The active Skills index did not include the project-local skills, and project trust was not confirmed. You **read Markdown files and manually applied the instructions**. This cannot be reported as an actual Skill invocation.

**Required action:** Identify the real Hermes process/TUI root. Start a new session from the correct worktree containing #259 or its descendant. Check the documented `hermes skills list` / `hermes skills trust` commands against the installed version and `--help` before using them. Do not change global trust/configuration without the owner's decision. Obtain a concrete log/trace of **actual invocation** of at least one new ACE Skill, including evidence of handoff to the next stage. If the host only supports reading the Skill text, report `NOT_OBSERVED` and precisely identify the missing invocation mechanism. Reading `SKILL.md` is not sufficient evidence.

### H-02: Inadequate DAG and Acceptance-Criteria Validation

The initial #263 regex silently ignored unknown dependency ID `C100` and checked an acceptance ID's presence **anywhere** in `tasks.md` rather than in its own phase. The checker in #263 has since been extended with generic phase IDs, strict comma-separated DAG dependencies, missing/self/cyclic/duplicate dependency detection, checkbox-to-link parity, **exact AC equality between each phase and its own canonical DAG row**, complete specification scenario coverage, and input fingerprints.

**Required action:** Execute the positive and negative tests in the updated `test/ace-sdlc-pipeline.test.mjs`, then independently reproduce them in a disposable fixture. At minimum: unknown `C100` → BLOCKED; valid alternative `P01` → PASS; malformed `C01; owner G02` → BLOCKED; cycle → BLOCKED; foreign/extra phase AC → BLOCKED even if that AC appears in another task row; uncovered AC → BLOCKED; missing checkbox/link → BLOCKED; changed design/spec → STALE/BLOCKED; symlink → BLOCKED. Record the **actual exit code and source SHA**, not merely a status message.

### H-03: Harbor Architecture Ownership Was Corrected at the Wrong Stage

The original #262 assigned C08–C10 to the historical Codex `harbor-four-arm` path, while #264 switched them to the existing two-arm Hermes feedback loop. The discovery itself was correct, but **changing architectural ownership in stage X without updating stage P** violated stage ownership. The correction was moved into #262; #264 should now contain only its own phase briefs, links, and cross-phase handoff material, without silently changing architectural or planning decisions.

**Required action:** Compare the separate three-dot diffs, actual Git tree blobs, and parent ancestry for #261 → #262 → #263 → #264. Expected changes: #261 only `design.md`; #262 only `tasks.md`; #263 only checker/tests; #264 only ten `phases/C*.md` files plus links/cross-phase handoff in `tasks.md`. Descendants must not revert their corrected parents' design or checker changes. Inspect actual source/runtime and ADR evidence. Do not trust a stale GitHub Files API cache over a fresh commit/tree comparison.

### H-04: The Attempt Model Lost Identity; C02 Had No Proven Retry Safety Boundary

In the original `design.md`, the `Authorized` variant discarded the body/provider/model binding from `Planned`. The updated #261 design proposes one immutable `AttemptBinding` carried through the attempt states, with a requirement for **real atomic consumption/CAS/fencing** for concurrency and restart scenarios. This is still a **proposal**, not an approved wire contract or state store.

In pinned Bifröst, ACE `PreLLMHook` executes above the internal `executeRequestWithRetries` loop. **One incoming Chat request may produce multiple physical callbacks/sends**, even with `MaxRetries=0`, through `extraAttempts`. Rejecting fallback alone does not disable inner retries.

**Required action:** Review C01/C02/C04 and owner-controlled G02 alternatives DEC-G11-01/02/03. Before any live C02 egress, require pinned-runtime **mock proof** that no unauthorized second send is possible, or an owner-approved per-dispatch guard. If that proof is absent, **C02 is BLOCKED**, regardless of separate provider permission. A verified single-dispatch mode is **not** positive G11-009 acceptance for retry-enabled routing. Do not invent a second proxy, new hook, TypeSpec wire shape, or CAS store. Present architecture options to the owner without deciding for them.

### H-05: Stale X-PR Metadata and Untested Parent Drift

The #264 phase files originally said `output X Draft PR not created` and embedded an old worktree SHA after that PR had already been opened. The phase files were corrected to bind immutable design/spec hashes and instruct the reader to resolve the **current mutable PR HEAD from GitHub**. The actual behavior after a parent input change remains untested.

**Required action:** Create only disposable, safe sandbox branches/PRs for the experiment, without rewriting the real G11 requirements. Change a fixture design/spec in the parent; capture the before/after Git blob SHAs. The child must become `STALE` with exit 2, then undergo targeted reconciliation/fingerprint refresh and return to PASS. Verify that the child's three-dot diff contains only its changes. Also simulate a **squash merge into a disposable base branch** and test child restack/retarget. Do not merge or close the real #259–264 PRs. Do not leave unnecessary temporary PRs without a clear report/cleanup decision. If a safe real PR experiment is impossible, report `NOT_RUN` rather than PASS.

### H-06: Hermes Ingress Compatibility Is Not Established

The current `scripts/harbor_hermes_codex_oauth.py` selects `openai-codex`, but a Bifröst endpoint has not been demonstrated. The current ACE Bifröst plugin only supports `/v1/chat/completions`. **Do not assume** that Hermes OAuth Responses requests can silently become Chat Completions. C07's agent route remains **BLOCKED**. Inspect the actual documented protocol/API and give the owner evidence-backed compatible alternatives. Do not bypass Bifröst by connecting the agent directly to the provider, and do not create a second ACE ingress.

## 3. Required Execution Sequence

**S0 — Remote and host preflight.** Recheck Git branches/PR states/HEADs, clean worktrees, and `sdlc:preflight` / `worktree:preflight`. Capture the exact Hermes process path/version, trust policy, pinned OpenSpec 1.17.0, Node/npm, and source SHA. Do not present unverified facts from the earlier Research as current observations. Do not modify `main` or owner branches merely for convenience.

**S1 — Real Skills smoke test.** Run Hermes from the correct project checkout. Confirm discovery/trust and at least one actual invocation. For each of `ace-stage-handoff`, `ace-architecture-design`, `ace-to-tickets`, `ace-phase-plan`, `domain-modeling`, and `codebase-design`, distinguish `DISCOVERED / INVOKED / MANUAL_READ / BLOCKED / NOT_OBSERVED`. If the active host cannot invoke these skills, provide the exact operator steps and a blocker report; do not fabricate a PASS.

**S2 — Phase-plan dry run.** From the latest #264 HEAD:

~~~bash
npm run test:ace-sdlc-pipeline
npm run test:matt-pocock-skill-vendor
npm run test:sdd-prepare
npm run check:ace-phase-plan -- --change 013-gateway-g11-production-acceptance --phase C01 --json
# Repeat separately for C02 through C10, recording each exit code and input SHA.
npm run check:sdd-prepare -- --change 013-gateway-g11-production-acceptance --tier T2 --json
npm run verify:pr
~~~

Every phase should reach `READY_FOR_PHASE_REVIEW` **only in the structural sense**. Broken Git SHAs, AC mappings, checkboxes, and dependencies must fail closed. Run pinned OpenSpec strict validation separately (11 active changes passed historically; do not transfer that result to a new SHA). Actual implementation commands inside phase briefs are **PLANNED/NOT_RUN**, particularly the proposed future `scripts/bifrost-g11-wire-e2e.mjs`; do not invoke a file that does not yet exist.

**S3 — Negative fixture suite.** Perform H-02 and retain `test name | source SHA | exit | observed | expected`, including an independent phase-AC drift test and C100. Do not mutate the canonical G11 change to construct a negative test.

**S4 — Actual stage handoff / STALE / restack test.** Perform H-05 on disposable repository branches. Confirm that the next **planning** stage may open before its parent merges, without granting automatic owner approval; G02 and egress remain hard STOP conditions. If the active host ends after one PR, record that actual continuity boundary and a checkpoint. A Markdown skill alone cannot promise background execution.

**S5 — Semantic architecture review**, with **no implementation**: inspect the exact pinned Bifröst revision, both retry boundaries, C02 single-dispatch proof requirement, C04 owner alternatives, C07 Hermes ingress, C08–C10 actual Hermes feedback ownership, frame/exceptional conditions, TypeSpec owners, and test seams. If a new genuine conflict is found, update the **owning upstream stage first**, then reconcile descendants. Do not silently revise architecture inside phase files.

**S6 — CI and handoff.** Verify every PR at its **latest exact HEAD and tested checkout/merge SHA**. Report ACE verification, OpenSpec structural validation, Security, and Gateway audit separately from QG6/CodeQL. QG6 previously failed with eight HIGH findings in pre-existing files (`node-workspace-port.ts`, Harbor holdout scripts, `gateway-projection-http.ts`, etc.). Do not suppress findings or claim an overall green status. Create a separate scoped security issue/proposal rather than modifying unrelated product files in an SDLC PR.

## 4. Acceptance Matrix — Evidence, Not Declarations

| ID | Required observable evidence |
| --- | --- |
| HTEST-01 | Hermes host is running in the correct checkout; root/trust/skill index recorded |
| HTEST-02 | Actual Skill invocation captured, not merely Markdown reading |
| HTEST-03 | Architecture-first and existing DDD ownership preserved; G02 not bypassed |
| HTEST-04 | DAG accepts P01 and rejects C100, cycles, malformed syntax and unknown IDs |
| HTEST-05 | Exact per-phase AC mapping and complete specification AC coverage; invalid drift rejected |
| HTEST-06 | All G11 C01–C10 plans validated at a single source SHA with actual exits |
| HTEST-07 | C02 no-second-send guard is not replaced by or omitted in favor of `MaxRetries=0` |
| HTEST-08 | PRs #261–264 have correct parents and isolated stage diffs |
| HTEST-09 | Parent spec/design mutation causes real STALE; child validates again after repair |
| HTEST-10 | Sandbox squash/restack/retarget preserves a child-only diff |
| HTEST-11 | One-phase Apply, G02 and provider egress are genuinely blocked without authorization |
| HTEST-12 | CI/CodeQL and skipped tests are accurately bound to concrete SHA values |
| HTEST-13 | Session resume/checkpoint is proven or explicitly `NOT_OBSERVED` |

For each criterion record `PASS / FAIL / PARTIAL / BLOCKED / NOT_RUN`, with an actual log, command, exit code, SHA, and link. Structural `READY_FOR_PHASE_REVIEW` is **not** G02 approval. A mock provider receipt is **not** real final-send/provider proof. Reading a Skill file is **not** invocation. Do not auto-merge, bypass Bifröst, or perform product changes.

## 5. Deliverables for the Owner

Provide one **Russian-language conversational summary to the owner** containing: (1) current Git branches/bases/heads, (2) Skill invocation matrix, (3) results for all ten phase checks, (4) negative fixture matrix, (5) actual sandbox stacked-PR/STALE/rebase observations, (6) unresolved C04/C07 decisions and the C02 prerequisite, (7) CI/QG6 at exact SHAs, (8) minimal bug-fix PRs with causes and retests, (9) remaining owner decisions, and (10) a justified final verdict of `READY_FOR_OWNER_REVIEW / PARTIALLY_VERIFIED / BLOCKED / FAILED`.

**If this summary or any evidence is committed to GitHub, write that repository version entirely in English.** Do not mark the G11 acceptance IDs as completed or run G11 Apply.

**Primary objective:** Demonstrate that the **skill-based SDLC pipeline itself** actually works. The first trial produced useful documents and exposed a checker defect, but did not observe Skill invocation or exercise parent drift. Close those gaps with real evidence, or report a reproducible blocker.
