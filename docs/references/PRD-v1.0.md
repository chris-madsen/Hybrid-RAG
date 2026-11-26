# ACE — Product Requirements Document v1.0

**Historical requirements baseline: 17 October 2026.** English editorial reconstruction of the [original requirements record](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/references/PRD-v1.0.md). The original text, its checklist and its exact historical wording remain available at that immutable revision. This document records the initial requirements, not a new approval or a claim that all capabilities are implemented. Later accepted ADRs and OpenSpec govern current implementation.

## 1. Purpose

Adaptive Context Engine (ACE) is an agent-independent context layer intended to improve software engineering tasks by supplying precise, relevant, current evidence from code, project documentation and retained project history. The primary engineering objective is lower total token consumption per correctly completed task without compromising task quality.

The initial reference agent was Codex. The current reference integration uses Hermes with native Responses through Bifröst; that later decision does not change the original evaluation principle. The original author also identified a reproducible engineering demonstration and professional portfolio as secondary personal objectives. These are historical stakeholder goals, not architecture responsibilities.

## 2. Problem and hypothesis

Agents can spend substantial context and time locating symbols, tracing dependencies, rereading files and rediscovering architectural decisions. Long sessions can lose important earlier constraints. Generic text search may return irrelevant, outdated or ambiguous evidence. ACE should retrieve a small useful set while preserving the ability to inspect exact originals.

The initial ambition was at least fivefold reduction in total tokens against a strong native agent on accepted tasks. Earlier estimates against naive and optimized baselines were hypotheses, not results. No target may be represented as demonstrated without matched experiments and independent correctness evidence.

## 3. Users and tasks

- A developer needs accurate evidence for unfamiliar code, refactoring, debugging and implementation.
- A maintainer needs current project constraints, architectural decisions, source identity and safe behavior after changes.
- A returning agent needs attributable historical decisions across sessions.
- An operator needs reproducible local execution, explicit data policy and honest failure diagnostics.
- An evaluator needs comparable, repeatable measurements of task quality, usage, latency and cost.

## 4. Outcomes

| ID | Original outcome |
| --- | --- |
| O-01 | At least 5× aggregate end-to-end token reduction on comparable accepted tasks; hypothesis pending evidence. |
| O-02 | Maintain or improve independently measured correctness. |
| O-03 | Reduce unsupported code claims and misleading references. |
| O-04 | Retrieve relevant retained decisions across gaps of 1–14 or more days. |
| O-05 | Reduce full workload cost, including auxiliary processing and infrastructure where applicable. |
| O-06 | Reproducible experiments, inputs, execution and reporting. |
| O-07 | A credible engineering demonstration based on real results rather than marketing claims. |

Do not count fewer tokens from abandoned, incorrect or incomplete tasks as a successful optimization. Unknown usage is unknown, not zero.

## 5. Scope and non-goals

Initial scope: local repository discovery, structural and semantic evidence, project document retrieval, persistent historical recall, a unified context request, explicit policy, and comparative evaluation. Do not build a new language server, parser, vector database, general-purpose agent orchestrator or replacement coding agent merely to deliver these functions. Full runtime tracing, broad language expansion and AIOps are later possibilities, not first-release prerequisites.

Current decisions select native CBM for code retrieval, Bifröst as the sole agent-facing gateway, internal context RPC v3, separately authorized Vertex documents, and a future Graphiti/FalkorDB memory delivery path. Independent external LSP remains a research question. See [current architecture](../operations/current-architecture.md).

## 6. Use cases

| ID | Scenario | Expected result |
| --- | --- | --- |
| UC-01 | Locate retry logic | Relevant implementation with verifiable source and range. |
| UC-02 | Change an API signature | Definitions, affected references and uncertainty where analysis is incomplete. |
| UC-03 | Recall an earlier alternative | Relevant original discussion, decision and date, not an invented rationale. |
| UC-04 | Modify the working tree | Updated evidence or explicit stale/unavailable status. |
| UC-05 | Find project documentation | Relevant attributed document excerpts under explicit policy. |
| UC-06 | Investigate dynamically wired behavior | Distinguish observed facts from unresolved dependencies. |
| UC-07 | Work on a known file | Avoid unnecessary retrieval overhead; preserve normal agent tools. |
| UC-08 | Compare retrieval approaches | Matched tasks, versions, environment and independent acceptance. |
| UC-09 | Provider failure | Truthful typed failure or incomplete coverage; never claim absent evidence was retrieved. |
| UC-10 | Private repository and secrets | Enforce data-class and destination restrictions; redact diagnostic output. |

## 7. Functional requirements

Priorities are retained from v1.0: P0 essential, P1 important, P2 later. This is a requirements inventory, not an implementation checklist.

