# V-02 — Functional architecture

**Governing viewpoint:** VP-02 · **Model kinds:** MK-02, MK-03 · **Concerns:** C-01, C-03, C-06, C-08.

## Responsibility model

ACE is one TypeScript/Effect modular monolith. Logical responsibilities do not imply separate deployments.

| Responsibility | Core behavior / ownership |
| --- | --- |
| Workspace truth | Workspace registration, path containment, tracked/untracked/removed source observations, revision-aware reads |
| Retrieval and semantic intelligence | Query planning, candidate discovery, structural spans, independent symbol validation and ranking |
| Context orchestration | Assemble source-grounded evidence, preserve required coverage, handle lossless expansion, produce an additive projection |
| Policy and authorization | Data-class and destination policy, request identity, signed projection receipt and single-use send authorization |
| Retained memory | Immutable originals, archive lifecycle, tombstones and reconciliation; future temporal retrieval separate |
| Evaluation | Frozen tasks, usage/cost accounting, evidence correlation and correctness gates |
| Transport/adapters | Typed internal RPC, provider-specific IO and Go connector; no domain ownership of provider DTOs |

~~~mermaid
flowchart TD
    T["Transport / Go connector"] --> A["Application / Effect orchestration"]
    A --> D["Domain / pure ADTs and invariants"]
    A --> P["Application ports"]
    X["Provider adapters"] -. implement .-> P
    R["Runtime composition"] --> A
    R --> X
~~~

The domain has no dependency on adapters, transport or provider IO. Runtime composition wires the ports to maintained providers. State machines model meaningful request, index and archive/evaluation lifecycle transitions; routing scores are not forced into a state machine.

## View components

[Strategic DDD](../01-strategic-ddd.md), [Event Storming](../02-event-storming.md), [Tactical DDD](../03-tactical-ddd.md), [FSM workflows](../04-fsm-workflows.md), [ADR-019](../../references/ADR-019-functional-ddd-typespec-contracts.md), [ports](../../../src/application/ports.ts), [architecture rules](../../../architecture/rules/).

The detailed DDD models preserve earlier domain terminology. The current implementation and later ADRs determine actual adapters and contract identity. Architecture fitness checks enforce dependency direction; real provider composition requires independent verification (CR-02, CR-06).
