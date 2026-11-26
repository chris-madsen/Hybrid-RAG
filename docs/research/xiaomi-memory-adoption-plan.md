# MiMo Code and Mi-Memory research for ACE — 22 October 2026

**Historical research record.** English editorial reconstruction of the [complete original document](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/research/xiaomi-memory-adoption-plan.md). Detailed original observations, examples, experimental proposals and source citations remain at that immutable revision. This is not a new experiment, implementation plan approval or confirmation of vendor claims.

## Scope

Historical sources: [MiMo Code](https://github.com/XiaomiMiMo/MiMo-Code/tree/213365a0a3fd1ec0b171687d85bc453f05d33863), [Mi-Memory](https://github.com/Darwin-Agent/Mi-Memory/tree/e16a60dec80162cd8f07ae64cff53c0e94aba4a6), ACE `21074994220272b4e4fc381333967bc9a80cc7b7`. The original review examined MiMo Code source/README and the Mi-Memory report repository. It did not execute upstream code, reproduce experiments or run ACE integration tests. At the pinned revision, Mi-Memory was a report/landing-page repository, not a memory engine available for direct integration.

The useful distinction is operational continuity of unfinished work versus durable, attributable project knowledge. Do not replace the original archive with generated summaries, fork the agent, or build an always-on orchestrator to obtain that distinction. Current native Responses projection does not deliver temporal memory.

## Proposed workstreams

| ID | Candidate | Intended acceptance |
| --- | --- | --- |
| A | Typed session checkpoint | Preserve goal, progress, next actions, source pointers and uncertainty; validate schema and exact original references. |
| B | Checkpoint writer and lifecycle | Bounded triggers, idempotent writing, failure/restart safety; measure overhead. |
| C | Resume and reconstruction | Recheck current worktree/branch and policy; never treat stale checkpoint claims as current. Paired interruption experiment. |
| D | Local raw-history search | Source-linked recall; compare existing search and optional FTS only when needed. |
| E | Dream / consolidation | Derived durable-knowledge candidates, review and provenance; no silent promotion into accepted decisions. |
| F | Distill / workflow learning | Propose reusable instructions or tests from repeated patterns; no unreviewed mutation of agent policy. |
| G | Governed memory evolution | Diagnose, propose, shadow-test, evaluate and roll back retrieval/policy changes. |

The original staged experiments were G0 baseline, G1 checkpoint MVP, G2 resume spike, G3 optional writer/index, G4 reviewed knowledge promotion, G5 workflow distillation and governed evolution. These are historical proposals, not active scheduling commitments.

## Safety and evidence

Original episodes are authoritative; checkpoints and extracted claims are derived. Scope by workspace/session, preserve source offsets and digests, represent temporal validity and status, and honor correction/deletion. A checkpoint cannot authorize tools, credentials, private data egress or an unapproved provider route. Resume must revalidate current state, not execute historical instructions automatically.

Evaluate a predeclared interruption workload against the ordinary agent baseline. Measure independent task correctness, repeated work, attributable recall, factual error, total actual model usage including any writer/extractor calls, latency and full cost. Test interrupted writes, stale workspace, corrupted or missing records, duplicate retries, conflicting decisions, rejected promotion and unauthorized data. A recalled fact alone is not proof of savings.

The research noted MIT licensing and additional MiMo Code policy notices; recheck the applicable version and terms before copying anything. The original source citations remain in the linked record. See [current architecture](../operations/current-architecture.md) for the actual archive and memory boundary. No checkpoint/resume feature or Graphiti delivery is declared implemented by this document.
