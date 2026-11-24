> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-015 — Hermes as the primary agent for the Harbor feedback loop

**Status:** Accepted  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-23  
**Decision source:** Explicit project-owner decision during PR #157.

## Context

> **Superseded delivery detail (owner decisions 2026-10-23/24):** This ADR retains the historical Hermes-as-benchmark-agent and OAuth decision. **Its ACE-via-native-optional-tool-call injection assumption is obsolete.** ADR-016 documents the implemented request-local Hermes `ContextEngine` / direct JSONL bridge, with the optional tool protocol reserved for explicit tools. ADR-017 selects planned Bifröst → ACE projection for configurable-endpoint agents. Neither a registered optional tool server nor an optional tool call proves model-bound context delivery. LangGraph orchestrates agents outside ACE.

ACE was designed to be agent-neutral, with verified context delivered through a then-planned optional tool-call integration rather than coupling to a particular coding harness. The existing feedback loop centered on Codex, but its actual purpose was to test whether ACE improves an agent's natural use of context. The owner selected Hermes for that evaluation because it offered native optional tool-call support and, at the time, a more suitable context-injection model.

There was no need to replace the underlying GPT model or move to separately billed API usage. Hermes supported the `openai-codex` provider using ChatGPT/Codex OAuth state. Harbor 0.24.0 could run Hermes and forward optional tool servers, but its built-in Hermes adapter did not support that OAuth provider; a thin benchmark adapter was therefore needed.

## Decision (historical)

1. **Hermes is the primary agent for the current Harbor feedback loop.** The native and ACE-optional arms use the same Hermes version, model, reasoning effort, task image, source revision, timeout and single attempt.
2. **GPT is accessed through Hermes `openai-codex`.** Authentication comes from Hermes's own `~/.hermes/auth.json` store, created by `hermes auth add openai-codex`. Benchmarks must not reuse `~/.codex/auth.json`; Hermes upstream separates refresh-token chains so Hermes and Codex CLI/VS Code do not invalidate one another. The store is copied only to `HERMES_HOME=/tmp/hermes` in the ephemeral task container, then refreshed OAuth state is synchronized atomically back to the host Hermes store after the serial trial. Credential bytes never enter manifests or logs.
3. **ACE was connected as a native Hermes optional tool-call server.** The baseline arm received no ACE; the ACE-optional arm received exactly one stdio server named `ace`, using `/ace/scripts/harbor-ace-retired-tool-protocol.sh`.
4. **Harbor 0.24.0 remained selected.** Until upstream supported `openai-codex`, the minimal custom adapter `scripts.harbor_hermes_codex_oauth:HermesCodexOAuth` reused the standard Harbor Hermes runtime.
5. **Pin the Hermes version** in each experiment/job evidence record. The feedback-loop version selected at the time was `v0.22.3`. Any update requires new provenance and evidence, not a silent switch to `latest`.
6. **Do not rewrite historical Codex evidence.** It remains valid only for the runtime that produced it. After changing the primary agent, run a new one-task Hermes smoke before main repetitions or holdout.
7. **Codex remains a comparison and compatibility client.** This does not make ACE Hermes-specific or prohibit matched Codex head-to-head trials.

## Comparison invariants

- In a paired Hermes run, the sole intentional difference between arms was ACE optional-tool availability.
- Provider, model and reasoning identities match across arms.
- Zero ACE calls means `ACE_NOT_USED`, not ACE-caused savings.
- Missing Hermes/provider usage means `UNKNOWN`, not zero.
- Preserve and correlate Hermes sessions, optional-tool evidence, ACE provider traces and request IDs.
- Do not publish raw source, credentials or private session payloads.

## Consequences

**Benefits:**
- ACE had a natural native optional-tool integration instead of Codex-specific configuration injection.
- The coding harness could change independently of the underlying GPT subscription/model.
- The experimental contract aligned more closely with ACE's agent-neutral intent.

**Costs:**
- Before upstream Harbor support, a small adapter was required to stage/sync Hermes-owned OAuth state without touching Codex CLI credentials.
- Earlier Codex smoke/preflight results were not Hermes E2E proof.
- Token/cache fields depend on actual Hermes/Harbor/provider exports; missing fields remain unknown.

## Reconsideration

Revisit if upstream Harbor supports Hermes `openai-codex` OAuth with equivalent provenance/security guarantees, if Hermes loses required optional-tool/session evidence, or if matched benchmarks demonstrate that another agent harness better suits the primary feedback loop.

## Related documents

- ADR-001 — agent-neutral retired optional tool-call boundary
- ADR-006 — structured Context Bundle and progressive disclosure
- ADR-009 — Harbor benchmarking (agent-specific Codex clauses superseded here)
- ADR-014 — Hybrid Context Engine
- ADR-016 — implemented native Hermes request-time projection (superseded optional-tool injection)
- ADR-017 — planned Bifröst model-bound gateway for configurable-endpoint agents
- OpenSpec change `002-harbor-evaluation`
