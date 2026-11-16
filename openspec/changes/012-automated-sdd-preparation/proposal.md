# Proposal

## Why

The approved Matt Pocock helpers and OpenSpec skills are already vendored, but ACE has no single supported planning entrypoint that predictably routes Research → bounded discovery → requirement synthesis → canonical OpenSpec authoring → G02 review. File discovery does not prove actual agent invocation.

## What Changes

- Add an ACE-owned ace-sdd-prepare planning skill and route the existing ace-sdlc entrypoint to it on explicit SDD requests.
- Use existing pinned grill-with-docs/grilling/domain-modeling/to-spec techniques through ACE's compatibility overlay, without external tracker, second ADR tree or second agent.
- Reuse OpenSpec propose/update skills for canonical planning artifacts; avoid duplicate changes on resume.
- Add a read-only, dependency-free structural checker and regression fixtures for positive, missing/duplicate IDs, missing G02, blocked decisions and invalid change paths.
- Require honest G02 owner review, independent of mechanical checks.

## Capabilities

### New Capabilities
- agent-sdd-preparation: one-agent planning route for risk-classified changes.

### Modified Capabilities
None.

## Impact

- .agents/skills/ace-sdd-prepare/, existing ace-sdlc instructions, scripts/, test/, package.json, current operational SDLC docs.
- No ACE runtime/LLM transport changes, external model invocation, global agent installs, mandatory merge policy, or additional npm dependency.
