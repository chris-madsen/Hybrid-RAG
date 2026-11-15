# Spec Delta

## Purpose

Make selected licensed helper skills discoverable to repository agents without replacing ACE's accepted single-agent SDLC, OpenSpec authority, or privacy and review rules.

## ADDED Requirements

### Requirement: Pinned helper skills are discoverable and attributable

Repository agents SHALL discover only the approved helper skills from `.agents/skills`, with complete upstream references and verifiable source provenance.

#### Scenario: SKILL-001 — Exact pinned vendor content
- **WHEN** the selected helper skills are present in the repository
- **THEN** every vendored file matches the approved upstream `v1.3.2` source identity recorded in the manifest
- **AND** the MIT attribution is present
- **AND** no unselected automation or installer is executed or imported.

#### Scenario: SKILL-002 — Existing skill preservation
- **WHEN** the helper skills are added
- **THEN** all pre-existing ACE and OpenSpec skill entrypoints remain present and unchanged.

### Requirement: ACE governance remains authoritative

Imported helper skills SHALL remain subordinate to root `AGENTS.md`, accepted ADRs, applicable OpenSpec contracts, and the ACE single-agent workflow.

#### Scenario: SKILL-003 — No parallel executor or tracker
- **WHEN** an imported skill recommends sub-agents, a separate issue tracker, or skill-setup automation
- **THEN** the agent follows the ACE compatibility overlay instead
- **AND** uses one agent and the existing OpenSpec task graph without publishing duplicate tickets.

#### Scenario: SKILL-004 — Domain and review compatibility
- **WHEN** an imported skill recommends creating generic ADR/glossary files or parallel review agents
- **THEN** the agent uses ACE's existing decision records and functional DDD rules
- **AND** performs the applicable BUILD/ARCH/SEC/PLAN review passes sequentially without claiming independent review.

### Requirement: Requirement questions are bounded and non-repeating

For material unresolved requirements, the agent SHALL ask only decision questions that repository inspection cannot answer, in bounded rounds, and SHALL not repeat an answered or declined question.

#### Scenario: SKILL-005 — Bounded clarification
- **WHEN** material decisions remain after tool-based fact gathering
- **THEN** the agent asks no more than three independent questions in a round and no more than two rounds per scoped task
- **AND** records unanswered decisions as `UNKNOWN` or `BLOCKED` while continuing work that does not depend on them.

#### Scenario: SKILL-006 — No repeated or tool-resolvable questions
- **WHEN** the user has already answered a question or the answer is available from authorized repository/environment evidence
- **THEN** the agent does not ask that question again
- **AND** retrieves the fact itself where permitted.

### Requirement: OpenSpec remains the acceptance authority

When a request needs a durable specification, the agent SHALL express behavior and stable acceptance IDs in the repository's existing OpenSpec workflow, without creating a competing spec or ticket authority.

#### Scenario: SKILL-007 — Request-to-acceptance handoff
- **WHEN** an owner request and its review provide enough scope to implement a bounded slice
- **THEN** the proposal and capability spec capture that scope and stable acceptance IDs
- **AND** the agent does not invent owner answers or ask questions already resolved by the request or source evidence.
