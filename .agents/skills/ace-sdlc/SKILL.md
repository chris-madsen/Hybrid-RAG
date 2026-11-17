---
name: ace-sdlc
description: Apply ACE's existing single-agent, client-neutral Research → Design → Plan → Implement workflow, G02 owner decisions and evidence-backed quality gates. Use before investigating, planning, modifying or reviewing ACE code; never run a second orchestration framework.
---

# ACE SDLC — thin local agent entrypoint

This skill **routes to canonical ACE instructions**. It does not replace root `AGENTS.md`, accepted ADR/OpenSpec, the SDLC command files, or the existing worktree lifecycle skill. Before invoking any vendored Matt Pocock skill, read [the ACE compatibility overlay](references/matt-pocock-compatibility.md); upstream skill text is subordinate to that overlay and the repository authorities. File presence proves repository discovery, not live agent behavior.

1. Read repository-root `AGENTS.md` and scoped `AGENTS.md`; current explicit owner decisions, accepted ADR/OpenSpec and current source retain their prescribed authority.
2. Read `docs/operations/ai-assisted-sdlc.md` and choose **T0/T1/T2 by risk**, not diff size. Read `docs/research/sdlc/PROMPTS-ACE.md` and the matching **complete** `source/commands/*.md` file.
3. Run the **read-only** preflight with an explicit stage and tier:

   ```bash
   npm run sdlc:preflight -- --tier T1 --stage research --json
   ```

   `READY_FOR_AGENT` means only that local preflight has no blockers; it is **not** G02, CI, provider or production acceptance. `REVIEW_REQUIRED` means unresolved human/agent decisions. `BLOCKED` means stop and repair the stated condition.
4. Before branch/worktree mutation use the existing `npm run worktree:preflight -- --task-id <id> --json` and `worktree:start` commands. Reuse existing task branch/PR. Never develop on `main` or discard unrelated edits.
5. **Research:** fact-only runtime tracing at exact SHA, real vs fake evidence clearly separated. **Requirements:** use scoped `ace-sdd-prepare` / `to-spec` and OpenSpec. **Architecture BEFORE slicing:** read and apply **`.agents/skills/ace-architecture-design/SKILL.md`** for AS-IS reuse, Event Storming, bounded contexts, functional ADTs/FSM only when needed, pure transitions, Effect boundaries, TypeSpec public wire and Meyer DbC. **Plan:** for material T2 work, use **`.agents/skills/ace-plan-refinement/SKILL.md`** twice: PREPARE a source-identical free-form candidate after R/S (in a separate fresh context), run the normal `.agents/skills/ace-architecture-design/SKILL.md` → `.agents/skills/ace-to-tickets/SKILL.md` → `.agents/skills/ace-phase-plan/SKILL.md` candidate in a different fresh context, then SYNTHESIZE their substantive decisions after X into one canonical plan. T0 skips this; T1 uses it only if warranted or requested. Preserve ~1,000-line forecast and all G02 gates. No routine granularity questions or parallel spec trackers.
6. **Before T2 implementation:** perform G02 design consistency and retain accepted owner decisions in the canonical plan. A preflight result or the mere existence of a crosswalk file **cannot approve** G02. For code-stage preflight provide `--task-id`, `--plan`, and `--g02` as applicable.
7. **Implement:** one approved phase, smallest change, RED before GREEN where practical, then separate BUILD, ARCH, SEC and PLAN reviews. Run `npm run test:affected` while editing and the bounded `npm run verify:pr` once for handoff. Use `npm run verify:full` only for explicit nightly/manual full verification. Run relevant actual provider/agent E2E separately; mocks cannot satisfy it.
8. Use **`.agents/skills/ace-stage-handoff/SKILL.md`** for review-overlap planning: a Draft PR per completed R/S/A/P/X stage; downstream branches/PRs **stack on the preceding stage branch**, never conflicting direct-to-main PRs. Record input artifact hashes, source branch HEAD and actual CI-tested checkout SHA separately. No automatic merge or owner approval; G02 and egress remain hard gates before dependent implementation.
9. Before context handoff fill `docs/research/sdlc/source/templates/progress-checkpoint.md` and re-read live Git/source on resume.

## Staged pipeline route

For requests to run the complete staged SDLC or prepare architecture/phase plans across reviews, read and follow **`.agents/skills/ace-stage-handoff/SKILL.md`** and **`docs/operations/staged-sdlc-pipeline.md`** in full. The normal T2 planning order is verified Research → Requirements OpenSpec → **`ace-plan-refinement` PREPARE** (private free-form A on the same R/S/source input) → independent Skills B: **`ace-architecture-design`** → `ace-to-tickets` → **`ace-phase-plan`** → **`ace-plan-refinement` SYNTHESIZE** (decision-level A/B comparison and canonical C) → G02 owner review → one separately approved Implement slice → cross-phase Verify. Planning may remain provisional across Draft PRs; T2 implementation cannot proceed without G02. A/B runs are sequential and must use fresh isolated contexts for a genuine independence claim. Planning may progress provisionally across Draft PRs before G02; **T2 implementation cannot**. The router is an instruction workflow for the currently active agent, not a background daemon.

## To-tickets / Plan route (automatic default)

For requests to "make the implementation plan", "split into tasks/chunks" or "to-tickets", first confirm a reviewable **architecture design** exists; then follow **`.agents/skills/ace-to-tickets/SKILL.md`**. It replaces the upstream sizing interview with ~1,000-line forecasts (including tests). For material T2 planning, call **`.agents/skills/ace-plan-refinement/SKILL.md`** in PREPARE mode after shared R/S; follow the normal **`.agents/skills/ace-phase-plan/SKILL.md`** and invoke refinement again in SYNTHESIZE mode after X. Validate **every final C phase** with `check:ace-phase-plan`. Never present same-context alternatives as independent. No count is hard-coded. G02, provider permission, actual tests and owner-controlled implementation remain separate.

## SDD preparation route (explicit user request)

When the owner asks for "prepare SDD", "ace-sdlc prepare", or conversion of a task into a canonical OpenSpec spec, read and follow **.agents/skills/ace-sdd-prepare/SKILL.md** in full. It routes fact-only Research → conditional Matt grill-with-docs/domain-modeling → to-spec synthesis → openspec-propose/update-change → structural acceptance checks and G02 owner-review handoff. Do not launch implementation while preparing SDD. Do not use this route for trivial T0 work or create duplicate OpenSpec changes. The read-only check:sdd-prepare never approves G02.

Local dry-run procedure and explicit negative checks: `docs/operations/local-agent-sdlc-trial.md`.
