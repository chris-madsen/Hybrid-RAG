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

### Requirement: Native index coordination cannot roll back verified source

CBM SHALL own native index and cache coordination. ACE SHALL fence publication of its derived source membership and verify exact current bytes and scope. It SHALL NOT implement a second persistent index or writer authority.

#### Scenario: REM-005 — Stale observation after newer source
- **WHEN** an older indexing request races a newer source observation, including independently running frontends using the same upstream daemon
- **THEN** ACE neither delivers stale bytes as current nor claims verified completeness from the older membership
- **AND** readers see verified current evidence or explicit typed unavailable or partial results

#### Scenario: REM-006 — Failed/restarted native publication
- **WHEN** a native frontend, daemon or worker fails or restarts, or incompatible cache roots or builds compete
- **THEN** ACE cannot expose a partial or rolled-back snapshot as complete
- **AND** upstream coordination and current source are checked before a new generation is published
- **AND** frontend termination is never mistaken for confirmed daemon or worker termination
