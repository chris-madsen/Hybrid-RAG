# ACE compatibility for vendored Matt Pocock skills

The skills in this directory are optional techniques, not authorities. Apply this overlay together with the repository root `AGENTS.md`, accepted ADRs, the applicable OpenSpec change, and `docs/operations/ai-assisted-sdlc.md`. Higher-priority ACE instructions always win.

## Bounded requirement discovery

- Use `grill-me`/`grilling` only after repository and permitted environment facts have been checked, and only when a material decision remains for the owner.
- Ask at most **three independent decision questions in one round** and at most **two rounds per scoped task**. Never repeat a question already answered, declined, or resolvable from authorized evidence.
- If the limit is reached or an answer is unavailable, record the unresolved decision as `UNKNOWN` or `BLOCKED`; proceed with independent work and stop only the dependent slice. Do not interview for facts the agent can retrieve.
- Do not require a confirmation round when the request, accepted decision, and evidence already settle the scope.

## Automatic ACE to-tickets sizing (overrides the upstream granularity quiz)

- **Do not ask a routine question about granularity, number of tickets, or merge/split preferences.** The owner has set a reusable default: target **approximately 1,000 changed handwritten lines per fresh-context implementation pass, including tests**; use about **700–1,200** as a flexible estimate band. Select the number of chunks automatically; it is never fixed at eight or any other count.
- Estimate added + deleted handwritten implementation/test/config/documentation lines per slice, and separately disclose generated/vendor bulk. Prefer merging related complete tracer bullets predicted well below the target; split those above approximately 1,200 when context/risk warrants, normally split above 1,500 unless an indivisible safe expand–contract exception is justified. Never pad, bundle unrelated tasks, under-test, or assume a code-size estimate proves context sufficiency.
- Keep every slice vertically complete and independently verifiable with acceptance IDs, blocking edges, RED/GREEN, actual provider/agent or Harbor oracles as appropriate, and honest STOP/BLOCKED conditions. Security, concurrency, provider authorization, external trial volume and owner decisions can require smaller steps even when LOC is low.
- The upstream `to-tickets` "Quiz the user" step is replaced **only for routine sizing** by an internal self-review against estimates and dependencies, followed by direct publication to canonical OpenSpec `tasks.md`. Ask the owner only for material unresolved choices under ACE's bounded-question and G02 rules. Do not auto-approve G02 or paid provider egress.

## Codebase-design and detailed-plan adaptation

- The separate pinned `codebase-design` add-on has integrity metadata in `.agents/codebase-design-v1.3.2-manifest.json` (upstream MIT, unmodified source). Use its **deep module, interface and seam** principles to *integrate into existing ACE Functional DDD*, not as a new architectural authority. Its optional `DESIGN-IT-TWICE.md` parallel-subagent procedure is **not permitted** under ACE's one-agent rule; explore alternatives sequentially, review accepted ADR/contexts and require G02 owner decision.
- `ace-architecture-design` is the canonical Architecture route; `ace-phase-plan` expands each approved architecture-based To-tickets chunk through existing `phase-template.md`; the `writing-plans` influence is a **referenced design technique**, not an installed Superpowers runtime/agent orchestrator or an extra tracker.
- `ace-stage-handoff` owns stacked Draft PR dependency hygiene and input-fingerprint freshness. Opening a Draft PR lets **planning** continue provisionally while review is pending; it does not imply G02, provider egress permission, human merge or release acceptance.

## ACE-specific skill mapping

- `grill-me` and its `grilling` dependency may clarify material requirements; they do not authorize implementation or change the source-of-truth hierarchy.
- `grill-with-docs` and `domain-modeling` do not auto-create root `GLOSSARY.md`, generic `docs/adr/` files, or a parallel decision system. Use existing ACE bounded-context documentation, ADRs, and OpenSpec; apply Event Storming and immutable ADTs/pure functions for material T2 domain work.
- `to-spec` synthesizes requirements into the existing OpenSpec change/spec structure. Do not publish issues, labels, or a second spec.
- `to-tickets` maps dependencies into the existing OpenSpec `tasks.md`; do not create `.scratch/.../issues/` or publish tracker tickets. **ACE's default Plan-stage entrypoint is `.agents/skills/ace-to-tickets/SKILL.md`**, which reads and applies the complete pinned `to-tickets` process with the ACE overrides below.
- `tdd` follows the ACE test-portfolio rule: test observable behavior at the cheapest owning seam, avoid redundant layers, and use `npm run test:affected` in the edit loop.
- `code-review` may organize standards and specification checks as separate axes, but its upstream parallel-subagent procedure conflicts with ACE policy. Perform reviews sequentially in one agent; never claim independent review. Use the repository BUILD/ARCH/SEC/PLAN gates.
- Do not invoke or install upstream `implement-spec`, `setup-matt-pocock-skills`, or any other unvendored skill. Do not execute scripts or installers from imported content without a separately reviewed, explicit authorization.

## OpenSpec Apply one-phase limit

- Upstream `openspec-apply-change` has a default **loop until all tasks are done**. In ACE, this is explicitly constrained by `ace-sdlc` / `implement_backend.md`: **select exactly one approved, unblocked canonical phase per implementation pass**, produce its RED/GREEN and four gates, update **only that phase's** `tasks.md` checkboxes, then **STOP** and hand off its PR/evidence. Never treat the upstream multi-task loop as authorization to implement the next phase or bypass G02, an unresolved parent PR, or the explicit implementation request.
- Apply reads all OpenSpec context but obeys the currently approved phase's contract, including its linked executable brief and input-fingerprint check. If the executable plan is stale, reconcile planning rather than silently redesigning during code edits.

## Evidence boundary

The pinned source manifest proves file provenance and integrity. The `.agents/skills` directory and local Codex prompt-input inspection can prove repository-level discovery only; they do not prove model behavior, independent review, provider delivery, agent E2E, or production readiness.

The current request-to-acceptance example and stable IDs are in [`docs/research/sdlc/examples/matt-skills-prd-to-openspec.md`](../../../../docs/research/sdlc/examples/matt-skills-prd-to-openspec.md) and [`openspec/changes/011-pinned-agent-skills/specs/agent-sdlc-skills/spec.md`](../../../../openspec/changes/011-pinned-agent-skills/specs/agent-sdlc-skills/spec.md).
