import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { failureEvidence, safeCode, writeLocalChainEvidence } from '../scripts/g11-local-native-chain.mjs';

test('G11 failure evidence exposes safe physical outcomes without request or source data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-g11-failure-evidence-'));
  const tracePath = join(directory, 'retrieval-trace.jsonl');
  const providerTracePath = join(directory, 'provider-trace.jsonl');
  try {
    await mkdir(join(directory, 'state'));
    await writeFile(join(directory, 'state', 'gateway-policy-audit.jsonl'), [
      JSON.stringify({ component: 'gateway-physical-send', outcome: 'denied', reasonCode: 'DESTINATION_NOT_ALLOWED',
        attemptId: 'private-attempt', body: 'private-request-body' }),
      JSON.stringify({ component: 'other', outcome: 'allowed', reasonCode: 'IGNORED' }),
      'null',
    ].join('\n') + '\n');
    await writeFile(tracePath, [
      JSON.stringify({ stage: 'delivered', candidates: [{ sourceText: 'private-source-bytes' }] }),
      JSON.stringify({ stage: 'projection', requestId: 'private-request-id' }),
      'null',
    ].join('\n') + '\n');
    await writeFile(providerTracePath, JSON.stringify({ provider: 'codebase_memory', operation: 'search_graph',
      status: 'success', query: 'private-query' }) + '\n');
    await writeFile(tracePath + '.receipt.json', JSON.stringify({ flushStatus: 'ok', closeStatus: 'ok',
      projections: [{ requestId: 'private-request-id', receiptSha256: 'private-receipt' }] }));

    const evidence = await failureEvidence(directory, tracePath, providerTracePath);
    assert.deepEqual(evidence, {
      physicalAttemptCount: 1,
      physicalOutcomes: ['denied'],
      physicalReasonCodes: ['DESTINATION_NOT_ALLOWED'],
      projectionCount: 1,
      traceFlushStatus: 'ok',
      traceCloseStatus: 'ok',
      deliveredEventCount: 1,
      nativeMemoryOperationCount: 1,
    });
    const serialized = JSON.stringify(evidence);
    for (const secret of ['private-attempt', 'private-request-body', 'private-source-bytes',
      'private-request-id', 'private-receipt', 'private-query']) assert.ok(!serialized.includes(secret));
    assert.equal(safeCode('HERMES_UNEXPECTED_DENIAL_STATUS_500'), 'HERMES_UNEXPECTED_DENIAL_STATUS_500');
    assert.equal(safeCode('private reason'), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local chain evidence is written only outside source checkouts and never overwrites a prior receipt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-g11-chain-evidence-'));
  const sourceRoot = join(directory, 'source');
  const externalRoot = join(directory, 'external');
  const linkedSource = join(directory, 'linked-source');
  const receiptPath = join(externalRoot, 'chain-evidence.json');
  const receipt = { schemaVersion: 1, status: 'local-native-chain-denied', providerWireCertified: false };
  try {
    await Promise.all([mkdir(sourceRoot), mkdir(externalRoot)]);
    await symlink(sourceRoot, linkedSource, 'dir');
    await writeLocalChainEvidence(receiptPath, receipt, [sourceRoot]);
    assert.deepEqual(JSON.parse(await readFile(receiptPath, 'utf8')), receipt);
    await assert.rejects(writeLocalChainEvidence(receiptPath, receipt, [sourceRoot]), /already exists/u);
    await assert.rejects(writeLocalChainEvidence(join(sourceRoot, 'chain-evidence.json'), receipt, [sourceRoot]), /outside the source checkout/u);
    await assert.rejects(writeLocalChainEvidence(join(linkedSource, 'nested', 'chain-evidence.json'), receipt, [sourceRoot]), /outside the source checkout/u);
    await assert.rejects(access(join(sourceRoot, 'nested')), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
