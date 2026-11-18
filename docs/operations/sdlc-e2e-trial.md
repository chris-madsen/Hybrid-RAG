# Continuous Hermes SDLC stage trial — R → S → A → P → X

Status: PREPARED; LIVE HERMES TRIAL NOT RUN. The checked-in test fixture uses synthetic Git branches and synthetic tool-event JSONL. It tests the read-only validator, **not** real Hermes skill invocation or G02.

## Scope and safety

Use one disposable, no-network T2 planning-only OpenSpec change; no product source modifications, provider egress, Harbor, Apply, model authorization or G02 approval. Target native Responses only. Chat Completions translation/fallback is prohibited. Read root AGENTS.md, the full ace-sdlc and ace-stage-handoff skills, accepted OpenSpec and current source SHA. Use isolated worktrees. The actual Hermes CLI, project skill trust and session-resume syntax MUST be discovered with the locally installed --help; do not assume undocumented options. The existing November 17 trial proved only two skill_view calls, not R→X automation.

## One real operator-authorized session

1. Start one trusted project-root Hermes task. Give one initial request: "Execute a planning-only ACE R→S→A→P→X staged SDLC trial for a disposable OpenSpec change. Native Responses only. Auto-advance between reviewable Draft stages within this single authorized session, create a stacked Draft PR per stage, stop before implementation/G02/egress, and emit a checkpoint and source Git-object evidence."
2. Observe actual successful tool calls to Hermes skill_view for ace-stage-handoff → ace-sdd-prepare → ace-architecture-design → ace-to-tickets → ace-phase-plan. A file read or model assertion is not an invocation. Observe R>S, S>A, A>P, P>X transitions. Another user request to nudge a stage fails the *automatic* handoff scenario. A same-session resume without a new user request may pass if its identity and actual calls are verified.
3. Verify five Draft PRs, each child based on the previous stage branch and containing only that stage output: R source research memo, S proposal and specs tree, A design, P tasks, X linked phase briefs. G02 remains REVIEW_REQUIRED. No production, real provider or agent-loop proof follows.
4. Keep the original Hermes native trace PRIVATE outside the repository; create a redacted normalized event-index JSONL containing observed user_request, successful skill_view tool_call and handoff events with the same observed session. This normalized record is NOT the native Hermes trace and CAN be fabricated. Retain original native log and its independent SHA-256 for reviewer comparison; never put source text, secrets, transcript or session identifiers in a PR.

## Manifest and validation

The verifier uses a JSON manifest with root fields: schemaVersion = ace.sdlc.handoff-trial.v1; changeId = safe OpenSpec change; transport = openai.responses; g02 = REVIEW_REQUIRED; trace = { file: local redacted events path, sha256: exact local SHA-256 }; stages = exactly R,S,A,P,X.

Each stage object contains id, branch (local branch name), head (40-hex commit), parentRef (previous stage branch or main for R), parentHead (recorded commit), inputs and outputs. Each input/output entry has path and oid (40-hex git object identity). Obtain OIDs from the exact Git tree with git rev-parse COMMIT:path. Use the **tree** OID for specs and phases directories, not the SHA of a fabricated concatenation. This detects added/deleted files too.

Design must contain the exact declarations:
- Target agent transport: openai.responses
- Legacy Chat route: RETIRED_NOT_SUPPORTED

Sample normalized event sequence for one observed session: user_request; tool_call(skill_view, ace-stage-handoff, success:true); handoff(R,S); tool_call(skill_view, ace-sdd-prepare, success:true); handoff(S,A); tool_call(skill_view, ace-architecture-design, success:true); handoff(A,P); tool_call(skill_view, ace-to-tickets, success:true); handoff(P,X); tool_call(skill_view, ace-phase-plan, success:true). Every JSONL object must use the same session field. This is an audit index, **not** independently authenticated host evidence.

Run these locally:

    npm run test:sdlc-stage-trial
    npm run check:sdlc-stage-trial -- --root /absolute/local/checkout --manifest /private/path/trial.json --json

A positive checker result is STRUCTURAL_REVIEW_ONLY, never a live Hermes E2E claim. Review the original host trace and real GitHub PR metadata separately. Run existing check:sdd-prepare, check:ace-phase-plan for each phase, strict OpenSpec validation and relevant CI separately.

## Real Hermes direct-implementation entry/resume trial (separate from R→X)

**Live result: NOT RUN until observed on actual Hermes host.** On a prepared, pinned **disposable** change with a canonical phase `tasks.md`/brief, obtain the required owner G02 decision and ensure no unapproved external egress. Give one fresh-context Hermes task: "Implement the already-approved C01 phase from this OpenSpec change; reuse the current plan; do not redo R/S/A/P/X." Observe the **actual** first route/skill calls and Git operations. Acceptance: direct apply/implement path, exact phase selected, scoped preflight/phase check, RED/GREEN and one phase PR; **zero** unsolicited R/S/A/P/X artifact generation and no new dual-plan candidates. Do not call a static Markdown assertion live Hermes evidence.

**Negative trial:** Keep the same existing plan but mark material G02 `REVIEW_REQUIRED`. A fresh "имплементируй C01" must select **I**, report `BLOCKED_G02`, make zero source edits and **not** fall back to Research or silently approve G02. **Resume trial:** with an in-progress phase PR, use "продолжай" in a new session; confirm it reuses the same worktree/PR, checks current HEAD and does not repeat completed non-idempotent actions. Record tool-event traces privately and distinguish observations from agent claims. Do not execute paid provider calls or modify protected branches for this trial.
## Mandatory parent-change regression

After R→X, amend a **tracked input** in parent R or S and advance its head. Run the OLD manifest before touching child branches: expect STALE with a failing STALE_PARENT check. Then try a parent-only unrelated commit with the tracked input unchanged: expect NEEDS_RESTACK rather than a false semantic STALE. Rebase/reconcile descendants, recompute exact input/output OIDs, rerun affected gates and recheck child-only PR diffs. Keep old trial manifest as historical evidence; a changed PR does not inherit previous approval.

## Acceptance conditions

- The fixture suite passes all twelve positive/negative tests (missing stage, missing skill, second prompt, changed trace, real input drift, unrelated parent restack, Chat-first target/design and broken phase links, reordered skill/handoff events, and successful restack/revalidation after a changed parent).
- Live R→X invocation and automatic transitions remain NOT_RUN until actual Hermes tools and one-session continuity are observed.
- G02, final provider wire, Hermes agent/product E2E and implementation remain REVIEW_REQUIRED or NOT_RUN.
