---
name: ace-plan-refinement
description: Critically improve a completed ACE OpenSpec plan after ace-phase-plan, preserving canonical stage ownership and G02 gates.
---

# ACE Plan Refinement — evidence-first post-X quality pass

**Use after:** `ace-phase-plan` has produced every linked executable brief; before X planning is called reviewable and before implementation. Also use when the owner explicitly requests a critique/refinement of an existing ACE plan. This is **one-agent planning only**: no sixth R/S/A/P/X stage, second task tracker, subagent orchestrator, daemon or hidden background execution. If the host cannot continue, checkpoint and mark NOT_RUN, never claim the skill ran merely because this file exists.

## Authority, preflight, baseline

1. Read root/scoped `AGENTS.md`, current explicit owner decisions, accepted ADR/OpenSpec, `docs/operations/ai-assisted-sdlc.md`, `docs/operations/staged-sdlc-pipeline.md`, and `.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md`. Read the complete `ace-architecture-design`, `codebase-design`, `ace-to-tickets`, `ace-phase-plan` and `ace-stage-handoff` skills. Reuse them rather than invent a new planning algorithm. `code-review` may inform separate Standards/Spec lenses, but its upstream parallel subagent and issue-tracker instructions conflict with ACE's one-agent policy.
2. Pin current remote `main` HEAD, branch/worktree and active stacked PR heads. Confirm no conflicting changes. Inspect current **real** source, tests, provider wiring, pinned upstream versions and accepted decisions (not old plans as implementation facts). Reuse the **existing** `openspec/changes/<id>/` proposal, all `specs/**/spec.md`, `design.md`, `tasks.md` and every linked `phases/<ID>.md`; do not create a competing plan.
3. Snapshot before editing: source SHA, design Git blob, SHA-256 of all sorted spec paths and contents (per `ace-phase-plan` contract), task blob, phase inventory/input fingerprints and current stage parent/head SHA. Run available read-only SDLC and worktree preflights before writes. If input is stale, unsafe, missing or unapproved, record `STALE/BLOCKED`, do not infer readiness.

## Pass 1: critique first, no edits

Independently question the existing solution along **five distinct axes**, using `references/review-checklist.md`:

1. **Architecture/feasibility:** unsupported Bifröst/provider hooks, external obligations, hidden retries or fallback, authority crossing, privacy, TypeSpec/Effect boundaries, owner decisions and blocking technical feasibility tests positioned too late.
2. **Reuse and deletion:** current ACE modules, named upstream code/versions/licenses, provider-native primitives, maintained libraries, duplicate adapters and shadow mechanisms. Require evidence for both reusing or rejecting a candidate; identify superseded paths that must be removed.
3. **Slices and ordering:** acceptance-ID ownership, vertical demonstrability, cyclic/missing/unneeded dependencies, premature implementation, risk-separated gates and forecast added+deleted handwritten source/test/other LOC. ~700–1,200 including tests is a preference, not a quota.
4. **Executable briefs:** actual versus proposed file/function paths, interface seams, expected RED and GREEN assertions/commands, negative cases, require/ensure/invariant/frame/exceptional outcomes, real-provider/agent/Harbor oracles, rollback and STOP.
5. **Cross-artifact consistency:** all OpenSpec scenarios, G02 crosswalk, accepted decisions, design, one canonical `tasks.md` DAG, every `phases/<ID>.md`, TypeSpec ownership, fingerprints and absent/retired routes.

Write findings **in the existing X Draft PR body/checkpoint**, not as a new task ledger. Each finding must include `ID | BLOCKER/MAJOR/MINOR | axis | path:line@SHA (or UNKNOWN) | demonstrated defect versus plausible risk | minimal alternative | affected ACs/phases | owner decision?`. **No evidence means UNKNOWN, not a confirmed defect or PASS.** Do not describe one model's self-review as independent human review.

## Pass 2: compare, route, repair

For each finding evaluate original versus minimal alternative: expected benefit, trade-off, behavior changes and test oracle. Record `FIX / OWNER_DECISION / DEFER_WITH_RATIONALE / REJECT_WITH_EVIDENCE`. Preserve sound parts; **NO_CHANGE** is a valid outcome when the suggested rewrite would not improve quality.

- A changed requirement or AC returns to **`ace-sdd-prepare` / OpenSpec**. Do not alter acceptance merely to make tests green.
- An architectural, provider-feasibility or upstream-reuse correction returns to **`ace-architecture-design`** (and an owner-reviewed ADR/G02 where material). Rerun downstream planning.
- A changed chunk count, blocking edge, priority or LOC forecast returns to **`ace-to-tickets`**, then `ace-phase-plan` for the affected frontier.
- A correction limited to a brief and consistent with governing design returns to **`ace-phase-plan`** for that brief.
- Missing source/upstream/credential/authorization proof or unresolved material owner choice: record `UNKNOWN/BLOCKED`; stop the dependent path, continue only independent planning.

Only modify the **canonical** S/A/P/X artifacts in their owning stage branches. If an upstream S/A/P draft changes, mark descendant PRs **STALE**, restack and refresh exact input Git identities, and keep each stage PR diff stage-only. If already merged, use a new focused branch/PR based on current main. Do not silently rewrite accepted ADRs or G02 decisions. Never create another issue queue, second `tasks.md`, task checkboxes in phase briefs or a postprocessor status file. Allow **one full critique and one correction/recheck**, then stop with honest unresolved findings.

## Verify and report

Re-run pinned `openspec validate --all --strict --no-interactive`, applicable `npm run check:sdd-prepare -- --change <id> --tier T2 --json`, and **`npm run check:ace-phase-plan -- --change <id> --phase <ID> --json` for every linked phase** on the changed checkout; run relevant focused/PR tests. Refresh design Git blob and sorted-specs SHA-256 in affected briefs after any input changes. A structural PASS checks linkage/freshness, **not** semantic correctness, skill invocation or G02.

Report to existing X-stage or focused planning PR and checkpoint: baseline and output HEAD/blob identities, five-axis findings and decisions, before/after AC/phase/DAG/LOC comparison (including NO_CHANGE), actual commands/results and source SHA, blocking owner decisions, G02/egress status and next permitted stage. `REVIEWABLE_REFINEMENT` requires evidence-backed resolution of blockers and passed applicable structural checks; otherwise `PROVISIONAL`, `STALE` or `BLOCKED`. Do not edit product source, authorize provider egress, begin implementation, auto-merge, approve G02, assert real tests without running them or claim automatic skill invocation without observed host evidence.
