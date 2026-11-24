> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-006 — Relevance-first Context Bundles without losing long generated code

**Status:** **Accepted**  
**Decision items:** 16B, 17D (clarified by the owner)  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project-owner selections dated 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or verification; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale, and reconsideration criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests, and topology belong in a subsequent Architecture Design.

## Context

The harness should reduce **unnecessary reads and repeated transmission** without destroying essential context. During a long agent loop, Codex may create or modify **2,000 or more lines of code**; arbitrary response limits must not truncate those results or introduce regressions.

## Decision

1. Produce a **structured Context Bundle** containing relevant symbols, spans, relationships, sources, revisions/freshness, and uncertainty, with a way to request details.
2. **Do not impose a mandatory fixed N-token context cap.** Optimize with relevance-first retrieval, deduplication, freshness verification, and progressive disclosure rather than mechanical truncation.
3. **Long code written or edited by an agent is a protected artifact.** Do not silently truncate it, replace the original with a summary, substitute an incomplete patch, or lose it across iterations.
4. **Preserve the full exact contents of generated files and patches** in the working tree or reliable artifact storage. Historically, an optional tool-call view could expose a reference and range for later **byte-exact** expansion. When a full response is needed, support complete output or lossless pagination with explicit continuation markers.
5. Safety limits may defend against pathological events such as infinite recursive traversal or enormous log dumps. They must not silently truncate user source, valid test results, or meaningful patches, nor change semantics.
6. A retired optional tool-call protocol alone cannot guarantee modification or compaction of **model history**: the harness controls its outputs and retained evidence, not Codex's internal context machinery. Deeper integration requires investigation under ADR-001.

## Alternatives

- Fixed 2,000/3,000-token caps per call: rejected because they may omit important dependencies and lengthy results.
- Always return complete files: rejected as the default because it adds unnecessary context.
- Automatically summarize all code: rejected as a replacement for exact artifacts; an **additional** map may be built without replacing originals.

## Acceptance criteria

- An agent writes/edits a file of **at least 2,000 lines**; the resulting disk/output artifact is fully reproducible with matching hashes and no loss between iterations.
- A large relevant span can be retrieved in full without hidden `max_tokens` truncation.
- Under overload, the system returns an explicit error or exact pagination, **never** silent truncation.
- End-to-end tokens decrease on comparative tasks without reducing task pass rate. Include long-horizon tasks, not just small examples.

## Reconsideration

If pathological oversized results cause excessive usage, adaptive guardrails may be introduced only with evidence that they preserve exact artifacts and do not reduce task quality.

## References

- ADR-001, ADR-004, ADR-009

## Owner clarification — 2026-10-21: repeated-context suppression

Progressive disclosure must reduce not only initial payload size but also **repeated transmission of unchanged evidence**.

ACE SHALL evolve ContextBundle delivery so that stable bundle/evidence identities can be acknowledged by an retired optional tool-call protocol client. When unchanged evidence is already known, ACE SHOULD return a compact reference instead of resending the same body. Changed/new evidence is delivered normally; exact original bytes remain available through `ace_expand`.

This is distinct from embedding cache reuse: embedding reuse saves indexing compute, while context receipts/delta delivery save retired optional tool-call protocol/model-input bytes. No hidden mandatory token cap is introduced.

See ADR-014 and OpenSpec change 007.
