# V-04 — Runtime and integration

**Governing viewpoint:** VP-04 · **Model kinds:** MK-05, MK-03 · **Concerns:** C-01, C-02, C-03, C-04, C-05, C-06.

**Identity/version:** V-04 v1.2; ACE-AD-001 v1.2; 2026-11-25. **Perspectives:** SP-01, SP-02, SP-03. **Aspects:** AS-01, AS-04, AS-05. **Scope:** the entity portion described below, within the [AD boundary](../architecture-description.md).

## Native subscription request sequence

~~~mermaid
sequenceDiagram
    participant H as Hermes
    participant B as Bifröst + Go connector
    participant A as ACE context RPC
    participant R as Retrieval / workspace
    participant P as ChatGPT provider
    H->>B: Native Responses request on subscription passthrough
    B->>A: Authenticated project request
    A->>R: Plan, discover, reread and verify source
    R-->>A: Verified evidence or typed failure
    A-->>B: Additive context and signed receipt, or BLOCK
    alt Prepared and eligible under source/data policy
        B->>A: Authorize exact physical attempt
        A-->>B: Bound authorization or denial
        alt Authorized actual attempt
            B->>P: Same native request with authorized context
            P-->>B: Native response / SSE
            B-->>H: Native response / SSE
        else Denied / not certified
            B-->>H: Explicit failure
        end
    else Projection blocked
        B-->>H: Explicit failure
    end
~~~

This sequence describes the accepted integration and source-level behavior. Actual external wire, streaming/cancellation and multi-turn agent acceptance are still open. Retries require independently bound physical attempts; PREPARED is not a send permit. Ordinary generation remains gated by the applicable certification and policy.

## Contract and ownership

- Hermes subscription base prefix: /chatgpt_passthrough; Bifröst native ingress: /chatgpt_passthrough/backend-api/codex/responses.
- ACE internal TypeSpec contract: ace.context.v3, with health, capabilities, project and authorize-attempt under /internal/ace-context/v3.
- Bifröst owns authentication forwarding, final request dispatch, provider retries, response stream and accounting. ACE does not generate a second model request or claim coding-host transcript attestation from request visibility.
- Context projection preserves native input and opaque request fields, adds verified evidence and checks final request binding. Required retrieval failure or unauthorized destination must not become silent passthrough.

## Native retrieval lifecycle

Native code retrieval uses WorkspaceSync and the CBM stdio frontend. Provider loss, cancelled/expired requests and failed rebuilds invalidate ACE publication; final source observation fences delivery. The upstream daemon may outlive the frontend. Its lifecycle and shared-cache ownership, ABA-free observations and external provider-wire cancellation remain separate acceptance obligations.

## Supporting sources and evaluation references

[ADR-021](../../references/ADR-021-bifrost-single-gateway-ace-context-service.md), [TypeSpec](../../../typespec/context-v3.tsp), [RPC transport](../../../src/transport/context-rpc-http.ts), [projection service](../../../src/application/responses-projection-service.ts), [attempt authorization](../../../src/application/gateway-attempt-authorization-service.ts), [Go connector](../../../integrations/bifrost/ace-connector/README.md), [subscription runbook](../../operations/gateway-subscription-oauth.md).

[Contracts/deployment design record](../05-contracts-and-deployment.md) contains historical interface assumptions; current TypeSpec and ADR-021 govern. Acceptance: [C01–C08](../../../openspec/changes/013-gateway-g11-production-acceptance/tasks.md), CR-01, CR-02, CR-03 and CR-05.

## Identified view components

| Component / version | Contents in this view | Governing model kind |
| --- | --- | --- |
| VC-04A v1.2 | Native subscription sequence | MK-05 |
| VC-04B v1.2 | Preparation, denial and attempt lifecycle | MK-03 |

The [versioned catalog](../viewpoints.md) supplies the conventions, construction/analysis methods and interpretation legends. Linked historical source documents are supporting material, not automatically current components. Correspondence methods: CR-01, CR-02, CR-03, CR-05.

## Known issues

Final-wire, cancellation and real multi-turn agent acceptance remain open. See the [correspondence results and inconsistency register](../correspondences.md). No additional deviation from the governing notation conventions is identified in this documentation review.
