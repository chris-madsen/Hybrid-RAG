# ast-index research and adoption hypotheses for ACE — 22 October 2026

**Historical research record.** English editorial reconstruction of the [complete original document](https://github.com/chris-madsen/Hybrid-RAG/blob/d19b8ac04ce3861ee0b477fd5253c684edb5136f/docs/research/ast-index-adoption-plan.md). Detailed original observations, examples, experimental proposals and source citations remain at that immutable revision. This is not a new experiment, implementation plan approval or confirmation of vendor claims.

## Research scope

Original source snapshots: [ast-index](https://github.com/defendend/Claude-ast-index-search/tree/6ca99bde97627224f9217c7962e3dff9944c7a87), ACE `3180bd09f07a055552aae98f3aa30633772b61bc`. The historical report examined pinned code and documentation, not a head-to-head benchmark. It described Tree-sitter parsing, SQLite/FTS5 storage, structural search, relationships, graph traversal, PageRank/RWR, history signals and incremental update mechanisms. These observations refer to that revision; upstream claims about savings were not independently reproduced.

The original ACE composition used separate structural and vector providers. The native CBM cutover makes a second bespoke graph or vector pipeline an obsolete default proposal. Reuse the selected native capabilities and measure missing behavior before adding an adapter.

## Original adoption candidates

| ID | Priority in original plan | Hypothesis |
| --- | --- | --- |
| A0 | P0 | Compare ast-index externally before implementing another graph layer. |
| A1 | P0 | Persistent symbol/reference identity and typed edges with source provenance. |
| A2 | P0 | Selective one-hop graph expansion after candidate retrieval. |
| A3 | P1 | Personalized PageRank/random walk with restart for query-relative ranking. |
| A4 | P0/P1 | Dependents, dependencies, impact and path exploration. |
| A5 | P0 | Bind graph freshness to source identity; fail closed on stale evidence. |
| A6 | P1 | Centrality as a secondary signal, not a relevance oracle. |
| A7 | P1/P2 | Git-history signals such as change hotspots, risk and prior use. |
| A8 | P1 | Changed-file context as a ranking signal. |
| A9 | P1 | Test discovery relationships. |
| A10 | P1/P2 | Module and build dependency relationships. |
| A11 | P0 | Explicit completeness and pagination; never hide omitted results. |
| A12 | P0/P1 | Compact rendering without losing exact source access. |
| A13 | P1 | Coalesced, bounded updates; not a new identity model. |
| A14 | P2 | Multiple roots or attached subtrees with isolation. |
| A15 | P2 | External dependency symbol stubs with explicit evidence limits. |
| A16 | P2 | Inspectable graph and query diagnostics. |

## Graph semantics

The historical model proposed SymbolNode, SymbolEdge and SymbolGraphSnapshot: stable repository/path/symbol identity, relationship kind and direction, evidence method, confidence, current source digest and version. Name matches and inferred relationships are not exact definition evidence. Dynamic relationships require uncertainty annotations. The old proposal to construct a local graph is superseded by selection of native CBM for structural and graph discovery; retain only the source and evidence requirements.

## Original experimental design

G0 external ast-index baseline; G1 one-hop expansion; G2 relation/confidence weighting; G3 personalized PageRank/RWR; G4 centrality; G5 history-aware ranking; G6 module graph. Each arm was a separate proposed experiment, not a measured improvement. Compare exact candidates/ranges, recall, ranking, source freshness, context bytes, latency, resource costs and independent accepted-task usage. Keep tasks, source, model and agent constraints matched. Use held-out tasks and avoid leakage.

The report recommended first obtaining a real feedback baseline, then the smallest experiment justified by the observed retrieval gap. Do not copy upstream parser/storage/transport implementations wholesale or treat a ranking score as source truth. The pinned project license and source references were recorded in the original; recheck current licensing before any code reuse.

## Current applicability

See [native CBM cutover](../plans/2026-11-25-native-cbm-cutover-and-legacy-retirement.md), [#363](https://github.com/chris-madsen/Hybrid-RAG/issues/363) and [#364](https://github.com/chris-madsen/Hybrid-RAG/issues/364). The graph research is historical evidence, not an instruction to reintroduce a duplicate engine. Absolute native retrieval quality, source verification and independent LSP scope remain distinct.
