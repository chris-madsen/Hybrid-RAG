# Architecture viewpoint and model-kind catalog

A viewpoint defines the conventions used to construct and evaluate a view. The following viewpoints are project-specific, not a mandatory fixed set prescribed by ISO/IEC/IEEE 42010. Each view has one governing viewpoint, explicit concerns and model kinds. Model components may be shared by references rather than copied. Each VP and MK identifier below denotes a version 1.1 specification, dated 2026-11-24 in ACE-AD-001. Increment its version when its conventions or applicability change.

## Model kinds and legends

| ID | Model kind | Conventions / interpretation | Evaluation method |
| --- | --- | --- | --- |
| MK-01 | System context diagram | Named nodes are actors, ACE or external systems; arrows are labeled directed interactions; dashed edges are planned paths; boundary boxes distinguish scope | Check every interface and owner against accepted ADR and runtime entry point |
| MK-02 | Functional/context model | Bounded contexts identify consistency and language boundaries, not services; arrows denote dependency or interaction as labeled | Compare ports, layers and domain invariants with code and fitness rules |
| MK-03 | Behavior / state model | Commands, events, guards, state transitions and failure outcomes; never infer successful terminal state from an error | Review pre/postconditions, negative cases and contract tests |
| MK-04 | Information and lifecycle model | Named data classes, authoritative/derived stores, identity and freshness relationships; planned stores marked target | Inspect exact source, digest, coverage, policy and archive contracts |
| MK-05 | Runtime sequence | Participant lifelines and ordered requests/replies, with separate authorization and provider attempt; optional/blocked paths explicitly labeled | Trace source and retained wire evidence; verify no second dispatch |
| MK-06 | Trust and control matrix | Asset, boundary, risk, control, failure behavior and evidence; local authentication distinct from provider authentication | Review policy/authorization tests and real transmission evidence separately |
| MK-07 | Deployment and operations topology | Nodes/processes and placement constraints; arrows are process communications; targets not assumed deployed | Verify manifests, runtime config, health, identity, recovery and actual deployment evidence |
| MK-08 | Quality and evidence matrix | Concern/contract → verification scope → status/reference; implementation, local tests and live evidence separate | Review exact Git SHA, source/config identities, negative controls and acceptance criteria |
| MK-09 | Decision and correspondence register | Stable IDs, directed links, rationale, supersession, consistency rules and open discrepancies | Inspect references, owner approval and cross-view consistency |

Mermaid is used for compact diagrams; Markdown tables and prose carry explicit semantics. A diagram is descriptive and does not prove a running component. TypeSpec, OpenSpec, ADRs, DDD diagrams and source files are referenced view components with their own existing formats and authority. No new architecture description language or framework is introduced.

## Viewpoint definitions

| Viewpoint | Governs | Stakeholders | Concerns | Aspects | Model kinds |
| --- | --- | --- | --- | --- | --- |
| VP-01 System context | [V-01](views/system-context.md) | SH-01, SH-02, SH-03, SH-04, SH-05 | C-01, C-04, C-05 | AS-01, AS-05 | MK-01, MK-09 |
| VP-02 Functional | [V-02](views/functional.md) | SH-01, SH-02, SH-03, SH-04 | C-01, C-03, C-06, C-08 | AS-02, AS-04 | MK-02, MK-03 |
| VP-03 Information | [V-03](views/information.md) | SH-01, SH-02, SH-03, SH-04, SH-05, SH-06 | C-02, C-04, C-06, C-07, C-08 | AS-03, AS-05, AS-07 | MK-04, MK-06 |
| VP-04 Runtime/integration | [V-04](views/runtime.md) | SH-02, SH-03, SH-04, SH-05 | C-01, C-02, C-03, C-04, C-05, C-06 | AS-01, AS-04, AS-05 | MK-05, MK-03 |
| VP-05 Security/privacy | [V-05](views/security.md) | SH-04, SH-05, SH-07 | C-02, C-04, C-05, C-10 | AS-05, AS-03 | MK-06, MK-09 |
| VP-06 Deployment/operations | [V-06](views/deployment.md) | SH-03, SH-04, SH-05, SH-07 | C-06, C-10 | AS-06, AS-04 | MK-07, MK-08 |
| VP-07 Quality/assurance | [V-07](views/quality.md) | SH-01, SH-02, SH-04, SH-05, SH-06, SH-07 | C-02, C-05, C-07, C-09, C-10, C-11 | AS-07, AS-08 | MK-08, MK-09 |
| VP-08 Evolution/governance | [V-08](views/governance.md) | SH-01, SH-03, SH-05, SH-06, SH-07 | C-03, C-08, C-09, C-11 | AS-08, AS-02 | MK-09, MK-08 |

## Viewpoint applicability and information sources

