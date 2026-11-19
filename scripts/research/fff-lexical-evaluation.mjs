#!/usr/bin/env node
/**
 * Opt-in research probe, NEVER a production ACE provider or required CI gate.
 * Compares a resident FFF Node SDK with independent ripgrep CLI calls on the
 * same deterministic source fixture. No external LLM or user/project content.
 *
 * Install @ff-labs/fff-node separately and pass its JS entry via FFF_SDK_ENTRY.
 * Each result states whether lexical result sets are equal; timing claims are
 * invalid if the compared result sets differ.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const sdkPath = process.env.FFF_SDK_ENTRY;
if (!sdkPath) throw new Error('FFF_SDK_ENTRY must point to a separately installed pinned SDK entrypoint');
const sdk = await import(pathToFileURL(sdkPath).href);
const { FileFinder } = sdk;
if (!FileFinder) throw new Error('FFF SDK did not export FileFinder');
const rgVersion = spawnSync('rg', ['--version'], { encoding: 'utf8' });
if (rgVersion.status !== 0) throw new Error('ripgrep executable is required for benchmark');

const root = mkdtempSync(join(tmpdir(), 'ace-fff-lexical-'));
const fileCount = Number(process.env.FFF_BENCH_FILES ?? '3000');
const repeats = Number(process.env.FFF_BENCH_REPEATS ?? '25');
if (!Number.isInteger(fileCount) || fileCount < 100 || fileCount > 30000) throw new Error('unsafe file count');
if (!Number.isInteger(repeats) || repeats < 5 || repeats > 100) throw new Error('unsafe repeat count');
const countFD = () => {
  try { return readdirSync('/proc/self/fd').length; } catch { return null; }
};
const memory = () => ({ rss: process.memoryUsage().rss, fds: countFD() });
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const pct = (p) => Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] * 1000) / 1000;
  return { n: values.length, p50_ms: pct(0.5), p95_ms: pct(0.95), min_ms: Math.round(sorted[0] * 1000) / 1000, max_ms: Math.round(sorted[sorted.length - 1] * 1000) / 1000 };
};
const timed = (fn, n) => {
  const samples = [];
  for (let k = 0; k < n; k++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return stats(samples);
};
const runRg = (pattern) => {
  const result = spawnSync('rg', [
    '--no-config', '--fixed-strings', '--line-number', '--no-heading',
    '--color=never', '--hidden', '--no-ignore', '--glob=**/*.ts',
    '--', pattern, '.',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
  if (result.status !== 0 && result.status !== 1) throw new Error('rg failed: ' + result.stderr);
  return result.stdout.trim() ? result.stdout.trim().split('\n').map((s) => {
    const match = /^(.*?):([0-9]+):/u.exec(s);
    if (!match) throw new Error('rg output without path:line ' + s.slice(0, 80));
    return match[1].replace(/^\.\//u, '') + ':' + match[2];
  }).sort() : [];
};
const fromFff = (finder, pattern) => {
  const all = [];
  let cursor = null;
  for (let page = 0; page < 500; page++) {
    const found = finder.grep(pattern, {
      mode: 'plain', smartCase: false, maxFileSize: 10_000_000,
      maxMatchesPerFile: 10000, pageSize: 500,
      ...(cursor === null ? {} : { cursor }),
    });
    if (!found.ok) throw new Error('fff grep error: ' + found.error);
    all.push(...found.value.items.map((x) => x.relativePath.replace(/^\.\//u, '') + ':' + x.lineNumber));
    if (found.value.nextCursor === null) return all.sort();
    cursor = found.value.nextCursor;
  }
  throw new Error('fff grep pagination did not terminate');
};
const fixtureStart = performance.now();
for (let i = 0; i < fileCount; i++) {
  const folder = join(root, 'part-' + String(Math.floor(i / 100)).padStart(3, '0'));
  mkdirSync(folder, { recursive: true });
  const name = 'component-' + String(i).padStart(5, '0') + '.ts';
  const text = [
    '// deterministic fixture ' + i,
    'export function handler_' + i + '() { return ' + i + '; }',
    'export const local_value_' + i + ' = "sample";',
    i % 97 === 0 ? 'export const SEARCH_COMMON = ' + i + ';' : 'export const ordinary = 1;',
    i === 73 ? 'export const SEARCH_UNIQUE_00073 = true;' : 'export const more = 2;',
    '// test line ' + i,
  ].join('\n') + '\n';
  writeFileSync(join(folder, name), text);
}
const fixtureMs = performance.now() - fixtureStart;
const startRss = memory();
let finder;
let output;
try {
  const startInit = performance.now();
  const init = FileFinder.create({
    basePath: root, aiMode: false, disableWatch: true,
    disableGit: true, disableMmapCache: false, disableContentIndexing: false,
  });
  if (!init.ok) throw new Error('fff native create failed: ' + init.error);
  finder = init.value;
  const initializedMs = performance.now() - startInit;
  const scanStart = performance.now();
  const scan = await finder.waitForScan(60000);
  if (!scan.ok || scan.value !== true) throw new Error('fff native initial scan unfinished: ' + JSON.stringify(scan));
  const scanMs = performance.now() - scanStart;
  const indexedRss = memory();
  const queries = ['SEARCH_UNIQUE_00073', 'SEARCH_COMMON', 'SEARCH_ABSENT_XXX'];
  const cases = [];
  for (const pattern of queries) {
    const rgRows = runRg(pattern);
    const fffRows = fromFff(finder, pattern);
    const equal = JSON.stringify(rgRows) === JSON.stringify(fffRows);
    // Warm the system before timed comparisons. Report mismatches instead of
    // printing misleading speedup factors for different result sets.
    runRg(pattern);
    fromFff(finder, pattern);
    const fffStats = timed(() => { fromFff(finder, pattern); }, repeats);
    const rgStats = timed(() => { runRg(pattern); }, repeats);
    cases.push({ pattern, rgHits: rgRows.length, fffHits: fffRows.length,
      resultsEqual: equal, rg: rgStats, fff: fffStats,
      speedup_p50: equal && fffStats.p50_ms > 0
        ? Math.round(rgStats.p50_ms / fffStats.p50_ms * 100) / 100 : null });
  }
  const fuzzyStart = performance.now();
  const fuzzy = finder.fileSearch('componet-00073', { pageSize: 10 });
  if (!fuzzy.ok) throw new Error('fff fileSearch failed: ' + fuzzy.error);
  const fuzzyMs = performance.now() - fuzzyStart;
  const afterQueriesRss = memory();
  output = {
    evidence_class: 'REAL_NATIVE_SDK_SYNTHETIC_FIXTURE',
    note: 'Separate SDK dependency, no model/provider use; results are NOT ACE end-to-end or Qdrant replacement evidence',
    platform: process.platform, arch: process.arch, node: process.version,
    rg: rgVersion.stdout.split('\n')[0],
    sdk: process.env.FFF_SDK_VERSION ?? 'unverified',
    fixture: { fileCount, byteApprox: fileCount * 200, created_ms: Math.round(fixtureMs) },
    fffInit_ms: Math.round(initializedMs * 1000) / 1000,
    fffWaitScan_ms: Math.round(scanMs * 1000) / 1000,
    resource: { before: startRss, after_index: indexedRss, after_queries: afterQueriesRss },
    cases,
    fuzzy: { query: 'componet-00073', ms: Math.round(fuzzyMs * 1000) / 1000,
      firstPaths: fuzzy.value.items.slice(0, 5).map((x) => x.relativePath) },
  };
  if (cases.some((x) => !x.resultsEqual)) output.warning = 'LEXICAL_RESULT_MISMATCH — speedup must not justify promotion';
} finally {
  if (finder) finder.destroy();
  rmSync(root, { recursive: true, force: true });
}
assert.ok(output);
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
