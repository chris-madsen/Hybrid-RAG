# Independent ACE architecture audit — 19 November 2026

## A. Executive verdict

**SIGNIFICANT COURSE CORRECTION NEEDED.** Keep the context engine. Change the order of delivery. The critical missing unit is not another source of context: it is one completed Hermes task with evidence of what reached the configured model and what that task cost. On the audited `main`, the gateway can prepare a request but deliberately stops it before generation. Even preparation requires code evidence on turns that need none. Removing the stop alone would therefore not produce a dependable agent loop. Conversely, abandoning verified source reads or moving to a second agent interface would discard useful work without testing the hypothesis.

**PARTIAL AUDIT.** This report distinguishes reachable source, local fixture execution, historical measurements, open branches and unknowns. A detailed [delivery appendix](2026-11-19-astra-delivery.md) supplies the call graph, line ranges, counterexamples and test ledger. No product changes, paid requests, agent transcript uploads or production approvals are part of this review.

**Baseline:** `bd170d197dcafc5cd30d0b8d6220ba6eca4fde5b`, fetched and fast-forward checked against `origin/main`. The difference from the brief's `5f6d941` is the audit prompt alone (#289). At inspection #285 was merged at `5f6d941` (deduplication, not dispatch). #286 `06e333d` was open against main (lexical research); #287 `2a944a8` was open **against #286's branch** (benchmark, not runtime). #288 `8358c26` was open against main (individual-send authorization). None of these three open changes is credited to main. Recheck these identities before acting on a different revision.

## B. Architecture scorecard

| Dimension | Assessment on this SHA | Deciding evidence |
|---|---|---|
| Integrity | Mixed | Single delivery owner, but the retrieval obligation is hard-coded in the projection service. |
| Product alignment | Weak at the last mile | A prepared request cannot produce a Hermes answer through this connector. |
| Correctness | Mixed | Identity and source checks matter; two implementations disagree about an empty tool output (G4). |
| Maintainability | Mixed | Useful typed seams, but even interpreting one turn requires Go ingress, TS selection and Go verification. |
| Build versus buy | Mixed | Official Qdrant client is reused; repeat validation in the same Go caller is not a separate trust boundary. |
| Retrieval quality | UNKNOWN on natural Hermes tasks | Passing rank/fixture contracts is not accepted-task quality. |
| Agent autonomy | Blocked | Not a manual prompt per turn: automatic policy exists, but dispatch is unavailable and no-code turns cannot pass normally. |
| Safety | Positive local controls; final wire UNKNOWN | Deny by default, explicit destination policy and loopback; no observed provider retention or delivery. |
| Performance | UNKNOWN on this route | Older indexing results quantify setup risk, not today's per-turn latency. |
| Token economics | UNKNOWN | Historical forced comparison was worse; not the proposed experiment. |
| Test credibility | Strong for local claims only | Bounded test execution and negative results below; no real-agent inference from mocks. |
| SDLC maturity | Structural integration established; behavioral adoption UNKNOWN | Closure summary explicitly computes a structural verdict, not a host execution trace. |
| Production readiness | No for the evaluated agent path | Hook stops generation; recording endpoint returns 501. |

## C–D. Ranked issues and evidence register

Order is by impact on a real task. G IDs refer to the appendix, which includes the actual functions, evidence grades, minimal fixes and tests. No P0 observed; a deliberate privacy stop is not a confirmed disclosure.