| VP / version | Perspectives | Correspondence methods | Selection rationale and sources |
| --- | --- | --- | --- |
| VP-01 v1.1 | SP-01, SP-02, SP-03 | CR-01, CR-03, CR-05 | Boundary and responsibility; [ADR-021](../references/ADR-021-bifrost-single-gateway-ace-context-service.md), [current runtime](../operations/current-architecture.md) |
| VP-02 v1.1 | SP-01, SP-02, SP-04 | CR-02, CR-06 | Domain integrity and composition; [ADR-019](../references/ADR-019-functional-ddd-typespec-contracts.md), [strategic DDD](01-strategic-ddd.md), [fitness](07-architecture-fitness-contracts.md) |
| VP-03 v1.1 | SP-01, SP-02, SP-03, SP-04 | CR-03, CR-04, CR-07 | Source authority and retrieval choices; [ADR-006](../references/ADR-006-context-integrity.md), [ADR-014](../references/ADR-014-hybrid-context-engine.md), [CBM](../operations/codebase-memory-provider.md) |
| VP-04 v1.1 | SP-01, SP-02, SP-03 | CR-01, CR-02, CR-03, CR-05 | Request fidelity; [ADR-021](../references/ADR-021-bifrost-single-gateway-ace-context-service.md), [TypeSpec](../../typespec/context-v3.tsp) |
| VP-05 v1.1 | SP-03, SP-04 | CR-03, CR-05, CR-08, CR-09 | Trust and policy; [ADR-007](../references/ADR-007-security-failure-policy.md), [security gates](../operations/security-gates.md) |
| VP-06 v1.1 | SP-02, SP-03, SP-04 | CR-04, CR-05, CR-08 | Placement, readiness and recovery; [ADR-008](../references/ADR-008-local-kubernetes.md), [configuration matrix](../operations/ace-configuration-and-readiness-matrix.md) |
| VP-07 v1.1 | SP-01, SP-03, SP-04 | CR-02, CR-06, CR-07, CR-08, CR-09 | Independent evidence; [ADR-009](../references/ADR-009-harbor-benchmark.md), [testing strategy](../operations/testing-strategy.md) |
| VP-08 v1.1 | SP-02, SP-04 | CR-01, CR-02, CR-07, CR-09 | Controlled evolution; [ADR register](../references/ADR-000-decision-register.md), [SDLC](../operations/ai-assisted-sdlc.md) |

## Model-kind methods and sources

These methods, together with the earlier conventions table, specify the versioned MKs. Diagram labels, table columns and the named model semantics form their legends. Planned or blocked entries are not observed runtime facts.

| MK / version | Construction and analysis method | Correspondence methods | Information sources |
| --- | --- | --- | --- |
| MK-01 v1.1 | Enumerate actors, boundary and owned interfaces from ADRs; draw labeled directions and compare with runtime sequence | CR-01, CR-03, CR-05 | [Flowchart syntax](https://mermaid.js.org/syntax/flowchart.html), ADR-021 |
| MK-02 v1.1 | Extract domain responsibilities and dependency directions from DDD and ports; compare with implementation fitness rules | CR-02, CR-06 | [Strategic DDD](01-strategic-ddd.md), [architecture rules](../../architecture/rules/) |
| MK-03 v1.1 | Derive transitions and guards from FSM/contracts; identify denial, failure and terminal conditions; trace negative tests | CR-02, CR-05, CR-06 | [FSM](04-fsm-workflows.md), [fitness](07-architecture-fitness-contracts.md) |
| MK-04 v1.1 | Inventory stores and data authority; model derivation, identity, lifecycle and target status; compare recovery evidence | CR-03, CR-04, CR-07 | [CBM](../operations/codebase-memory-provider.md), [source coverage](../../src/domain/source-coverage.ts) |
| MK-05 v1.1 | Derive sequence from accepted interface; identify guards, retry and actual send; compare final wire independently | CR-01, CR-03, CR-05 | [Sequence syntax](https://mermaid.js.org/syntax/sequenceDiagram.html), [TypeSpec](../../typespec/context-v3.tsp) |
| MK-06 v1.1 | Map asset/trust crossing to risk, control and failure; compare policy and evidence | CR-03, CR-04, CR-05, CR-08 | [Policy](../../src/domain/policy.ts), [security gates](../operations/security-gates.md) |
| MK-07 v1.1 | Identify processes and placement constraints; distinguish local and proposed deployments; verify readiness separately | CR-04, CR-05, CR-08 | [Local infrastructure](../../infra/k8s/ace-local/README.md), [configuration](../operations/ace-configuration-and-readiness-matrix.md) |
| MK-08 v1.1 | Associate concern/control with test scope, source identity and evidence state; report absent proof | CR-02, CR-04, CR-06, CR-07, CR-08, CR-09 | [Testing strategy](../operations/testing-strategy.md), [fitness](07-architecture-fitness-contracts.md) |
| MK-09 v1.1 | Assign stable IDs to relations and decisions; link method, rationale and outcome; reconcile discrepancies | CR-01, CR-02, CR-05, CR-07, CR-08, CR-09 | [Decision register](../references/ADR-000-decision-register.md), [correspondences](correspondences.md) |

## Construction and review rules

- Each view identifies its governing viewpoint, version, concerns, perspectives, aspects, current versus target scope, versioned components, model kinds and known issues. Derive view elements using the methods above and retain evidence identity. Record the result of every applicable correspondence method, including any missing proof.
- VP-01 records entity boundaries, interface direction and ownership; compare all agent-facing paths with ADR-021.
- VP-02 records bounded contexts, application orchestration, domain/adapters and failure transitions; compare implementation dependencies with fitness contracts.
- VP-03 records authoritative versus derived data, data classes, lifecycle and readiness; verify freshness and allowed egress.
- VP-04 records the native request path and each actual send boundary; distinguish preparation from authorization and response ownership.
- VP-05 records trust domains and negative/security controls; a successful local fixture is not a real external security claim.
- VP-06 records current local processes and future deployment constraints, with recovery prerequisites and known operational gaps.
- VP-07 records measurable concerns and the applicable evidence stage; unknown measurements are not zero and historical runs are not current certification.
- VP-08 records decision authority, change impact and how inconsistencies are resolved without rewriting historical records.

All viewpoints share the [stakeholder/concern identifiers](concerns.md), [correspondence rules](correspondences.md) and the [conformance review](conformance.md). A change in one view requires reviewing the linked views for consistency.
