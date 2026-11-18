# ACE SDLC — intent-first entry and implementation resume

**Scope:** a single coding agent (including Hermes), no daemon and no new orchestration framework. This procedure is entered **before** choosing Research as the default. The latest explicit owner request determines the operation; the canonical artifact/branch state determines whether it is safe. Read root `AGENTS.md` and the full `.agents/skills/ace-sdlc/SKILL.md`.

## Route by user intent, then validate actual state

| User intent | Entry | Default behavior |
| --- | --- | --- |
| "implement", "имплементируй", "реализуй", "apply C02", "code the next chunk" | **I — existing implementation phase** | Reuse canonical `tasks.md` and selected `phases/<ID>.md`; **do not restart R/S/A/P/X or regenerate A/B/C** for valid existing artifacts |
| "continue", "продолжай", "resume" after coding began | **I — resume the in-progress phase** | Inspect current branch/PR, checkpoint and actual commits; continue unfinished phase, never repeat side effects blindly |
| "verify", "ревью", "проверь реализованное" | **V / review** | Inspect the diff, actual checks and provider evidence; no forced Research/Planning rerun |
| "plan", "разбей на чанки", "уточни дизайн" | **P/X or requested owning S/A stage** | Reuse valid upstream R/S/A; run only missing/affected planning steps |
| "build from scratch", genuinely new requirement with no usable accepted artifacts | **R/S/A/P/X** | Follow full staged planning including dual-plan synthesis when material T2 |

These are semantic examples, not a fragile keyword-only classifier. An explicit request to redo Research/Architecture overrides reuse. A short current-code/changed-input check during implementation is **not** a new Research stage.

## Direct I-stage admission (read-only first; no speculative replanning)

1. **Resolve the owner-selected change and phase.** Prefer explicit change/phase ID, then the active PR/worktree and existing checkpoint, then the only unambiguous current OpenSpec change. If multiple plausible plans remain, ask only which one; do not invent a new change. Discover state via `openspec list --json`, `openspec status --change <change-id> --json` and `openspec instructions apply --change <change-id> --json` using the project's declared OpenSpec store where applicable. Follow its `contextFiles` and blocked states; never create new artifacts merely to satisfy a router.
2. **Use the single canonical plan.** Read `openspec/changes/<change-id>/tasks.md`, accepted specs, `design.md` and the **entire** `phases/<phase-id>.md`. Pick the explicitly named phase; otherwise resume the one genuinely IN-PROGRESS on the live branch/PR; otherwise take the first **dependency-ready, unimplemented** phase in the canonical DAG. Check source/PR reality before trusting a checkbox; a green stale PR or unchecked task is not proof of work remaining. If all phases are implemented, route to V rather than rebuilding the plan.
3. **Freshness is scoped.** Compare the phase's design Git blob, sorted-spec fingerprint, AC ownership, dependency DAG and exact source interfaces against **current** checkout/branch/parent PR. Run `npm run check:ace-phase-plan -- --change <change-id> --phase <phase-id> --json`. Its `READY_FOR_PHASE_REVIEW` is a structural signal, **not** approval. Check changed source/contracts and overlapping PRs only as needed. If an input is STALE, reconcile the affected owning S/A/P/X artifact and descendants; never silently rewrite the entire plan or label it approved.
4. **Authorize safely.** Read applicable accepted ADR/OpenSpec and *actual* G02 owner decision/reference for material T2; a `design.md`, G02 table, `--g02` file or latest "implement" instruction **does not by itself approve** an unresolved architectural decision. A missing/denied provider, model, data-class or paid external-egress permission blocks only the dependent external action. With no owner G02 for a T2 implementation, report **BLOCKED_G02** and the exact decision needed; **do not fall back to Research** or start modifying product code.
5. **Enter implementation directly.** On a safe isolated worktree/PR run `npm run worktree:preflight -- --task-id <task-id> --json` and the existing read-only `npm run sdlc:preflight -- --tier T2 --stage implement --task-id <task-id> --plan openspec/changes/<change-id>/tasks.md --g02 openspec/changes/<change-id>/design.md --json` (T1: omit `--g02` and use `--tier T1`). Verify the owner approval *separately*. A `REVIEW_REQUIRED` preflight is not an implicit STOP if the agent can independently show the required approval, nor is it an automatic PASS. Follow `openspec-apply-change` instructions **constrained to this one ACE phase** and the **complete** `docs/research/sdlc/source/commands/implement_backend.md`; implement actual RED → GREEN → BUILD/ARCH/SEC/PLAN reviews → bounded `verify:pr` → PR. Do not let generic OpenSpec "loop until done" override ACE's one-phase limit.
6. **Resume, don't reset.** Reuse the existing branch/worktree and open PR if applicable; preserve dirty/unrelated changes and any previously committed RED/GREEN evidence. Re-read the exact HEAD, checkpoint, source and current plan. Idempotently continue remaining tasks. Never discard/reapply an external side effect or use a stale checkpoint as authority.

## Routing outcomes and fail-safe semantics

- **IMPLEMENT_PHASE(<change>, <phase>)**: dependencies, approval and necessary scoped evidence verified; proceed to code immediately, no initial R/S/A/P/X pipeline.
- **RESUME_PHASE(<change>, <phase>)**: active phase/PR verified; continue remaining implementation.
- **VERIFY_ONLY**: user asked for review or already-delivered phases.
- **PLAN_REPAIR_SCOPED**: an identified artifact/input was stale; route only to affected owning planning stage and then return to I after recheck.
- **BLOCKED_G02 / BLOCKED_DEPENDENCY / BLOCKED_EGRESS / BLOCKED_AMBIGUOUS**: state the exact missing decision, dependency, permission or selection; do not fake a pass, start Research, or change protected code.
- **START_NEW_PIPELINE**: genuinely new, explicitly requested end-to-end planning with no reusable accepted plan.

**Evidence / limitations:** Record selected route, owner request, change/phase, plan blob and source HEAD, parent/PR identity, actual G02 reference, preflight/phase results, remaining acceptance gates and exact next action in the existing `progress-checkpoint.md` shape. Markdown instructions and static tests cannot demonstrate that Hermes actually picked the right route; prove this separately in the real local Hermes entry/resume trial.

### Example — existing G11 phases

For an owner command "Implement C01 from `openspec/changes/013-gateway-g11-production-acceptance/tasks.md`", enter **I / C01**, inspect its current plan and relevant source, and validate G02/permissions. Do **not** begin R/S/A/P/X merely because the normal diagram starts at Research. If G02 is still `REVIEW_REQUIRED`, stop as **BLOCKED_G02**; report the unresolved owner decision rather than writing code or regenerating the eight phase plans.
