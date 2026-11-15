# Proposal

## Why

The 2026-11-15 SDLC conformance review found that the selected Matt Pocock helper skills were verified at a pinned source but were not present in the repository's agent-discovery path. Vendoring only the needed MIT-licensed skills, with an ACE compatibility layer, makes the techniques available without displacing ACE's single-agent process, accepted ADR/OpenSpec authority, or existing OpenSpec skills.

## What Changes

- Vendor the selected `grill-me`, its required `grilling` dependency, `grill-with-docs`, `domain-modeling`, `to-spec`, `to-tickets`, `tdd`, and `code-review` skill directories from the exact upstream `v1.3.2` commit.
- Record per-file provenance, preserve the MIT notice, and verify that imported bytes match the pinned source.
- Add an ACE compatibility overlay that bounds questioning and prevents imported instructions from creating another agent runner, issue tracker, or spec authority.
- Demonstrate the current owner request flowing to acceptance IDs in this OpenSpec change; do not invent owner answers or repeat questions already answered by the request or repository evidence.
- Preserve all existing ACE and OpenSpec skills. Do not import or execute `implement-spec`, `setup-matt-pocock-skills`, or unpinned installers.

## Capabilities

### New Capabilities
- `agent-sdlc-skills`: repository coding agents can discover selected licensed helper skills while remaining governed by ACE's single-agent workflow and existing OpenSpec process.

### Modified Capabilities

None.

## Impact

- Adds files under `.agents/skills/` and a pinned-source manifest.
- Updates the local `ace-sdlc` routing guidance and current SDLC documentation.
- Adds a bounded vendor-integrity/discovery contract test and OpenSpec acceptance scenarios.
- No ACE runtime, public API, provider configuration, external issue tracker, dependency manifest, or model-execution behavior changes.
