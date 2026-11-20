# Code-intelligence engine bake-off (not an ACE integration)

Status: **experiment only, no winner selected**. This procedure compares the
**unmodified** upstream Codebase Memory MCP and CodeGraphContext against the
same source commit. It does not expose either engine to ACE Gateway, Qdrant
or the production repository indexing path.

## Frozen inputs

- Source repo: `chris-madsen/Hybrid-RAG`
- Source commit: `9464c4a4a420634ea39bd4ae57673a51fc88ed8f`
- CBM: release `v0.12.1`, Linux AMD64 release checksum
  `8453015145f072c1b9b019cbdd02cea8cc6f18cc5e116036dd20992631c638c7`.
  Release assets: https://github.com/DeusData/codebase-memory-mcp/releases/tag/v0.12.1
- CGC source: `CodeGraphContext/CodeGraphContext@ed2f36b0c5fa4566091e0a34753931c27e98bb33`;
  compare default Tree-sitter with explicitly requested SCIP.
- SCIP TypeScript: `@sourcegraph/scip-typescript@0.6.2` for the SCIP leg.
- Same repository bytes, languages, queries, runner class. Separate engine
  process, databases and Python environment. Dependency solver choices are
  retained in installation logs; further pin transitive packages for long-term
  reproduction.

## Control fixtures and oracle

Three files are added *untracked* in each isolated snapshot:
- `src/__ace_bakeoff_alpha.ts`: exports `collide`.
- `src/__ace_bakeoff_beta.ts`: exports **another** `collide`.
- `src/__ace_bakeoff_consumer.ts`: imports both under aliases, and exports
  `dispatchCollide`. First it calls only alpha; after a one-line change it
  calls only beta.

Expected positive relation at baseline: `dispatchCollide -> alpha.collide`.
Expected negative relation at baseline: `dispatchCollide -X-> beta.collide`.
After edit these expectations reverse. Presence of *some* same-name `collide`
edge is **not sufficient** to declare correct resolution. Missing results,
ambiguous edges, unresolved calls and heuristic links must be reported
separately; file/definition identity is mandatory to score a correct edge.
The included graph queries are discovery probes only and do not automatically
prove semantic correctness.

A real ACE symbol `compareStructuralAnalyses` is also searched in the same
snapshot. Additional real tasks for final selection: cross-file calls, imports,
renamed/deleted source, same-name symbols and path/digest freshness.

## Run and evidence

The optional GitHub Actions matrix `ace-code-intel-bakeoff.yml` tests
`cbm`, `cgc-tree`, and `cgc-scip` independently. Only the PR head contains
the harness; the source index is checked out at the fixed SHA.

Each engine records:
- upstream/version and exit statuses;
- tracked source files and fixture hashes;
- initial indexing time and peak RSS;
- searches, graphs, call traces, explicit query failures;
- identical source mutation and repeated indexing time;
- raw stdout/stderr per command and a machine-readable `report.json`.

The runner stores DB state under disposable per-job directories. Do not
publish indexes, enable agents/hooks, run an installer with automatic IDE
configuration, or change the production ACE environment.

**Important**: CGC `SCIP_INDEXER=true` alone does not demonstrate SCIP
execution. Inspect logs for the real `scip-typescript` invocation and indexed
SCIP documents. If CGC silently falls back to Tree-sitter, mark SCIP
unproven. `cgc index` after an edit tests rescan/reindex; live watch
convergence needs a separate bounded watcher experiment.

## Acceptance before considering integration

1. Both engines index the same frozen repo and report coverage/skips.
2. Qualified edges pass the two-name fixture on both sides of a source edit.
3. Names, file paths and symbol identities can be exported via a stable API.
4. No source from outside the allowlisted snapshot; no unreported gaps.
5. Real-repo tests demonstrate useful hit/call improvements against baseline.
6. Freshness guarantees and snapshot identities can be enforced at the ACE
   adapter boundary; absence of a source digest is an explicit gap.
7. Measured cold/update latency and memory are within approved bounds.
8. Licensing, dependency footprint, security posture and upgrade owner accepted.

No default provider switch, PR merge, production code deletion, or "winner"
claim without the actual runner artifacts plus independent review.
