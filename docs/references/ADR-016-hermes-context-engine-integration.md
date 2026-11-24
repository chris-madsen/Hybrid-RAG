# ADR-016 — Hermes native ContextEngine integration (superseded)

**Status:** Superseded by the explicit owner decision of 2026-11-14.

The Hermes-native context bridge described in the historical experiment is
not an alternative or fallback integration for ACE agents. The only supported
model-bound context path is the configured Bifröst LLM Gateway and the local
versioned ACE Gateway Projection API. Hermes must use the configured provider
endpoint rather than a native ACE context hook.

Internal ACE context transformation, source verification, retrieval, archival
memory and receipt handling are unchanged by this decision. Past Hermes-native
benchmarks are historical evidence and do not certify actual Gateway-to-model
egress. Gateway final-send, retries, streaming and real agent E2E require
separate tests and owner acceptance.

See [ADR-017](ADR-017-bifrost-unified-llm-gateway.md) and
[Gateway-only G02](../plans/2026-11-14-gateway-only-retirement-g02.md).
