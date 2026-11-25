# workspace-snapshot-correctness — Audit Remediation Delta

## ADDED Requirements

### Requirement: Verified freshness for complete source search

A successful complete retrieval SHALL require a trustworthy source observation. Non-Git size/mtime hints alone SHALL NOT prove freshness.

#### Scenario: REM-001 — Same-metadata non-Git mutation
- **WHEN** source bytes change without a size/mtime change, or watcher events are dropped
- **THEN** reconciliation detects the change or represents source coverage as incomplete
- **AND** no empty search is declared verified-current before reconciliation

#### Scenario: REM-002 — Truthful empty Native Responses pass-through
- **WHEN** an authorized request yields a truly complete, fresh, successful empty retrieval
- **THEN** the already approved verified-no-addition response preserves native input bytes exactly
- **AND** stale, denied, partial, failed or unknown results never enter that success path

### Requirement: Concurrent Qdrant publishers cannot roll back newer source

The publisher SHALL have a workspace-scoped authority that prevents stale writers from erasing or activating older generations.

#### Scenario: REM-005 — Stale writer after newer publication
- **WHEN** process A observes v1, pauses, and process B publishes v2 before A continues
- **THEN** A neither deletes v2 membership nor promotes v1 over v2
- **AND** readers see a complete current generation or an explicit typed unavailable result

#### Scenario: REM-006 — Failed/restarted publication
- **WHEN** publication fails, a writer crashes/restarts or competing writers have the same claimed generation
- **THEN** the system cannot expose a partial or rolled-back snapshot as complete
- **AND** verified newer membership survives restart/cleanup and is not lost by stale pruning
- **AND** alias atomicity is never mistaken for generation compare-and-swap
