> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# ADR-009 — Harbor evaluation, accurate token accounting, and evidence for the 5× target

**Status:** **Accepted (Harbor and evaluation principles)**; dataset adapters and exact usage collection remain implementation decisions  
**Decision items:** 21 (minimum metrics), 22D, 23 (Harbor approved)  
**Project:** Agentic Code Intelligence Harness / Adaptive Context Engine (ACE)  
**Date:** 2026-10-17  
**Decision source:** PRD v1.0 discussion and owner selections of 2026-10-17.  
**Status definitions:** `Accepted` — approved; `Proposed` — requires a spike or validation; `Deferred` — deliberately postponed.

> **Document boundary:** This ADR records the decision, alternatives, rationale and reconsideration criteria. Concrete classes, database schemas, API contracts, Kubernetes manifests and topology belong in subsequent Architecture Design.

> **Superseded agent-specific clauses (2026-10-23):** Harbor, quality-first benchmarking and the accounting principles remain accepted, but the Codex-specific primary baseline/authentication path was superseded for the current feedback loop by ADR-015: Hermes + native optional tool-call protocol + `openai-codex` ChatGPT OAuth. Historical Codex evidence and result artifacts retain their names and original meaning.

## Context

Architecture choices and professional claims require measurable results, not estimates based on the size of one tool response. Codex reports token usage; an established evaluation framework is still needed for repeatable tasks, isolation and comparable experimental configurations.

## Decision

1. **Harbor** is the primary framework for reproducible agent benchmarks. Compare the Codex baseline with existing/custom tools on TypeScript/DevOps tasks and suitable public datasets.
2. **Codex SDK and `codex exec --json`** are candidate usage sources after verifying the installed version's exact event contract. Never substitute approximate `tiktoken` estimates for available provider-reported usage.
3. Initially compare **native Codex**, **Codex + Serena**, and **Codex + Unified Harness**. Include **Augment Code**, **GitNexus / CodeGraphContext** when accessible/authorized, and other relevant solutions in a rigorous final report using the same tasks.
4. Run independent ablations for RAG, AST/LSP, routing and persistent memory. Memory scenarios must include a new session with preserved previous history.
5. Include **Jev, Vertex, embedding, Graphiti/extraction and indexing costs** separately rather than hiding external calls behind apparent Codex savings.
6. Full observability dashboards/tracing are out of scope (ADR-010).

## Formulas and prevention of double counting

For a comparable completed task using Codex usage fields:

```
raw_total_tokens = input_tokens + output_tokens
uncached_input_tokens = input_tokens - cached_input_tokens
speedup_tokens = baseline_raw_total_tokens / harness_raw_total_tokens
```

- `cached_input_tokens` **already belongs to** `input_tokens`; never add it a second time.
- `reasoning_output_tokens` is a subset of `output_tokens`; do not add it again.
- Account for `cache_write_input_tokens` separately according to the actual provider schema; do not automatically include it in token total.
- Record `measurement_unavailable` for incompatible or missing usage fields rather than guessing.
- Calculate **monetary cost** separately using cached/uncached input, output and external model-service prices. Show infrastructure and indexing time as separate cost categories.

## Integrity requirements for the 5× claim

- **5× is a target, not a proven result.** Make no claim before the final frozen holdout.
- Keep model/version, reasoning effort, source commit, task, environment, timeouts and permissions identical; document effective configurations.
- The **baseline retains ordinary strong Codex tooling**. Do not disable shell, ripgrep, file reads, Git, tests, caching or compaction to produce artificial savings.
- Compare **whole end-to-end agent runs**, including failures, partial completions and interrupted attempts. Never exclude failures without an explicitly justified methodology.
- Task success, tests and regression checks are quality gates. Report matched-success results for tasks passed in both arms while also disclosing any decline in total pass rate.
- Examine repetitions and distributions—median, variation, p90, and task type—not only the most favorable trace.
- Do not truncate code or artifacts under an otherwise equal time budget to manufacture token savings (ADR-006).
- Use exploratory tasks for tuning and a **separate immutable holdout** for final results.

## Minimum result manifest (logical requirement, not an implemented JSON Schema)

`run_id`, `task_id`, `suite_version`, `agent_version`, `model`, `reasoning_effort`, `repo_commit`, `config_id`, `toolset`, `success`, `test_result`, `input_tokens`, `cached_input_tokens`, `output_tokens`, `other_provider_tokens/cost`, `elapsed_ms`, `failure_reason`, `artifact_refs`, `environment_fingerprint`.

Retain raw events and the final JSONL/CSV along with artifact checksums. Do not expose secrets or private source in public reports.

## Benchmark roadmap (without rigid deadlines)

1. Verify one or two smoke tasks and the usage event schema using installed Codex/Harbor versions.
2. Build a small exploratory set of TypeScript/DevOps tasks and sanity checks.
3. Run paired baseline/Serena/harness comparisons, followed by ablations.
4. Prepare an independently validated repeated holdout with quality checks.
5. Add strong existing competitors where licensing and access allow.
6. Publish reproducible measurements, run artifacts and interpretation limits.

## Accepted deployment separation

The harness uses the existing local Kubernetes installation (ADR-008); **Harbor need not use that cluster** and may run isolated local Docker environments or a supported environment provider. These are separate workflows.

## Reconsideration

If Harbor stops supporting the required Codex version or cannot provide accurate usage or task coverage, consider a replacement through a separate evidence-based ADR.

## References

- Harbor: https://github.com/harbor-framework/harbor
- Codex SDK usage types: https://github.com/openai/codex/blob/main/sdk/typescript/src/events.ts
- SWE-bench: https://github.com/SWE-bench/SWE-bench
- Terminal-Bench 2.0: https://github.com/harbor-framework/terminal-bench-2
- ADR-006, ADR-008, ADR-010
