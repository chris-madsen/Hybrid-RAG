# retrieval-quality-provenance — Audit Remediation Delta

## ADDED Requirements

### Requirement: Working-context priors preserve documented ranking semantics

Positive working-context preferences SHALL not demote candidates merely because cosine scores can be negative.

#### Scenario: REM-015 — Prior applied to negative/zero/positive score
- **WHEN** Qdrant returns negative, zero or positive ranked scores and a relevant candidate receives a preference
- **THEN** the prior never decreases its intended relative rank under the documented strategy
- **AND** held-out retrieval quality and latency are measured before promotion

### Requirement: Delivered evidence and provider provenance are accurate

Retrieval metrics SHALL distinguish shortlist from final verified model-visible evidence; provider identities SHALL describe the actual active implementation.

#### Scenario: REM-016 — Stale shortlisted hit excluded from delivered stage
- **WHEN** a hit fails source verification, final reread, dedup or actual delivery
- **THEN** it is recorded as shortlisted/rejected rather than delivered verified evidence
- **AND** delivered recall cannot count its missing code body

#### Scenario: REM-017 — Selected runtime provider identity
- **WHEN** Rust/Go/Python/custom LSP or embedding runtime supplies evidence
- **THEN** trace and receipt carry effective resolved identities where observed
- **AND** unavailable providers never inherit hard-coded TypeScript defaults

### Requirement: Optional structural/ranking providers improve measured task quality

RepoMap SHALL NOT claim source recall for paths it never received; an AST extractor SHALL NOT replace the canonical CLI until corpus and task parity have been demonstrated.

#### Scenario: REM-018 — Multi-file path outside Qdrant top-K
- **WHEN** a relevant path falls outside initial candidate shortlist on a multi-file coding task
- **THEN** the strategy measures and reports that bound or uses proven provider-native diversity/overfetch
- **AND** no unverified RepoMap text substitutes for exact cited source

#### Scenario: REM-019 — Canonical ast-grep extractor not silently replaced
- **WHEN** the alternative N-API and canonical CLI disagree on current repository corpus
- **THEN** the CLI remains authoritative unless language/task parity and license provenance are demonstrated
- **AND** an unproved alternate path cannot claim equivalent source spans

### Requirement: Timed-out Python provider work cannot monopolize the worker indefinitely

A cancelled client wait SHALL not leave unbounded serial provider work or misattribute stale responses.

#### Scenario: REM-020 — Python worker timeout and next request
- **WHEN** an embedding task stalls, is cancelled or times out before a queued healthy request
- **THEN** worker recovery/backpressure lets the healthy request complete or return typed bounded unavailability
- **AND** stale late output cannot be attributed to the next request