| ID | Priority | Original requirement |
| --- | --- | --- |
| FR-01 | P0 | Ranked lexical and semantic code search. |
| FR-02 | P0 | Structural discovery of symbols and precise source spans. |
| FR-03 | P0 | Language-server definitions, references, types and diagnostics. Independent external LSP scope remains open under #364. |
| FR-04 | P0 | Retrieval from project documentation. |
| FR-05 | P0 | Unified request and evidence assembly across applicable sources. |
| FR-06 | P0 | Initially proposed fixed token/result caps and progressive disclosure. ADR-006 supersedes mandatory truncation; preserve exact originals and use evidence-sensitive selection. |
| FR-07 | P1 | Adapt retrieval to the task and avoid unnecessary operations. |
| FR-08 | P1 | Search for structural patterns. |
| FR-09 | P1 | Dependency graph and impact exploration. |
| FR-10 | P2 | Data flow, control-flow/code-property graph and taint analysis where useful. |
| FR-11 | P2 | Integrate runtime and test evidence adapters. |
| FR-12 | P0 | Bind evidence to repository, revision, path, symbol and range as applicable. |
| FR-13 | P0 | Never present known stale source as current. |
| FR-14 | P1 | Incremental indexing with current working-tree changes. |
| FR-15 | P1 | Provenance and evidence method. |
| FR-16 | P1 | Explicit uncertainty for unresolved dynamic behavior. |
| FR-17 | P0 | Search original retained historical material. |
| FR-18 | P0 | Preserve originals separately from derived knowledge. |
| FR-19 | P0 | Attribute recalled facts to their source and date. |
| FR-20 | P1 | Represent proposed, accepted, superseded and rejected decisions. |
| FR-21 | P1 | Support time-aware queries and historical decision state. |
| FR-22 | P1 | Correct, delete or exclude retained material under policy. |
| FR-23 | P1 | Link decisions to code, ADRs and commits where evidence exists. |
| FR-24 | P0 | Integrate with a coding agent without replacing it. The original agent-invoked tool route is retired; ADR-020/021 select native Responses via Bifröst. |
| FR-25 | P0 | No mandatory agent fork or intervention in hidden reasoning. |
| FR-26 | P1 | Document integration and operating guidance in AGENTS.md. |
| FR-27 | P1 | Agent-independent integration contract; original tool-protocol assumption is superseded by the gateway boundary. |
| FR-28 | P1 | Preserve useful local operation on failures and fail closed for unsafe actions or data. Under the current contract required-source failure blocks projection; no unprotected provider passthrough is authorized. |
| FR-29 | P0 | Record complete agent-run and usage evidence. |
| FR-30 | P0 | Compare matched baseline and ACE runs. |
| FR-31 | P0 | Independent task correctness verification. |
| FR-32 | P0 | Separate total, cached and uncached tokens and full cost. |
| FR-33 | P1 | Retrieval metrics including recall, MRR and nDCG on labeled tasks. |
| FR-34 | P1 | Operational dashboards and observability; ADR-010 defers the full observability stack. |
| FR-35 | P1 | Ablation experiments isolating contributions of retrieval components. |
| FR-36 | P1 | Evaluate recall and usefulness across sessions. |

## 8. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-01 | Protect secrets and credentials; safe logging and redaction. |
| NFR-02 | Explicit residency and external data-transfer policy. |
| NFR-03 | Honest outage and partial-result behavior. |
| NFR-04 | Source freshness and explicit stale status. |
| NFR-05 | Measure latency and avoid unnecessary overhead. |
| NFR-06 | Reproducible Linux setup. |
| NFR-07 | Structured diagnostics, tracing and measurements where implemented; full observability deferred by ADR-010. |
| NFR-08 | Pin provider, model, configuration and task versions. |
| NFR-09 | Namespace isolation and measured scale behavior. |
| NFR-10 | Dependency license inventory and SBOM. |
| NFR-11 | Compact initial evidence with exact source access, not irreversible truncation. |
| NFR-12 | Treat retrieved content as untrusted data, not instructions. |
| NFR-13 | Measure CPU, RAM, disk, latency and cost. |
| NFR-14 | Auditable, source-redacted evidence for claims and decisions. |

## 9. Original component shortlist and constraints

The October shortlist considered Codex, Serena, Augment, GitNexus and other graph tools; hybrid local RAG, AST/LSP, Vertex, Graphiti and an immutable archive; Harbor or another reproducible evaluator. It compared reuse of maintained products against independent tool composition and a unified context layer. These were alternatives, not an approved stack or a verified feature comparison. The subsequent ADRs and native CBM cutover supersede the standalone vector/embedding/reranking proposals.

Selection must consider exact-source correctness, provider support, operational cost, license and data boundaries. Historical external comparisons and links in the original record are not current vendor verification.

## 10. Context engine behavior

1. Understand the task and decide which authorized sources are relevant.
2. Retrieve candidates using existing provider capabilities.
3. Verify current source identity, exact ranges and coverage where applicable.
4. Compose compact evidence with provenance and explicit limitations.
5. Preserve access to originals and avoid modifying the agent's unrelated native request fields.
6. Apply independent security and actual-attempt authorization at delivery.

These are intended responsibilities, not a declaration of full-unified readiness.

## 11. Project memory

