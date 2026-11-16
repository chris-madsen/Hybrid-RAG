# Design

## Context / AS-IS

Current main already vendors Matt Pocock v1.3.2 helpers and seven OpenSpec skill files. ace-sdlc routes general Research → Design → Plan → Implement, but it does not define automatic preparation composition or a checkable SDD handoff. Upstream to-spec attempts issue-tracker publication; grill-with-docs delegates skill calls. The local overlay forbids a second tracker, unbounded questioning and invented agent attestations.

## Goals / Non-goals

**Goals:** Single explicit SDD entrypoint; conditional questions; canonical OpenSpec reuse/update; testable acceptance mapping and deterministic structural checks; truthful G02 review boundary; one-agent operation.

**Non-goals:** New daemon/runner, third-party skill modification, upstream installer, tracker publication, automatic owner approval, product implementation or model/provider E2E certification.

## Decisions

1. **Instruction-level composition, not a second orchestrator.** ace-sdd-prepare drives the installed skills as ordered stage references. Hosts supporting Skill invocation may use it; others read full skill texts. Actual invocation remains unproven until a live host trial.
2. **Existing OpenSpec remains sole spec authority.** to-spec contributes synthesis only. openspec-propose creates an original change; openspec-update-change revises an existing one. Agent checks existing changes before creating anything, preventing duplicate specs on resume.
3. **Bounded discovery and fail-closed owner choices.** Only material unknown owner decisions trigger interviews; at most 3 questions/round and 2 rounds/task. Missing decisions block their dependent paths, not independent research.
4. **Mechanical acceptance integrity is not G02.** A small Node checker validates exact required files, accepted scenario IDs, design/task references, T2 crosswalk cardinality and explicit blocked status. Success is READY_FOR_G02_REVIEW or READY_FOR_REVIEW, never design approval. OpenSpec strict validation remains separate.
5. **T0 bypass.** Mechanical documentation changes continue via existing ACE T0 SDLC, avoiding unnecessary new changes.

## G02 crosswalk

| AC | Owner | Decision | Interface/state | Phase | Deterministic oracle | Provider/agent oracle |
| --- | --- | --- | --- | --- | --- | --- |
| SDD-001 | ACE owner | ACCEPTED: single entrypoint | ace-sdd-prepare / ace-sdlc | 1 | skill-contract test | N/A |
| SDD-002 | ACE owner | ACCEPTED: bounded interview | Matt compatibility overlay | 1 | skill-contract test | live host invocation NOT-RUN |
| SDD-003 | ACE owner | ACCEPTED: OpenSpec only | propose / update change | 1 | skill-contract test | N/A |
| SDD-004 | ACE owner | ACCEPTED: structural review only | check:sdd-prepare | 2 | checker positive + negatives | N/A |
| SDD-005 | ACE owner | ACCEPTED: fail closed | check:sdd-prepare | 2 | negative fixtures | N/A |
| SDD-006 | ACE owner | ACCEPTED: resume existing change | same OpenSpec change directory | 1 | instruction oracle; host E2E NOT-RUN | live agent NOT-RUN |
| SDD-007 | ACE owner | ACCEPTED: planning boundary | prepare handoff | 3 | skill-contract test | N/A |
| SDD-008 | ACE owner | ACCEPTED: truthful evidence | source SHA and gate report | 3 | checker output asserts review-only | live Hermes trial NOT-RUN |

## Risks and tests

- Pure text instructions cannot enforce host tool calls; a real Hermes invocation must be separately observed and labeled NOT-RUN until performed.
- Regex/Markdown checker is intentionally limited to structure; it does not prove design quality or source-truth. OpenSpec CLI validates syntax, owner approves G02.
- Check exact IDs in specs, design, tasks; reject incomplete or malformed T2 rows, unsafe or symlinked paths, explicit BLOCKED decisions, duplicate IDs; keep clean T1/T2 fixtures.
- Validate scoped checks and PR CI without inflating the running cost of unrelated tasks.

## Migration / rollback

Add the self-contained skill, validator and tests, then route ace-sdlc and document usage. Reverting the routing paragraph restores the prior manual preparation path without changing ACE runtime.
