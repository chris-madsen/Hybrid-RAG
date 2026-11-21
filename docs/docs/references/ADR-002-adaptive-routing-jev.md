# ADR-002 — Adaptive retrieval routing; evaluate Jev before adoption

**Status:** **Proposed (spike)** — Jev implementation is not approved  
**Decision item:** 4  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project-owner selections dated 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or validation; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records decisions, alternatives, rationale, and review criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests, and topology belong in a later Architecture Design.

## Context

Not every request requires RAG, AST, LSP, Vertex AI, and memory simultaneously. Extra routing-model calls have their own cost and may incorrectly exclude a necessary source.

Jev (TypeSafe AI, System One) provides **typed decisions among specified alternatives**, making it a candidate for routing and classification. A valid output type does not establish that a decision is correct. Vendor-reported speed and cost claims require independent validation.

## Decision at this stage

- **Approve a time-boxed experiment**, **not Jev as a required component**.
- Control arm: deterministic rules without an additional model call.
- Experimental arm: Jev as a strategy selector; optionally add a small-LLM third arm where useful.
- Allow **multi-source retrieval plans** and escalation under uncertainty. Do not force every request into one provider.
- Fail-safe default for uncertain routing: let the agent continue searching rather than assert the data does not exist.
- Without authorization for external Jev API transmission, do not call it. Even anonymized metadata is potentially sensitive until assessed.

## Candidate routes (not a final API)

`lexical`, `code_semantic`, `symbol_lsp`, `structural_ast`, `documentation`, `project_memory`, `multi_source`.

## Comparison criteria

1. **Route correctness** on labeled scenarios, including ambiguous requests.
2. Recall of relevant files, symbols, and documents after actual retrieval—not just route-label accuracy.
3. End-to-end task success, all-provider tokens, monetary cost, tool calls, and wall-clock latency.
4. Fallback frequency and sources incorrectly excluded.
5. Behavior on known paths, past ADRs, multiple repositories, recent edits, and ambiguous function names.

## Gate for a future adoption decision

Enable Jev on the main path **only if** held-out results show higher usefulness or better total efficiency than rule-based routing, with no reduction in task success and no unauthorized cloud transmission. Otherwise retain rule-based routing. Numeric thresholds and the corpus are to be agreed in Evaluation Design, not invented in this ADR.

## Risks

- Cloud dependency, vendor lock-in, and API churn.
- A probabilistic decision is not proof.
- A wrong route can harm quality more than one model call costs.
- Repeated routing may compound overhead in a long agent loop.

## References

- Original announcement: https://typesafe.ai/blog/introducing-system-one-models-and-jev
- Official documentation: https://docs.typesafe.ai/
- ADR-006, ADR-007, ADR-009
