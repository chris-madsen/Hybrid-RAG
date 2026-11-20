import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { Effect } from 'effect';
import { compareStructuralAnalyses, summarizeAstGrepCorpusParity, symbolParityFingerprint } from '../src/application/ast-grep-parity.js';
import { makeAstGrepStructuralPort } from '../src/adapters/ast-grep-structural.js';
import type { StructuralAnalysis } from '../src/domain/semantic.js';

const analysis = (overrides: Partial<StructuralAnalysis> = {}): StructuralAnalysis => ({
  repoPath: 'fixture.ts',
  sourceDigest: 'a'.repeat(64) as never,
  symbols: [{
    name: 'save',
    kind: 'function',
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 30,
    startByteOffset: 0,
    endByteOffset: 30,
    isExported: true,
  }],
  hasSyntaxErrors: false,
  ...overrides,
});

test('NAPI parity comparator accepts semantically equivalent symbol/range output', () => {
  const report = compareStructuralAnalyses(analysis(), analysis());
  assert.equal(report.equivalent, true);
  assert.deepEqual(report.differences, []);
  assert.equal(typeof symbolParityFingerprint(report), 'string');
});

test('NAPI parity comparator reports missing, range, export, and syntax differences', () => {
  const report = compareStructuralAnalyses(
    analysis(),
    analysis({
      symbols: [{
        name: 'save',
        kind: 'function',
        startLine: 2,
        startColumn: 1,
        endLine: 2,
        endColumn: 30,
        startByteOffset: 31,
        endByteOffset: 61,
        isExported: false,
      }],
      hasSyntaxErrors: true,
    }),
  );
  assert.equal(report.equivalent, false);
  assert.deepEqual(report.differences.map((difference) => difference.kind), [
    'range_mismatch',
    'export_mismatch',
    'syntax_mismatch',
  ]);
});

test('NAPI parity comparator reports symbol loss and additions', () => {
  const report = compareStructuralAnalyses(
    analysis({ symbols: [] }),
    analysis({ symbols: [{
      name: 'load',
      kind: 'function',
      startLine: 1,
      startColumn: 1,
      endLine: 1,
      endColumn: 30,
      isExported: false,
    }] }),
  );
  assert.deepEqual(report.differences.map((difference) => difference.kind), [
    'missing_from_cli',
  ]);
});


test('parity does not lose same-named overloads or class methods', () => {
  const overloads = [
    { ...analysis().symbols[0]!, startLine: 1, endLine: 1, startByteOffset: 0, endByteOffset: 30 },
    { ...analysis().symbols[0]!, startLine: 4, endLine: 4, startByteOffset: 60, endByteOffset: 90 },
  ];
  const report = compareStructuralAnalyses(
    analysis({ symbols: overloads }),
    analysis({ symbols: [overloads[1]!] }),
  );
  assert.equal(report.equivalent, false);
  assert.ok(report.differences.some((item) => item.kind === 'missing_from_napi'),
    'a Map keyed only by name+kind would lose this missing overload');
});

test('parity checks declaration extents and UTF-8 byte offsets, not just identifier anchors', () => {
  const first = analysis();
  const symbol = first.symbols[0]!;
  const withSameIdentifier = {
    ...symbol,
    nameStartLine: 1, nameStartColumn: 17, nameEndLine: 1, nameEndColumn: 21,
  };
  const changed = {
    ...withSameIdentifier,
    endColumn: 32,
    endByteOffset: 32,
  };
  const report = compareStructuralAnalyses(
    analysis({ symbols: [withSameIdentifier] }),
    analysis({ symbols: [changed] }),
  );
  assert.equal(report.equivalent, false);
  assert.ok(report.differences.some((item) => item.kind === 'range_mismatch'));
});

test('parity checks paths and import status even if digests and names match', () => {
  const imported = { ...analysis().symbols[0]!, isImport: true };
  const report = compareStructuralAnalyses(
    analysis({ symbols: [imported] }),
    analysis({ repoPath: 'other.ts', symbols: [{ ...imported, isImport: false }] }),
  );
  assert.deepEqual(report.differences.map((item) => item.kind), [
    'path_mismatch', 'import_mismatch',
  ]);
});

test('parity fingerprint differentiates equal-shape reports from different source digests', () => {
  const left = compareStructuralAnalyses(analysis(), analysis());
  const right = compareStructuralAnalyses(
    analysis({ sourceDigest: 'b'.repeat(64) as never }),
    analysis({ sourceDigest: 'b'.repeat(64) as never }),
  );
  assert.equal(left.equivalent, true);
  assert.equal(right.equivalent, true);
  assert.notEqual(symbolParityFingerprint(left), symbolParityFingerprint(right),
    'the previous fingerprint omitted both source digests');
});

