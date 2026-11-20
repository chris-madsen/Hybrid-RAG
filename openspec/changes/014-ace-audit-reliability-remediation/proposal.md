# Proposal — ACE source-integrity, recovery and evidence remediation

## Why

Completed Research in audit PR #290 (audited main `bd170d197dcafc5cd30d0b8d6220ba6eca4fde5b`) found source-path failures: unsafe concurrent Qdrant changed-path pruning (F1), incomplete non-Git freshness (F2), crash-vulnerable memory archive/proof (F3/F4), unverified optional RepoMap sent as ready (F5), unbounded source artifacts (F6), and ranking/provenance/economics gaps (F7–F13). See `docs/reviews/2026-11-19-astra-static-code-review.md`, other PR #290 appendices and `docs/reviews/2026-11-20-ace-remediation-engineering-decisions.md`. Research is complete at that source SHA, not re-run by this change.

## What Changes

- Define additional source integrity and cross-process publication acceptance.
- Make archival writes/projection-deletion proof recoverable after process failure.
- Enforce requested source plan and provenance, and stop unbounded unused full-file artifact retention.
- Correct ranking, delivery-stage telemetry, provider identity, Python worker backlog and corpus-parity decisions.
- Correlate Harbor provider/task usage evidence and prohibit false fivefold claims.

## Existing capability ownership and scope

This is **one cross-cutting OpenSpec delta change** for gaps from the audit. It does **not** replace accepted retrieval changes 003/006/007, memory 004 or gateway G11 change 013. It does not duplicate their task checkboxes.

Open PR #291 already addresses G2/G4/G5/G6/R1/R3/R6/M1/B1; treat its M1 crash recovery gap F4 as remaining pending until disproven by failpoint evidence. PR #288 owns native physical-send authorization; change 013 C03–C08 exclusively owns Bifröst final wire, streaming, actual agent loop and provider trials. This proposal requires their observations only as **external acceptance dependencies**, not duplicated implementation tasks. Never credit unmerged code to main.

## Non-goals

No new agent-facing API, Chat Completions fallback, model-invoked ACE tools, direct-provider bypass, new benchmark runner, Graphiti production rollout, arbitrary output-token cap, agent-per-send owner approval, auto-merge or new branch protection. No wholesale rewrite solely to satisfy a review. No source code is implemented by this Requirements stage.

## User stories and acceptance

As an ACE user I need fresh source facts and no silent stale/optional facts in a ready model response. As a memory operator I need crash-recoverable immutable originals and a deletion decision that cannot mistake unknown graph state for no projection. As an owner I need bounded source-copy retention, reliable provider identity and task-level cost and quality accounting. The scenarios REM-001…REM-022 specify deterministic positive and negative oracles. For real external provider and agent work, existing G11 acceptance remains independent.

## SDLC stage and authority

**Risk tier:** T2 (concurrency, persistence, privacy and evidence boundaries). **R:** REUSED from PR #290. **S:** this proposal and `specs/**/spec.md`. **A/P/X:** separate stacked Draft PRs, provisional pending review. Material G02 decisions require actual owner consent before a subsequent **explicit** implementation request. No egress in planning. Skill texts were read/applied manually; a live host Skill invocation is NOT_OBSERVED. Product baseline and overlapping PR HEADs MUST be refreshed before I.
