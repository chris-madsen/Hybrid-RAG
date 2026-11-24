# ADR-007 — Data security, cloud-call policy and failure handling

**Status:** **Accepted**  
**Decision items:** 18B (with logging), 19B  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and owner decisions dated 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or validation; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale, and review criteria. Detailed classes, database schemas, API contracts, Kubernetes manifests, and topology belong in subsequent Architecture Design.

## Context

The harness handles source code, private discussions, API keys and project documentation. Failures of LSP, Qdrant or Vertex must not unnecessarily prevent Codex from using safe tools, but authorization failures or policy violations must never trigger an unsafe fallback.

## Decision

1. Source code and original conversations **stay local by default**. Cloud embedding/decision APIs for private code require project-specific opt-in and an explicitly defined data boundary.
2. Do not send secrets, tokens, `.env` contents, private key material or sensitive payloads to Vertex, Jev, embedding providers or usage logs. Classification and redaction are requirements; the implementation architecture defines the mechanisms.
3. Treat ordinary **technical failures** (timeouts, retrieval backends unavailable, LSP down) as degraded operation: disclose the unavailable source, allow normal safe tools, and never simulate successful retrieval.
4. **Authentication/authorization failures, policy denials, data-residency violations and attempted secret leaks** are fail-closed: stop the forbidden operation without silently switching endpoint or provider.
5. **Log all such failures safely**, including timestamp, component/service, error category, correlation ID and action/outcome. Do not log passwords, private prompts or source.
6. Do not present stale cached content as trustworthy current evidence during degradation; label it `unavailable/unknown/stale`.
7. Do not make covert autonomous changes to code or infrastructure outside Codex/user permissions.

## Rejected alternatives

- Always fail-open, including after access denials: unacceptable.
- Completely halt on every retrieval outage: unnecessarily reduces system usefulness.
- Send all local source to the cloud by default: violates the chosen privacy policy.

## Acceptance criteria

- Fault injection: Qdrant/LSP/Vertex unavailable → correct degraded status, safe fallback and recorded error.
- Invalid API credentials or missing opt-in → outbound request blocked with no alternate route.
- Secret scans of logs and redaction tests show no private-code leakage in external requests by default.
- Retrieval never reports false success after a timeout or failure.

## Reconsideration

Revisit for enterprise deployments with different IAM/KMS, licensing and data-residency requirements.

## References

- ADR-001, ADR-003, ADR-005, ADR-008
