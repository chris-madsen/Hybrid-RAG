> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# Proposal — Foundation: workspace truth, safety and retired optional tool-call protocol boundary

## Why

A context harness cannot supply trustworthy evidence without workspace identity, access control, source freshness and a stable agent-facing boundary.

## What Changes

Create domain contracts for workspace registration and verified reads; enforce data policy; expose a single Codex-compatible retired optional tool-call protocol façade with lossless expansion and safe errors. No user-code writing.

## Capabilities

### New Capabilities

- `workspace-identity` — Registry, working-tree identity and freshness boundaries.
- `security-policy` — Cloud opt-in, deny behavior and safe failure records.
- `retired-tool-protocol-gateway` — Single logical retired optional tool-call protocol surface and lossless artifact boundary.

## Impact

- **Domain contexts:** consult `docs/architecture/01-strategic-ddd.md`; references ADR-001…010 as applicable.
- **Dependencies:** none (starting capability).
- **Non-goals:** RAG/AST implementation, Jev, Graphiti extraction, complete observability, agent-written patch interception.
- **Risk:** provider contracts/versions, security and provenance must be tested before asserting production behavior.
- **Acceptance:** normative scenarios in `specs/*/spec.md` plus `tasks.md`; no performance claim without measured evaluation.
