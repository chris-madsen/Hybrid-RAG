# V-03 — Information architecture

**Governing viewpoint:** VP-03 · **Model kinds:** MK-04, MK-06 · **Concerns:** C-02, C-04, C-06, C-07, C-08.

## Information authority and lifecycle

| Information | Authority / role | Lifecycle and readiness |
| --- | --- | --- |
| Current source bytes | Workspace original; verified digest and exact UTF-8 range | Reread/revalidate during selection; a changed source must not be labeled fresh |
| Structural and semantic discovery | CBM native AST, graph, semantic and BM25 hints | Persistent provider process; lost session invalidates its graph until reindex |
| Vector candidates | Qdrant dense/sparse and native RRF, backed by local embedding workers | Derived code index; current runtime requires this composition; no certified CBM-only fallback |
| Symbol evidence | External LSP definition and document symbol validation | Independent exact-symbol check; value relative to CBM remains a comparative question |
| Project documentation | Vertex AI RAG with separately authorized corpus/data class | External opt-in; not an implicit code or private conversation destination |
| Archive originals | Immutable content-addressed local archive, lifecycle and tombstones | Implemented archive mechanisms; exact originals remain authoritative |
| Temporal projection | Graphiti/FalkorDB selected target | Not configured in current context runtime; enabling the retired adapter fails startup |
| Evaluation evidence | Frozen tasks, attempt/usage correlation and retained artifacts | Separate observations, unknowns and accepted outcomes |

~~~mermaid
flowchart LR
    O["Workspace originals"] --> I["Derived discovery indexes"]
    I --> C["Ranked candidates"]
    O --> V["Exact-byte verification"]
    C --> V
    L["Independent LSP evidence"] --> V
    V --> B["Verified evidence bundle"]
    A["Immutable archive"] -. "target derived temporal projection" .-> G["Graphiti / FalkorDB"]
    D["Authorized Vertex documents"] --> B
~~~

Private source, private conversation, secret and project-document policy boundaries are independent of provider capability. Only authorized data classes may cross an external boundary. Context completeness depends on all required sources and verified evidence, not candidate count. Original artifacts support lossless authorized access; budget pressure does not justify silently declaring incomplete evidence complete.

## View components

[Current retrieval composition](../../operations/current-architecture.md), [CBM provider](../../operations/codebase-memory-provider.md), [Qdrant writer authority](../../operations/qdrant-single-writer-authority.md), [source coverage model](../../../src/domain/source-coverage.ts), [context assembly](../../../src/domain/context-assembly.ts), [workspace manifest](../../../src/domain/workspace-manifest.ts), [ADR-006](../../references/ADR-006-context-integrity.md), [ADR-014](../../references/ADR-014-hybrid-context-engine.md).

The contribution of CBM, Qdrant and LSP is an open matched-evaluation decision, not an assertion that every component is necessary. See CR-03, CR-04 and CR-07.
