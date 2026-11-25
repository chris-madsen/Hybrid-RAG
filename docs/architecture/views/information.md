# V-03 — Information architecture

**Governing viewpoint:** VP-03 · **Model kinds:** MK-04, MK-06 · **Concerns:** C-02, C-04, C-06, C-07, C-08.

**Identity/version:** V-03 v1.1; ACE-AD-001 v1.1; 2026-11-24. **Perspectives:** SP-01, SP-02, SP-03, SP-04. **Aspects:** AS-03, AS-05, AS-07. **Scope:** the entity portion described below, within the [AD boundary](../architecture-description.md).

## Information authority and lifecycle

| Information | Authority / role | Lifecycle and readiness |
| --- | --- | --- |
| Current source bytes | Workspace original; verified digest and exact UTF-8 range | Reread/revalidate during selection; a changed source must not be labeled fresh |
| Structural and semantic discovery | CBM native AST, graph, semantic and BM25 hints | Persistent provider process; lost session invalidates its graph until reindex |
| Native ranked candidates | CBM graph/semantic/BM25 | Native local mode tested; no claims of complete recall from top-K. Qdrant/embedding derived index remains transitional until retirement |
| Symbol evidence | External LSP definition and document symbol validation | Independent contracts and adapters retained; native code-only RPC does not request LSP. Further research deferred |
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

## Supporting sources and evaluation references

[Current retrieval composition](../../operations/current-architecture.md), [CBM provider](../../operations/codebase-memory-provider.md), [Qdrant writer authority](../../operations/qdrant-single-writer-authority.md), [source coverage model](../../../src/domain/source-coverage.ts), [context assembly](../../../src/domain/context-assembly.ts), [workspace manifest](../../../src/domain/workspace-manifest.ts), [ADR-006](../../references/ADR-006-context-integrity.md), [ADR-014](../../references/ADR-014-hybrid-context-engine.md).

The owner selected CBM; absolute quality and source correctness remain acceptance obligations. Independent LSP research is deferred. See CR-03, CR-04 and CR-07.

## Identified view components

| Component / version | Contents in this view | Governing model kind |
| --- | --- | --- |
| VC-03A v1.1 | Information authority/lifecycle model | MK-04 |
| VC-03B v1.1 | Data classification and completeness rules | MK-06 |

The [versioned catalog](../viewpoints.md) supplies the conventions, construction/analysis methods and interpretation legends. Linked historical source documents are supporting material, not automatically current components. Correspondence methods: CR-03, CR-04, CR-07.

## Known issues

Temporal recall is inactive; comparative retrieval and reliability acceptance remain open. See the [correspondence results and inconsistency register](../correspondences.md). No additional deviation from the governing notation conventions is identified in this documentation review.

Retirement and research remain open: [native CBM cutover (#363)](https://github.com/chris-madsen/Hybrid-RAG/issues/363) and [CBM Hybrid LSP versus external LSP (#364)](https://github.com/chris-madsen/Hybrid-RAG/issues/364). The benchmark adapter uses the current CBM source outline boundary, not the removed structural parser.
