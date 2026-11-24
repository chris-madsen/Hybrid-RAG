# Architecture viewpoint and model-kind catalog

A viewpoint defines the conventions used to construct and evaluate a view. The following viewpoints are project-specific, not a mandatory fixed set prescribed by ISO/IEC/IEEE 42010. Each view has one governing viewpoint, explicit concerns and model kinds. Model components may be shared by references rather than copied.

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

## Construction and review rules

- Each view identifies its governing viewpoint, intended concerns, current versus target scope, and linked authoritative components.
- VP-01 records entity boundaries, interface direction and ownership; compare all agent-facing paths with ADR-021.
- VP-02 records bounded contexts, application orchestration, domain/adapters and failure transitions; compare implementation dependencies with fitness contracts.
- VP-03 records authoritative versus derived data, data classes, lifecycle and readiness; verify freshness and allowed egress.
- VP-04 records the native request path and each actual send boundary; distinguish preparation from authorization and response ownership.
- VP-05 records trust domains and negative/security controls; a successful local fixture is not a real external security claim.
- VP-06 records current local processes and future deployment constraints, with recovery prerequisites and known operational gaps.
- VP-07 records measurable concerns and the applicable evidence stage; unknown measurements are not zero and historical runs are not current certification.
- VP-08 records decision authority, change impact and how inconsistencies are resolved without rewriting historical records.

All viewpoints share the [stakeholder/concern identifiers](concerns.md), [correspondence rules](correspondences.md) and the [conformance review](conformance.md). A change in one view requires reviewing the linked views for consistency.
