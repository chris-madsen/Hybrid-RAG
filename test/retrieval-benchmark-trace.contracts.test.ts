import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { makeFileRetrievalBenchmarkTrace } from '../src/adapters/retrieval-benchmark-trace.js';
import {
  retrievalBenchmarkStages,
  validateRetrievalBenchmarkTraceArtifact,
  type RetrievalBenchmarkTraceEvent,
} from '../src/domain/retrieval-benchmark.js';

const candidate = {
  runtimeCandidateId: 'workspace-candidate',
  canonicalCandidateId: 'canonical-candidate',
  repoPath: 'src/example.ts',
  sourceDigest: 'a'.repeat(64),
  range: { startLine: 1, endLine: 1 },
};

const eventFor = (
  requestId: string,
  stage: RetrievalBenchmarkTraceEvent['stage'],
  status: NonNullable<RetrievalBenchmarkTraceEvent['status']> = 'executed',
): RetrievalBenchmarkTraceEvent => ({
  requestId,
  stage,
  status,
  candidates: status === 'executed' ? [candidate] : [],
  durationMs: status === 'executed' ? 1 : 0,
  providerIdentities: { dense: 'test-provider' },
});

const allStageEvents = (requestId: string): readonly RetrievalBenchmarkTraceEvent[] =>
  retrievalBenchmarkStages.map((stage) => eventFor(requestId, stage));

const withTempDirectory = async <T>(run: (directory: string) => Promise<T>): Promise<T> => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-benchmark-trace-'));
  try {
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test('benchmark stage validation rejects epoch time in a non-executed duration', async () => {
  await withTempDirectory(async (directory) => {
    const trace = await makeFileRetrievalBenchmarkTrace(join(directory, 'latency.jsonl'));
    const requestId = 'latency-request';
    const statuses = retrievalBenchmarkStages.map((stage) => eventFor(
      requestId, stage, stage === 'dense' ? 'unavailable' : 'executed',
    ));
    for (const stage of statuses) trace.record(stage);
    await trace.close();
    const good = await readFile(trace.tracePath, 'utf8');
    const receipt = JSON.parse(await readFile(trace.terminalReceiptPath, 'utf8')) as unknown;
    assert.equal(validateRetrievalBenchmarkTraceArtifact(good, receipt, [requestId]).valid, true);
    const invalid = good.replace('"durationMs":0', '"durationMs":1790000000000');
    const checked = validateRetrievalBenchmarkTraceArtifact(invalid, receipt, [requestId]);
    assert.equal(checked.valid, false);
    assert.ok(checked.failures.some((reason) => reason.endsWith('nonexecuted_latency')));
  });
});

test('file trace drains JSONL and writes a complete terminal receipt', async () => {
  await withTempDirectory(async (directory) => {
    const trace = await makeFileRetrievalBenchmarkTrace(join(directory, 'run.jsonl'), {
      sourceCommit: 'a'.repeat(40),
      runnerVersion: 'test-runner/1',
    });
    for (const event of allStageEvents('request-1')) trace.record(event);
    await trace.flush();
    assert.equal(trace.status.recordedEvents, 6);
    assert.equal(trace.status.persistedEvents, 6);
    const jsonl = await readFile(trace.tracePath, 'utf8');
    assert.equal(jsonl.trim().split('\n').length, 6);
    await trace.close();
    await trace.close();
    assert.equal(trace.status.state, 'closed');
    const receipt = JSON.parse(await readFile(trace.terminalReceiptPath, 'utf8')) as unknown;
    const validation = validateRetrievalBenchmarkTraceArtifact(jsonl, receipt, ['request-1']);
    assert.equal(validation.valid, true, validation.failures.join(', '));
    assert.doesNotMatch(jsonl, /query|content|token|sourceBytes/u);
  });
});

test('file trace record and close remain observable after append failure', async () => {
  await withTempDirectory(async (directory) => {
    const path = join(directory, 'failing.jsonl');
    const trace = await makeFileRetrievalBenchmarkTrace(path);
    await rm(path);
    await mkdir(path);
    trace.record(eventFor('request-1', 'dense'));
    await assert.rejects(trace.flush(), /benchmark trace persistence failed/u);
    assert.equal(trace.status.state, 'failed');
    assert.equal(trace.status.persistedEvents, 0);
    assert.throws(() => trace.record(eventFor('request-1', 'sparse')), /benchmark trace persistence failed/u);
    await assert.rejects(trace.close(), /benchmark trace persistence failed/u);
    const receipt = JSON.parse(await readFile(trace.terminalReceiptPath, 'utf8')) as { flushStatus: string; closeStatus: string };
    assert.equal(receipt.flushStatus, 'failed');
    assert.equal(receipt.closeStatus, 'ok');
  });
});

test('file trace rejects an unwritable trace target before a run starts', async () => {
  await withTempDirectory(async (directory) => {
    await assert.rejects(
      makeFileRetrievalBenchmarkTrace(directory),
    );
  });
});

test('trace evaluator rejects missing terminal receipt, incomplete stages, and corrupt JSONL', async () => {
  await withTempDirectory(async (directory) => {
    const trace = await makeFileRetrievalBenchmarkTrace(join(directory, 'partial.jsonl'));
    trace.record(eventFor('request-1', 'dense'));
    await trace.close();
    const jsonl = await readFile(trace.tracePath, 'utf8');
    const receipt = JSON.parse(await readFile(trace.terminalReceiptPath, 'utf8')) as unknown;
    const incomplete = validateRetrievalBenchmarkTraceArtifact(jsonl, receipt, ['request-1']);
    assert.equal(incomplete.valid, false);
    assert.ok(incomplete.failures.includes('request_request-1_stage_completeness'));
    assert.equal(validateRetrievalBenchmarkTraceArtifact(jsonl, undefined).valid, false);
    assert.equal(validateRetrievalBenchmarkTraceArtifact(jsonl + '{', receipt).valid, false);
  });
});