| Rank / ID | Priority and confidence | Observable consequence | Smallest decision or corrective test |
|---|---|---|---|
| 1 / G1 | P1 confirmed | Even an eligible request cannot complete one model turn. | Keep stop until one pinned physical writer passes a local receiver test. |
| 2 / G2 | P1 confirmed | A no-code summary or successful empty search cannot continue without nonempty evidence. | Distinguish a verified no-addition decision from unavailable/stale/denied. |
| 3 / G3 | P1 confirmed mechanism, impact unknown | Existing agent history is preserved; deduplicating the addition does not establish fewer total tokens. | Measure avoided turns and total usage per accepted task, not snippet length. |
| 4 / E1 | P1 confirmed evidence gap | Old accepted-task arithmetic can be reused for the wrong agent and intervention. | Freeze a new matched Hermes comparison after G1. Never delete the negative result. |
| 5 / G4 | P2 confirmed | A blank tool result leads to different queries in Go/TS; deterministic refusal can surface as service unavailability. | Shared cross-language table; distinguish deny from retryable failure. |
| 6 / G5 | P2 strongly supported | Client timeout need not interrupt local work. | Observe finalization of a slow local transform after disconnect; propagate cancellation. |
| 7 / P1-MEM | P2 confirmed integration limit | Enabling the retired memory path stops startup, not just memory reads. | Keep it explicitly unsupported; separate required-memory startup failure from code-only configuration. |
| 8 / G6 | P2 confirmed | Prepared bytes decoded and validated twice in Go. | Return the validated bytes once; keep cross-boundary validation. |
| 9 / T1 | P3 confirmed | Nondefault HTTP body setting and advertised capability disagree. | One effective setting; test both default and nondefault server options. |
| 10 / E2 | P3 confirmed evidence limit | A passing structural SDLC check cannot show whether a host agent performed the work. | Label the check narrowly and sample observed, source-linked behavioral outcomes. |

**E1 — benchmark attribution.** `benchmarks/reports/harbor-ace-paired.md:3–27`: Codex, forced retrieval, 3 tasks repeated 3 times. Both arms 9/9; native 891,950 tokens vs ACE 1,571,768; reported cost $0.0569132 vs $0.08538924. This establishes the historical direction, **not** that current Hermes costs 76% more. `benchmarks/reports/harbor-natural-use-blocked-7bb3e02.json:5–25` explicitly lacks natural-use correlation and complete cost telemetry. Cause: changed client, route, instructions and measurement boundary. Reuse Harbor and its evaluator; retire only the old run's role as acceptance evidence. Depends on G1, not Graphiti.

**P1-MEM — configuration lifecycle.** `src/bin/ace-runtime.ts:272–289,327–333,1137–1139`: readiness models memory as separate, but `ACE_ENABLE_GRAPHITI=true` throws before HTTP startup. An operator carrying forward this opt-in cannot use even code-only projection. This is an explicit unsupported configuration, not evidence of lost memory. Do not silently accept it as healthy. Remove obsolete deployment references if found, validate configuration before expensive setup, and test code-only startup vs explicit memory-required failure. No new service or library. Separately, Vertex construction is conditional on its flag and project/corpus (`:172–197,904–909,958–960`); an adapter's presence is not evidence that a real documentation query ran. Preserve originals, recovery and deletion tests independently of serving derived claims.

**T1 — capabilities report the constant, not configuration.** `src/transport/gateway-projection-http.ts:16–34,66–74,125–143`: the server derives its envelope bound from the configured body size but its capabilities response uses the default. Local loopback observation: start `createGatewayProjectionServer({}, {authToken:'synthetic',maxBodyBytes:1024})`, authenticated GET `/internal/ace-gateway/v2/capabilities` → HTTP 200, `maxBodyBytes:4194304`. Does not establish a fault for the default production launch. Pass effective settings to the handler and keep the envelope allowance distinct from the raw limit. No new schema or dependency.

**E2 — evidence ownership.** `scripts/sdlc-closure-audit.mjs:165–183,216,267,281–287` tests paths, content and structural violations. A matching file and an agent actually using the skill produce the same input to this check. Its existing `structuralVerdict` label is correct; the error would be promoting it to a product verdict. By contrast G4 has a concrete fixture and G1 a reachable stop. Keep those negative tests. Use G02 for new material design choices, reuse already approved decisions for repeated execution; no observed evidence here of a human approving each model turn. No cross-host Hermes/Codex trial was run; neither universal compliance nor systematic obstruction was established.

**Additional branch-only issue G7:** see appendix; inspect the physical-send callback and process-local scope before promoting #288. Stream mode is still rejected there. Do not count it twice as a main-branch defect.

## E. Build-versus-buy decisions

