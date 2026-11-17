import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Bifrost plugin build is pinned and fail-closed before plugin compilation', async () => {
  const script = await readFile('scripts/build-bifrost-ace-plugin.sh', 'utf8');
  const plugin = await readFile('integrations/bifrost/ace-connector/plugin/main.go', 'utf8');
  assert.match(script, /BIFROST_COMMIT:=fe7634a6c828927d05ffdd57c62be0aaab04193f/u);
  assert.match(script, /rev-parse HEAD/u);
  assert.match(script, /main_test\.go/u);
  assert.match(script, /test -tags=bifrost_plugin -count=1/u);
  assert.match(script, /-buildmode=plugin/u);
  assert.match(script, /-X main\.aceSourceCommit=\$ace_commit/u);
  assert.match(script, /status --porcelain --untracked-files=no/u);
  assert.match(plugin, /ACE plugin source commit provenance is unavailable/u);
  assert.match(plugin, /ace-bifrost-plugin:" \+ aceSourceCommit/u);
  assert.match(plugin, /HTTPTransportPreHook/u);
  assert.match(plugin, /crypto\/rand/u);
  assert.match(plugin, /newPhysicalRequestID/u);
  assert.match(plugin, /sessionCorrelationFromRequest/u);
  assert.match(plugin, /schemas\.HarnessSessionHeaders/u);
  assert.match(plugin, /schemas\.NormalizeSessionID/u);
  assert.match(plugin, /physicalRequestIDKey/u);
  assert.match(plugin, /sessionCorrelationKey/u);
  assert.match(plugin, /ctx\.Deadline\(\)/u);
  assert.match(plugin, /BifrostContextKeySessionID/u,
    'the later PreLLM hook must re-check Bifrost core session resolution');
  assert.match(plugin, /durableActiveTranscriptDigest/u);
  assert.match(plugin, /sha256Hex\(body\)/u);
  assert.match(plugin, /"hostTranscriptAttested": false/u);
  assert.match(plugin, /"hostCompactionEpoch": "unknown"/u);
  assert.match(plugin, /bifrost-visible-request-only/u);
  assert.doesNotMatch(plugin, /"hostTranscriptAttested": true/u,
    'Bifrost cannot claim it observed the coding host durable transcript');
  assert.match(plugin, /schemas\.ParseModelString\(rawModel, ""\)/u);
  assert.match(plugin, /ACE coding-harness session correlation is unavailable/u);
  assert.match(plugin, /ACE native Responses route is not yet certified/u);
  assert.match(plugin, /ACE Chat Completions route is retired/u);
  assert.match(plugin, /PreLLMHook/u);
  assert.match(plugin, /LLMPluginShortCircuit/u);
  assert.match(plugin, /AllowFallbacks:\s*&allowFallbacks/u);
  assert.match(plugin, /ace\.pre_llm_attempt_seen/u);
  assert.match(plugin, /len\(fallbacks\) != 0/u);
  assert.match(plugin, /ACE gateway model route is unsupported/u);
  assert.match(plugin, /ACE gateway model route is unsupported/u);
  assert.match(plugin, /only native Responses is eligible/u);
  assert.match(plugin, /projectedContextDigest\(projected\)/u);
  assert.match(plugin, /message\.Content\.ContentStr/u);
  assert.match(plugin, /return blockProviderAttempt\\(req, "ACE provider dispatch disabled until native Responses is certified"\\)/u);
  assert.doesNotMatch(plugin, /ACE_GATEWAY_STRICT/u, 'missing ACE receipts must never be a configurable bypass');
  assert.doesNotMatch(plugin, /ACE_BIFROST_SESSION_ID|ACE_BIFROST_ATTEMPT_GROUP_ID|ACE_BIFROST_HOST_ATTESTATION_JSON/u);
  assert.match(plugin, /ACE native Responses route is not yet certified/u);
  assert.match(plugin, /ACE Gateway requires an explicit Bifrost provider\/model route/u);
  assert.doesNotMatch(plugin, /bifrost:auto/u, 'automatic provider routing cannot satisfy destination authorization');
  assert.doesNotMatch(plugin, /ace\.session_id|ace\.attempt_group_id|ace\.provider|ace\.host_attestation/u,
    'the Gateway must not reintroduce a second caller-populated ACE bridge');
  assert.doesNotMatch(plugin, /ctx\.Value\(schemas\.BifrostContextKeyRequestID\)/u,
    'HTTPTransportPreHook runs before Bifrost populates its request ID');
  assert.match(plugin, /receipt\.RequestID != physicalRequestID/u);
  assert.match(plugin, /func HTTPTransportPreHook\\(/u);
  // Reuse Bifrost's own request cancellation/deadline context. An orphan
  // context.Background() would keep the provider projection running after
  // a host request was cancelled.
  assert.match(plugin, /projectionClient\.Project\(ctx, connector\.Request/u);
  assert.doesNotMatch(plugin, /context\.Background\(\)/u);
});
