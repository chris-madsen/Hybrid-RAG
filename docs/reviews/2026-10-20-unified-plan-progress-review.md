# ACE unified-plan progress review — 20 October 2026

**Historical record, not current implementation instructions.** English editorial reconstruction of the [complete original record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/reviews/2026-10-20-unified-plan-progress-review.md). The original evidence, detailed task lists and source references remain preserved at that immutable revision. No fresh provider tests or acceptance are asserted here. For current authority see [runtime architecture](../operations/current-architecture.md), the accepted ADRs and OpenSpec.

Historical main at `b7963aff915bd7458ead566c2ff6012b8bbb6a5f` (merge PR #63). Static review: parts of the plan and large source files were truncated; later work packages were assessed from the ledger and PR history. No test or real provider was executed. PR #63 head CI was green; #64 was running at inspection; the main merge SHA was not separately checked.

## Historical findings

| ID | Severity / evidence | Finding |
| --- | --- | --- |
| F1 | P1 / static inference | File leases and PID liveness were scoped to one host and state root; another namespace could lose reader protection under shared collection GC. |
| F2 | P2 / source observation | Scroll operations requested full payloads when only key/candidate identity was needed, producing unnecessary index-size-dependent work. |
| F3 | P3 / source observation | Collection namespace used requested embedding identity rather than actual receipt identity; snapshot fingerprint isolated data but did not satisfy the intended namespace contract. |
| F4 | P2 / static inference | Startup behavior differed between fatal and not-ready provider failures; operational clarity issue, not established data corruption. |
| F5 | P3 / source observation | Memory search selected the first linked decision only; valid-time versus import-time semantics were not explicit. |
| F6 | P2 / document observation | Status ledger lagged merged PRs and could misstate completion. |

Follow-up recorded in the original: F1 #66 and historical real crash lifecycle #78; F2 #67; F3 #71; F4 #72; F5 #69/#70; F6 ledger refresh #74 and subsequent update through #80. These historical dispositions do not establish current acceptance. The old Qdrant runtime has since been retired.

## Progress interpretation

The C-A through C-E correctness tracks had implementation and tests, but real provider choice, memory integration, scale and matched agent economics remained incomplete. Historical forced-use token ratio 0.567× was negative; unknown cost remained unknown. Report generators and validators were useful contracts, not substitutes for actual runs. The review prioritized a small natural-use experiment and real recovery/quality work rather than expanding evidence infrastructure. The later [extended review](2026-10-20-unified-plan-progress-1227.md) corrected and refined these observations.

No current defect, provider incident, completion percentage or production readiness is inferred from this historical record.