| Local mechanism | Existing owner / alternative | Recommendation, deletion boundary and migration risk |
|---|---|---|
| Vector operations and publication | `@qdrant/js-client-rest`; Qdrant query/prefetch/fusion | `src/adapters/qdrant-sdk-adapter.ts:1–40` already derives request types from SDK. Use native query operations. Keep workspace identity, source verification and publication consistency outside the DB: a vector hit is not a current source citation. Do not delete fencing on API similarity alone. |
| Structural extraction / ranked repo map | ast-grep N-API / Tree-sitter; Aider tags and graph ranking, grep-ast context | Keep parsed spans and measured rank parity. `src/domain/repo-map.ts:164` and `test/fixtures/repo-map/` document the port/oracle. Notices in `third_party/licenses/`. Remove parallel extraction only after comparing identical inputs and useful snippets; fixture parity alone is not a license/provenance audit. |
| Lexical candidate discovery | ripgrep, fff | #287 compared resident fff vs fresh rg on 3,000 synthetic files: equal literal result sets, ~2.5–3.2× warm p50 gain; cold setup, real edits and relevance differ. Do not replace Qdrant or LSP from that result; test cheap literal candidates as an ablation, with current-byte verification. No runtime code to delete on main. |
| Semantic sessions / Python workers | Language servers, `vscode-jsonrpc`, provider-native inference | Keep compiler semantics separate from structural names. Do not consolidate lifecycle solely because both use child processes. Compare actual cancellation, restart, project ownership and error propagation first. No new queue or worker framework justified. |
| Transport, retry, streaming | Bifröst; Effect interruption at TS boundary | G5/G6: reuse host transport, remove second same-process decode; keep one independent receiver check. Do not add a second gateway or recreate SSE ordering. |
| Public DTOs and validation | TypeSpec schemas / generated TS | Generated envelopes prevent shape drift, not semantic drift between languages (G4). Prefer shared examples over another generated protocol; keep ingest validation. |
| Archive vs derived graph / external documentation | Byte archive, Graphiti/FalkorDB, Vertex | Different guarantees, not duplicate stores. Defer serving derived memory and remote docs in first code-only comparison. Removing the archive would make reconstruction and dispute resolution harder. |
| Evaluation / process evidence | Harbor paired trials, existing CI | Remove duplicate claims before removing tests. A structural checker and a behavioral assertion are not equivalent. Avoid a new orchestration service. |

## F–G. Architecture drift and what to preserve

**AS-IS:** Hermes-configured endpoint → Bifröst Go HTTP hook → local authenticated TS/Effect projection → workspace-bound retrieval → prepared response → Go verification → generation stop. The TS runtime also composes local indexing, structural tags, embeddings, optional sparse/reranking, a language-server registry, optional repo map and remote documentation. `src/bin/ace-runtime.ts:840–874,904–977,990–1076` checks manifest stability, publishes an index, and reconciles changes. Historical 10k-file cold run: 938,616 ms at `9edd7ca` (`benchmarks/reports/index-scale-real-provider-current-10000-2026-10-20.json:4–29`); **not** a current latency benchmark. Memory CLI, worktree helper and Harbor scripts have different failure domains and are not all required per request.

**TARGET:** one delivery owner; a context engine that can add verified useful facts *or explicitly decide none are needed*; host owns model choice, history and retries. ACE owns workspace binding, data permission at transmission and honest source status. The purpose of ADR-014 and ADR-017 survives. Treating every turn as a code retrieval task does not. ADR-019 helps schema agreement, not behavioral equivalence. ADR-020's native item preservation matters more than superficial payload shrinkage. A green phase checklist should not turn optional providers into a release dependency.

**MINIMAL VIABLE ACE:** one workspace, one configured model, one permitted native Responses route, the smallest existing local code-retrieval profile sufficient for frozen tasks. No mandatory graph, remote docs, new search daemon, reranker or second agent tool. No silent truncation or cloud fallback. If the actual Hermes loop requires streaming, streaming becomes part of this minimum; a synthetic non-streaming success is not an agent result. Starting over, we would build this vertical slice before broadening providers. Transition cost is principally physical-write integration, shared semantics and evaluation, not a rewrite of the retrieval core.

