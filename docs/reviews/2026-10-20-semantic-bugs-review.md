# ACE semantic defects review — 20 October 2026

**Historical record, not current implementation instructions.** English editorial reconstruction of the [complete original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/reviews/2026-10-20-semantic-bugs-review.md). The original evidence, detailed task lists and source references remain preserved at that immutable revision. No fresh provider tests or acceptance are asserted here. For current authority see [runtime architecture](../operations/current-architecture.md), the accepted ADRs and OpenSpec.

Reviewed baseline `8192397de26334c9827ea2508dcaebba54c3a83d`; implementation corresponded to `7cfe49d24a8c288f4fc97a251bc01623d1f68d70`. Six findings from static review, not a new complete audit. No test/provider execution or fixes were claimed in this review.

## SB-01 — P1: error interpreted as Graphiti absence

Former typed read parser accepted structured content before checking the error flag:

```json
{"isError":true,"structuredContent":{"episodes":[]}}
```

This could return false absence and allow archive deletion after purge despite failed verification. Reject errors before any typed decoding; test structured/text episode and fact errors, malformed replies, and no archive deletion on verification error.

## SB-02 — P1: concurrent deletion and reconciliation

Reconciler reads the original; deletion purges and verifies absence; reconciler projects previously read bytes; an old writer can overwrite terminal outbox state. Static race, not reproduced. Require durable deletion intent, episode-level fencing, terminal-state version checks and coordinated in-flight projection; test barriers between these operations.

## SB-03 — P1: missing durable projection intent after crash

Archive originals were persisted before the outbox intent. Reconciliation enumerated outbox records only. A crash between phases could leave admitted originals without a projection job. Preserve original bytes and recover admitted intent automatically; do not project archive-only admissions. Test the exact crash window, not a different enqueue/receipt window.

## SB-04 — P1: lease acquisition versus recursive cleanup

A reader observed an empty lease directory; a concurrent process created a lease; recursive removal could destroy it. I/O errors could be mistaken for absence. The risk concerned same-owner/state-root processes with GC enabled, not all sharing modes. Require deterministic interleaving, error and reader-before-delete tests; static inference, not provider reproduction.

## SB-05 — P1: incomplete cost evidence accepted by text label

Historical Harbor cost completeness was inferred from a negative regular expression over costScope. Empty or arbitrary labels and null numeric costs could evade the check. The CLI used a type assertion, not an independent runtime schema. This was an acceptance-contract gap, not an observed fabricated published result. Require structured known/unknown costs, report verdicts and executed job/config identity.

## SB-06 — P2: arbitrary artifacts treated as JSON

The release CLI reused a JSON loader to verify arbitrary DBC artifact hashes. Plain logs, JSONL and binary artifacts could fail before digest comparison. Separate raw-byte hashing from structured parsing; test CLI input and mismatched digest.

## Interpretation

An unchanged provider fingerprint after an edit does not by itself prove stale source. Missing production approval is not automatically a code defect. The original recommended order was deterministic reproduction, targeted corrections, real lifecycle checks and independent acceptance evidence. See [the extended review](2026-10-20-unified-plan-progress-1227.md). Old provider-specific findings are not a current defect inventory.
