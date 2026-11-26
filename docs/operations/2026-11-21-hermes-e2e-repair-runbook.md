# Hermes / Bifröst / ACE local acceptance repair — 21 November 2026

**Scope:** recovery from the November 21 source-bound verification failure, not a
production certificate or permission to start unrestricted model traffic.
Reference: the operator's `final-verdict.md` for main@331d497e. The per-call
CBM CLI bottleneck was superseded by merged PR #321.

## Fix inventory and exact evidence boundary

| Failure | Source-level remediation | What still requires a real operator run |
| --- | --- | --- |
| 25 CBM CLI subprocesses in 196.6 seconds | Persistent, application-owned CBM stdio transport (merged PR #321). CBM tools remain inaccessible to Hermes. | Git-backed fixture: one CBM process start, `PREPARED` in 16.56s; see follow-up. |
| `durationMs` equals epoch timestamp on non-executed stages | Zero non-executed durations and reject invalid trace payloads. | Fresh local traces use elapsed durations; see follow-up. |
| Generic `BLOCK/TRANSFORM_NOT_READY` | The first trace lacked an inner cause; the follow-up below identifies the Qdrant text-normalization mismatch and its fix. | Local synthetic projection now returns `PREPARED`; real subscriber/provider-wire acceptance remains an operator gate. |
| Bifröst plugin compiled but HTTP server did not | Checksum-repaired pin `chris-madsen/bifrost@72f03b4b0d4a93b08e9fc0e5ebfe3447248af2a0` plus actual UI and temporary Go workspace build. | Pinned server/UI build passed in run `44903885637`; launch, post-auth hook, and subscription-route acceptance remain not run. |
| Harbor 0.24 built-in Hermes adapter | Require `import_path=scripts.harbor_hermes_codex_oauth:HermesCodexOAuth`; explicitly reject `name: hermes` overriding it; use upstream install with proper `hermes --version` validation. | Test the actual Harbor 0.24 task container, Hermes binary and private OAuth state. |
| Wrong URL silently treated as Bifröst | Both the Python agent and TypeScript preflight now reject /v1, direct-provider hosts and mismatched URL digests. | Verify the route from INSIDE the Harbor task container, including its Docker DNS/network. |

## Hard safety boundaries

- Hermes uses its OWN `openai-codex` subscription OAuth; no Codex CLI credential borrowing.
- Do not configure API-key-based model routes or direct model-provider endpoints.
  Never default to Harbor's built-in `name: hermes` agent; select only the pinned
  custom OAuth adapter through `import_path`.
- Set `HERMES_CODEX_BASE_URL` to the full Bifröst passthrough **base prefix**,
  for example `http://bifrost:8080/chatgpt_passthrough/backend-api/codex`, not the bare `/chatgpt_passthrough` prefix, `/v1`,
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
   the qualified source pin's actual HTTP binary and ACE plugin together with
   `scripts/build-bifrost-subscriber-server.sh` and absolute `ACE_PLUGIN_OUTPUT`.
   The script builds the upstream Vite UI and uses a disposable Go workspace
   with `-mod=readonly`; no new protocol. See the current subscription runbook
   for the exact pin; historical evidence below retains its original SHA.
2. **Zero-egress tests:** run `npm run verify:full`, the real installed-CBM
   integration job, the Gateway-only audit, and the Go plugin contracts.
   These checks may pass with NO real Hermes/provider traffic.
3. **Reproduce source projection first:** reuse the exact tiny Git-backed
   synthetic fixture and known source/configuration revision. Record
   `PREPARED` or the precise typed `BLOCK` reason, verified candidate
   counts, CBM index identity and per-stage
   latencies. Never increase timeouts just to hide repeated indexing.
4. **Start one local Gateway:** launch ACE's internal projection service and
   the pinned Bifröst HTTP binary with the approved connector, native CBM and
   `BIFROST_REQUIRED_PHYSICAL_SEND_PLUGIN=ace-bifrost-context` and
   `BIFROST_CHATGPT_PASSTHROUGH_SUBSCRIPTION_ONLY=true` configuration. Verify the subscription passthrough from the sandbox.
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

## Follow-up: source-bound local projection rerun — 21 November 2026

The root-cause trace was diagnostic-only: temporary instrumented source commit
`57cca47363910e477bb4aee8f486c5ec36d4d417` reported matching source digest and
an existing byte span, but a mismatching retrieved text value. This was not used
as success evidence. It isolated the defect: `candidateFromPayload` passed Qdrant's
source `text` through the metadata helper `stringField`, which called
`.trim()`. The candidate digest and range were correct, but trimming its final
newline made the retrieved text differ from the exact current source span. Fix
commit `89ab9695f71745a7191ebd2f64e259e74f556aff` adds a content validator that
checks nonblank text without normalizing it; the same rule is used for Vertex
document content. Qdrant and Vertex regressions cover both boundaries.

Verified on the clean local task tree at `0b49e3c8dce4f9b13ab4d679ab629cedf26b4b9e`
(`sourceCleanAtBuild=true`, source-manifest SHA-256
`8485e89a73b6d661caf48188809dc8c5c3beaac9dd39b5bddbb0c8c23e6277e4`, runtime
executable SHA-256 `5ed569dbe569e4a96bd1ed75ffa719628c8e1e752985b28b3d959609a13234fb`):

- The focused post-merge contract command
  `./node_modules/.bin/tsx --test test/qdrant-client.contracts.test.ts test/retrieval-memory-routing.contracts.test.ts test/process-embedding.contracts.test.ts test/fastembed-shell-launchers.contracts.test.ts`
  passed **54/54** tests.

- The stock `scripts/real-projection-e2e.mjs` 2,000-line synthetic TypeScript
  fixture returned `projection-pass` / `PREPARED` in 26.794 seconds. Fixture
  SHA-256: `0b8a31e69224ffc8acb067ae7d1dd4c22a8b5cc0fa5e95417c06b2f0a932245c`.
- The exact 17-line Git-backed fixture returned `PREPARED` /
  `VERIFIED_CONTEXT_ADDED`; the base-body digest matched, verified context was
  inserted, and it mentioned the target symbol. Fixture SHA-256:
  `79729e306950546b5cbbe93a5df04601d0d7d65347988eee4ff5fffe0ee8492b`.
  A counting wrapper showed one Codebase Memory process start for the request;
  wall time was 16.56 seconds.
- The deliberate source-race variant returned `projection-pass` with the
  updated source context in 294.471 seconds. No timeout was increased.
- The local Qdrant outage variant returned the expected honest `BLOCK / NOT_READY`
  in 0.971 seconds; it did not return `PREPARED`.

All four probes used the pinned local FastEmbed model/artifact, Codebase Memory
0.12.1, Qdrant 1.19.2 on loopback port 16333 backed by disposable tmpfs, and a
`mock`-only model policy. `providerWireCertified=false`: no Bifröst server was
started, no subscriber request or physical provider send was made, and no
model, Harbor, OAuth, or paid-provider call occurred.

Separately, workflow run `44903885637` at main `c77b45fda4574ea79a60a088f77e336ed43bd6a7`
successfully built the UI and pinned Bifröst HTTP server at
`72f03b4b0d4a93b08e9fc0e5ebfe3447248af2a0`; binary SHA-256 was
`6b946378c2df4d7b7216a9cc3146cf11e741d856e135466713363e1732104fd5`. This is
build evidence only, not subscriber/provider-wire acceptance. C03–C05 physical
send, C06–C08, Harbor task quality, and token/cost economics remain not run.
