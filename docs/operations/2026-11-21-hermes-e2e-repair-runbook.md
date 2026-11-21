# Hermes / Bifröst / ACE local acceptance repair — 21 November 2026

**Scope:** recovery from the November 21 source-bound verification failure, not a
production certificate or permission to start unrestricted model traffic.
Reference: the operator's `final-verdict.md` for main@331d497e. The per-call
CBM CLI bottleneck was superseded by merged PR #321.

## Fix inventory and exact evidence boundary

| Failure | Source-level remediation | What still requires a real operator run |
| --- | --- | --- |
| 25 CBM CLI subprocesses in 196.6 seconds | Persistent, application-owned CBM stdio transport (merged PR #321). CBM tools remain inaccessible to Hermes. | Re-run the exact Git-backed projection fixture; measure wall time and process count. |
| `durationMs` equals epoch timestamp on non-executed stages | Zero non-executed durations and reject invalid trace payloads. | Check a fresh runtime trace, not the previously corrupted evidence. |
| Generic `BLOCK/TRANSFORM_NOT_READY` | Distinguish incomplete required code coverage vs context truncation vs inconsistent evidence without exposing paths. | The exact old fixture's inner cause remains unknown until a new source-bound trace is collected. |
| Bifröst plugin compiled but HTTP server did not | Checksum-repaired pin `chris-madsen/bifrost@72f03b4b0d4a93b08e9fc0e5ebfe3447248af2a0` plus actual UI and temporary Go workspace build. | Start the built server with the approved plugin and verify Bifröst's subscriber route on the operator host. |
| Harbor 0.24 built-in Hermes adapter | Require `import_path=scripts.harbor_hermes_codex_oauth:HermesCodexOAuth`; explicitly reject `name: hermes` overriding it; use upstream install with proper `hermes --version` validation. | Test the actual Harbor 0.24 task container, Hermes binary and private OAuth state. |
| Wrong URL silently treated as Bifröst | Both the Python agent and TypeScript preflight now reject /v1, direct-provider hosts and mismatched URL digests. | Verify the route from INSIDE the Harbor task container, including its Docker DNS/network. |

## Hard safety boundaries

- Hermes uses its OWN `openai-codex` subscription OAuth; no Codex CLI credential borrowing.
- Do not set `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, direct model provider endpoints,
  or default to Harbor's built-in `name: hermes` agent. OpenRouter is a **negative
  test case**, never an authorized fallback.
- Set `HERMES_CODEX_BASE_URL` to the full Bifröst passthrough **base prefix**,
  for example `http://bifrost:8080/chatgpt_passthrough`, not `/v1`,
  `/v1/responses`, ACE's context projection endpoint, or a direct provider URL.
  The prefix must be reachable from the actual sandbox network; `localhost`
  inside Docker does not refer to the host.
- Pin the SHA-256 of the NORMALIZED URL (strip trailing slashes) in the
  experiment and Harbor agent `bifrost_endpoint_sha256`. The fingerprint is
  only an identity check, not proof that the endpoint is Bifröst.
- Keep Bifröst as the sole agent-facing gateway; ACE's local TypeSpec endpoint
  is an internal context/verification boundary. Do not register ACE or CBM tools
  for discretionary model invocation.
- Preserve per-physical-send source policy, protected body, approved
  destination/model/data classes, `store:false` and correlated receipts.
  `BLOCK`, `NOT_READY`, missing credentials or missing prepared context MUST
  NOT be bypassed with raw provider sends or alternate routes.

## Minimal ordered verification

1. **Source and build:** verify clean ACE and pinned Bifröst checkouts. Build
   the pinned ACE Go plugin with `scripts/build-bifrost-ace-plugin.sh` and the
   actual HTTP binary with `scripts/build-bifrost-subscriber-server.sh`.
   The second script builds the upstream Vite UI and uses a disposable
   Go workspace with `-mod=readonly`; neither uses a new protocol.
2. **Zero-egress tests:** run `npm run verify:full`, the real installed-CBM
   integration job, the Gateway-only audit, and the Go plugin contracts.
   These checks may pass with NO real Hermes/provider traffic.
3. **Reproduce source projection first:** reuse the exact tiny Git-backed
   synthetic fixture and known source/configuration revision. Record
   `PREPARED` or the precise typed `BLOCK` reason, verified candidate
   counts, CBM index identity, Qdrant publication membership and per-stage
   latencies. Never increase timeouts just to hide repeated indexing.
4. **Start one local Gateway:** launch ACE's internal projection service and
   the pinned Bifröst HTTP binary with the approved connector and worker
   configuration. Verify the subscription passthrough from the sandbox.
   A reachable health endpoint is NOT proof that the ACE post-auth hook runs.
5. **Harbor dry run:** verify that the job uses ONLY `import_path` and no
   built-in `name`; verify Hermes v0.22.3 binary and its supported
   `hermes --version`. Harbor `--dry-run` saying "nothing was run" is
   expected: it provides no model or task acceptance.
6. **Scoped C03–C05 subscriber probe:** only after a genuine verified
   `PREPARED`, exercise the already owner-authorized bounded/public-synthetic
   attempt on the existing ChatGPT subscriber route. Retain redacted exact
   source/attempt/body digests and provider acknowledgment, not OAuth tokens,
   request bodies, private transcripts or original source bytes.
7. **C06–C08 and economics:** real streaming/multiturn and independent Harbor
   coding quality plus H0/H1/H2 token/cost comparison remain separate,
   owner-gated checks. An official ARB lexical/BM25 reference baseline is not
   ACE output; never claim a 5x improvement from it.

## Machine-readable blockers

- `TRANSFORM_REQUIRED_CODE_COVERAGE_INCOMPLETE`: required source coverage
  was incomplete; inspect internal source-coverage details in the trusted
  local trace, not a model-visible exception.
- `TRANSFORM_CONTEXT_BUDGET_TRUNCATED`: verified evidence did not fit the
  specified lossless delivery policy/budget.
- `TRANSFORM_INCONSISTENT_CONTEXT_EVIDENCE`: transform returned an unusable
  body/evidence identity combination.
- `TRANSFORM_NOT_READY`: a different transform implementation returned no
  typed cause. Still BLOCK; never assume this indicates provider auth.
- `PROVIDER_WIRE_NOT_CERTIFIED`: the code path lacks real final-wire
  certification; offline contracts do not change this state.

**No claim of completed live Hermes → Bifröst → ACE → ChatGPT delivery is
established by this change.** The same host, model, exact request, source tree,
receipt and approved policy are required to close that acceptance gap.
