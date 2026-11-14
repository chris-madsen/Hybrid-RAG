# Proposal — Production retrieval vertical slice and architecture fitness

**Status: Proposed. Owner approval required.** The existing 001–005 changes are only partially implemented; 006 is an acceptance hardening change, **not permission to skip earlier provider approvals**.

## Why

A running agent/Gateway path can appear healthy while real Qdrant/AST/LSP adapters are not composed. An isolated adapter unit test or checked task does not prove the intended ACE value.

## What changes

1. Implement one **real** model-bound retrieval path through Bifröst Gateway Projection with actual provider invocations: Qdrant + approved real embeddings for candidate discovery, Tree-sitter/ast-grep for exact symbol spans, approved language-service semantics for references/types when needed, current source verification and a cited concise projection with authorized lossless source preservation.
2. Enforce Design by Contract (Meyer) at the actual Gateway/provider boundary: preconditions, postconditions, invariants, frame conditions and exceptional postconditions; see `docs/docs/architecture/07-architecture-fitness-contracts.md`.
3. Quarantine hash vectors, regex full-file indexing and home-grown protocol as benchmark/fallback experiments, never as silent default production implementation.
4. Make `complete` based on **required route coverage**, not merely evidence freshness; report capability statuses honestly.
5. Use Harbor paired realistic retrieval-demanding tests with counted successful ACE calls, source/provider trace, correctness and full token/cost attribution; zero-call natural smoke cannot claim gains.

## In scope / out of scope

In scope: real runtime composition, semantic/spans, Gateway/connector conformance, contract tests, integration regression, realistic benchmark attribution and owner quality gate. Out: autonomous code mutation, microservices, new parsers/vector databases/embedding algorithms, Jev promotion, dashboards, rewritten Graphiti, general LSP server reimplementation.

## Dependencies

Accepted ADR-001/003/004/005/006/007/009/011; ADR-012 is **Proposed**. Real LSP, embedding, provider version and Kubernetes host-worktree access decisions still require documented approvals. Do not represent this change as implemented because files exist.
