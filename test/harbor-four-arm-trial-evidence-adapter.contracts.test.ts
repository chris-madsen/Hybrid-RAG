import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readHarborFourArmTrialObservations } from '../src/adapters/harbor-four-arm-trial-evidence.js';

const withTrial = async (fn: (root: string, dir: string, aggregate: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'ace-gateway-trial-'));
  const dir = join(root, 'trial-1');
  const aggregate = join(root, 'aggregate.json');
  try {
    await mkdir(join(dir, 'agent'), { recursive: true });
    await writeFile(aggregate, JSON.stringify({ n_total_trials: 1 }));
    await writeFile(join(dir, 'result.json'), JSON.stringify({
      trial_id: 't1', task_name: 'task-1',
      started_at: '2026-11-14T10:00:00Z', finished_at: '2026-11-14T10:01:00Z',
      verifier_result: { rewards: { reward: 1 } }, exception_info: null,
      agent_result: { n_input_tokens: 120, n_output_tokens: 15 },
    }));
    await fn(root, dir, aggregate);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test('native Harbor baseline has no Gateway requests or fabricated telemetry', async () => {
  await withTrial(async (_, __, aggregate) => {
    const [result] = await readHarborFourArmTrialObservations('native', aggregate);
    assert.equal(result?.observedAceCalls, 0);
    assert.equal(result?.successfulAceCalls, 0);
    assert.equal(result?.rawInputTokens, 120);
    assert.equal(result?.newContextBytes, null);
  });
});

test('Gateway arm without request-bound receipts is blocked, not counted as success', async () => {
  await withTrial(async (_, __, aggregate) => {
    await assert.rejects(readHarborFourArmTrialObservations('dense', aggregate), /missing native Responses projection evidence/u);
  });
});

test('Gateway projection is distinct from model-invoked ACE tools and final-provider delivery', async () => {
  await withTrial(async (_, dir, aggregate) => {
    const projection = {
      schemaVersion: 'ace.gateway.v2', requestId: 'req1',
      kind: 'PREPARED', baseBodySha256: 'a'.repeat(64),
      projectedBodySha256: 'b'.repeat(64), bodyBase64: 'e30=', reasonCode: 'VERIFIED_CONTEXT_ADDED',
    };
    await writeFile(join(dir, 'agent', 'ace-responses-projection.jsonl'), JSON.stringify(projection) + '\n');
    const [result] = await readHarborFourArmTrialObservations('hybrid', aggregate);
    assert.equal(result?.observedAceCalls, 0);
    assert.deepEqual(result?.gatewayProjectionRequestIds, ['req1']);
    assert.equal(result?.successfulAceCalls, 0);
    assert.equal(result?.rawOutputTokens, 15);
    assert.deepEqual(result?.successfulRequestIds, []);
  });
});

test('malformed, duplicate and native-contaminating projection receipts fail closed', async () => {
  await withTrial(async (_, dir, aggregate) => {
    const path = join(dir, 'agent', 'ace-responses-projection.jsonl');
    await writeFile(path, '{"kind":"FAKE_SUCCESS"}\n');
    await assert.rejects(readHarborFourArmTrialObservations('dense', aggregate), /malformed native Responses projection evidence/u);
    const record = { schemaVersion: 'ace.gateway.v2', requestId: 'x', kind: 'BLOCK',
      baseBodySha256: 'a'.repeat(64), reasonCode: 'NOT_READY',
    };
    await writeFile(path, JSON.stringify(record) + '\n' + JSON.stringify(record) + '\n');
    await assert.rejects(readHarborFourArmTrialObservations('dense', aggregate), /duplicate native Responses projection/u);
    await assert.rejects(readHarborFourArmTrialObservations('native', aggregate), /native baseline contains/u);
  });
});
