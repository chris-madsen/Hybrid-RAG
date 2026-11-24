> **Current implementation note, 2026-11-21:** PR #316 supersedes the *provider-selection implementation details* below: native Codebase Memory v0.12.1 now owns runtime AST/graph and has Hybrid LSP plus semantic/BM25 discovery. Separate LSP still validates identifier selection/definition; ast-grep remains only the architecture linter. This annotation does not rewrite the accepted historical decision. [Current architecture](../operations/current-architecture.md).

> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-004 — AST, LSP, dependency analysis, and index freshness

**Status:** **Accepted** for the principles; selection of a specific LSP adapter was pending benchmarking  
**Decision items:** 8B, 9D, 10C, 11B, 12D  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project-owner selections dated 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or verification; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale, and reconsideration criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests, and topology belong in a subsequent Architecture Design.

## Context

RAG discovers candidates but cannot establish that a specific symbol or relationship exists. AST distinguishes syntactic constructs; LSP and language services provide semantic definitions, references, and types within their supported scope. None of these mechanisms guarantees a complete dynamic call graph.

## Decision

1. **AST:** Select the existing Tree-sitter/ast-grep family of tools; do not write a custom parser.
2. **LSP:** Compare **Serena** against direct **TypeScript Language Service / tsserver** integration for coverage and per-query cost. No final choice was made at this stage. Consider license compliance in addition to quality (Serena application GPL-3.0-or-later, SolidLSP MIT).
3. **Code graph:** Start with AST/LSP facts and precise symbol resolution. Add a separate persistent graph index only if its value is demonstrated; do not treat GitNexus or CodeGraphContext as already selected dependencies.
4. **Incremental indexing and working-tree overlay** are required. Current source takes precedence over persisted RAG entries; uncommitted edits must be tracked. Mark evidence `stale/uncertain` when freshness cannot be established.
5. **Impact analysis on demand:** start with references/types, then targeted CFG, data-flow, CodeQL or CPG, and finally tests/runtime traces where available. Do not run the full expensive sequence for every request.
6. **Incomplete static analysis:** absence of static references does not prove that dynamic dependency injection, reflection, runtime registrations, cross-service calls, or untested paths are unused.

## Alternatives

- Regex/grep alone: fast baseline, but no symbol resolution.
- TypeScript Compiler API alone, without Tree-sitter: feasible, but not selected as the initial structural layer.
- An always-on full Code Property Graph: substantial overhead without demonstrated value.
- Reindex everything after each edit: straightforward but wasteful and potentially slow.

## Evidence provenance and labeling

A Context Bundle should include `source_kind`, `file`, `symbol`, `line_range`, `revision/hash`, `evidence_method` (e.g. `ast`, `lsp`, `runtime_test`), and a `completeness/uncertainty` indicator. This is a logical requirement, not a finalized JSON Schema.

## Acceptance criteria

- After a function edit, analysis sees the new symbol and does not cite stale source as current.
- `find references` distinguishes same-named symbols where the server supports that distinction.
- Unknown dynamic calls never justify a confident "definitely unused" claim.
- Measure AST/LSP against the Codex baseline and separate historical optional tool-call tools: tool calls, tokens, and static-analysis errors.
- Compare Serena and the native language service on identical tasks, including licensing and runtime overhead.

## Reconsideration

Revisit for a change in primary language, inadequate LSP accuracy, or demonstrated value from a persistent semantic index (such as SCIP) or a separate code graph.

## References

- https://github.com/tree-sitter/tree-sitter
- https://github.com/ast-grep/ast-grep
- https://github.com/oraios/serena
- https://github.com/sourcegraph/scip-typescript
- ADR-003, ADR-006

## Owner instruction — 2026-10-19

**Do not preselect an LSP or write a new ADR simply to choose one.** Codex must execute the existing ADR-004 experimental comparison: **Serena versus direct TypeScript Language Service**. Install both on comparable TS/JS fixtures; verify same-name definitions/references, writes vs definitions, types, diagnostics, source freshness, unsupported/dynamic cases, version/licensing and runtime overhead. Compare full agent task success, tool calls, latency and total token/cost. Retain failing cases and submit a reasoned selection to the owner; neither candidate becomes production-approved solely by being implemented. Experiments themselves are approved before final provider selection.

## Implementation clarification — 2026-10-21

PR #94 materially completed the de-bespoke direction:

- production structural discovery now uses pinned **ast-grep** rather than an ACE-maintained Tree-sitter node table;
- production semantic verification uses a generic JSON-RPC **LSP** adapter with an external maintained language server;
- request-time workspace reconciliation prevents stale indexed state from being called complete.

Therefore future work SHALL NOT rebuild a custom AST extractor or language-server project lifecycle. New languages are added by registering maintained ast-grep language support and a maintained LSP server/configuration.

LSP remains an enrichment/verification layer. Hybrid retrieval candidate discovery is defined by ADR-014/OpenSpec 007 and is not replaced by LSP.
