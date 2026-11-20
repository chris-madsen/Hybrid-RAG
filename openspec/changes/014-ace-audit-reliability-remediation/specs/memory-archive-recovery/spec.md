# memory-archive-recovery — Audit Remediation Delta

## ADDED Requirements

### Requirement: Immutable episodes survive crash and idempotent re-import

Archive commit of original bytes and metadata SHALL be recoverable without accepting partial content, and retries SHALL remain safe.

#### Scenario: REM-007 — Interrupted blob or metadata write
- **WHEN** a process exits after a partial new blob or metadata write
- **THEN** re-import recovers exact digest-verified bytes or emits typed persistence failure
- **AND** no truncated existing content-addressed blob is accepted as successful

#### Scenario: REM-008 — Existing digest collision and orphaned temporary state
- **WHEN** existing digest path contains invalid bytes, an orphan temp remains or import is repeated
- **THEN** existing bytes are verified, conflicted files are quarantined or rejected, and legitimate originals remain intact
- **AND** malformed metadata never becomes a successful episode

### Requirement: Never-projected proof and deletion fence survive process failures

Deletion without live Graphiti absence proof SHALL be allowed only with positively durable never-projected state, including across retries and crashes.

#### Scenario: REM-009 — Crash between first archive write and archive-only proof
- **WHEN** first import commits an episode and crashes before later proof, then idempotent replay returns created:false
- **THEN** a persisted recovery/transaction record can prove no graph call could have started or the episode remains unknown
- **AND** every graph attempt is preceded by durable projection intent

#### Scenario: REM-010 — Unknown projection blocks deletion
- **WHEN** deletion is requested for old, ambiguous, attempted, or graph-projected state and graph absence is unavailable
- **THEN** original bytes remain protected and deletion is typed denied/not-ready
- **AND** no absence is inferred from missing receipts, timeouts or current configuration

#### Scenario: REM-011 — Shared original remains readable
- **WHEN** two live episodes reference the same blob and one provably archive-only episode is deleted
- **THEN** the survivor remains byte-exact and digest-verified after restart
- **AND** the deleted episode stays tombstoned with correct reference protection
