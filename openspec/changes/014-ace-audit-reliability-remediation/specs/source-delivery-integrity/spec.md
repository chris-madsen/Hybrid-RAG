# source-delivery-integrity — Audit Remediation Delta

## ADDED Requirements

### Requirement: Requested source plan controls optional derived evidence

RepoMap and similar derived sources SHALL only enter model context when requested, allowed and source-verified.

#### Scenario: REM-003 — Code-only request excludes RepoMap
- **WHEN** Gateway requests code only while RepoMap is configured with nonempty unverified text
- **THEN** no RepoMap structural bytes reach the Native Responses prepared body
- **AND** code permission does not grant implicit structural-evidence permission

#### Scenario: REM-004 — Required structural evidence unavailable
- **WHEN** structural source is required but the rendered map cannot be verified against its paths/revisions
- **THEN** Gateway returns typed partial/not-ready rather than promoting unverified map text as ready
- **AND** warnings are not silently dropped while their unverified facts remain model-visible

### Requirement: Exact retrieval artifacts have bounded purpose and lifetime

Private full-source copies SHALL NOT accumulate indefinitely on a path with no active expansion consumer.

#### Scenario: REM-012 — Repeated retrieval does not multiply private whole-file copies
- **WHEN** repeated verified retrievals return the same source and there is no active authorized artifact consumer
- **THEN** full-source durable artifact bytes do not grow linearly with request count
- **AND** exact source/range verification remains intact

#### Scenario: REM-013 — Retired expansion façade is not exposed
- **WHEN** ACE supplies context exclusively through approved Bifröst Native Responses
- **THEN** no inaccessible model-invoked ace_expand/context-command route is advertised or usable
- **AND** legitimate exact-source reads must use an actually supported, authorized path

### Requirement: Maintained and correctly versioned digest semantics

Identity digests SHALL have documented algorithms and compatibility behavior; handwritten invalid SHA-256 SHALL NOT be treated as a standard hash.

#### Scenario: REM-014 — Digest vectors and receipt migration
- **WHEN** canonical hash vectors, large-message cases or historical identities are encountered
- **THEN** current SHA-256 matches a maintained implementation and old/new receipts cannot silently impersonate each other
- **AND** any bundle or receipt hash migration is explicitly versioned and regression-tested
