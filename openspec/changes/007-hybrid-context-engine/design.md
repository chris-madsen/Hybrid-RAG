> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# Design — Agent-neutral multi-layer hybrid context

**Normative ADR:** ADR-014.

**Transport clarification (updated 2026-11-14):** This specification governs ACE internal retrieval/projection semantics. Bifröst Gateway is the sole agent-facing delivery path; Hermes-native and model-invoked ACE delivery paths are retired. Transport ownership is defined by active change `010-gateway-only-ownership`.

## Retrieval pipeline

```text
query + source obligations + working context
             |
             +--> dense embedding ----------+
             +--> sparse BM25 --------------+--> Qdrant RRF --> optional reranker
             +--> structural/exact priors --+
                                                  |
                                                  v
                                         exact source reread
                                                  |
                                                  v
                                              LSP enrich
                                                  |
                 +--------------------------------+------------------+
                 |                                |                  |
                 v                                v                  v
             current code                    Vertex docs        Graphiti memory
                 |                                |                  |
                 +----------------------+---------+------------------+
                                        v
                             source-aware ContextBundle
                                        |
                               inline minimum + handles
                                        |
                         exact verified source retention
```

## Provider ownership

ACE owns policy, orchestration, provenance, completeness and delivery.

ACE does not own:
- parser grammars;
- language-server project lifecycle;
- vector database internals;
- cross-encoder model training;
- Git implementation;
- graph database semantics.

## Hybrid code retrieval

A code point contains dense and sparse representations for the same structural chunk. Dense embeddings answer behavior/meaning queries. Sparse BM25 protects exact identifiers, configuration keys and rare literals.

Qdrant performs native candidate prefetch and RRF fusion. The initial shortlist is larger than the final delivery set.

The reranker, when approved, only reorders the fused shortlist.

## Working-state priors

ACE independently observes Git/worktree state. The Gateway adapter MAY supply focus/open-file/range hints only through an accepted, versioned contract field; no retired delivery client is an alternate source of authority.

Working-state values influence ranking and context assembly but never override:
- exact source digest verification;
- source policy;
- required-source completeness.

## Delta delivery

ContextBundle evidence has stable identities. A Gateway request can provide known evidence identities where the accepted wire contract supports them. ACE may omit unchanged projected evidence while retaining exact verified source bytes internally for authorized re-projection.

This is distinct from embedding cache reuse:
- embedding reuse reduces indexing compute;
- context delta delivery reduces repeated context-transfer/model input bytes on the authorized Gateway adapter where compatibility and provider-wire evidence permit it.

## Failure semantics

Each optional stage reports whether it ran:
- sparse unavailable;
- reranker unavailable;
- LSP unavailable;
- docs/memory unavailable.

A required stage failure makes source coverage incomplete. An optional stage failure may degrade ranking but cannot be represented as if it ran successfully.

## Measurement

Every hybrid experiment reports:
- branch recall/rank;
- fused rank;
- rerank rank;
- context bytes before/after dedupe;
- new/reused/expanded bytes;
- agent tokens and tool calls;
- task quality.
