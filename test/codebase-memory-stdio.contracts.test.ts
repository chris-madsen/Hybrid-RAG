import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { Effect } from 'effect';
import {
  makeCodebaseMemoryStdio, parseCodebaseMemoryToolResult,
} from '../src/adapters/codebase-memory-stdio.js';
import { makeCodebaseMemoryGraph } from '../src/adapters/codebase-memory-graph.js';
import type { ProviderTraceEvent } from '../src/domain/provider-trace.js';

const fixture = resolve('test/fixtures/cbm-stdio-fixture.mjs');
const root = resolve(process.cwd());
const readLog = (path: string): { pid: number; method: string; tool?: string }[] => {
  try {
    return readFileSync(path, 'utf8').trim().split('\n')
      .filter(Boolean).map((line) => JSON.parse(line) as { pid: number; method: string; tool?: string });
  } catch { return []; }
};

test('native stdio session reuses one process across indexing, outlines and graph requests', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ace-cbm-stdio-'));
  const log = join(dir, 'calls.jsonl');
  const traces: ProviderTraceEvent[] = [];
  process.env.ACE_CBM_TEST_LOG = log;
  const graph = makeCodebaseMemoryGraph({
    rootPath: root, command: process.execPath, args: [fixture], timeoutMs: 5_000,
    trace: { record: (event) => traces.push(event) },
    candidates: () => [],
  });
  try {
    const indexed = await Effect.runPromise(graph.reindex());
    assert.equal(indexed._tag, 'Ok', JSON.stringify(indexed));
    const outlined = await Effect.runPromise(graph.outline('src/app.ts' as never));
    assert.equal(outlined._tag, 'Ok', JSON.stringify(outlined));
    if (outlined._tag === 'Ok') assert.equal(outlined.value[0]?.name, 'handler');
    const traced = await Effect.runPromise(graph.trace('test-cbm.src.handler'));
    assert.equal(traced._tag, 'Ok', JSON.stringify(traced));
    const queried = await Effect.runPromise(graph.queryGraph('MATCH (n) RETURN n LIMIT 1'));
    assert.equal(queried._tag, 'Ok', JSON.stringify(queried));
    const changed = await Effect.runPromise(graph.detectChanges());
    assert.equal(changed._tag, 'Ok', JSON.stringify(changed));
    const searched = await Effect.runPromise(graph.search({ query: 'private test needle', limit: 2, requestId: 'request-cbm-test' }));
    assert.equal(searched._tag, 'Ok', JSON.stringify(searched));
    assert.ok(traces.some((event) => event.provider === 'codebase_memory'
      && event.providerVersion === 'codebase-memory-mcp/0.12.1'
      && event.operation === 'search_graph' && event.status === 'success'
      && event.requestId === 'request-cbm-test'));
    assert.ok(traces.some((event) => event.provider === 'codebase_memory'
      && event.operation === 'index_repository' && event.status === 'success'));
    assert.ok(traces.every((event) => !('query' in event) && !('arguments' in event) && !('result' in event)));
    assert.doesNotMatch(JSON.stringify(traces), /private test needle/u,
      'safe native provider trace must not retain query text');
    const logEntries = readLog(log);
    assert.deepEqual(logEntries.map((item) => item.method), [
      'initialize', 'tools/call', 'tools/call', 'tools/call', 'tools/call', 'tools/call', 'tools/call', 'tools/call',
    ]);
    assert.equal(new Set(logEntries.map((item) => item.pid)).size, 1);
    assert.ok(logEntries.every((item) => item.method !== 'tools/list'));
  } finally {
    await graph.close();
    delete process.env.ACE_CBM_TEST_LOG;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('provider transport refuses non-retrieval operations before creating a child', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ace-cbm-deny-'));
  const log = join(dir, 'calls.jsonl');
  process.env.ACE_CBM_TEST_LOG = log;
  const client = makeCodebaseMemoryStdio({
    rootPath: root, command: process.execPath, args: [fixture], timeoutMs: 5_000,
  });
  try {
    const unauthorized = await client.invoke('manage_adr', { mode: 'update' });
    assert.equal(unauthorized._tag, 'Err');
    if (unauthorized._tag === 'Err') assert.equal(unauthorized.error.code, 'INVALID_INPUT');
    assert.deepEqual(readLog(log), []);
    await client.close();
    assert.equal((await client.invoke('search_graph', {}))._tag, 'Err');
  } finally {
    await client.close();
    delete process.env.ACE_CBM_TEST_LOG;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dead native provider invalidates the published graph until explicit reindex', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ace-cbm-crash-'));
  const log = join(dir, 'calls.jsonl');
  process.env.ACE_CBM_TEST_LOG = log;
  const graph = makeCodebaseMemoryGraph({
    rootPath: root, command: process.execPath, args: [fixture], timeoutMs: 5_000,
    candidates: () => [],
  });
  try {
    assert.equal((await Effect.runPromise(graph.reindex()))._tag, 'Ok');
    const crashed = await Effect.runPromise(graph.search({ query: 'crash-provider', limit: 2 }));
    assert.equal(crashed._tag, 'Err');
    assert.equal((await Effect.runPromise(graph.outline('src/app.ts' as never)))._tag, 'Err',
      'no stale source outline after the native session dies');
    assert.equal((await Effect.runPromise(graph.reindex()))._tag, 'Ok');
    assert.equal((await Effect.runPromise(graph.outline('src/app.ts' as never)))._tag, 'Ok');
    const entries = readLog(log);
    assert.equal(new Set(entries.map((item) => item.pid)).size, 2,
      'recovery starts a new process only after the failed one is discarded');
  } finally {
    await graph.close();
    delete process.env.ACE_CBM_TEST_LOG;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('unsupported binary version and request timeout fail closed', async () => {
  const wrong = makeCodebaseMemoryStdio({
    rootPath: root, command: process.execPath, args: [fixture, '--wrong-version'], timeoutMs: 5_000,
  });
  try {
    const init = await wrong.invoke('index_repository', { repo_path: root });
    assert.equal(init._tag, 'Err');
    if (init._tag === 'Err') assert.equal(init.error.code, 'NOT_READY');
  } finally { await wrong.close(); }

  const hanging = makeCodebaseMemoryStdio({
    rootPath: root, command: process.execPath, args: [fixture], timeoutMs: 900,
  });
  try {
    const indexed = await hanging.invoke('index_repository', { repo_path: root });
    assert.equal(indexed._tag, 'Ok', JSON.stringify(indexed));
    const blocked = await hanging.invoke('search_graph', { semantic_query: ['hang-provider'] });
    assert.equal(blocked._tag, 'Err');
    if (blocked._tag === 'Err') assert.equal(blocked.error.code, 'NOT_READY');
  } finally { await hanging.close(); }
});

test('closing during initialization cancels the native child instead of waiting for the request deadline', {
  timeout: 4_000,
}, async () => {
  const client = makeCodebaseMemoryStdio({
    rootPath: root, command: process.execPath,
    args: [fixture, '--hang-initialize'], timeoutMs: 10_000,
  });
  const inFlight = client.invoke('index_repository', { repo_path: root });
  try {
    await client.close();
    const response = await inFlight;
    assert.equal(response._tag, 'Err');
    if (response._tag === 'Err') assert.equal(response.error.code, 'NOT_READY');
  } finally { await client.close(); }
});

test('native result decoding uses structuredContent, rejects errors and never trusts text as code evidence', () => {
  const structured = parseCodebaseMemoryToolResult({
    isError: false,
    structuredContent: { cols: ['qn'], rows: [['exact']] },
    content: [{ type: 'text', text: '{"cols":["wrong"],"rows":[]}' }],
  });
  assert.equal(structured._tag, 'Ok');
  if (structured._tag === 'Ok') assert.deepEqual(structured.value, {
    cols: ['qn'], rows: [['exact']],
  });
  assert.equal(parseCodebaseMemoryToolResult({
    isError: true, structuredContent: { error: 'index failed' },
  })._tag, 'Err');
  assert.equal(parseCodebaseMemoryToolResult({
    isError: false, content: [{ type: 'text', text: 'not JSON' }],
  })._tag, 'Err');
  assert.equal(parseCodebaseMemoryToolResult({
    isError: false, content: [{ type: 'image', data: 'fake' }],
  })._tag, 'Err');
});