Retain authorized original records independently from extracted entities and relations. Represent temporal validity and decision lifecycle; link an answer to original evidence. An earlier rejected approach should be distinguishable from a current accepted constraint. Deletion, correction, access and recovery must be explicit. The original design evaluated Graphiti and other memory systems; the currently selected Graphiti integration is not active in native Responses projection.

## 12. Evaluation

Original comparison arms (historical research design):

| ID | Configuration |
| --- | --- |
| B0 | Native Codex without external context layer. |
| B1 | Codex + Serena. |
| B2 | Codex + Augment Context Engine. |
| B3 | Codex + GitNexus or another license-permitted graph tool. |
| B4 | Codex + local hybrid RAG. |
| B5 | Codex + independent RAG and AST/LSP integrations. |
| B6 | Codex + unified ACE layer. |
| B7 | B6 with and without persistent memory. |

Not every arm is required for every task. Current matched Hermes acceptance is governed by [OpenSpec 013](../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md) and [#171](https://github.com/chris-madsen/Hybrid-RAG/issues/171). Historical Codex results cannot certify Hermes.

Freeze task manifests, independent tests, source revision, agent/model/version, effort, tools, time budget and environment. Reset the worktree between runs. Separate tuning from the holdout; prevent leakage of expected patches or hidden tests. Repeat where needed and report variation, excluded runs, failed attempts and scope.

```text
run_total_tokens = sum(actual per-call input_tokens + output_tokens)
run_uncached_input_tokens = sum(per-call input_tokens - cached_input_tokens)
token_reduction_factor = baseline_total_tokens / harness_total_tokens
cost_per_success = total_workload_cost / number_of_accepted_tasks
```

Avoid double-counting cumulative snapshots or cached subsets. Report quality, failure rate, latency, tool activity, source correctness, retrieval metrics and additional infrastructure/model expenses. A 5× claim needs complete comparable actual usage and independent acceptance on a predeclared task population. A smaller saving with higher quality can still be useful, but report the measured result rather than the target.

## 13. Product stages (historical)

0. Discovery and benchmark foundation.
1. Integrated MVP covering retrieval, structural/semantic evidence, documentation, minimal memory and evaluation.
2. Adaptive selection, working-tree freshness, temporal recall and quality gates.
3. Reproducible engineering-grade release and operational evidence.
4. Optional expansion after core value is demonstrated.

These stages do not authorize obsolete integration paths or change active acceptance gates.

## 14. Build versus reuse

Prefer maintained engines and adapter boundaries; evaluate native alternatives rather than reimplementing indexing, parsing, semantic analysis or graph storage without evidence. A collection of independent tools is a possible experimental baseline, not necessarily a good unified architecture. The original research hypothesis is a coherent, policy-aware context layer that reduces redundant work.

## 15. Risks

| ID | Risk |
| --- | --- |
| R-01 | The 5× hypothesis is not achieved. |
| R-02 | Mature competing integrations outperform the proposed composition. |
| R-03 | Auxiliary retrieval or cloud costs offset model savings. |
| R-04 | Stale or ambiguous source produces incorrect context. |
| R-05 | Derived memory invents or misattributes decisions. |
| R-06 | Static discovery misses dynamic dependencies. |
| R-07 | Dependency licenses constrain adoption or distribution. |
| R-08 | Private source or conversations cross an unauthorized boundary. |
| R-09 | Indexing and additional operations increase latency. |
| R-10 | Tuning leaks into holdout or overfits the benchmark. |
| R-11 | Provider and agent versions change. |
| R-12 | Scope expands into unrelated infrastructure or AIOps work. |

Mitigate through matched independent tests, exact-source verification, explicit policy, version pins, reliable usage and bounded scope.

## 16. Required evidence and deliverables

Working implementation, documented operation, independent correctness and economics results, architecture and decision records, security and reproducibility evidence. The original professional-demonstration goal is subordinate to these engineering facts. Do not publish unmeasured savings or fabricate portfolio achievements.

## 17. References and authority

- [Current architecture](../operations/current-architecture.md)
- [ADR register](ADR-000-decision-register.md)
- [Architecture fitness contracts](../architecture/07-architecture-fitness-contracts.md)
- [Native provider cutover](../plans/2026-11-25-native-cbm-cutover-and-legacy-retirement.md)
- [Original October requirements and external research references](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/references/PRD-v1.0.md)

The historical requirements are preserved in Git; later accepted decisions determine current scope. This editorial revision does not mark the original final owner-agreement checklist item complete.

## 18. Open questions and acceptance

The current unresolved questions are native-provider absolute retrieval quality and scale, independent LSP scope, actual document and temporal delivery, provider-wire and real-agent acceptance, and matched-task economics. Use the canonical OpenSpec trackers and issue records; do not infer acceptance from the existence of this PRD.

## 19. Requirements record status

The original v1.0 checklist documented requirements preparation, not implementation acceptance. Final owner agreement was not checked in that record. No approval is inferred by translating or editing it.
