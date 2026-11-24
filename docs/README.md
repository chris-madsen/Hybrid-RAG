# ACE documentation

Start with the [Architecture Description](architecture/README.md) for the system's scope, stakeholders, concerns, architecture views and traceability. It uses the ISO/IEC/IEEE 42010:2022 architecture-description concepts as an organizing structure, without claiming formal standards conformance.

## Documentation map

| Area | Purpose | Entry point |
| --- | --- | --- |
| Architecture description | Current and target architecture, stakeholder concerns, views, decisions and cross-view consistency | [Architecture](architecture/README.md) |
| Product requirements | Original product intent and requirements, interpreted through later accepted decisions | [PRD v1.0](references/PRD-v1.0.md) |
| Architecture decisions | Accepted and historical ADRs, rationale and supersession | [Decision register](references/ADR-000-decision-register.md) |
| Behavioral specifications | OpenSpec capability contracts, acceptance criteria and canonical change ledgers | [OpenSpec](../openspec/README.md) |
| Current runtime | Implemented composition, provider readiness and verification boundary | [Current architecture](operations/current-architecture.md) |
| Operations and assurance | Configuration, deployment, runbooks, security and release evidence | [Readiness](operations/ace-configuration-and-readiness-matrix.md), [security gates](operations/security-gates.md), [testing strategy](operations/testing-strategy.md) |
| Development governance | Risk-based AI-assisted SDLC and intent-first stage entry | [SDLC](operations/ai-assisted-sdlc.md), [AGENTS](../AGENTS.md) |
| Research and spikes | Historical research, provider alternatives and evidence | [Research](research/), [spikes](spikes/) |
| Plans and reviews | Dated implementation plans and source-specific reviews; not a substitute for current acceptance | [Plans](plans/README.md), [reviews](reviews/) |

## Current system and acceptance

ACE is an agent-neutral context engine, integrated behind Bifröst as the sole model-facing gateway. The current code composition uses native Responses with the internal TypeSpec context RPC v3; Codebase Memory supplies structural and native semantic/BM25 discovery, Qdrant adds dense/sparse retrieval, and LSP independently validates symbols. Vertex AI RAG handles authorized project documents. The immutable archive exists; the selected Graphiti/FalkorDB live temporal provider remains unavailable in the current runtime.

See [current runtime](operations/current-architecture.md), the [CBM integration](operations/codebase-memory-provider.md), [OpenSpec 013](../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [OpenSpec 014](../openspec/changes/014-ace-audit-reliability-remediation/tasks.md) for the source and acceptance boundary. Local tests, implemented adapters and build evidence are not live provider/agent acceptance.

## Document authority and provenance

Current explicit owner decisions, accepted ADRs, applicable OpenSpec and the engineering rules retain their prescribed precedence. Source and retained evidence establish actual implementation and validation. Architecture views summarize and connect those authorities; dated plans and research do not override them.

The November 2026 documentation relocation removes the duplicated documentation root. The existing detailed DDD records, ADRs, PRD and spikes retain their identities and historical statuses. The older SHA256SUMS.txt is retained as a historical snapshot of a previous layout; it is not a current-tree integrity manifest. Inspect Git history for earlier paths and byte identities rather than recalculating historical evidence.

The [docs-scoped writing instructions](AGENTS.md) govern documentation maintenance. For standards alignment and the outstanding normative review, see [conformance assessment](architecture/conformance.md).
