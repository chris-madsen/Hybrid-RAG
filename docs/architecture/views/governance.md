# V-08 — Evolution and governance

**Governing viewpoint:** VP-08 · **Model kinds:** MK-09, MK-08 · **Concerns:** C-03, C-08, C-09, C-11.

**Identity/version:** V-08 v1.1; ACE-AD-001 v1.1; 2026-11-24. **Perspectives:** SP-02, SP-04. **Aspects:** AS-08, AS-02. **Scope:** the entity portion described below, within the [AD boundary](../architecture-description.md).

## Decision and evolution model

| Authority or artifact | Function |
| --- | --- |
| Explicit owner decision / Accepted ADR | Resolve material architectural choices; later accepted decisions supersede earlier ones explicitly |
| OpenSpec | Observable behavior, acceptance criteria and canonical implementation/acceptance work ledgers |
| TypeSpec | Authoritative versioned interface structure and generated contracts |
| Architecture Description | Organize current and target views, concerns, decisions and correspondences |
| AGENTS and agent SDLC skills | Intent-first risk-based engineering process and change rules |
| Source and retained verification | Evidence of actual implementation and observed behavior, tied to revision and configuration |
| Dated plans, spikes and reviews | Historical evidence, alternatives and work instructions, not competing current architecture |

The accepted approach uses one modular monolith, functional DDD and maintained provider primitives. Material changes to provider selection or security/transport boundaries need the applicable owner decision and G02 review. The CBM-only versus CBM/Qdrant and independent LSP comparisons remain open. Full unified memory depends on a future active temporal provider and evidence.

## Architecture change procedure

1. Identify the owner-requested SDLC stage and actual source baseline; reuse valid prior artifacts.
2. Identify affected concern/aspect IDs, governing viewpoints and current/target models.
3. For a material design choice, record decision rationale and alternatives in an ADR and observable behavior in OpenSpec; keep existing acceptance status truthful.
4. Update affected views, correspondences and source/verification references in the same reviewable change. Do not create a parallel architecture authority.
5. Review cross-view consistency, unresolved discrepancies and evidence limitations. Run the applicable existing verification scope and report exact results; do not convert documentation alignment to runtime acceptance.

The protected-main policy and scoped checks are governed by the repository engineering rules and actual GitHub settings; this view does not assert or change hosted configuration.

## Supporting sources and evaluation references

[Owner and engineering rules](../../../AGENTS.md), [operational SDLC](../../operations/ai-assisted-sdlc.md), [intent-first entry/resume](../../operations/implementation-entry-resume.md), [architecture design skill](../../../.agents/skills/ace-architecture-design/SKILL.md), [ADR register](../../references/ADR-000-decision-register.md), [detailed traceability](../06-traceability-and-review.md), [conformance assessment](../conformance.md). CR-01, CR-02, CR-07 and CR-09 apply.

## Identified view components

| Component / version | Contents in this view | Governing model kind |
| --- | --- | --- |
| VC-08A v1.1 | Decision and evolution model | MK-09 |
| VC-08B v1.1 | Change/review and evidence rules | MK-08 |

The [versioned catalog](../viewpoints.md) supplies the conventions, construction/analysis methods and interpretation legends. Linked historical source documents are supporting material, not automatically current components. Correspondence methods: CR-01, CR-02, CR-07, CR-09.

## Known issues

Provider selection and superseded records require ongoing reconciliation. See the [correspondence results and inconsistency register](../correspondences.md). No additional deviation from the governing notation conventions is identified in this documentation review.
