import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Bifrost plugin build is pinned and fail-closed before plugin compilation', async () => {
  const script = await readFile('scripts/build-bifrost-ace-plugin.sh', 'utf8');
  const plugin = await readFile('integrations/bifrost/ace-connector/plugin/main.go', 'utf8');
  assert.match(script, /BIFROST_COMMIT:=fe7634a6c828927d05ffdd57c62be0aaab04193f/u);
  assert.match(script, /rev-parse HEAD/u);
  assert.match(script, /-buildmode=plugin/u);
  assert.match(plugin, /HTTPTransportPreHook/u);
  assert.match(plugin, /BifrostContextKeyRequestID/u);
  assert.match(plugin, /BifrostContextKeySessionID/u);
  assert.match(plugin, /durableActiveTranscriptDigest/u);
  assert.match(plugin, /sha256Hex\(body\)/u);
  assert.match(plugin, /schemas\.ParseModelString\(rawModel, ""\)/u);
  assert.match(plugin, /ACE request-bound host identity is unavailable/u);
  assert.match(plugin, /ACE projection blocked/u);
  assert.match(plugin, /PreLLMHook/u);
  assert.match(plugin, /LLMPluginShortCircuit/u);
  assert.match(plugin, /AllowFallbacks:\s*&allowFallbacks/u);
  assert.match(plugin, /ace\.pre_llm_attempt_seen/u);
  assert.match(plugin, /len\(fallbacks\) != 0/u);
  assert.match(plugin, /ACE gateway model route is unsupported/u);
  assert.match(plugin, /ACE provider model differs from authorized ingress payload/u);
  assert.match(plugin, /ingressModel != model/u);
  assert.match(plugin, /projectedContextDigest\(projected\)/u);
  assert.match(plugin, /message\.Content\.ContentStr/u);
  assert.match(plugin, /ACE context was lost or modified before the provider attempt/u);
  assert.doesNotMatch(plugin, /ACE_GATEWAY_STRICT/u, 'missing ACE receipts must never be a configurable bypass');
  assert.doesNotMatch(plugin, /ACE_BIFROST_SESSION_ID|ACE_BIFROST_ATTEMPT_GROUP_ID|ACE_BIFROST_HOST_ATTESTATION_JSON/u);
  assert.match(plugin, /ACE provider differs from the authenticated ingress identity/u);
  assert.match(plugin, /bifrost:auto/u);
  assert.doesNotMatch(plugin, /ace\.session_id|ace\.attempt_group_id|ace\.provider|ace\.host_attestation/u,
    'host identity must come from trusted Bifrost request context, not a second bridge');
  // Reuse Bifrost's own request cancellation/deadline context. An orphan
  // context.Background() would keep the provider projection running after
  // a host request was cancelled.
  assert.match(plugin, /projectionClient\.Project\(ctx, connector\.Request/u);
  assert.doesNotMatch(plugin, /context\.Background\(\)/u);
});
