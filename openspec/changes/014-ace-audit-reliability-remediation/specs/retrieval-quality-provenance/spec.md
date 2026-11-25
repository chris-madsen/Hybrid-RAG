# retrieval-quality-provenance — Audit Remediation Delta

## ADDED Requirements

### Requirement: Native ranking preserves source authority

CBM SHALL own native code ranking. ACE SHALL NOT recreate dense/sparse fusion or an external reranker. Working-context hints MAY disambiguate native candidates but SHALL NOT bypass source verification.

#### Scenario: REM-015 — Working-context hint on native candidates
- **WHEN** a native candidate is associated with a focused or dirty path
- **THEN** documented disambiguation preserves verified source identity and does not elevate unrelated or stale evidence
- **AND** absolute quality of final delivered evidence is evaluated on frozen tasks without comparing retired vector providers

### Requirement: Delivered evidence and provider provenance are accurate

Retrieval metrics SHALL distinguish shortlist from final verified model-visible evidence; provider identities SHALL describe the actual active implementation.

#### Scenario: REM-016 — Stale shortlisted hit excluded from delivered stage
- **WHEN** a hit fails source verification, final reread, dedup or actual delivery
- **THEN** it is recorded as shortlisted/rejected rather than delivered verified evidence
- **AND** delivered recall cannot count its missing code body

#### Scenario: REM-017 — Selected runtime provider identity
- **WHEN** native CBM or an independently requested semantic provider supplies evidence
- **THEN** trace and receipt carry effective resolved identities where observed
- **AND** retired retrieval stages are explicitly not applicable; unavailable providers never inherit a hard-coded identity

### Requirement: Native graph and structural discovery have verified source provenance

CBM SHALL be the only code retrieval and structural engine. ACE SHALL measure absolute quality and source coverage without rebuilding retired parsers or indexes.

#### Scenario: REM-018 — Multi-file path outside native top-K
- **WHEN** a relevant path falls outside the native shortlist on a multi-file coding task
- **THEN** the strategy measures and reports that bound or uses proven provider-native discovery
- **AND** no unverified derived text substitutes for exact cited source

#### Scenario: REM-019 — Pinned CBM structural source boundaries
- **WHEN** the native outline is unavailable, invalid or disagrees with current source
- **THEN** ACE reports incomplete or unavailable structural coverage and does not substitute another parser
- **AND** a line-only outline never claims independent exact identifier-column verification

### Requirement: Cancelled native provider work cannot monopolize subsequent requests

ACE SHALL use upstream CBM session and daemon coordination with bounded request admission and fail-closed publication invalidation. Frontend exit alone SHALL NOT be considered proof of worker or daemon termination.

#### Scenario: REM-020 — Native session timeout and next request
- **WHEN** native indexing or retrieval stalls, is cancelled or times out before a healthy request
- **THEN** recovery lets the healthy request complete with verified current evidence or return typed bounded unavailability
- **AND** stale late output cannot be attributed to a new request or generation
