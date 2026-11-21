# Adopting an AI-assisted SDLC in ACE

## A. Instruction integration

1. Root `AGENTS.md` remains the primary source of engineering rules.
2. Follow `docs/operations/ai-assisted-sdlc.md` to carry out tasks.
3. Read existing OpenSpec changes and ADRs instead of creating a second set of architecture rules.
4. Detailed stage commands live under `source/commands/`; reusable harness-neutral prompts are in `PROMPTS-ACE.md`.
5. Select process depth by change risk: T0, T1 or T2.

## B. End-to-end trial on a real task

1. Identify an unresolved bug or small feature, checking the current branch, implementation and open PRs.
2. Perform source-grounded Research with `path:line` citations.
3. Prepare a concise Design and obtain approval for material choices.
4. Record implementation phases in the existing OpenSpec or execution plan.
5. For bug fixes, reproduce RED and then achieve GREEN.
6. Perform four sequential reviews: build, architecture, security and plan completeness.
7. Run applicable real-provider checks and explicitly record tests that were not run.
8. Publish a separate PR with an exact SHA, observed CI results and human review.
9. Complete a cross-phase verification after the change is delivered.

## C. Additional quality gates

Investigate current GitHub Actions, secret scanning, dependencies, architecture-boundary enforcement and documentation links. Add only missing checks with measurable value. Do not import Go-specific tools into a TypeScript project without justification.

## Non-goals

- Do not depend on Claude TeamCreate/TaskCreate.
- Do not implement a second SDLC orchestrator.
- Do not duplicate OpenSpec, ADRs or CI.
- Do not pass off one agent's self-review as independent review.
- Do not present mock-only tests as proof of actual provider E2E behavior.

## Completion criterion

At least one real PR completed through the applicable stages, reproducible tests and observed quality-gate outcomes. The resulting PR may then substantiate a description of the methodology in a CV.

## Quality Gates extension — execute as small follow-up PRs

See [research comparison](QUALITY-GATES-VIDEO-SPHERICON-ACE.md), [gate catalog](QUALITY-GATES-CATALOG.md), and [implementation plan](QUALITY-GATES-IMPLEMENTATION-PLAN.md).

Current implementation status:
1. **QG0 — ACTIVE:** offline local Markdown links with positive/negative fixtures.
2. **QG1 — ACTIVE:** PR secret scanning plus actionlint/zizmor workflow checks; scheduled history scan remains report-only.
3. **QG2 — ACTIVE / report-only:** ACE-specific ast-grep architecture rules with valid/invalid fixtures and source scan.
4. **QG3 / G02 — ACTIVE procedural gate:** T2 implementation requires a pre-code acceptance crosswalk and owner decisions; it is intentionally not an automatic architectural approval.
5. **QG4 — ACTIVE report-only:** Knip dependency/unused-code reporting plus scheduled OSV advisory reporting.
6. **QG5 — ACTIVE for Gateway v2:** TypeSpec regeneration, generated DTO/schema checks and fail-closed native contract validation.
7. **QG6 — ACTIVE:** nightly/full deterministic-property verification and OSV reporting are complemented by pinned CodeQL and a targeted mutation gate for accepted security invariants; remote external links are scheduled nonblocking signal.
8. **QG7/8 conditional:** typed SCIP/easement or additional toolchain managers are not required for SDLC closure unless a measured invariant cannot be proved with the existing graph/tests.

Do not copy Sphericon's PostgreSQL/Go SQL testing, frontend bundle-size gate, worktree isolation daemon or TypeSpec generators as mandatory ACE checks. Existing ACE deterministic tests, real providers and release supply-chain proof remain independent authoritative checks.

Any future gate/tool extension must still show a clean fixture and deliberately violating fixture, observed commands and GitHub CI result at the exact PR SHA. Do not relabel optional/planned gates as required closure criteria.

## Owner decision update — TypeSpec and functional domain

- TypeSpec is **selected**, no longer a speculative P2 option. Introduce it through staged TS-00..06 tasks in [codegen coverage](TYPESPEC-CODEGEN-COVERAGE.md).
- For each material T2 design begin with Event Storming, derive readonly ADTs/pure invariants, and keep Effect use cases at I/O boundaries.
- Codegen output target is wider than DTO types: client SDK, server handler/route interfaces, runtime validation, mechanical mappings, typed permission metadata, mocks/fixtures, docs and reproducibility.
- Require fail-on-unmapped fields/enums, schema compatibility and actual wire roundtrip. No claim all targets are available from TypeSpec alone.
- The ACE-selected subset from the pinned Matt v1.3.2 release is vendored and byte-manifested; see the [vendor record](MATT-POCOCK-SKILLS.md). Its compatibility overlay preserves the one-agent/OpenSpec process; file presence alone is not agent-use evidence.
- Don't invoke upstream `implement-spec` as a multi-agent executor. The one-agent ACE process remains canonical.
