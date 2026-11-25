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

### Requirement: Maintained native structural and ranking provider has measured task quality

Native CBM SHALL own discovery and structural hints in the selected code retrieval architecture. Unobserved paths SHALL NOT count as recall and native outline ranges SHALL NOT be promoted to exact identifier coordinates. Provider identity, corpus quality, source scope and license provenance SHALL be established before acceptance; no independent LSP contract is withdrawn.

#### Scenario: REM-018 — Multi-file path outside native top-K
- **WHEN** a relevant path falls outside initial candidate shortlist on a multi-file coding task
- **THEN** the strategy measures and reports that bound or uses proven provider-native diversity/overfetch
- **AND** no unverified RepoMap text substitutes for exact cited source

#### Scenario: REM-019 — Native structural evidence remains source-bound
- **WHEN** a native CBM outline, graph result or unsupported language supplies incomplete, ambiguous or inconsistent structural evidence
- **THEN** ACE rereads and verifies exact current UTF-8 source ranges or reports typed partial/unavailable
- **AND** corpus quality, provider identity and license provenance are recorded independently
- **AND** no line hint claims exact independent LSP identifier coordinates; FR-03 remains open for separate research

### Requirement: Timed-out native provider work cannot monopolize the transaction indefinitely

A cancelled client wait SHALL not leave unbounded serial provider work or misattribute stale responses.

#### Scenario: REM-020 — Native CBM timeout and next request
- **WHEN** native indexing or retrieval stalls, is cancelled or times out before a queued healthy request
- **THEN** cancellation/recovery and transaction fencing let the healthy request complete or return typed bounded unavailability
- **AND** the cancelled generation cannot publish and stale late output cannot be attributed to the next request
- **AND** shared upstream jobs or other processes must not invalidate the approved source/generation isolation boundary
