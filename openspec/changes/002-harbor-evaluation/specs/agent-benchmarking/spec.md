# agent-benchmarking — Spec Delta

## Purpose

Harbor baseline, complete usage and causal comparative evidence for Gateway-delivered ACE.

## ADDED Requirements

### Requirement: Strong matched baseline

The system SHALL compare an ACE Gateway arm with a strong matched baseline using the same task, source revision, coding-agent identity where applicable, provider/model, reasoning configuration and permissions.

#### Scenario: Baseline preparation

- **WHEN** a paired task is launched
- **THEN** model/provider/reasoning, task input, repository commit and permissions match between comparable arms
- **AND** the ACE arm differs only in the declared Gateway/ACE treatment.

#### Scenario: Owner-selected model identity

- **WHEN** the owner selects a specific supported provider/model/reasoning identity
- **THEN** generated jobs and experiment manifests preserve those values exactly
- **AND** unsupported values are blocked rather than silently normalized.

### Requirement: Harbor run isolation

The system SHALL use Harbor to run reproducible tasks in isolated environments while retaining failed and aborted runs.

#### Scenario: Independent rerun
- **WHEN** a benchmark task is repeated for a new configuration
- **THEN** a fresh isolated environment and pinned base commit are used.

#### Scenario: Timeout
- **WHEN** a run times out or crashes
- **THEN** the failed run remains in pass-rate/cost analysis.

### Requirement: Correct provider-reported usage

The system SHALL capture usage exported by the pinned agent/Bifröst/provider/Harbor path when available. Missing fields SHALL remain unknown rather than being reconstructed as exact usage.

#### Scenario: Cached and reasoning subsets
- **WHEN** input, cached-input, output and reasoning-output counters are present
- **THEN** totals avoid double-counting subsets already included by the provider.

#### Scenario: Missing usage
- **WHEN** usage is unavailable
- **THEN** UNKNOWN is recorded rather than zero.

### Requirement: Independent quality gate

The system SHALL evaluate functional correctness independently of token counts.

#### Scenario: Cheaper wrong result
- **WHEN** an ACE arm uses fewer tokens but fails required tests/quality acceptance
- **THEN** the run is not an accepted success and no 5× claim is made.

### Requirement: Frozen holdout and provenance

The system SHALL support versioned exploratory and frozen holdout suites and retain all relevant run identities and limitations.

#### Scenario: Claiming fivefold savings
- **WHEN** a report asserts at least fivefold end-to-end token reduction
- **THEN** it includes frozen-suite identity, matched baseline, quality gate, repeats, raw usage/provider evidence and limitations.

### Requirement: Gateway causal attribution

The system SHALL attribute an ACE effect only when the model-bound run has a valid ACE Gateway projection.

#### Scenario: No APPLY receipt
- **WHEN** an ACE-configured run shows lower usage but has no valid request-bound ACE APPLY receipt for the provider attempt
- **THEN** the difference may be reported
- **AND** the report explicitly denies causal attribution to ACE.

#### Scenario: Trivial forced projection
- **WHEN** the only task is constructed merely to force an obvious ACE projection
- **THEN** it may validate integration
- **AND** it SHALL NOT satisfy retrieval-benefit or token-economics acceptance.
