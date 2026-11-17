---
name: ace-plan-refinement
description: Coordinate independent free-form and skills-led ACE planning candidates, reconcile them by evidence into one canonical OpenSpec plan, and run a bounded final critique.
---

# ACE Plan Refinement — dual-plan semantic synthesis

**Goal:** for material T2 planning, obtain two distinct candidate solutions on **identical, source-pinned inputs**: **A: free-form architecture/implementation planning**, and **B: ACE Skills Pipeline (R → S → A → P → X)**. Compare *the engineering decisions*, synthesize the best evidence-backed **C** in the **one canonical OpenSpec change**, and verify it before G02. Never concatenate Markdown, vote by verbosity, count of phases or estimated LOC, or assume either candidate is right. For T0 do not run dual planning; for T1 use it only if explicitly requested or the risk justifies it.

This skill has **two checkpoints**: **PREPARE after R/S and before B's Architecture**, then **SYNTHESIZE after B's phase briefs (X)**. It is **not** a sixth stage, a second SDLC workflow, a daemon, a parallel-subagent framework or an authorization to implement. The existing single-agent staged Draft PR contract continues to own R/S/A/P/X.

## Authority and common baseline — required for both candidates

1. Read root/scoped AGENTS.md, explicit owner decisions, accepted ADRs, current implementation and tests, relevant OpenSpec proposal and **every** specs/**/spec.md, docs/operations/ai-assisted-sdlc.md and staged-sdlc-pipeline.md, and the ace-sdlc compatibility overlay. Read the full ace-architecture-design, codebase-design, ace-to-tickets, ace-phase-plan and ace-stage-handoff skills for the B and reconciliation route. Upstream code, versions, contracts and licensing are evidence, never invented approvals.
2. Confirm change ID and original stage R/S evidence: one exact source Git HEAD/tree, accepted ADR/owner-decision set, requirement AC IDs, specs tree identity and source checkout cleanliness; identify unapproved design decisions, conflicting active PRs and forbidden egress. Run available read-only sdlc/worktree preflights. Fix SOURCE/REQUIREMENTS drift before comparing anything.
3. Treat an already checked-in design/tasks/phases as **historical/current candidate evidence**, not a known-good answer; both A and B receive the same such baseline if it is applicable. Never alter the shared R/S spec or silently redefine the task to make two proposals agree. Source facts must distinguish AS-IS, proposed TO-BE and tested outcomes.

## PREPARE: two genuinely separate generations

1. **Freeze a neutral input bundle**: task text, constraints, R research facts at exact SHA, S OpenSpec specs/proposal, relevant ADRs, current code pointers, available tests and blockers. Exclude any analysis or conclusion produced by either candidate, synthesis feedback and any proposed plan generated in this run. Record the input SHA and spec fingerprint in the normal X-stage PR/checkpoint (not a new tracker).
2. **A — Free Planning.** Use a **fresh isolated agent context** with the neutral bundle and permitted source access. Do NOT apply ace-architecture-design / ace-to-tickets / ace-phase-plan templates or read candidate B. Still obey root AGENTS.md, accepted ADR/OpenSpec, security, one agent and data policy. Produce a *complete provisional* architecture, proposed phases/DAG, explicit AC coverage, per-phase source/test seams, RED/GREEN, risks, build-vs-reuse alternatives, and STOP/provider/owner gates. A is **not** an approved design or a competing permanent OpenSpec tracker.
3. Freeze A with an exact artifact digest and source/bundle identity **before** B is generated. Keep A only in private/disposable task evidence outside the canonical OpenSpec tracker and B's input view; it must not be committed as a parallel accepted design/task spec. Record its locator and digest in the existing X-stage PR body/checkpoint. Delete the disposable worktree when complete, retaining only permitted redacted evidence.
4. **B — Skills Planning.** Start a **different fresh isolated agent context** with exactly the **same neutral bundle**, no access to A, its critiques, or synthesis decisions. Apply the actual existing R/S artifacts, then ace-architecture-design → ace-to-tickets → ace-phase-plan and the stage-handoff PR/branch/fingerprint rules. Generate the *complete* canonical B design/tasks/all phase briefs provisionally. Freeze B's exact Git blob/tree identities before comparing it with A.
5. **Independence evidence:** record the two session/context identities privately, same shared input/baseline hash, candidate output hashes and whether isolation and no cross-access were actually observed. Never expose raw private context/session IDs or source in a PR. **Two passes in one continuing model context are NOT independent.** No parallel agents/subagents are authorized; perform the two sessions **sequentially**, with only one active coding agent. If the host cannot isolate contexts, record **INDEPENDENCE_NOT_ATTESTED** and do not call the result an independent dual-generation experiment. A single-context alternative review may continue as **PROVISIONAL**, not as proven independent synthesis. No host Skill tool? Follow full skill text and report **Skill invocation: NOT_OBSERVED**, never fabricate a call.
6. **No candidate, no false merge:** if A or B is missing, materially incomplete, based on different ACs/HEAD, or has leaked into the other's input, explicitly mark the relevant defect and do not certify a dual-plan synthesis. A safe, fully identified single-plan review may be used instead, labeled as such; do not manufacture a second plan.

## SYNTHESIZE: semantic merge, not file merge