test('parity report is independent of the provider symbol order', () => {
  const original = analysis().symbols[0]!;
  const symbols = [
    { ...original, startLine: 1, endLine: 1, startByteOffset: 0, endByteOffset: 30 },
    { ...original, startLine: 4, endLine: 4, startByteOffset: 60, endByteOffset: 90 },
  ];
  const expected = compareStructuralAnalyses(analysis({ symbols }), analysis({ symbols }));
  const reordered = compareStructuralAnalyses(
    analysis({ symbols: [...symbols].reverse() }),
    analysis({ symbols: [...symbols].reverse() }),
  );
  assert.equal(expected.equivalent, true);
  assert.equal(reordered.equivalent, true);
  assert.equal(symbolParityFingerprint(expected), symbolParityFingerprint(reordered));
});

test('CLI and NAPI agree on the representative TypeScript fixture', async () => {
  const repoPath = 'test/fixtures/ast-grep-parity/representative.ts';
  const source = new Uint8Array(await readFile(repoPath));
  const command = process.env.ACE_AST_GREP_COMMAND ?? 'node_modules/.bin/ast-grep';
  const cli = await Effect.runPromise(makeAstGrepStructuralPort({ command, provider: 'cli' }).extract({ repoPath, source }));
  const napi = await Effect.runPromise(makeAstGrepStructuralPort({ command, provider: 'napi' }).extract({ repoPath, source }));
  assert.equal(cli._tag, 'Ok');
  assert.equal(napi._tag, 'Ok');
  if (cli._tag === 'Ok' && napi._tag === 'Ok') {
    const report = compareStructuralAnalyses(cli.value, napi.value);
    assert.equal(report.equivalent, true, JSON.stringify(report, null, 2));
  }
});

test('AR08 121-of-125 real-shape corpus disagreements never become equivalent', () => {
  const paths = Array.from({ length: 125 }, (_, index) => `src/corpus/${String(index).padStart(3, '0')}.ts`);
  const reports = paths.map((path, index) => compareStructuralAnalyses(
    analysis({ repoPath: path }),
    analysis({ repoPath: path, hasSyntaxErrors: index < 121 }),
  ));
  const result = summarizeAstGrepCorpusParity(paths, reports);
  assert.equal(result.status, 'not_equivalent');
  assert.equal(result.expectedPathCount, 125);
  assert.equal(result.comparedPathCount, 125);
  assert.equal(result.matchingPathCount, 4);
  assert.equal(result.mismatchedPaths.length, 121);
  const missing = summarizeAstGrepCorpusParity(paths, reports.slice(1));
  assert.equal(missing.status, 'not_equivalent', 'missing file is not source parity');
  assert.equal(missing.missingPaths.length, 1);
  const duplicate = summarizeAstGrepCorpusParity(paths, [...reports, reports[0]!]);
  assert.equal(duplicate.status, 'not_equivalent', 'double-counted input is not valid corpus coverage');
  assert.ok(duplicate.failedPaths.includes(paths[0]!));
  const equal = summarizeAstGrepCorpusParity(paths.slice(121), reports.slice(121));
  assert.equal(equal.status, 'equivalent', 'positive complete same-source corpus remains possible');
});

test('AR08 representative actual source corpus report is pinned and does not promote NAPI', () => {
  // This uses the maintained CLI+NAPI against the current repository's source
  // bytes, not a mocked corpus. A mismatch is an expected *measured* outcome,
  // not a CI failure. SOURCE FILES stay unchanged.
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', 'scripts/ast-grep-provider-parity.ts', 'src',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
    env: {
      ...process.env,
      ACE_AST_GREP_PARITY_MAX_FILES: '125',
      ACE_AST_GREP_PARITY_SUMMARY_ONLY: 'true',
    },
  });
  assert.ok(result.status === 0 || result.status === 2, result.stderr);
  const report = JSON.parse(result.stdout) as {
    fileCount: number;
    corpusSha256: string;
    status: string;
    equivalent: boolean;
    mismatchedPaths: string[];
    failedPaths: string[];
    missingPaths: string[];
    matchingPathCount: number;
    activeDefault: string;
    candidatePromotion: string;
  };
  assert.equal(report.fileCount, 125, 'the real source corpus is deterministic and representative');
  assert.match(report.corpusSha256, /^[a-f0-9]{64}$/u);
  assert.equal(report.equivalent,
    report.mismatchedPaths.length === 0 && report.failedPaths.length === 0
      && report.missingPaths.length === 0 && report.matchingPathCount === report.fileCount);
  assert.equal(report.status, report.equivalent ? 'equivalent' : 'not_equivalent');
  assert.equal(report.activeDefault, 'cli');
  assert.equal(report.candidatePromotion, 'NOT_APPROVED');
  // Compact, source-pinned evidence in CI logs; no private code bodies.
  process.stdout.write('AR08_CORPUS_PARITY ' + JSON.stringify({
    corpusSha256: report.corpusSha256,
    files: report.fileCount,
    matching: report.matchingPathCount,
    mismatched: report.mismatchedPaths.length,
    failed: report.failedPaths.length,
    missing: report.missingPaths.length,
    parity: report.status,
    promotion: report.candidatePromotion,
  }) + '\n');
});
