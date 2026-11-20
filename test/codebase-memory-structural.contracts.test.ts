import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
