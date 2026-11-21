# ADR-010 — Defer full observability, not token measurement

**Status:** **Deferred** (does not apply to core metrics or security logging)  
**Decision item:** 21  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and project-owner selections dated 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or validation; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records decisions, alternatives, rationale, and review criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests, and topology belong in a later Architecture Design.

## Context

The project owner has separate observability plans to discuss later. Introducing OTel, Langfuse, Prometheus, and Grafana at startup would expand scope and distract from the central objective: saving tokens without compromising quality.

## Decision

- **Do not design a full observability platform yet**, including telemetry backend selection, dashboards, trace storage, SLOs, alerting, or long-term retention.
- **Do not postpone** minimum benchmark metrics: actual Codex token usage, cached/uncached input, output/reasoning where available, pass/fail, elapsed time, and associated calls/costs, as specified in ADR-009.
- **Do not postpone security logging:** record authentication and policy failures, along with technical degraded-mode events, without secrets (ADR-007).
- Exploratory results may be stored locally in JSONL/CSV; do not require Grafana or Langfuse to run tests.

## Reconsideration

Start a separate observability architecture cycle after the first objective benchmark results, or earlier if important failures cannot be diagnosed without telemetry.

## References

- ADR-007, ADR-009
