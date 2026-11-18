# gateway-foundation — Spec Delta

## Purpose

Single Gateway-only ACE delivery boundary with agent-neutral domain contracts and lossless authorized source preservation.

## ADDED Requirements

### Requirement: Unified automatic Gateway delivery

The system SHALL expose ACE model-bound context only through the versioned Gateway Projection API invoked automatically by the pinned Bifröst connector.

#### Scenario: Supported Gateway request

- **WHEN** Bifröst submits a schema-valid, authenticated projection request bound to a registered workspace, request and session
- **THEN** ACE delegates retrieval/projection to application ports and returns a versioned APPLY or BLOCK decision
- **AND** no model-selected ACE tool invocation is required.

#### Scenario: Invalid arguments or identity

- **WHEN** projection input violates schema, digest, workspace, request/session or authorization invariants
- **THEN** the Gateway returns a typed block/error without executing an unauthorized provider effect.

### Requirement: Read-only source operations

The harness SHALL NOT modify user source files or silently apply patches; source-code edits remain the responsibility of the coding agent.

#### Scenario: Gateway projection requires source context

- **WHEN** ACE reads/indexes source to satisfy a projection
- **THEN** it may read and index authorized bytes but never writes a source patch.

### Requirement: Lossless exact source preservation

The system SHALL preserve exact source/generated artifacts and SHALL NOT silently truncate required source because a model/provider request has a bounded body.

#### Scenario: Two-thousand-line artifact

- **WHEN** an authorized source artifact contains at least 2000 lines
- **THEN** ACE can reconstruct its exact bytes and verifiable digest independently of the concise initial projection.

#### Scenario: Projection cannot represent required bytes safely

- **WHEN** required evidence cannot fit the supported projection/body semantics
- **THEN** ACE blocks or reports an explicit incomplete capability
- **AND** it does not label silently omitted bytes as complete.

### Requirement: Versioned Gateway and pinned connector

The production agent-facing boundary SHALL use the TypeSpec-owned native Responses v2 Gateway contract and a thin Bifröst connector compiled against the exact approved upstream revision. Custom parallel transports SHALL NOT become an alternate delivery route.

#### Scenario: Connector conformance

- **WHEN** the pinned connector handles valid, invalid, cancelled or concurrent projection requests
- **THEN** versioned request/decision semantics and typed failure behavior are preserved
- **AND** source/worktree bytes are not mutated.
