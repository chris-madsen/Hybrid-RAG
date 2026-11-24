> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# Critical architecture review: contracts exist, but the useful ACE system was not assembled

**Status:** Blocking architectural review · **Date:** 2026-10-18 · **Source:** [`ef2c7967ec6876a978800de01523146a8d077709`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/commit/ef2c7967ec6876a978800de01523146a8d077709)

**Verdict:** This was not a complete implementation of the agreed RAG + AST + LSP hypothesis. It was a typed architectural scaffold with separate adapters, while the executable optional tool-call bootstrap used a weak lexical/whole-file path. The existence of interfaces must not be mistaken for an operational product. Earlier architecture documentation and SDD decomposition also contributed: the requirements did not impose a sufficiently strong end-to-end gate. **The following are verifiable findings, not assertions about the author's motives.** This was a static review; code and integrations were not run locally.

## Blocking findings

### P0 — The main executable path loses the product's purpose

- [`src/bin/ace-retired-tool-protocol.ts#L35-L68`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/bin/ace-retired-tool-protocol.ts#L35-L68) initializes `buildLocalCodeIndex` and `makeLocalContextProvider`. Qdrant, Tree-sitter, approved LSP, Graphiti and Vertex are not connected into one production composition.
- [`src/adapters/local-code-index.ts#L28-L91`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/local-code-index.ts#L28-L91) extracts names using `symbolPattern` regex, assigning each candidate `range: 1..endLine` and the entire file as `text`. Calling a whole-file snippet “symbol-aware” does not make it a symbol.
- [`src/domain/retrieval.ts#L127-L158`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/domain/retrieval.ts#L127-L158) ranks by lexical `includes`, not semantic retrieval.
- **Why this matters:** The intended product delivers accurate context economically, not a matched name followed by a full source file. **Blocking acceptance:** DBC-01/02/03 and a real Codex → optional tool call → Qdrant → AST → LSP → current source → bundle path.

### P0 — SHA-256 produces deterministic projections, not semantic embeddings

[`src/adapters/local-hash-embedding.ts#L17-L40`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/local-hash-embedding.ts#L17-L40) creates pseudovectors from cryptographic hashes. This **does not imply semantic similarity**. The implementation was explicitly labeled `local_sha256_projection_v1` in `SPIKE-RETRIEVAL-PROVIDERS.md`, a mitigating disclosure. Still, scoring `2/3` on three fixtures proves nothing about real embeddings. **Blocking acceptance:** use a measured genuine embedding model, local by default. Keep the hash implementation only as a fixture double.

### P1 — Custom optional tool-call transport without an approved justification

[`src/transport/retired-tool-protocol-stdio.ts#L112-L165`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/transport/retired-tool-protocol-stdio.ts#L112-L165) implements JSON-RPC and tool-call lifecycle itself. Why maintain a protocol implementation when an official TypeScript SDK exists? Passing internal contract tests does not establish conformance with a current client. **Blocking acceptance:** adopt the SDK or document a demonstrated need for custom implementation in an ADR.

### P1 — Incorrect reference semantics

[`src/adapters/typescript-language-service.ts#L95-L100`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/typescript-language-service.ts#L95-L100) assigns `isDefinition: item.isWriteAccess`. A write is not necessarily a definition. This is a factual bug, not a stylistic preference. **Blocking acceptance:** use the correct language-service contract and test same-named symbols and write references.

### P1 — Memory may destroy data and invalidate stable references

- [`src/adapters/file-memory-archive.ts#L69-L85`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/file-memory-archive.ts#L69-L85) deletes `contentPath(existing.contentDigest)` without checking whether another episode refers to the same digest. Deleting one episode may break another episode sharing the blob.
- [`src/adapters/codex-session-history.ts#L52-L83`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/codex-session-history.ts#L52-L83) includes the **whole-file** `sourceDigest` in the episode ID. Appending to a session changes old record identities, so replay is no longer idempotent.
- **Blocking acceptance:** DBC-10/11, stable event identities, reference-safe deletion, atomicity and replay tests.

### P1 — `complete` may be false evidence

[`src/domain/retrieval.ts#L159-L179`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/domain/retrieval.ts#L159-L179) sets `complete` based on freshness of returned evidence. If a required provider returns nothing and only adds a warning, `complete` can still be true. **Blocking acceptance:** completeness requires coverage of required sources and successful checks, not merely absence of stale items.

### P1 — Token usage and performance do not yet demonstrate ACE value

[`benchmarks/reports/ace-local-smoke-paired-repeat5.md`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/benchmarks/reports/ace-local-smoke-paired-repeat5.md) reported **263,441** baseline vs **654,919** ACE tokens (10 ACE calls, equal smoke-test quality): ACE used approximately **2.49×** as many tokens. [`ace-local-smoke-natural-paired-repeat5.md`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/benchmarks/reports/ace-local-smoke-natural-paired-repeat5.md) reported **362,152** vs **300,432**, but with **zero ACE calls**. Neither result demonstrates 5× savings or retrieval-based efficiency. Both reports **disclose their limitations**, which must be preserved. **Blocking acceptance:** substantial paired code-intelligence tasks, provider traces, actual ACE calls, and no trivial smoke tests treated as product proof.

### P2 — The hot path scans and hashes the whole workspace

[`src/adapters/local-context-provider.ts#L26-L46`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/local-context-provider.ts#L26-L46) takes a snapshot before search; [`node-workspace-port.ts#L44-L76`](https://github.com/chris-madsen/Mult-agent-AI-Orchestration/blob/ef2c7967ec6876a978800de01523146a8d077709/src/adapters/node-workspace-port.ts#L44-L76) recursively reads and hashes files. Even without a benchmark, cost necessarily scales with the tree size rather than just the request; the **magnitude** of slowdown was not measured. Measure incremental observation, targeted digest checks and p95 latency before choosing Rust.

## Root causes: more than “the agent made mistakes”

1. **Our SDD decomposition was insufficient:** it organized ports and tasks horizontally but failed to make the end-to-end product the overriding acceptance criterion. A documented `controlled exception` could too easily hide an unready required provider.
2. **Instruction governance was weak:** root AGENTS contained hundreds of generic rules, while ACE-specific guidance lived only under `docs/AGENTS.md` and did not automatically apply to `src/`.
3. **Implementation error:** the executable bootstrap chose a weak fallback rather than composing the selected technologies; existing tests missed independent semantic and archive defects.
4. **Premature checklist closure:** marking ports and smoke tests `[x]` implied maturity without runtime provider acceptance.

## Required remediation — no new months-long planning cycle

- Preserve DDD boundaries, strict types, useful tests, security invariants and Harbor evidence.
- Do not introduce eight microservices or build a new parser, embedding engine or optional tool-call framework.
- Specify each mandatory Meyer contract in `docs/architecture/07-architecture-fitness-contracts.md`; correct OpenSpec 001/002/003/004; accept `006-production-retrieval-vertical-slice` **only with a real end-to-end composition** backed by provider and agent evidence.
- Block `Production Ready` until owner review, real provider/E2E tests, quality-gated Harbor results and acceptance of pending ADRs.
- First correct AST spans, approved embeddings, LSP references, shared-memory content deletion and `complete` semantics.

**The tone of this review is deliberately forceful because architectural divergence is costly. These findings concern code and process, not the developer's character.** The existing contracts and adapters are salvageable foundations—not a reason to restart the whole project.
