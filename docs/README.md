# Adaptive Context Engine (ACE) — architecture and OpenSpec documentation

**Current runtime reading path (source-inspected 2026-11-21):** [Current implementation/status](operations/current-architecture.md) → [configuration/readiness](operations/ace-configuration-and-readiness-matrix.md) → [Codebase Memory integration](operations/codebase-memory-provider.md) → [testing](operations/testing-strategy.md). Full provider-wire/Hermes/Harbor acceptance remains open.

**Current code composition:** Hermes uses Bifröst native Responses and the versioned ACE Gateway projection API. Codebase Memory v0.12.1 is the sole structural AST/graph engine and also provides semantic/BM25 discovery; Qdrant remains used for code-only dense/sparse retrieval until independent A/B evidence permits its removal. External LSP checks exact symbol definitions. Vertex AI RAG is for authorized project documentation; Graphiti/FalkorDB are the selected temporal-memory architecture and the immutable archive has supporting code, **but Gateway-native Graphiti is not configured**: the inspected runtime intentionally rejects `ACE_ENABLE_GRAPHITI=true`. Full unified production is therefore not available. The former Hermes-native ContextEngine bridge and model-invoked ACE tools are retired.

**Authoritative acceptance:** [OpenSpec 013](../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [OpenSpec 014](../openspec/changes/014-ace-audit-reliability-remediation/tasks.md). [ADR-020](docs/references/ADR-020-native-responses-only.md) supersedes earlier Gateway protocol assumptions. [ADR-014](docs/references/ADR-014-hybrid-context-engine.md) remains a dated accepted *historical* decision; read its current-implementation note before treating older ast-grep/ContextEngine instructions as live.

**Historical plans:** the [plans index](plans/README.md) is retained for provenance; old retrieval queues are not the current runtime specification. The [release-preflight runbook](plans/unified-production-release-preflight.md) remains the evidence-based promotion procedure.

## Deliverables

**Architecture (Markdown)**

1. [`01-strategic-ddd.md`](docs/architecture/01-strategic-ddd.md) — bounded contexts, ubiquitous language, strategic subdomains, context map and relationships.
2. [`02-event-storming.md`](docs/architecture/02-event-storming.md) — domain commands/events/policies/read models, hot spots and end-to-end flows.
3. [`03-tactical-ddd.md`](docs/architecture/03-tactical-ddd.md) — entities, value objects, aggregates, domain services, invariant boundaries.
4. [`04-fsm-workflows.md`](docs/architecture/04-fsm-workflows.md) — FSM and example workflows with success/error/race paths.
5. [`05-contracts-and-deployment.md`](docs/architecture/05-contracts-and-deployment.md) — proposed tool contracts, domain ports, external adapter boundaries and local Kubernetes topology.
6. [`06-traceability-and-review.md`](docs/architecture/06-traceability-and-review.md) — mapping PRD/ADR → OpenSpec → acceptance, unresolved design decisions.

**Agent SDD implementation packet**

- [`../openspec/README.md`](../openspec/README.md) — execution order and OpenSpec CLI guidance.
- [`../openspec/config.yaml`](../openspec/config.yaml) — project context for coding agent.
- [`../openspec/changes/`](../openspec/changes) — active spec-driven changes, including `007-hybrid-context-engine`, with `proposal.md`, `specs/*/spec.md`, `design.md`, `tasks.md`.
- [`AGENTS.md`](AGENTS.md) — agent safety, scope and implementation policy.
- [`docs/references/`](docs/references) — source PRD and ADR decision record, including Accepted ADR-014 for the hybrid context target.

## DDD modular monolith, not microservices

DDD boundaries reflect different meanings/invariants; they do not automatically determine Deployments/StatefulSets. Primary code is one modular monolith in already installed local Kubernetes; Qdrant/Graphiti backends may be stateful dependencies, Vertex is managed external docs RAG, Harbor is an external benchmark runner.

## FSM usage

FSM is deliberately used for `ContextRequest`, `IndexGeneration`, `SessionArchive`, `DecisionRecord`, `BenchmarkRun`. Routing/scoring are policies, not FSM. No requirement to adopt a particular FSM library.

## Decision hierarchy

1. Explicit later user decisions / newly accepted ADR.
2. Existing accepted ADRs, including ADR-006 (no arbitrary truncation) and ADR-014 (hybrid context target).
3. PRD v1.0 for product intent, interpreted through later ADR clarifications.
4. Proposed DDD architecture and OpenSpec implementation blueprints (revisable).

The package does not claim to have achieved a 5× reduction. Several real integration paths now exist, but full production promotion remains conditional on retained provider/deployment/benchmark evidence and explicit owner approval for the exact release commit.

## Authoritative sources for SDD / components

- OpenSpec official: https://github.com/Fission-AI/OpenSpec
- OpenSpec format: https://github.com/Fission-AI/OpenSpec/blob/main/docs/getting-started.md
- OpenSpec spec-driven schema: https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/schema.yaml
- Harbor: https://github.com/harbor-framework/harbor
- Source PRD and ADRs are in `docs/references/`.
