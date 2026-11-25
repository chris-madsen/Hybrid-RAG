# Architecture correspondences and traceability

Correspondences relate architecture-description elements and support consistency across views. This register records both the relationships and the rules used to evaluate them. It does not replace the behavioral requirement or evidence ledgers.

## Correspondence methods

| ID | Related elements | Consistency rule | Evaluation method |
| --- | --- | --- | --- |
| CR-01 | V-01, V-04, V-08, ADR-021 | One Bifröst agent-facing route; ACE internal context computation only | Compare context/sequence diagrams, accepted decision, actual connector and TypeSpec |
| CR-02 | V-02, V-04, V-07, V-08, ADR-019 | Domain invariants and typed ports align with public/versioned contracts without provider DTO leakage | Source dependency fitness rules, generated contract checks and negative tests |
| CR-03 | V-01, V-03, V-04, V-05, C-02/C-04 | Only verified current original source can support source facts; required source and data-class policy apply through delivery | Inspect source coverage, exact digest/range and policy contracts; compare actual delivery evidence |
| CR-04 | V-03, V-06, V-07 | Provider and archive state, persistence and recovery readiness must agree across information and deployment views | Check configuration/readiness, real integration/restart evidence; never treat target temporal provider as active |
| CR-05 | V-01, V-04, V-05, V-06, V-07 | The same approved native route, identity, final body, source policy and each physical attempt are bound; local service remains internal | Compare route/placement/authorization and inspect final provider wire; separate streaming evidence |
| CR-06 | V-02, V-07 | Observable capability requires actual runtime port composition, not the existence of an adapter | Fitness/DbC tests and appropriate real-provider evidence |
| CR-07 | V-03, V-07, V-08 | Native provider acceptance uses absolute retrieval/scale evidence; agent economics use matched tasks; no unproven removal or 5× claim | Review frozen benchmark and accepted-task evidence; separate retrieval and agent outcomes |
| CR-08 | V-05, V-06, V-07 | Operational and supply-chain assurance must bind exact release source, artifacts and applicable real evidence | Inspect provenance, SBOM, signature/verification records, recovery and readiness evidence |
| CR-09 | V-05, V-07, V-08 | Decision and acceptance status are not promoted by docs, a local build or a controlled exception | Compare owner/ADR/OpenSpec status, recorded source and actual verification conclusions |

## Recorded correspondences and evaluation

The participating architecture description for each CO relation is ACE-AD-001 v1.1. CO identifies the actual relationship between AD elements; CR identifies its governing method. These are documentary/source evaluations, not a fresh live execution. An unproved method is recorded as not satisfied, with its missing evidence.

| Correspondence | Participating AD elements | Method | Evaluated result and known gap |
| --- | --- | --- | --- |
| CO-01 | VC-01A, VC-04A, VC-08A, ADR-021 | CR-01 | HOLDS for documented/source ownership: Bifröst owns model dispatch and v3 is internal; external wire is evaluated in CO-05 |
| CO-02 | VC-02A, VC-04B, VC-07A, VC-08A, ADR-019 | CR-02 | NOT SATISFIED as complete implementation proof: view rules agree, but exact-final-head dependency and generated-contract checks must be observed |
| CO-03 | VC-01A, VC-03A, VC-04B, VC-05A, C-02, C-04 | CR-03 | NOT SATISFIED for end-to-end proof: source authority and policy agree; complete source coverage and real outbound data evidence remain open |
| CO-04 | VC-03A, VC-06A, VC-07A | CR-04 | NOT SATISFIED operationally: temporal recall and deployment status agree; provider restart, publication and archive recovery acceptance remains incomplete |
| CO-05 | VC-01A, VC-04A, VC-05A, VC-06A, VC-07A | CR-05 | NOT SATISFIED: documented route and placement agree; real physical wire, native stream and tenant/attempt evidence remain open |
| CO-06 | VC-02A, VC-07A | CR-06 | NOT SATISFIED for full composition: scoped CBM/Qdrant/LSP source and tests exist; real provider/agent acceptance remains incomplete |
| CO-07 | VC-03A, VC-07A, VC-08A | CR-07 | NOT SATISFIED: absolute native retrieval/scale and accepted-task economics remain unproven; no claimed fivefold saving |
| CO-08 | VC-05A, VC-06B, VC-07A | CR-08 | NOT SATISFIED: exact release signature, deployment and recovery evidence remain incomplete |
| CO-09 | VC-05B, VC-07B, VC-08A, C-11 | CR-09 | HOLDS for the AD: current/target/acceptance states remain separate; migration does not approve a release or promote tracker status |

Methods with unsatisfied outcomes are recorded rather than silently treated as passed. Such open architecture/evidence findings are distinct from a missing mandatory AD element. Before changing a result, review the method's stated evidence and exact configuration. These methods apply to the AD and the linked viewpoint/model-kind specifications.

## Concern-to-decision-to-evidence register

Source and test links indicate verification mechanisms, not current PASS results.

