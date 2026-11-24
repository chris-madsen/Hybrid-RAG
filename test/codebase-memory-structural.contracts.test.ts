import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { repoBenchSourceManifestSha256 } from '../src/domain/repobench-r.js';
import { test } from 'node:test';
import { Effect } from 'effect';
import { cbmOutlineToAnalysis, makeCodebaseMemoryStructuralPort } from '../src/adapters/codebase-memory-structural.js';
import { parseCodebaseMemoryFileOutline } from '../src/adapters/codebase-memory-graph.js';
import { exactUtf8ByteRange } from '../src/domain/utf8-range.js';
import { ok } from '../src/domain/result.js';

test('CBM upstream outline is the sole source of declaration identities', async () => {
  const path = 'src/code.ts' as never;
  const text = 'const prefix = 0;\nexport function handler() {\n  return prefix;\n}\n';
  const source = Buffer.from(text);
  const outline = parseCodebaseMemoryFileOutline(path, {
    file_path: path, cols: ['name', 'label', 'lines', 'qn'],
    rows: [['handler', 'Function', '2-4', 'project.src.code.handler']],
    total: 1, has_more: false,
  });
  assert.ok(outline);
  const analysis = cbmOutlineToAnalysis(path, source, outline);
  assert.equal(analysis._tag, 'Ok');
  if (analysis._tag === 'Err') return;
  assert.deepEqual(analysis.value.symbols.map((s) => [s.name, s.kind, s.startLine]), [
    ['handler', 'function', 2],
  ]);
  const symbol = analysis.value.symbols[0]!;
  const exact = exactUtf8ByteRange(source, {
    startLine: symbol.startLine, startColumn: symbol.startColumn,
    endLine: symbol.endLine, endColumn: symbol.endColumn,
  });
  assert.ok(exact);
  assert.equal(source.subarray(exact.offset, exact.offset + exact.length).toString('utf8'),
    'export function handler() {\n  return prefix;\n}\n');
  assert.equal(analysis.value.sourceDigest, createHash('sha256').update(source).digest('hex'));
});

test('CBM outline failures never silently fall back to ast-grep or a custom parser', async () => {
  const source = Buffer.from('export function check() { return 5; }\n');
  const port = makeCodebaseMemoryStructuralPort({
    outline: () => Effect.succeed(ok([{
      name: 'check', label: 'Function', startLine: 5000,
      endLine: 5000, qualifiedName: 'check',
    }])),
  });
  const result = await Effect.runPromise(port.extract({
    repoPath: 'src/check.ts', source,
  }));
  assert.equal(result._tag, 'Err');
  if (result._tag === 'Err') assert.equal(result.error.code, 'INVALID_EXTERNAL_RESPONSE');
});

test('declaration-free files still become exact, bounded source chunks', () => {
  const source = Buffer.from('{"feature":true}\n');
  const analysis = cbmOutlineToAnalysis('src/config.json' as never, source, []);
  assert.equal(analysis._tag, 'Ok');
  if (analysis._tag === 'Ok') {
    assert.equal(analysis.value.symbols[0]?.providerKind, 'FileChunk');
    assert.equal(analysis.value.symbols[0]?.endByteOffset, source.length);
  }
});

test('native CBM maps frozen RepoBench source and refuses a dirty checkout', {
  skip: process.env.ACE_TEST_REAL_CBM !== 'true',
  timeout: 240_000,
}, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-repobench-cbm-'));
  const root = join(directory, 'repo');
  const path = 'src/helpers.py';
  const source = 'def helper(value):\n    return value + 1\n';
  const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
  try {
    await mkdir(join(root, 'src'), { recursive: true });
    await writeFile(join(root, path), source);
    const git = (...args: string[]): string => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
    git('init', '--quiet');
    git('add', '.');
    git('-c', 'user.name=ACE Test', '-c', 'user.email=ace@example.invalid', 'commit', '--quiet', '-m', 'frozen fixture');
    const revision = git('rev-parse', 'HEAD');
    const records = JSON.stringify([{
      repo_name: 'fixture', file_path: 'src/current.py',
      context: [{ path, snippet: 'return value + 1' }],
      gold_snippet_index: 0, code: 'helper(value)',
    }]);
    const manifest = {
      schemaVersion: 1,
      dataset: {
        datasetId: 'tianyang/repobench-r', config: 'python_cff', split: 'test_easy',
        revision, recordsSha256: digest(records),
      },
      repositories: [{
        id: 'fixture', revision,
        sourceManifestSha256: repoBenchSourceManifestSha256('fixture', revision, [{
          path, sizeBytes: Buffer.byteLength(source), sha256: digest(source),
        }]),
      }],
    };
    const recordsPath = join(directory, 'records.json');
    const manifestPath = join(directory, 'manifest.json');
    const output = join(directory, 'output');
    await writeFile(recordsPath, records);
    await writeFile(manifestPath, JSON.stringify(manifest));
    const run = (): string => execFileSync(process.execPath, [
      '--import', 'tsx', resolve('scripts/repobench-r-adapter.ts'),
      '--records', recordsPath, '--manifest', manifestPath, '--output', output,
      'fixture=' + root,
    ], { encoding: 'utf8', timeout: 180_000 });
    run();
    const report = JSON.parse(await readFile(join(output, 'mapping-report.json'), 'utf8')) as {
      readonly status: string; readonly mappedRows: readonly unknown[]; readonly invalidRows: readonly unknown[];
    };
    assert.equal(report.status, 'READY');
    assert.equal(report.mappedRows.length, 1);
    assert.equal(report.invalidRows.length, 0);
    await writeFile(join(root, path), source + '# dirty\n');
    assert.throws(run, /frozen RepoBench checkout must remain clean/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