**Preserve:** exact source ranges/digests and stale-versus-absent distinctions; immutable originals versus derived claims; native reasoning and tool/result order; authorization independent of provider credentials; evidence that distinguishes preparation from actual delivery. Keep the historical negative benchmark: it is a useful control against tuning the narrative.

## H–I. Shortest path to a product decision

1. **Prove one physical route locally.** Reuse the Bifröst writer. With synthetic source, observe exact destination, serializer output, cancellation, denial and number of attempts on a loopback receiver. Do not remove the main stop until every permitted write has an attributable policy check and denied writes count zero. Test streaming if required by the client.
2. **Make evidence conditional, not safety optional.** Share query fixtures across Go/TS; separate allowed unchanged input from required-but-unavailable retrieval. Remove duplicate decode after parity. Exit: no-code and tool-continuation turns finish on a local fixture; stale data, denial and unavailable required code remain distinct. No new LLM planning call.
3. **Freeze the comparison before tuning.** Same Hermes revision, task snapshots, tools, model, reasoning, evaluator, stopping conditions and fresh sessions; pair and alternate arm order. Use unmodified Hermes vs Hermes + ACE. If gateway overhead alone needs isolation, add a diagnostic transport-only control, not a prerequisite product tier. Include failures, retries, cold/warm state, and independent task families; repeated runs of one task are not independent tasks.
4. **Run only under appropriate provider authorization.** Require observed final-wire correlation, complete attempt accounting and independent task acceptance. Sum all attempts' non-overlapping input/output tokens per arm, divide by accepted tasks; report cached input separately, never add it twice. Compare baseline/ACE ratios with paired uncertainty; if no tasks accepted, ratio undefined. Report actual billed and local estimated costs separately, p50/p95 task and turn latency, retrieval quality and failure reasons. A missing usage record is unknown, not zero. Publish below-target and negative results. No claim of ≥5× without both quality non-inferiority and support for the ratio.
5. **Only then add scope.** Ablate lexical, vector, repo map, semantic and memory contributions one at a time on a separate tuning set. Remove layers that add cost without reproducible task benefit. Preserve source and authorization invariants regardless of their benchmark impact.

## J. Evidence coverage and limits

Local environment: Linux x86_64, Node v24.15.0, npm 11.12.1, main SHA above. `npm ci --ignore-scripts --offline --no-audit --no-fund` installed locked dependencies. `npm run verify:pr`: initial attempt lacked a runnable `tsc`; rerun **PASS**. `node typespec/scripts/check-native-responses.mjs`: **PASS**, four route definitions and generated-type consistency, not provider execution. Targeted run from repo root (Bash):

```sh
node --import tsx --test test/{responses-projection,responses-projection-service,gateway-projection-http,qdrant-client,repo-map,graphiti-memory-search,local-memory-backup,harbor-four-arm-evidence,retrieval-quality-evaluation}.contracts.test.ts
```

**PASS 93/93**, zero skipped. Local HTTP/fixtures, local backup and contract checks; not a live Graphiti, Qdrant, Vertex or Hermes comparison. Appendix gives the separate Go compile failure and pinned-plugin test blocker. Inventory (`git ls-files`): 986 tracked files; 125 under `src`, 125 under `test`, 169 under `benchmarks`. Enumeration is not line-by-line review. Trace coverage is deepest for gateway and runtime composition. Source inventory, selected fixtures and historical artifacts cover retrieval, memory and evaluation less deeply.

**NOT_RUN:** current provider-backed indexing/recall at scale, actual crash/recovery across processes, k3s deployment, deep original-archive deletion audit, exact upstream parity across every language server and AST grammar, plugin SSE delivery, real-agent loops and paid usage. Live workload distributions, production threat coverage, provider cost, comparative host skill invocation and production readiness of optional services remain **UNKNOWN**. No existing ADR was altered; this report recommends decisions, not production promotion.
