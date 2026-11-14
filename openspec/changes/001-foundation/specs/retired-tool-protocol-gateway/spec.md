> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# retired-tool-protocol-gateway — Spec Delta

## Purpose

Single logical retired optional tool-call protocol surface and lossless artifact boundary.

## ADDED Requirements

### Requirement: Unified Codex gateway

The system SHALL expose a single logical retired optional tool-call protocol facade with agent-neutral domain contracts and an initial Codex adapter.

#### Scenario: Supported client

- **WHEN** Codex calls an ACE tool with a valid workspace and query
- **THEN** the gateway delegates to domain ports and returns a versioned response

#### Scenario: Invalid arguments

- **WHEN** tool input violates schema or refers to another workspace
- **THEN** the tool returns a typed error without executing backend queries

### Requirement: Read-only source operations

The harness SHALL NOT modify user source files or silently apply patches; source-code edits remain the responsibility of the coding agent.

#### Scenario: Query invokes context

- **WHEN** Codex requests source context
- **THEN** the harness may read and index but never writes a patch to the source tree

### Requirement: Lossless expansion

The system SHALL preserve exact source and generated artifacts and permit complete, authorized expansion without silent truncation or mandatory fixed context-token caps.

#### Scenario: Two-thousand-line artifact

- **WHEN** Codex produced a file of at least 2000 lines and ACE later reads it
- **THEN** the complete file is available byte-identically with a verifiable digest

#### Scenario: Too large inline

- **WHEN** a source is too large for one transport response
- **THEN** exact pagination or a retrieval handle is returned and no bytes are lost

---

### Requirement: Official SDK and boundary contract

The production retired optional tool-call protocol transport SHALL use an official, maintained TypeScript retired optional tool-call protocol SDK and SHALL pass actual installed Codex/client protocol conformance. A custom JSON-RPC implementation SHALL NOT be the production default without a separately approved ADR and conformance proof.

#### Scenario: DBC-09 SDK conformance

- **WHEN** the Codex client initializes, lists and invokes tools, sends malformed arguments, cancels, or invokes concurrent calls
- **THEN** the real SDK transport behaves compatibly and preserves typed failures without mutating source
