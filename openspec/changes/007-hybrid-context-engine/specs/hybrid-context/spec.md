# hybrid-context — Spec Delta

## ADDED Requirements

### Requirement: Native hybrid code retrieval

CBM SHALL be the sole code retrieval and structural engine, using its native semantic, BM25 and graph capabilities. ACE SHALL use native returned candidates with exact current-source verification, not an independent dense/sparse pipeline, fusion or reranker.

#### Scenario: Behavior query without identifier

- **WHEN** a query describes behavior without naming a symbol
- **THEN** native semantic discovery returns ranked candidates that ACE verifies against current source.

#### Scenario: Exact identifier or configuration key

- **WHEN** a query contains an exact rare symbol, environment key or configuration token
- **THEN** native lexical or graph discovery can find relevant candidates without a second index or cloud request.

#### Scenario: Native ranking provenance

- **WHEN** CBM returns ranked code candidates
- **THEN** ACE preserves observed native provider identity and does not claim separately executed dense, sparse, fusion or reranker stages.
- **AND** required unavailable discovery remains explicitly incomplete or unavailable.

### Requirement: Dynamic working context

The system SHALL incorporate authoritative current Git/worktree state and MAY incorporate client-provided focus/open-file hints as ranking priors.

#### Scenario: Focus hint

- **WHEN** the client supplies a focused file/range
- **THEN** matching current evidence may receive a ranking prior
- **AND** the hint SHALL NOT make stale or unrelated evidence authoritative.

#### Scenario: Dirty tree

- **WHEN** an indexed chunk conflicts with current working-tree bytes
- **THEN** current bytes win and stale evidence cannot be delivered as current.

### Requirement: Context receipt and delta delivery

The system SHALL assign stable bundle/evidence identities and SHALL support suppressing unchanged previously-known evidence bodies.

#### Scenario: Repeated context request

- **WHEN** a client presents a prior bundle/evidence receipt and relevant evidence is unchanged
- **THEN** ACE returns a compact reference for unchanged evidence instead of retransmitting the same body
- **AND** exact bytes remain available through authorized expansion.

#### Scenario: Evidence changed

- **WHEN** evidence with the same logical source changes digest/range/content
- **THEN** the new evidence is delivered as changed/new rather than hidden behind the prior receipt.

### Requirement: Quality-gated context economy

The system SHALL measure context savings only together with task/retrieval quality.

#### Scenario: Token reduction with quality regression

- **WHEN** a candidate architecture reduces context bytes/tokens but fails the predeclared quality/non-inferiority gate
- **THEN** it SHALL NOT be accepted as an ACE improvement.
