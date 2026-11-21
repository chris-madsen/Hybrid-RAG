# Historical engine comparison before native CBM migration

**Status: ARCHIVED — observational evidence, not an active benchmark or parser-selection gate.**
The pre-migration engine comparison was developed against
`main@9464c4a4a420634ea39bd4ae57673a51fc88ed8f` and included a custom
three-file alias fixture. It was useful for identifying uncertainty, but is
**not sufficient proof** of correct call edges, graph freshness, or agent
quality on existing code. It was superseded by the selected native CBM
integration in [PR #316](https://github.com/chris-madsen/Hybrid-RAG/pull/316).

The proposal's ad-hoc runner and auto-triggered matrix have been retired rather
than merged into the long-lived SDLC. Historical measurements can still be
inspected in their original GitHub Actions runs; no new measurement was
performed by this archival change.

## Recorded observations (not a model-quality comparison)

| Engine | Prior observation | Caveat |
|---|---|---|
| Codebase Memory v0.12.1 | 3.97–5.27 s cold index; 1.72–3.77 s refresh; zero **CALLS** edges in the custom alias fixture | One fixture cannot prove repo-wide call coverage; graph navigation on real code still requires acceptance |
| CodeGraphContext Tree-sitter 0.6.13 | About 35 s indexing; stale `alpha.collide` target after a switch to beta | Forced reindex did not establish correct exact target identity |
| CodeGraphContext + SCIP | Initial run around 180 s; reported duplicate `alpha.collide` | Actual SCIP coverage/refresh remained unproven in the initial run |

Raw observational results: [CBM run 44811483156](https://github.com/chris-madsen/Hybrid-RAG/actions/runs/44811483156),
[CGC Tree-sitter run 44811316394](https://github.com/chris-madsen/Hybrid-RAG/actions/runs/44811316394),
[CGC+SCIP run 44810755693](https://github.com/chris-madsen/Hybrid-RAG/actions/runs/44810755693).

The historical time/RSS numbers measure CLI processes and may exclude worker
processes. Available artifact retention is determined by GitHub; this record
does not claim the raw run artifacts will remain accessible permanently.

## Architecture after selection

The deployed structural owner is **Codebase Memory**, not CodeGraphContext.
Qdrant remains semantic/hybrid retrieval; ACE retains byte-exact source
verification and publication fencing. The CBM adapter must not equate a
same-name search hit to a resolved call edge. A missing/ambiguous edge must
remain explicitly unproven, with correctness established through actual
source-qualified references and independent real-agent coding tasks.

This historical note **does not** authorize merging incomplete agent-E2E
or claiming any number of saved provider tokens.
