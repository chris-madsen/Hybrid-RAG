# ACE dual-plan synthesis contract

This is a comparison/evidence format for the **existing X-stage PR body and checkpoint**, not a new OpenSpec tracker or an extra permanent artifact.

## Neutral input and independence
Record:
- Task/change ID, T2 (or explicit T1 opt-in), pinned source HEAD and tree, accepted ADRs and owner decisions;
- Verified Research memo identity and OpenSpec proposal + specs tree SHA/AC inventory;
- A and B **same neutral input fingerprint**; candidate artifact locations/digests (private storage if sensitive);
- Isolation: two **sequential fresh contexts**, B unable to read A, A unable to read B, recorded evidence or INDEPENDENCE_NOT_ATTESTED;
- Actual skill invocation OBSERVED or NOT_OBSERVED, actual test commands PASS/FAIL/NOT_RUN.

Do not publish hidden instructions, source snippets with secrets, transcript bodies or private session IDs. A staged B plan and a free A plan are **candidates**, never two accepted canonical task sources.

## Decision comparison matrix

| Decision ID | ACs | A proposal + source evidence | B proposal + source evidence | Conflict / complement | Selected (A/B/HYBRID/THIRD/UNRESOLVED) | Why, trade-off and rejected options | Owning S/A/P/X stage | Acceptance/negative oracle | Owner / G02 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

For every **material** divergence, cite current source or pinned upstream path:line@SHA when possible; if not known, say UNKNOWN. Verify each option against requirements and security. Agreement is not proof. Separate:
- **BLOCKER**: unsafe/unimplementable or external assumption before dependent implementation;
- **MAJOR**: material reuse, missing behavior/AC, wrong DAG or proof deficiency;
- **MINOR**: clarity/detail improvement without acceptance risk;
- **UNKNOWN**: unverified risk, not a fact or automatic green light.

Prefer minimal risk-adjusted improvements; do not use count of phases, LOC, document length or the fact that B followed skills as the deciding metric.

## C synthesis summary
- Canonical architecture decisions, external prerequisites and exact interface/owner crosswalk;
- Full spec AC set = C task ownership = C linked phase inventory, no missing/duplicate assignments;
- Changes to DAG/dependencies, forecasts, file maps, RED/GREEN, negative and real-provider/Harbor oracles;
- Per-decision provenance: adopted from A, B, compatible hybrid, third verified alternative, owner decision blocked, or NO_CHANGE;
- Source/acceptance fingerprint changes and reconciliation/rechecks of dependent stage PRs;
- Validations with exact current checkout SHA and observed outcomes; G02/egress separate and never inferred.

## Common failure modes to reject
- A copied B through a common context, or B read A; independence not demonstrated.
- Free planning evaded AGENTS/ADR/OpenSpec or used a forbidden tool/model route.
- B's output was promoted merely because a phase-structure checker passed.
- Blindly concatenated phase briefs, or renamed Cxx to Fxx while changing AC ownership.
- Adopted a provider-native feature without checking its pinned version, license and final-wire semantics.
- Claimed human review or provider proof from model agreement, mocks or generated schemas.
- Kept two contradictory canonical design/task trees after merge.
