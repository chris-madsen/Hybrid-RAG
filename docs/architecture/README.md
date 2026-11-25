# ACE Architecture Description

**AD identifier:** ACE-AD-001 · **Edition:** 1.2 · **Baseline:** 25 November 2026, native-only cutover (#378), pending final review and acceptance.

This architecture description is organized using the concepts of [ISO/IEC/IEEE 42010:2022](https://www.iso.org/standard/74393.html), Software, systems and enterprise — Architecture description. It describes the software system and its environment, rather than prescribing a different development methodology. The [clause-by-clause assessment](conformance.md) records the internal evaluation, including unresolved architecture evidence. It is not third-party certification.

## Read the architecture

| Artifact | Purpose |
| --- | --- |
| [Architecture description](architecture-description.md) | Entity of interest, scope, environment, architecture principles and baseline |
| [Stakeholders, perspectives, concerns and aspects](concerns.md) | Identified interests and the problems the description addresses |
| [Viewpoint catalog](viewpoints.md) | View construction rules, model kinds and evaluation methods |
| [System context](views/system-context.md) | System boundary, actors and external interfaces |
| [Functional architecture](views/functional.md) | Domain responsibilities, layers and behavior |
| [Information architecture](views/information.md) | Source truth, retrieval, data classes and temporal memory |
| [Runtime and integration](views/runtime.md) | Native model route, context projection and attempt authorization |
| [Security and privacy](views/security.md) | Trust boundaries, controls and denied behavior |
| [Deployment and operations](views/deployment.md) | Processes, infrastructure, recovery and operational readiness |
| [Quality and assurance](views/quality.md) | Fitness functions, verification scopes and benchmark acceptance |
| [Evolution and governance](views/governance.md) | Decisions, change control and architecture maintenance |
| [Correspondences](correspondences.md) | Cross-view relationships, invariants, source/contract and evidence references |
| [Essential decisions and rationale](decisions.md) | Decisions, affected concerns, consequences and original ADR authority |
| [Conformance assessment](conformance.md) | Standards alignment, known inconsistencies, evaluation and outstanding work |

## Detailed model components and original records

The existing detailed design records are retained as supporting source models, not rewritten as a competing architecture. Current view components have their own IDs, versions and governing model kinds. Where their historical assumptions differ from current accepted decisions or source, use the current view and the identified supersession.

- [Strategic DDD](01-strategic-ddd.md), [Event Storming](02-event-storming.md), [Tactical DDD](03-tactical-ddd.md), [FSM workflows](04-fsm-workflows.md).
- [Contracts and deployment](05-contracts-and-deployment.md), [traceability and review](06-traceability-and-review.md), [architecture fitness contracts](07-architecture-fitness-contracts.md).
- [Original product requirements](../references/PRD-v1.0.md) and [ADR register](../references/ADR-000-decision-register.md).
- [Runtime composition and verification boundary](../operations/current-architecture.md), [testing strategy](../operations/testing-strategy.md), [operational SDLC](../operations/ai-assisted-sdlc.md).
- [OpenSpec 013](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [OpenSpec 014](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md).

[Back to documentation index](../README.md).
