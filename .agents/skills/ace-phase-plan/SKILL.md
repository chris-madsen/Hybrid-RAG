---
name: ace-phase-plan
description: Expand each automatically sized ACE To-tickets chunk into an unambiguous executable mini-plan grounded in approved architecture, owning code/tests, commands, and RED/GREEN without starting implementation.
---

# ACE Phase Plan — executable plans before code

**Stage:** detailed Plan, immediately **after** `ace-to-tickets` selects coherent chunk boundaries. This one-agent skill is planning-only; never edits product source or claims a hypothetical RED/GREEN test passed. Use principles of small checkable steps and self-reviewed spec coverage (informed by MIT-licensed Superpowers `writing-plans`), but keep ACE's existing files and one-agent execution model.

## Inputs and authority

Read root/scoped `AGENTS.md`, current `main` and active stage PRs, accepted ADRs, `docs/research/sdlc/source/templates/phase-template.md`, `docs/research/sdlc/PROMPTS-ACE.md`, `docs/research/sdlc/source/commands/implement_backend.md`, full existing OpenSpec proposal/specs/design/tasks, `.agents/skills/ace-to-tickets/SKILL.md` and `.agents/skills/ace-stage-handoff/SKILL.md`. Inspect **current real code and tests**, not guessed paths. An unmerged architecture PR may be used as a clearly provisional input, never as owner G02 consent.

## Artifact contract — ONE canonical tracker

- `openspec/changes/<change>/tasks.md` keeps **the only phase list, acceptance-to-phase crosswalk, dependencies, status checkboxes and LOC forecasts**. Append a relative link to `phases/<id>.md` for each chunk. Do not introduce tracker issues, a second task ledger or competing OpenSpec change.
- A detailed `openspec/changes/<change>/phases/<id>.md` is an **implementation brief**, not a competing status file. Fill the entire relevant `phase-template.md`; retain its headings `Identity`, `Objective`, `Requirements and invariants`, `Architecture contract`, `File map`, `Task steps`, `Verification commands and expected proof`, `Gate review`, `Completion`. Use numbered steps, **no duplicate task-status checkboxes**.
- At top include `**Phase ID:** <id>`, `**Acceptance IDs:** <IDs>`, `**Design blob SHA:** <40 hex>` and `**Specs SHA-256:** <64 hex>`. Design SHA is the Git blob of current `design.md` bytes, not PR commit SHA. Specs fingerprint is SHA-256 of sorted UTF-8 `<relative_path>\n<content>\n` pairs for every current `specs/**/spec.md`. This binds a plan to its *actual architecture and requirement inputs*. A later change invalidates the brief until revalidated and refreshed; don't treat a PR URL as immutable.
- Include source branch/ref and exact HEAD, current owned file paths, whether source is clean, G02 decision/status, required owner/provider permissions, dependency IDs and forecast source/test/other changes. Separate verified existing paths from proposed new paths.
- Specify every AC's **require / ensure / invariant / frame / exceptional** outcomes, domain transition/FSM restrictions if applicable, Effect services/ports, adapter mapping and TypeSpec contract ownership. Refuse to invent unresolved architectural decisions just to complete a plan.
- For each vertical implementation step, identify the **exact file and test name** (existing or explicitly proposed), expected failing assertion/RED command and exit, minimum behavior to implement, GREEN command/pass condition, side-effect and forbidden negative case; include reuse/removal of superseded symbols. Actual command availability must be verified against scripts and repository, not assumed.
- Distinguish local test oracles, mock wire, actual provider/agent/Harbor checks; mark external tests requiring explicit egress/model/budget permission `BLOCKED` or `NOT_RUN`. List G02 + BUILD/ARCH/SEC/PLAN evidence obligations and rollback/STOP, cross-phase interface input/output signatures, integration risks and reproducible worktree/PR handoff.

## Self-review and validation

1. Verify each scenario belongs to a spec and is owned by the canonical chunk; every specified exception has a negative oracle. Check that each step permits **one reasonable implementation**, not “implement feature” or a complete speculative pasted implementation. Exact code is illustrative only if it represents an approved contract/transition decision.
2. Verify anticipated added+deleted handwritten LOC remains consistent with the upstream 700–1,200 planning preference; if implementation cost/architecture invalidates sizing, send only the impacted frontier back through `ace-to-tickets` for re-slicing. Don't turn this into another owner granularity interview.
3. Run `npm run check:ace-phase-plan -- --change <id> --phase <id> --json` once the canonical tasks link and phase file exist. A PASS proves **structure and input-fingerprint freshness only**, not semantic correctness, G02, executable tests, Skill execution or provider success. Run OpenSpec strict and `check:sdd-prepare` as applicable and report actual results.
4. Open a **Draft phase-planning PR** (can depend on an unmerged upstream plan PR) and record input hashes and validation. Subsequent implementation requires an **actual approved phase and owner-authorized T2 design**, not merely a green structural checker. Do not start Apply here.

## Post-X refinement handoff

After all linked phase briefs exist and have been structurally checked, follow **`.agents/skills/ace-plan-refinement/SKILL.md`** before finalizing the X-stage review. It performs an evidence-led critique and routes fixes to owning skills, without authorizing G02 or production. Do not call a structure-checker PASS semantic plan quality.

## Correction contract

If owner alters upstream requirements/design, treat affected phase plans as `STALE`, recalculate file/test owners and SHA fingerprints, re-run checks and update descendant PRs with an explicit reconciliation. Preserve unaffected accepted history. Do not silently claim a draft phase is approved.
