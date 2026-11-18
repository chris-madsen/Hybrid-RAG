import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('pinned Bifröst ACE plugin only accepts native Responses ingress before provider certification', async () => {
  const script = await readFile('scripts/build-bifrost-ace-plugin.sh', 'utf8');
  const plugin = await readFile('integrations/bifrost/ace-connector/plugin/main.go', 'utf8');
  assert.match(script, /BIFROST_COMMIT:=fe7634a6c828927d05ffdd57c62be0aaab04193f/u);
  assert.match(script, /rev-parse HEAD/u);
  assert.match(script, /main_test\.go/u);
  assert.match(script, /test -tags=bifrost_plugin -count=1/u);
  assert.match(script, /-buildmode=plugin/u);
  assert.match(script, /-X main\.aceSourceCommit=\$ace_commit/u);
  assert.match(plugin, /ACE plugin source commit provenance is unavailable/u);
  assert.match(plugin, /ace-bifrost-plugin:" \+ aceSourceCommit/u);
  assert.match(plugin, /func HTTPTransportPreHook\(/u);
  assert.match(plugin, /case "\/v1\/responses":/u);
  assert.match(plugin, /func prepareNativeResponses\(/u);
  assert.match(plugin, /ProjectNativeResponses/u);
  assert.match(plugin, /ACE Gateway endpoint is unsupported/u);
  assert.match(plugin, /func PreLLMHook\(/u);
  assert.match(plugin, /LLMPluginShortCircuit/u);
  assert.match(plugin, /AllowFallbacks:\s*&allowFallbacks/u);
  assert.match(plugin, /return blockProviderAttempt\(req, "ACE provider dispatch disabled until native Responses is certified"\)/u);

  assert.doesNotMatch(plugin, /projectionClient\.Project\(/u);
  assert.doesNotMatch(plugin, /context\.Background\(\)/u);
  assert.doesNotMatch(plugin, /ACE_GATEWAY_STRICT/u);
});

test('quarantined plugin retains truthful request-bound identity helpers for native migration', async () => {
  const plugin = await readFile('integrations/bifrost/ace-connector/plugin/main.go', 'utf8');
  assert.match(plugin, /crypto\/rand/u);
  assert.match(plugin, /newPhysicalRequestID/u);
  assert.match(plugin, /sessionCorrelationFromRequest/u);
  assert.match(plugin, /schemas\.HarnessSessionHeaders/u);
  assert.match(plugin, /schemas\.NormalizeSessionID/u);
  assert.match(plugin, /schemas\.ParseModelString\(rawModel, ""\)/u);
  assert.match(plugin, /durableActiveTranscriptDigest/u);
  assert.match(plugin, /"hostTranscriptAttested"\s*:\s*false/u);
  assert.match(plugin, /"hostCompactionEpoch"\s*:\s*"unknown"/u);
  assert.match(plugin, /bifrost-visible-request-only/u);
});
