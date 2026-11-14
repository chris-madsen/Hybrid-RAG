> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# Tasks — Hermes ContextEngine request-time ACE integration

- [ ] Verify the exact pinned Hermes runtime exposes the required ContextEngine contract.
- [ ] Add and test AceTransformRequest/AceTransformResult domain contracts.
- [ ] Extract a direct ACE context-transform service from the existing retrieval/delivery composition.
- [ ] Implement the non-retired optional tool-call protocol local JSONL bridge with runtime provenance and redacted diagnostics.
- [ ] Implement the Hermes ContextEngine plugin and group-safe request projection.
- [ ] Wire native and Hermes+ACE Harbor jobs with plugin/bridge identity pinning.
- [ ] Bind transformation receipts and provider traces to raw trial evidence.
- [ ] Make exact preflight validate auth, plugin, bridge, workspace, provider and container identities.
- [ ] Run a fresh one-task native Hermes vs Hermes+ACE smoke.
- [ ] Run matched main/repeat/holdout trials only after the smoke passes.
- [ ] Keep Codex adapters/jobs as explicitly labeled comparison compatibility paths.
