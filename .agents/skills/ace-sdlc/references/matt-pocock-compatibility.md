# ACE compatibility for vendored Matt Pocock skills

The skills in this directory are optional techniques, not authorities. Apply this overlay together with the repository root `AGENTS.md`, accepted ADRs, the applicable OpenSpec change, and `docs/operations/ai-assisted-sdlc.md`. Higher-priority ACE instructions always win.

## Bounded requirement discovery

- Use `grill-me`/`grilling` only after repository and permitted environment facts have been checked, and only when a material decision remains for the owner.
- Ask at most **three independent decision questions in one round** and at most **two rounds per scoped task**. Never repeat a question already answered, declined, or resolvable from authorized evidence.
- If the limit is reached or an answer is unavailable, record the unresolved decision as `UNKNOWN` or `BLOCKED`; proceed with independent work and stop only the dependent slice. Do not interview for facts the agent can retrieve.
- Do not require a confirmation round when the request, accepted decision, and evidence already settle the scope.

## ACE-specific skill mapping

- `grill-me` and its `grilling` dependency may clarify material requirements; they do not authorize implementation or change the source-of-truth hierarchy.
- `grill-with-docs` and `domain-modeling` do not auto-create root `GLOSSARY.md`, generic `docs/adr/` files, or a parallel decision system. Use existing ACE bounded-context documentation, ADRs, and OpenSpec; apply Event Storming and immutable ADTs/pure functions for material T2 domain work.
- `to-spec` synthesizes requirements into the existing OpenSpec change/spec structure. Do not publish issues, labels, or a second spec.
- `to-tickets` maps dependencies into the existing OpenSpec `tasks.md`; do not create `.scratch/.../issues/` or publish tracker tickets.
- `tdd` follows the ACE test-portfolio rule: test observable behavior at the cheapest owning seam, avoid redundant layers, and use `npm run test:affected` in the edit loop.
- `code-review` may organize standards and specification checks as separate axes, but its upstream parallel-subagent procedure conflicts with ACE policy. Perform reviews sequentially in one agent; never claim independent review. Use the repository BUILD/ARCH/SEC/PLAN gates.
- Do not invoke or install upstream `implement-spec`, `setup-matt-pocock-skills`, or any other unvendored skill. Do not execute scripts or installers from imported content without a separately reviewed, explicit authorization.

## Evidence boundary

The pinned source manifest proves file provenance and integrity. The `.agents/skills` directory and local Codex prompt-input inspection can prove repository-level discovery only; they do not prove model behavior, independent review, provider delivery, agent E2E, or production readiness.

The current request-to-acceptance example and stable IDs are in [`docs/research/sdlc/examples/matt-skills-prd-to-openspec.md`](../../../../docs/research/sdlc/examples/matt-skills-prd-to-openspec.md) and [`openspec/changes/011-pinned-agent-skills/specs/agent-sdlc-skills/spec.md`](../../../../openspec/changes/011-pinned-agent-skills/specs/agent-sdlc-skills/spec.md).
