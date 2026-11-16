# Spec Delta

## Purpose

Provide an ACE-owned, deterministic planning entrypoint without another agent runner or another specification authority.

## ADDED Requirements

### Requirement: An ACE planning request uses the installed SDLC authorities

#### Scenario: SDD-001 — Explicit preparation entrypoint
- **WHEN** an owner requests SDD preparation
- **THEN** ace-sdlc routes to ace-sdd-prepare after risk classification and current-source checks
- **AND** the agent follows the existing root, ADR, OpenSpec and SDLC precedence.

#### Scenario: SDD-002 — Bounded and conditional requirements interview
- **WHEN** material owner decisions remain after source inspection
- **THEN** the agent may use grill-with-docs and domain-modeling to ask at most three independent questions in a round and at most two rounds per task
- **AND** resolved, tool-answerable or previously declined questions are not repeated
- **AND** no interview is required when the accepted requirements are already sufficient.

#### Scenario: SDD-003 — OpenSpec remains sole specification authority
- **WHEN** requirements are synthesized using to-spec
- **THEN** the agent creates or updates only the canonical OpenSpec proposal, capability spec, design and tasks
- **AND** neither a second tracker nor a generic ADR/glossary tree is created.

### Requirement: Structural acceptance validation cannot impersonate approval

#### Scenario: SDD-004 — Traceable artifacts
- **WHEN** a completed SDD is checked
- **THEN** every uniquely identified acceptance scenario in specs is referenced in design and tasks
- **AND** T2 work has a complete seven-column G02 crosswalk for every scenario.

#### Scenario: SDD-005 — Negative checks fail closed
- **WHEN** an artifact is missing, an acceptance ID is duplicated/unreferenced, a T2 G02 row is incomplete, an explicit owner decision is BLOCKED, or a change path escapes the OpenSpec root
- **THEN** the checker returns BLOCKED and a nonzero exit code
- **AND** it does not mark missing evidence as PASS.

#### Scenario: SDD-006 — Repeat preparation is idempotent at planning level
- **WHEN** the agent prepares an already-existing change
- **THEN** it re-reads and updates that same OpenSpec change rather than creating a duplicate
- **AND** it checks current source SHA and outstanding decisions again.

#### Scenario: SDD-007 — Planning-only boundary
- **WHEN** preparation has produced an SDD
- **THEN** it stops before implementation, merge or release approval
- **AND** additional owner authorization is required for code implementation.

#### Scenario: SDD-008 — Honest readiness report
- **WHEN** deterministic artifact checks pass
- **THEN** the result is READY_FOR_REVIEW or READY_FOR_G02_REVIEW rather than owner-approved G02 PASS
- **AND** unobserved live agent/Skill invocation and provider tests remain NOT-RUN.
