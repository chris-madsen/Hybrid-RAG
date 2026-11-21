# Hermes subscription OAuth through ACE/Bifröst — current implementation and evidence boundary

**Owner decision (2026-11-21):** A single ChatGPT/Codex subscription route selected in Hermes configuration is the only supported real model authentication mechanism for ACE. No API-key substitution, fallback provider, or duplicate OAuth-validation service is authorized.

## Correct ownership

1. **Hermes:** owns OAuth login, refresh and the bearer token; `openai-codex` uses its dedicated auth store. Configure `HERMES_CODEX_BASE_URL` only to a known compatible Bifröst subscription route. Never copy tokens into ACE configuration, test fixtures or logs.
2. **Bifröst:** must forward the actual caller-owned subscription bearer to a ChatGPT Codex endpoint that accepts subscription OAuth. The normal `api.openai.com/v1/responses` API-key endpoint is **not equivalent**.
3. **ACE:** does not validate token identity, refresh tokens, or duplicate the provider's authorization decision. It verifies source/data policy, exact approved provider/model/destination, projection receipt, last serialized native Responses body, `store:false`, and single-use attempt identity; the service may return `ALLOW` when these pass. An authentic 401/403 is passed back as provider failure without API-key fallback.
4. **Provider:** authenticates the bearer and checks subscription entitlement. ACE never claims that it independently certified the subscription.

## Upstream capability — reuse before build

Maintained upstream Bifröst **transports v2.6.0** documents a ChatGPT passthrough (`/chatgpt_passthrough/backend-api/codex/responses`) forwarding ChatGPT subscription `Authorization` while its own virtual key is carried separately in `x-bf-vk`. See upstream [Codex CLI documentation](https://github.com/maximhq/bifrost/blob/transports/v2.6.0/docs/cli-agents/codex-cli.mdx) (section: *Keep your ChatGPT subscription*) and [WebSocket relay](https://github.com/maximhq/bifrost/blob/transports/v2.6.0/transports/bifrost-http/handlers/wscodexpassthrough.go). The route is a **native Responses subscription passthrough**, not general OpenAI API-key inference.

**Important mismatch:** ACE currently builds its Go plugin against the pinned fork `6baf302dc73a9858bb96da017a436ef2e60f82f1` and expects the `/v1/responses` gateway projection/physical-send hook. Bifröst transports v2.6.0's ChatGPT passthrough is **not certified to execute this exact ACE hook and final-byte authorization**. Do not assume a `/chatgpt_passthrough` request is intercepted merely because Bifröst supports the provider route. Do not change the pin without a Go API and security-boundary compatibility review.

## Admission semantics / no extra OAuth gate

- `src/application/gateway-attempt-authorization-service.ts` returns `ALLOW` only if existing effective receipt/body/source/data policy and the explicit provider/model/destination allowlists accept. No per-attempt `credential_source` proof is demanded.
- **Subscription-only deployment:** configure the ACE destination allowlist to **only** `https://chatgpt.com/backend-api/codex/responses` for the corresponding supported wire transport. Do not list `https://api.openai.com/v1/responses`, Azure, OpenRouter or other API-key routes as fallbacks.
- This exact destination is the final **outbound provider URL**, not the Hermes-to-Bifröst base URL; the current pinned Bifröst fork may not be able to produce it. Configuration and an `ALLOW` fixture alone do not implement the missing Gateway adapter.
- Continue checking `store:false`, preserved input, caller's approved source data classes, and final-attempt replay. These are integrity and data-routing checks, not a second login.
- Disable Bifröst provider/model fallbacks for this deployment. Do not replace subscription token with a Bifröst OpenAI API-key provider key.

## Verification before any real subscription E2E claim

1. Confirm the exact installed **Hermes** version uses the intended OAuth credential and actually honors the selected Bifröst base URL; no direct `chatgpt.com` bypass. Check separate auxiliary-agent routes, if applicable.
2. Confirm the actual Bifröst binary **natively forwards** that subscription bearer to ChatGPT Codex, without an API key or protocol conversion; identify the maintained upstream route and exact commit.
3. Confirm this route executes the **ACE authenticated v2 projection and per-physical-send final-byte guard** at the actual provider transmission boundary; a raw passthrough that skips ACE is a test failure, not an accepted alternative.
4. Confirm a successful public/synthetic Native Responses request yields both the ACE attempt ALLOW receipt and the **real correlated provider acknowledgement**. 401/403 must not silently retry via an API key.
5. Run controlled retries, model/destination mismatch and request mutation negatives. Streaming requires its own maintained route and C06 certification.
6. Retain source SHA, Bifröst binary SHA, Hermes version, redacted wire hashes and actual test results. Report `BLOCKED/NOT_RUN` for unavailable provider egress or absent verified adapter. Never write a mock PASS as C05 or C07 completion.

This resolves the **ACE duplicate-authentication deadlock**. It does **not** claim that the current pinned Bifröst fork automatically gains upstream v2.6.0 ChatGPT passthrough compatibility or that external egress has been executed.
