# V-01 — System context

**Governing viewpoint:** VP-01 · **Model kinds:** MK-01, MK-09 · **Concerns:** C-01, C-04, C-05.

**Identity/version:** V-01 v1.2; ACE-AD-001 v1.2; 2026-11-25. **Perspectives:** SP-01, SP-02, SP-03. **Aspects:** AS-01, AS-05. **Scope:** the entity portion described below, within the [AD boundary](../architecture-description.md).

## Context model

~~~mermaid
flowchart LR
    User["Developer / coding agent user"] --> Hermes["Hermes"]
    Hermes -->|"native Responses / own subscription bearer"| Bifrost["Bifröst (sole model gateway)"]
    subgraph ACE["ACE integration scope"]
        Connector["Go connector"]
        Core["TS / Effect context engine"]
        Connector <-->|"authenticated local context RPC"| Core
    end
    Bifrost <-->|"post-auth and physical-send hooks"| Connector
    Bifrost -->|"authorized final native request"| Provider["ChatGPT / Codex provider"]
    Core -->|"read and verify"| Workspace["Workspace / original source"]
    Core --> CBM["Codebase Memory"]
    Core --> LSP["External language servers"]
    Core -->|"authorized project documents"| Vertex["Vertex AI RAG"]
    Core --> Archive["Immutable local archive"]
    Core -. "target temporal recall" .-> Memory["Graphiti / FalkorDB"]
    Harbor["Harbor evaluation"] --> Hermes
~~~

Solid connections describe source-level integration boundaries, not certification of a live route. The dashed connection is the selected target; live temporal retrieval is not active.

| Boundary | Ownership |
| --- | --- |
| Agent and human | Task intent, model reasoning, tool invocation and code edits |
| Bifröst | Agent-facing endpoint, provider routing, bearer forwarding, physical retry and streaming/accounting |
| ACE connector and engine | Context projection, exact-source verification and request-bound policy |
| Retrieval providers | Provider-specific discovery; original verified source remains authoritative |
| Harbor | Independent agent-task execution and evaluation; not model-request transport |

## Supporting sources and evaluation references

[ADR-021](../../references/ADR-021-bifrost-single-gateway-ace-context-service.md) defines the accepted boundary. [Current architecture](../../operations/current-architecture.md) records implementation and readiness; [connector documentation](../../../integrations/bifrost/ace-connector/README.md) identifies the integration interface.

Verify that V-04 uses the same endpoint and ownership, V-05 has no unauthorized trust crossing, and V-06 keeps the local context service internal (CR-01, CR-03, CR-05). Full live delivery remains subject to OpenSpec 013.

## Identified view components

| Component / version | Contents in this view | Governing model kind |
| --- | --- | --- |
| VC-01A v1.2 | Context diagram | MK-01 |
| VC-01B v1.2 | Boundary ownership table | MK-09 |

The [versioned catalog](../viewpoints.md) supplies the conventions, construction/analysis methods and interpretation legends. Linked historical source documents are supporting material, not automatically current components. Correspondence methods: CR-01, CR-03, CR-05.

## Known issues

Live final-provider route and tenant isolation evidence remain open. See the [correspondence results and inconsistency register](../correspondences.md). No additional deviation from the governing notation conventions is identified in this documentation review.
