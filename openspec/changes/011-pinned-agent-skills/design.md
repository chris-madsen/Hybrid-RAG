# Design

## Context

See `proposal.md` for motivation and `specs/agent-sdlc-skills/spec.md` for acceptance. The project already exposes repository skills under `.agents/skills`, has an ACE-owned `ace-sdlc` entrypoint, preserves seven OpenSpec helper skills, and routes process authority through root `AGENTS.md`, accepted ADRs, and OpenSpec. The upstream tag resolves to commit `d1478fcb140db0b93c0c8df17bcfd311844749d0` and tree `42b57b23ac2979fce601ce1d4b4d6c1d46471bbe`.

## Goals / Non-Goals

**Goals:**
- Vendor only the eight selected/required skill directories and their exact in-directory support files.
- Make every imported file byte-verifiable against that source commit and retain the existing MIT notice.
- Keep incompatible upstream instructions subordinate through a repository-local ACE overlay.
- Demonstrate the owner request becoming stable OpenSpec acceptance IDs without fabricating a Q&A transcript.

**Non-Goals:**
- Do not install skills into the Hermes user profile or change global Codex configuration.
- Do not execute upstream installers, scripts, `implement-spec`, or tracker publishing.
- Do not add another issue tracker, agent runner, ADR format, glossary, or spec tree.
- Do not claim a live model invocation or provider acceptance from static skill-file checks.

## Decisions

1. **Vendor exact upstream directories rather than reconstructing prompts.** Copy `grill-me`, its required `grilling` dependency, `grill-with-docs`, `domain-modeling`, `to-spec`, `to-tickets`, `tdd`, and `code-review` from the pinned tag. Include their Markdown, `agents/openai.yaml`, and in-skill references; include no other skill or executable.
   - Alternative: write ACE-authored equivalents. Rejected for this slice because the review specifically asks for pinned upstream skills and the exact MIT source is available.
2. **Keep upstream files unchanged.** Record each file's source Git blob and SHA-256 in a manifest. Preserve the already-tracked MIT license only if its bytes continue to match the upstream license.
   - Alternative: edit upstream text to remove incompatible behavior. Rejected because that destroys source fidelity; ACE policy belongs in a separate overlay.
3. **Use an ACE compatibility overlay.** Extend `.agents/skills/ace-sdlc/SKILL.md` to require the companion reference before using imported skills. The overlay enforces one agent, existing OpenSpec as the sole spec/task authority, no tracker/setup side effects, ACE DDD/ADR conventions, and sequential review passes. Requirement discovery asks only material decisions unavailable from tools, at most three questions per round and two rounds per scoped task; never repeat answered or declined questions.
   - Alternative: trust upstream instructions to infer ACE conventions. Rejected because `to-spec`, `to-tickets`, `grill-with-docs`, `grilling`, and `code-review` include tracker, document-generation, unbounded-question, or parallel-subagent behavior incompatible with current ACE policy.
4. **Test the file-level discovery boundary without a model call.** A Node test verifies the exact vendor manifest, required dependencies and local links, preservation of existing OpenSpec skills, and compatibility rules. Use the installed Codex CLI's local prompt-input diagnostic only if it can verify discovery without invoking a model. This proves repository discovery/configuration, not that an LLM obeys the workflow.
5. **Use this change as the real request-to-acceptance example.** The owner's explicit priority and the review's P1-D scope are sufficient; repository/upstream questions are answered by source inspection. Stable `SKILL-001`–`SKILL-007` IDs live in the OpenSpec spec. Record that no additional owner question was necessary rather than inventing an answer.

## Risks / Trade-offs

- Upstream skill instructions can conflict with ACE governance. The local entrypoint and overlay mitigate this; root `AGENTS.md` remains higher authority.
- Repository file/layout checks do not prove model behavior. Any LLM-invocation trial is reported separately and will not be represented as agent-E2E or provider evidence.
- A future upstream upgrade changes source bytes and requires a separately reviewed pin/manifest update; no `latest` installer is used.

## Migration Plan

Add exact pinned files and manifest, then add the compatibility overlay, acceptance walkthrough, and tests. Update only current documents that claim import is pending; preserve dated review findings as historical audit evidence. Run the focused vendor test, strict OpenSpec validation, the bounded PR gate, and Codex's local discovery diagnostic if supported. Do not execute any imported setup or agent-execution automation.
