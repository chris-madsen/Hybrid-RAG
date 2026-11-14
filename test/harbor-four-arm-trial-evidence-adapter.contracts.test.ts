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
    await assert.rejects(readHarborFourArmTrialObservations('dense', aggregate), /missing Gateway projection receipts/u);
  });
});

test('authenticated projection is not silently promoted to final-provider delivery evidence', async () => {
  await withTrial(async (_, dir, aggregate) => {
    const receipt = {
      kind: 'APPLY',
      receipt: { schemaVersion: 'ace.gateway.v1', receiptId: 'rc1', requestId: 'req1', decision: 'APPLY' },
    };
    await writeFile(join(dir, 'agent', 'ace-gateway-projection.jsonl'), JSON.stringify(receipt) + '\n');
    const [result] = await readHarborFourArmTrialObservations('hybrid', aggregate);
    assert.equal(result?.observedAceCalls, 1);
    assert.equal(result?.successfulAceCalls, 0);
    assert.equal(result?.rawOutputTokens, 15);
    assert.deepEqual(result?.successfulRequestIds, []);
  });
});

test('malformed, duplicate and native-contaminating projection receipts fail closed', async () => {
  await withTrial(async (_, dir, aggregate) => {
    const path = join(dir, 'agent', 'ace-gateway-projection.jsonl');
    await writeFile(path, '{"kind":"FAKE_SUCCESS"}\n');
    await assert.rejects(readHarborFourArmTrialObservations('dense', aggregate), /malformed Gateway projection/u);
    const record = { kind: 'BLOCK',
      receipt: { schemaVersion: 'ace.gateway.v1', requestId: 'x', receiptId: 'r1', decision: 'BLOCK' },
    };
    await writeFile(path, JSON.stringify(record) + '\n' + JSON.stringify(record) + '\n');
    await assert.rejects(readHarborFourArmTrialObservations('dense', aggregate), /duplicate Gateway projection/u);
    await assert.rejects(readHarborFourArmTrialObservations('native', aggregate), /native baseline contains/u);
  });
});
