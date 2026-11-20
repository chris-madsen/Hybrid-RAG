# agent-evaluation-evidence — Audit Remediation Delta

## ADDED Requirements

### Requirement: Usage evidence is semantically reconciled with attempts and task outcome

Harbor acceptance SHALL bind typed usage and failure events to frozen task/arm/model/attempt and independent quality evidence; side-file hashes alone SHALL not certify egress.

#### Scenario: REM-021 — Missing or mismatched provider usage
- **WHEN** trace sidecars contain missing, duplicate, cancelled or wrong-arm/model/attempt usage
- **THEN** acceptance marks the affected trial unknown/incomplete and rejects verified egress claims
- **AND** actual provider writes and agent task acceptance still require G11 change 013 evidence

### Requirement: Fivefold verdict uses full task economics

Scored evaluation SHALL include all input/output token usage from failures/retries and divide by independently accepted tasks without counting cached subsets twice.

#### Scenario: REM-022 — Input-only improvement with increased output
- **WHEN** baseline task has 1000 input+100 output and ACE has 200 input+1100 output, or any usage is unknown
- **THEN** no fivefold total-token improvement is approved
- **AND** cached/reasoning subsets are not double-counted and unmeasured tokens stay unknown
- **AND** real Hermes/Harbor acceptance remains in existing G11 C07/C08
