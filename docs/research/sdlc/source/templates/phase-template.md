# Phase template — independently verifiable slice

## Identity
- Feature:
- Canonical design/plan:
- Phase ID:
- Depends on:
- Implementing agent:
- Branch/base/HEAD:
- Risk tier T0/T1/T2:
- Owner decision references:
- **Phase ID:** <phase-id> (repeat stable ID in plain text for checker)
- **Acceptance IDs:** <comma-separated scenario IDs>
- **Design blob SHA:** <40-hex Git blob of current design.md>
- **Specs SHA-256:** <64-hex SHA-256 over sorted spec path + newline + content + newline>
- Stacked input PR / base HEAD / output PR and source HEAD:
- Phase dependency status: REVIEWABLE / PROVISIONAL / STALE / BLOCKED

**Phase-plan rule:** this file is a non-tracking executable brief linked by canonical `tasks.md`. When instantiated into `phases/<ID>.md`, remove template placeholders and do **not** duplicate `- [ ]` task-status checkboxes. Material G02, real-provider and release permissions remain separate from structural completeness.

## Objective
**Observable behavior**: what a caller/user can now do.
**Non-goals**: explicitly unchanged behaviors.
**Definition of accepted**: exactly which checks must pass.

## Requirements and invariants
| ID | Required behavior | Precondition | Postcondition | Negative/exception |
|---|---|---|---|---|
| AC-01 | ... | ... | ... | ... |

**Frame conditions:** what must not change, including other files and protected data.

## Architecture contract
- Owning bounded context:
- Application service and ports:
- Adapters and provider:
- Actual runtime composition:
- Security/identity:
- Expected source/data provenance:
- Accepted ADR/OpenSpec references:
- Existing maintained implementation to reuse:
- Planned removal of superseded code:
- Potential rollback effects:

## File map
| Create/Modify/Delete | Exact file | Responsibility | Test owner |
|---|---|---|---|
| Modify | ... | ... | ... |

## Task steps
1. Re-check current HEAD/code and applicable owner instructions.
2. Select cheapest existing test owning this invariant.
3. Write RED case (or justify test-first exception).
4. Run test; confirm *specific intended failure*.
5. Implement minimum accepted code.
6. Run GREEN with real output.
7. Run affected test set.
8. Check actual provider/runtime integration if affected.
9. Review four gates separately.
10. Fix failed gate findings and repeat.
11. Commit, push and update open PR.
12. Reconfirm the current PR head and record the actual commit SHA CI tested (including a synthetic merge SHA when applicable).
13. Mark phase VERIFIED/DELIVERED only with evidence.

## Verification commands and expected proof

For each RED and GREEN identify the exact executable command, the expected failing assertion or passing condition, and the actual owning test file. Mark commands NOT_RUN at planning time rather than predicting results. Validate instantiated mini-plans using `npm run check:ace-phase-plan -- --change <id> --phase <ID> --json` before handoff.
| Command | When run | Expected output/invariant | Evidence path |
|---|---|---|---|
| ... | RED | specifically fails | ... |
| ... | GREEN | passes | ... |
| ... | affected tests | passes | ... |
| ... | provider E2E | actual provider | ... |

## Gate review
| Gate | PASS/FAIL/UNKNOWN/NOT-RUN/N/A | Evidence | Findings/repair |
|---|---|---|---|
| BUILD | | | |
| ARCHITECTURE | | | |
| SECURITY | | | |
| PLAN COVERAGE | | | |

## Review/repair ledger
| Attempt | Finding | Fix commit | Retest result |
|---|---|---|---|

## Completion
- Source SHA:
- PR:
- CI required checks:
- CI tested checkout/merge SHA:
- Real provider proof:
- Owner approval:
- Deferred follow-ups:
- Next unblocked phase:

## Quality Gate obligations for this phase

Relevant gate IDs from [catalog](../../QUALITY-GATES-CATALOG.md):
- Pre-code Design Consistency G02 (T2; for T1 brief; T0 N/A):
- Current available deterministic commands (G03):
- Installed architecture rules (G04) or planned rule (NOT-RUN):
- Secrets, workflow, docs or dependency scope (G05–G09):
- Real provider/agent E2E obligation (G11):
- Expensive nightly/release checks (G12–G13; outside edit loop):

For each enabled gate capture exact tool/version, command, exit, source SHA, evidence and decision owner. Do not mark an uninstalled tool PASS.

## Mandatory domain / contract design check (T2)

- Event Storming commands/events/policies/hot spots and bounded context owner:
- Immutable `State`, `Command`, `DomainError`, optional `Event` ADTs:
- Pure transition/decision function and invariant/property tests:
- Effect orchestration, authorization, cancellation, CAS/idempotency:
- Public TypeSpec operation/message/DTO/error version affected:
- Generated API boilerplate and mapping completeness gate:
- Existing old/new wire fixture and compatibility oracle:
- TypeSpec compiler and emitters installed? actual commands or NOT-RUN:
- Auxiliary Matt skill(s) read, if any:
