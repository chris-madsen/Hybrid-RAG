# Durable context checkpoint

Use this before compaction, session switch or when execution spans multiple interactions. The checkpoint is an index back to authoritative files, **not a substitute** for reading them.

## Source identity
- Repository and canonical remote:
- Branch:
- BASE SHA:
- Current HEAD SHA:
- Last CI tested checkout/merge SHA (if any):
- Open PR URL/number:
- Worktree status (dirty/untracked/unrelated):
- Date and agent/client:
- Current execution environment:
- Permission to perform external actions:
- Current SDLC stage (R/S/A/P/X/I/V):
- Latest owner intent and selected entry route (DIRECT_IMPLEMENT / RESUME_PHASE / VERIFY_ONLY / PLAN_REPAIR_SCOPED / BLOCKED / START_NEW_PIPELINE):
- Canonical existing change and phase selected, or reason none was available:
- Reused plan/phase fingerprint and last verification SHA (not an approval):
- Parent stage PR / parent branch HEAD:
- Input specs SHA-256 / design Git blob SHA:
- Stage verdict: REVIEWABLE / PROVISIONAL / STALE / BLOCKED:
- G02 owner signoff reference (or REVIEW_REQUIRED):
- Which stage skill was actually invoked vs only read:

## Authoritative instructions
- Root/nested AGENTS:
- Accepted ADR IDs:
- Applicable OpenSpec change/spec:
- Governing execution plan:
- Active phase ID:
- Research/design references:

## Progress ledger
| Phase | State | Last verified SHA | Required next action |
|---|---|---|---|
| ... | READY/IN-PROGRESS/VERIFIED/BLOCKED/DELIVERED | ... | ... |

## Accepted decisions
| Decision | Owner | Reference | Effect on next phases |
|---|---|---|---|

## Completed work
- Behavior actually implemented:
- Files changed and removed:
- Commits pushed:
- Claims supported by tests:

## Actual test and gate evidence
| Command or gate | SHA | Outcome / exit | Artifact | Limitations |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## Open findings
- Failed or unknown gate:
- Affected file and line:
- Root-cause hypothesis:
- Whether the owner has approved change:
- Provider/credential/test blockers:

## Exact next operation
1. Verify PR HEAD and working tree still match checkpoint.
2. Reopen specific source/design files:
3. Re-run relevant command/test:
4. Continue phase:
5. Do NOT do yet:

## Safe resumption
- Never assert tests remain valid after SHA changed.
- Never discard unrelated user edits.
- Never infer a blocked mandatory gate has passed.
- Never silently re-run side-effecting tool actions after a crash without idempotency evidence.
- Never use checkpoint prose to override accepted ADR/OpenSpec or fresh source.
