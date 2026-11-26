# ACE plans — current authority and historical provenance

**Current runtime status:** [source-inspected architecture](../operations/current-architecture.md). **Current implementation/acceptance ledgers:** [OpenSpec 013 C01–C08](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [OpenSpec 014 AR01–AR10](../../openspec/changes/014-ace-audit-reliability-remediation/tasks.md). These are not competing plans; implementations may be merged while real provider/Hermes/Harbor acceptance remains open.

## Live process and evidence

- [SDLC entry/resume](../operations/implementation-entry-resume.md) and [runtime configuration/readiness](../operations/ace-configuration-and-readiness-matrix.md).
- [Codebase Memory native provider](../operations/codebase-memory-provider.md): PR #316 adopted CBM for AST, graph and code semantic/BM25 search. PR #378 retired the separate vector stack. External LSP remains a separately scoped research question (#364), not an active code-only dependency.
- [Real Hermes feedback loop](./ace-real-feedback-loop.md), [retrieval quality ablations](./retrieval-quality-ablation-runbook.md), and [unified release preflight](./unified-production-release-preflight.md): **not** proof that live egress or 5× savings has passed.

## Historical design and execution plans — not active implementation authority

- [2026-10-19 consolidated completion plan](./2026-10-19-unified-ace-correctness-and-production-plan.md): historical queue; superseded by later accepted decisions and implementation.
- [2026-10-21 H1–H6 context plan](./2026-10-21-cursor-like-hybrid-context-completion-plan.md): historical pre-CBM milestones.
- [2026-10-26 post-#177 retrieval execution plan](./2026-10-26-retrieval-post-177-execution-plan.md): historical Aider/Claw/ast-grep work; *not* an instruction to reintroduce bespoke RepoMap or old ast-grep runtime.
- [2026-10-26 Aider + Claw composition proposal](./2026-10-26-aider-claw-retrieval-composition-plan.md): historical alternatives; CBM is now the production structural/graph engine.
- [2026-10-26 Hermes economics proposal](./2026-10-26-ace-hermes-economics-and-cleanup-plan.md): hypothesis and historical issue context, not a successful current E2E report.
- [Old post-merge correctness plan](./2026-10-19-post-merge-correctness-plan.md) and [production roadmap](./2026-10-19-ace-production-completion-roadmap.md): original planning evidence.

A historical unchecked task does not prove missing code; a merged code PR does not prove provider-wire, agent or release acceptance. Never relabel an unrun benchmark PASS or infer an architectural removal before measurement.