| Concern | Decision / model reference | Implementation or contract | Verification / acceptance reference |
| --- | --- | --- | --- |
| C-01 | [ADR-021](../references/ADR-021-bifrost-single-gateway-ace-context-service.md), V-01/V-04 | [Context RPC](../../typespec/context-v3.tsp), [connector](../../integrations/bifrost/ace-connector/README.md) | [Responses architecture contracts](../../test/responses-only-architecture.contracts.test.ts), [013](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) |
| C-02 | [ADR-006](../references/ADR-006-context-integrity.md), V-03 | [Source coverage](../../src/domain/source-coverage.ts), [assembly](../../src/application/context-assembler.ts) | [Meyer contracts](../../test/bertrand-contracts.test.ts), [014](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md) |
| C-03 | [ADR-019](../references/ADR-019-functional-ddd-typespec-contracts.md), V-02 | [Ports](../../src/application/ports.ts), [TypeSpec](../../typespec/context-v3.tsp) | [Architecture rules](../../architecture/rules/), [fitness contracts](07-architecture-fitness-contracts.md) |
| C-04 | [ADR-007](../references/ADR-007-security-failure-policy.md), V-05 | [Policy](../../src/domain/policy.ts), [authorization](../../src/application/gateway-attempt-authorization-service.ts) | [Data-class contracts](../../test/data-class-policy.contracts.test.ts), 013 C03–C05 |
| C-05 | [ADR-020](../references/ADR-020-native-responses-only.md), [ADR-021](../references/ADR-021-bifrost-single-gateway-ace-context-service.md) | [Projection service](../../src/application/responses-projection-service.ts), [attempt authorization](../../src/application/gateway-attempt-authorization-service.ts) | [Projection contracts](../../test/responses-projection-service.contracts.test.ts), 013 C03–C07 |
| C-06 | [ADR-008](../references/ADR-008-local-kubernetes.md), V-06 | [Runtime](../../src/bin/ace-runtime.ts), [workspace sync](../../src/application/workspace-sync.ts) | [Readiness](../operations/ace-configuration-and-readiness-matrix.md), [backup/restore](../operations/local-memory-backup-restore.md), 014 |
| C-07 | [ADR-009](../references/ADR-009-harbor-benchmark.md), [ADR-018](../references/ADR-018-ace-context-economics-audit.md) | [Evaluation model](../../src/domain/evaluation.ts), [Harbor evidence](../../src/domain/harbor-four-arm-evidence.ts) | [Testing strategy](../operations/testing-strategy.md), 013 C08 |
| C-08 | [ADR-014](../references/ADR-014-hybrid-context-engine.md), [ADR-019](../references/ADR-019-functional-ddd-typespec-contracts.md) | [Runtime composition](../../src/bin/ace-runtime.ts) | [CBM integration](../operations/codebase-memory-provider.md), open comparative evaluation |
| C-09 | [ADR-012](../references/ADR-012-production-capability-and-provider-gates.md), V-07 | [Fitness contracts](07-architecture-fitness-contracts.md), [Harbor task contracts](../../test/harbor-task-adapter.contracts.test.ts) | [013](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md), [014](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md) |
| C-10 | V-05/V-06/V-07 | [Runtime provenance](../../src/domain/runtime-provenance.ts), [supply-chain evidence model](../../src/domain/supply-chain-evidence.ts) | [Security gates](../operations/security-gates.md), [release evidence](../operations/supply-chain-release-evidence.md) |
| C-11 | V-07/V-08, [ADR register](../references/ADR-000-decision-register.md) | [AGENTS](../../AGENTS.md), [SDLC](../operations/ai-assisted-sdlc.md) | [Traceability record](06-traceability-and-review.md), [conformance](conformance.md) |

The detailed historical PRD-to-OpenSpec mapping is retained in [06-traceability-and-review.md](06-traceability-and-review.md). Reconcile conflicts using the current decision hierarchy; don't silently edit accepted decision or acceptance history.

## Known inconsistencies and resolution

| ID | Issue | Treatment |
| --- | --- | --- |
| INC-01 | Older records describe retired integration paths and earlier contract versions | Retain them as dated evidence; V-01/V-04 and ADR-021 determine current architecture |
| INC-02 | Historical retrieval designs describe replaced structural providers | Current source uses CBM; compare V-03 and current operational architecture |
| INC-03 | Selected Graphiti architecture versus absent active runtime provider | Explicit target/not-ready distinction in V-03/V-06/V-07 |
| INC-04 | Overlapping CBM/Qdrant discovery and independent LSP verification | Owner selected native CBM; complete physical retirement after safety/scale/topology evidence. LSP research deferred independently |
| INC-05 | Offline contracts and local projection evidence versus open real-agent acceptance | Explicit evidence progression in V-07; 013/014 remain canonical |
| INC-06 | Previous layout and stale design fingerprints | Resolved by relocating documentation and fixing all identified script, test fixture, workflow and configuration consumers; rebind path-only design fingerprints; retain the obsolete checksum snapshot in Git history. Final CI is independently verified. |
| INC-07 | Shared loopback identity is not per-principal host/workspace authentication | Keep the supported single-workspace deployment scope and the exact authorization boundary. Do not claim untrusted multi-tenant isolation. |
| INC-08 | Local build and archive evidence are not complete deployed-release assurance | Exact release, recovery and real deployment acceptance remain open. |

Any architecture change must review the affected rules, identify unresolved discrepancies and record the evidence or decision required for closure.

Benchmark boundary hardening (2026-11-24) adds source and negative-test evidence for C-04/C-10 under CR-03 and CR-08. The task-file verifier configuration is checked against operator authorization; benchmark data requires an independent digest before exclusive persistence. This does not close the existing end-to-end or release evidence gaps in CO-03/CO-08. See [security view](views/security.md) and [security gates](../operations/security-gates.md).

The remaining retrieval overlap under INC-04 / CO-07 is tracked by [#363](https://github.com/chris-madsen/Hybrid-RAG/issues/363) and [#364](https://github.com/chris-madsen/Hybrid-RAG/issues/364). Standalone retired parser requirements and ast-grep runtime configuration are removed from active setup; architecture lint remains development-only. Native mode and local recovery tests are now implemented; historical vector path remains. CO-07 stays unsatisfied pending absolute quality/scale and independent agent evidence.
