# Matt Pocock skills — pinned source and ACE vendor record

**Status:** the ACE-selected helper subset is vendored byte-for-byte under `.agents/skills/` from the pinned upstream source described below. `.agents/matt-pocock-skills-v1.3.2-manifest.json` records every file's source Git blob and SHA-256. This proves repository content only; it does not by itself prove a live agent invoked or obeyed a skill.

## Provenance

- Matt's original repository: https://github.com/mattpocock/skills
- Pinned source: **v1.3.2**; annotated tag resolves to commit `d1478fcb140db0b93c0c8df17bcfd311844749d0` and Git tree `42b57b23ac2979fce601ce1d4b4d6c1d46471bbe`.
- Reference implementation: https://github.com/getsphericon/sphericon at commit `2ba7879b511a970b16310a433d7092492f10dd29` (tree `f67e313fe0ec9494b75368456b13c273fd774da0`).
- Sphericon's `.mise.toml` defines the tagged-release source with `version = "latest"`; its committed `mise.lock` resolves and pins that source to **1.3.2** with archive checksum. `mise/tasks.toml`, `["skills"]` copies selected directories into `.agents/skills`. The final skills are populated by setup and therefore do not appear as vendored skill files in Sphericon's committed Git tree.
- License: **MIT Copyright (c) 2026 Matt Pocock**, text retained in [license](../../../.agents/LICENSE-MATTPOCOCK-MIT.txt).
- ACE already has its own OpenSpec skills in `.agents/skills`; they must not be overwritten.

## Upstream inventory reviewed (23 of Sphericon's 29 Matt skills)

**Engineering:** `code-review`, `codebase-design`, `diagnosing-bugs`, `domain-modeling`, `grill-with-docs`, `implement`, `improve-codebase-architecture`, `pr`, `research`, `retro`, `tdd`, `to-spec`, `to-tickets`.

**Supporting/optional:** `ask-matt`, `implement-spec`, `prototype`, `setup-matt-pocock-skills`, `grill-me`, `grilling`, `handoff`, `to-questionnaire`, `wait-what`, `writing-for-agents`.

At pinned `v1.3.2`, the broader evaluated inventory contains **64 upstream blobs**. It is not the ACE vendor set; only the subset below is copied. The older note that these files were absent records the state before the dedicated import.

## ACE vendored subset (8 directories, 20 files)

- `grill-me` and its required `grilling` dependency;
- `grill-with-docs`, `domain-modeling`, `to-spec`, `to-tickets`, `tdd`, and `code-review`.

The exact path and content inventory is `.agents/matt-pocock-skills-v1.3.2-manifest.json`. ACE keeps upstream bytes unchanged and places repository-specific restrictions in `.agents/skills/ace-sdlc/references/matt-pocock-compatibility.md`. In particular, skill questioning is capped at two rounds of at most three independent questions each; OpenSpec remains the only spec/task authority; review remains one-agent and sequential. The dependency `grilling` is included because the pinned `grill-me` and `grill-with-docs` entrypoints call it.

Not selected from Sphericon: `triage`, `wayfinder`, `wizard`, `teach`, `claude-handoff`, `loop-me`. The last two are especially ill-suited to a client-independent, one-agent workflow; issue-triage and wizard automation require a separate decision.

## Reproducible import and future updates

For future updates, review a dedicated vendor PR against a pinned upstream release. Matt's README may document convenience installers, but ACE must **not** use an unpinned `@latest` installer for this dependency, even interactively when preparing committed vendor content. Verify the annotated `v1.3.2` tag resolves to commit `d1478fcb140db0b93c0c8df17bcfd311844749d0` and tree `42b57b23ac2979fce601ce1d4b4d6c1d46471bbe`; copy only the approved directories, retain the MIT notice, and verify every path against the manifest before review. Sphericon uses pinned `mise` release archives; ACE is not required to add mise solely to import skills.

No automation should execute arbitrary scripts from a newly imported skill until owner review, and no skill installation should delete existing OpenSpec skills.

## ACE compatibility overlay

- Root `AGENTS.md`, accepted ADR/OpenSpec and our [operational SDLC](../../operations/ai-assisted-sdlc.md) outrank optional skills.
- `domain-modeling`: retain Event Storming, bounded contexts and ubiquitous language; implement passive immutable ADTs + cohesive pure domain functions, not mandatory rich OO entities.
- `to-spec`/`to-tickets`: map to existing OpenSpec behavioral specs and task graphs rather than a second issue/spec source. ACE's [`ace-to-tickets`](../../../.agents/skills/ace-to-tickets/SKILL.md) entrypoint keeps the upstream pin unchanged and automatically sizes end-to-end slices near 1,000 changed handwritten lines including tests; no routine granularity interview.
- `tdd`/`diagnosing-bugs`/`code-review`: augment current ACE RED/GREEN and four quality checks; provider acceptance remains separate.
- `implement-spec`: upstream multi-agent execution is incompatible with the **current one-agent** decision; treat as reading/reference only until explicitly changed.
- `setup-matt-pocock-skills`: may write repo config, glossary and tracker; do not auto-run without reviewing impact on existing ACE governance.
- `ask-matt` may refer to intentionally unselected skills; use ACE `PROMPTS-ACE.md` as the default router.
- `pr`/`handoff`: preserve focused commit, push, exact SHA/CI, human owner control and no direct-to-main behavior.

## Vendor verification requirements

1. All selected entrypoints and in-skill references exist at the intended paths.
2. Every vendored file matches both the source Git blob and SHA-256 in the manifest; no upstream instruction is silently edited.
3. The MIT notice matches the upstream license; the change is reviewed as vendored software.
4. Existing ACE and OpenSpec skills remain present and unmodified.
5. Repository-level discovery and the single-agent/OpenSpec compatibility contract are tested; no second runner or issue tracker is activated.
6. The PR contains the files and actual CI status; repository file presence alone is not a live agent invocation or provider acceptance claim.
