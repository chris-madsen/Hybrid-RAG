# Architecture Description — ACE-AD-001

| Attribute | Description |
| --- | --- |
| Entity of interest | Adaptive Context Engine (ACE), an agent-neutral hybrid context engineering system |
| Description scope | ACE core, provider adapters, local context RPC, Go Bifröst connector, supported deployment and assurance boundaries |
| Purpose | Explain the architecture, its rationale and the evidence needed to establish safe, correct, effective context delivery |
| Audience | See [stakeholders and concerns](concerns.md) |
| Custodian | Repository maintainer; architecture decisions follow the explicit owner/ADR policy |
| Baseline | Native-only cutover PR #378; previous main baseline c5983d008c9353e37182883966ab64eb6601705e inspected 24 November 2026 |
| Status | Version 1.2, internally assessed architecture description; implementation and acceptance statuses are separate |
| Issuing project | Adaptive Context Engine open-source repository, chris-madsen/Hybrid-RAG |
| Issued / revised | 2026-11-24; v1.0 initial migration; v1.1 normative review and path reconciliation; v1.2 native-only code retrieval |
| Author / review | AI-assisted repository contribution; author-side review; maintainer approval remains the PR decision |
| Configuration | Git-versioned Markdown; view, component and convention versions recorded in the architecture catalog |
| Standard reference | [ISO/IEC/IEEE 42010:2022](https://www.iso.org/standard/74393.html) |

## Context and mission

ACE selects and verifies relevant code, authorized documents and retained knowledge for native model requests. It aims to reduce tokens spent per accepted agent task without sacrificing correctness, source access, autonomy or confidentiality. A fivefold reduction is an evaluation target, not an established result.

ACE is an internal context engine, not an agent scheduler, identity provider, billing service, or second model-facing gateway. Hermes owns subscription authentication. Bifröst owns model ingress, final dispatch, retries, streaming and accounting. The ACE connector invokes the local context engine through a versioned authenticated interface and applies the returned context to the same native request.

## Environment and boundaries

Inside the architectural scope: the TypeScript/Effect modular monolith, domain and application ports, selected adapters, internal RPC contract and Go connector. External dependencies include Hermes, Bifröst runtime, ChatGPT/Codex provider, Codebase Memory, independent language servers, Vertex, the selected future Graphiti/FalkorDB path, the workspace and Harbor evaluators. Ownership and trust do not automatically follow process placement: the [context view](views/system-context.md) and [security view](views/security.md) define their relationships.

## Architectural principles

| ID | Principle | Rationale |
| --- | --- | --- |
| AP-01 | One agent-facing gateway and native Responses | Reuse the gateway's existing provider transport; avoid duplicated identity and response semantics |
| AP-02 | Functional DDD and explicit Effect orchestration | Separate invariants from provider IO and resource lifetime |
| AP-03 | Current source bytes are authoritative | Index hits and derived memory cannot prove current exact source |
| AP-04 | Explicit policy, failure and evidence states | Do not promote absent, denied, partial or unverified data to success |
| AP-05 | Reuse maintained providers and evaluate overlap | Avoid parallel infrastructure implementations without measurable need |
| AP-06 | Contract-first public/versioned interfaces | Keep TypeSpec contracts and observable OpenSpec behavior traceable |
| AP-07 | Independent validation before promotion | A code path or local test is not real provider, agent or release acceptance |

## Architecture state

The views distinguish three kinds of statement:

- **Implemented:** supported by the inspected source/configuration, without an implied successful live run.
- **Target / planned:** a selected future capability or unresolved design option; it does not become a working feature by documentation.
- **Evidence:** an observed result tied to its original source/configuration, with separate release and owner decisions.

The current architecture comprises Bifröst native subscription passthrough, internal ACE context RPC v3, native CBM as sole local code retrieval engine (independent LSP research deferred), policy-gated Vertex document search, archive and evaluation mechanisms. Live Graphiti-based temporal recall is a target, not an active runtime feature. Full provider-wire, agent E2E, paired economics and unified production acceptance remain subject to the [canonical acceptance tracker](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md). Reliability remediation is separately tracked by [OpenSpec 014](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md).

## Architecture decisions and change control

The [ADR register](../references/ADR-000-decision-register.md) retains rationale and historical decisions; notably [ADR-019](../references/ADR-019-functional-ddd-typespec-contracts.md), [ADR-020](../references/ADR-020-native-responses-only.md) and [ADR-021](../references/ADR-021-bifrost-single-gateway-ace-context-service.md). ADR-021 governs the single-gateway implementation and internal RPC; older designs remain historical where superseded.

The [essential decision index](decisions.md) records affected concerns, decisions and rationale with original authority. No separate conforming architecture description framework or language is claimed; the viewpoints are project-specific conventions.

Architecture views are governed by [viewpoints](viewpoints.md) and linked by [correspondence rules](correspondences.md). Changes must respect [AGENTS](../../AGENTS.md), applicable ADR/OpenSpec and the operational SDLC. Standards assessment and outstanding evaluation are recorded in [conformance](conformance.md).