**First read the entire frozen A and B independently of labels, then critique both** using references/review-checklist.md and references/synthesis-contract.md. Do not edit canonical files until the comparison is complete.

Evaluate both on these **five evidence axes**:

1. **Architecture/feasibility:** existing bounded contexts, Effect/TypeSpec, provider-native hooks, request/attempt trust boundaries, concurrency, security, G02 STOP and placement of feasibility proof before dependent execution.
2. **Reuse and deletion:** current ACE code and maintained/versioned upstream libraries and native mechanisms, exact functions/tests/licenses, duplicate adapters, removal of shadow paths.
3. **Slices and ordering:** each AC assigned to a complete vertical phase, DAG acyclicity, over-serialization, risk gates, independent prework, added+deleted handwritten source/test/other LOC (700–1,200 is a heuristic, not a score).
4. **Executable briefs:** verified vs proposed source/function owners, concrete RED/GREEN assertions/commands, negative exceptions, Meyer require/ensure/invariant/frame/exceptional, rollback/STOP, provider/agent/Harbor oracles and unverified outcomes.
5. **Cross-artifact consistency:** proposals/specs/design/G02 crosswalk/tasks/phases/TypeSpec version/fingerprints, original provider-native behavior and no second task authority.

For **every material difference**, record:
Decision ID | affected ACs | A claim and evidence | B claim and evidence | conflict or complement | chosen A/B/HYBRID/THIRD/UNRESOLVED | why chosen / rejected alternatives | affected owning SDLC stage | verification oracle | G02/owner status.

- A longer plan does not win on length; B does not win merely because skills ran. Both may share a wrong assumption: check real code/upstream and consider **THIRD** or **UNRESOLVED** rather than choosing the lesser error.
- Preserve *compatible* good elements across plans (e.g. B's early feasibility gate and A's precise test/file map). For incompatible proposals pick a single justified architecture, never splice mutually incompatible interfaces. Count of chunks may change; rederive dependencies, AC ownership and estimates rather than renaming files.
- **Evidence-first:** cite actual path:line@SHA or externally pinned upstream version/test; distinguish proven defect, plausible risk and UNKNOWN. A synthesized verdict from the same model is **not an independent human review**.
- An unresolved material source/ADR/G02/provider/permission choice remains **BLOCKED / OWNER_DECISION**. Silence, structural CI and the two candidates' agreement never constitute approval.
- Compare C back to both A and B, including retained, rejected and changed decisions. If no evidence-backed improvement exists, keep B intact and record **NO_CHANGE**; never rewrite for its own sake.

## Apply only through canonical stage owners

The output **C** lives only in the existing OpenSpec change: proposal/specs (when requirements truly change), **design.md**, **one tasks.md**, and linked **phases/<ID>.md**. Do NOT publish A or B as competing final task ledgers, invent issues or introduce a new orchestrator.

- New/changed acceptance requirement → return to ace-sdd-prepare / S; re-run affected downstream stages.
- Material architecture/reuse/interface → ace-architecture-design / A, with proposed ADR and actual G02 decision if required.
- Phase allocation, estimate, dependencies, number of chunks → ace-to-tickets / P.
- Executable step, file/test owner, negative/real-evidence oracle → ace-phase-plan / X.
- If changing upstream S/A/P while stacked Draft PRs are open, edit the **owning stage branch**, mark descendants STALE, restack/retarget and refresh source/input fingerprints; keep every PR stage-only. For merged upstream stages, use a focused branch against current main. Never silently rewrite accepted ADRs or change implementation.
- After synthesis, run **one bounded critique and correction/recheck** of C. Log FIX / OWNER_DECISION / DEFER_WITH_RATIONALE / REJECT_WITH_EVIDENCE in existing PR/checkpoint, not another task tracker. Do not loop indefinitely.

## Validation, evidence and exit

On the **actual C checkout**, run pinned openspec validate --all --strict --no-interactive, applicable npm run check:sdd-prepare -- --change <id> --tier T2 --json, and **npm run check:ace-phase-plan -- --change <id> --phase <ID> --json for every linked phase**, plus scoped tests and npm run verify:pr before PR handoff. Recompute the actual design Git blob and sorted spec SHA-256 in all affected briefs. Run real provider/agent/Harbor checks only when separately approved; mark NOT_RUN instead of inventing results. Structural checks cannot measure semantic quality.

The existing X Draft PR (or focused reconciliation PR) and progress-checkpoint.md-shaped handoff report: **A/B input equality; observed/not-attested context isolation; A/B hashes; decision-by-decision matrix; C canonical hashes and changed AC/phase/DAG/LOC; unresolved conflicts; stage-owner restacks; exact commands/results and tested source SHA; G02, egress and owner status**. Do not commit raw private agent traces or a second ledger.

Exit as **REVIEWABLE_SYNTHESIS** only when both candidates and input/independence evidence are complete, all material decisions are resolved or explicitly owner-gated, C passes the applicable structural checks and no unsafe dependency can proceed. Otherwise **PROVISIONAL / INDEPENDENCE_NOT_ATTESTED / STALE / BLOCKED / SINGLE_PLAN_REVIEW** as appropriate. These are *plan quality statuses only*, never production or G02 approval. Do not auto-merge, implement, claim a live skill invocation without observing it, or imply this prompt automatically starts separate model sessions.
