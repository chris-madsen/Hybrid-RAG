> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.

# Owner architecture correction: Gateway-only ACE agent integration

**Owner decision:** 2026-11-14. Model-invoked optional context tools are explicitly REJECTED. The only agent-facing delivery path for ACE is the configured **Bifröst LLM Gateway** and its versioned ACE projection API. This supersedes the two-plane clause of ADR-017, earlier tool-facade architecture decisions, and TypeSpec TS-04 optional-tool schemas. Not a token-admission change.

## AS-IS evidence (pre-code)

- `src/bin/ace-retired-tool-protocol.ts` is the 69 KiB composition root, and its **default** branch instantiates `makeRetiredToolProtocolGateway` + `runRetiredToolProtocolSdkStdio`; Gateway is only selected by `ACE_GATEWAY_HTTP_MODE=true`.
- `src/bin/ace-gateway-http.ts` and `ace-context-bridge.ts` import the former composition root; removing the old binary without preserving the composition root breaks both. Preserve internal source indexing, search and context projection.
- `package.json` pins optional tool-server/client SDK packages, `Dockerfile.ace` and k3s deploy a stdio-server, and benchmark scripts/configs collect optional tool calls.
- Graphiti currently uses its own tool-protocol client adapter; it is not the agent-facing Gateway. Eliminating its backend protocol must not be disguised as a successful Graphiti replacement. Do not assert temporal graph capabilities when the provider is disconnected.
- PRs #237/#245 and #244 carry architecture/TypeSpec corrections, including optional-tool assumptions. This branch integrates them before removing that surface, preventing stale PRs from silently reintroducing it.

## G02 decision / boundaries / acceptance

1. **Gateway-only invocation.** Default ACE entrypoint is Gateway projection HTTP, never optional agent-triggered tools. An explicit native Hermes entrypoint can remain only if it does not create a second tool-call integration and if separately approved; no implicit fallback to it. No additional token-count block.
2. **Keep ACE's functional core.** Retrieval, index, source verification, exact source expansion **inside the engine**, policy, context transformation and receipts are preserved. Never make source retrieval rely on a model deciding to invoke a tool. Search must be triggered by the Gateway request path.
3. **Delete dead code and dependencies.** Remove server protocol, optional tool facade, exposed command, image/k3s entrypoints, tooling and tests that exist solely to register/call optional tools. Replace tests with Gateway/transform-contract oracles rather than simply deleting coverage for security and retrieval.
4. **Graphiti boundary.** Independently evaluate maintained direct Graphiti/FalkorDB API before removing an internal adapter. If no substitute is approved or tested, mark local temporal graph provider unsupported/NOT_READY with an explicit contract and require separate native provider migration. Do not silently replace it with an empty result.
5. **TypeSpec.** Keep Gateway HTTP only; purge candidate optional-tool/native schema types and their generated outputs if they were introduced to support the rejected architecture. Preserve v1 request/response compatibility.
6. **Documents and legacy evidence.** Update root README/AGENTS, ADRs/OpenSpec and current runbooks. Historical obsolete tool-path plans and logs must not remain authoritative and must be clearly retired or removed. No live configuration may advertise a model-invoked ACE tool. Apply deterministic source-wide search.
7. **CI negative gate.** A full tracked-file audit, including docs, configs, workflows and dependency lock, must reject reintroduction of the removed protocol name and symbols. Exempt only artifacts that cannot be safely modified without altering third-party source terms, and disclose any exact exemptions (goal: zero).
8. **E2E scope.** Gateway HTTP / Bifröst local mock egress and policy negative contracts are required. Real provider, retries, streaming and full agent E2E remain NOT-RUN until evidenced; removing optional tools must never be described as provider certification.

## Four reviews

- BUILD: TypeScript compile, pinned dependency lock, codegen drift and packaging.
- ARCH: no optional agent-invoked context plane or duplicate transport, inward TypeScript ports and one Gateway projection owner.
- SEC: no additional network egress or raw prompt logging; deny checks intact; explicit NOT_READY on unavailable providers.
- PLAN: exact removed files/symbols/commands, regression tests, merged-base CI, remaining unsupported services.

**No direct main mutation.** Commit the correction on a branch, verify with focused CI, then review/merge. This is an explicit owner-approved architectural decision; no further retired optional tool-call protocol-first compatibility requirement may override it.
