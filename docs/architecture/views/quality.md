# V-07 — Quality and assurance

**Governing viewpoint:** VP-07 · **Model kinds:** MK-08, MK-09 · **Concerns:** C-02, C-05, C-07, C-09, C-10, C-11.

**Identity/version:** V-07 v1.2; ACE-AD-001 v1.2; 2026-11-25. **Perspectives:** SP-01, SP-03, SP-04. **Aspects:** AS-07, AS-08. **Scope:** the entity portion described below, within the [AD boundary](../architecture-description.md).

## Quality goals and verification scope

| Quality concern | Verification mechanism | Acceptance boundary |
| --- | --- | --- |
| Freshness, coverage and losslessness | Exact source digest/range, source-race and retrieval contracts | Required evidence must be current; no silent truncation or empty success |
| Interface and authorization correctness | TypeSpec generated contracts, Go connector, signed receipt and attempt tests | Local contract tests do not prove actual external provider bytes |
| Architectural integrity | Domain dependency fitness rules and single-gateway audits | Deterministic structural verification; no agent-E2E implication |
| Provider behavior | Real native CBM host/container lifecycle and source mutation tests; historical vector evidence is not transferable; independent LSP tests remain scoped | Each observed provider/configuration and SHA; no blanket certification |
| Agent behavior | Native wire, SSE/cancellation, real Hermes multi-turn task | C03–C07 acceptance remains independent |
| Token and cost efficiency | Harbor matched frozen baseline/ACE tasks with independent task correctness and attempt accounting | C08; unknown usage is unknown, failed tasks are not savings |
| Operational/release assurance | Source provenance, security checks, SBOM/signature evidence, backup/restore | Release-specific retained artifacts and owner acceptance |

## Evidence state model

Use the evidence progression defined by the engineering rules: contract designed → adapter implemented → real provider tested → agent E2E tested → benchmark evaluated → owner approved. These are separate facts, not a single completion flag.

The deterministic PR gate and full scheduled/manual regression have distinct scopes. The independent retrieval benchmarks (Agent Retrieval Bench, ContextBench, CodeGraph Bench) and real Harbor agent comparison are different experiments. The 5× accepted-task token target remains unproven. Historical local projection fixtures and build evidence are useful diagnostics, not final provider-wire or production proof.

## Supporting sources and evaluation references

[Testing strategy](../../operations/testing-strategy.md), [fitness and Design by Contract](../07-architecture-fitness-contracts.md), [architecture rules](../../../architecture/rules/), [Meyer contract tests](../../../test/bertrand-contracts.test.ts), [real CBM workflow](../../../.github/workflows/ace-codebase-memory.yml), [current 013 acceptance](../../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md), [014 reliability](../../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md), [ADR-009](../../references/ADR-009-harbor-benchmark.md), [ADR-012](../../references/ADR-012-production-capability-and-provider-gates.md).

CR-02, CR-06, CR-07, CR-08 and CR-09 apply. Evidence status is intentionally not recalculated or promoted by this documentation migration.

## Identified view components

| Component / version | Contents in this view | Governing model kind |
| --- | --- | --- |
| VC-07A v1.2 | Quality goals and evidence model | MK-08 |
| VC-07B v1.2 | Verification and acceptance relationships | MK-09 |

The [versioned catalog](../viewpoints.md) supplies the conventions, construction/analysis methods and interpretation legends. Linked historical source documents are supporting material, not automatically current components. Correspondence methods: CR-02, CR-06, CR-07, CR-08, CR-09.

## Known issues

Independent task economics, release proof and agent behavior remain open. See the [correspondence results and inconsistency register](../correspondences.md). No additional deviation from the governing notation conventions is identified in this documentation review.
