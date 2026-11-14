# Proposal — Foundation: workspace truth, safety and Gateway boundary

## Why

A context engine cannot supply trustworthy evidence without workspace identity, access control, source freshness and one stable agent-facing delivery boundary.

## What changes

Create domain contracts for workspace registration and verified reads; enforce data policy; expose agent-neutral ACE context automatically through the versioned Bifröst Gateway Projection boundary; preserve exact authorized source bytes; never write user code.

## Capabilities

- `workspace-identity` — stable workspace identity and verified read boundary.
- `security-policy` — local/cloud data policy and fail-closed authorization.
- `gateway-foundation` — sole Gateway-only agent-facing delivery boundary plus lossless source preservation.

## Non-goals

- provider-specific retrieval implementation in the domain;
- a second model-invoked context tool path;
- native agent-specific ACE delivery bridges;
- user-worktree mutation.
