import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { Effect } from 'effect';
import { makeAstGrepStructuralPort } from '../src/adapters/ast-grep-structural.js';
import { compareStructuralAnalyses, summarizeAstGrepCorpusParity } from '../src/application/ast-grep-parity.js';

const command = process.env.ACE_AST_GREP_COMMAND?.trim() || resolve('node_modules/.bin/ast-grep');
const cli = makeAstGrepStructuralPort({ command, provider: 'cli', providerVersion: 'parity-cli' });
const napi = makeAstGrepStructuralPort({ command, provider: 'napi', providerVersion: 'parity-napi' });

const sourceExtensions = new Set(['.cjs', '.js', '.jsx', '.mjs', '.ts', '.tsx']);
const ignoredDirectories = new Set(['.git', 'coverage', 'dist', 'node_modules', '__pycache__']);

const collectFiles = async (input: string): Promise<string[]> => {
  const absolute = resolve(input);
  const metadata = await stat(absolute);
  if (metadata.isFile()) return sourceExtensions.has(extname(absolute).toLocaleLowerCase()) ? [absolute] : [];
  if (!metadata.isDirectory()) return [];
  const entries = await readdir(absolute, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => !entry.isDirectory() || !ignoredDirectories.has(entry.name))
    .map((entry) => collectFiles(resolve(absolute, entry.name))));
  return nested.flat().sort((left, right) => left.localeCompare(right));
};

const inputs = process.argv.slice(2);
const roots = inputs.length === 0 ? ['test/fixtures/ast-grep-parity/representative.ts'] : inputs;
const discovered = [...new Set((await Promise.all(roots.map(collectFiles))).flat())].sort();
const maxFiles = Number(process.env.ACE_AST_GREP_PARITY_MAX_FILES ?? '0');
if (!Number.isSafeInteger(maxFiles) || maxFiles < 0 || maxFiles > 10_000) {
  throw new Error('ACE_AST_GREP_PARITY_MAX_FILES must be 0 (all) or an integer up to 10000');
}
const files = maxFiles === 0 ? discovered : discovered.slice(0, maxFiles);
if (files.length === 0) throw new Error('No JS/TS/TSX source files were found for parity comparison');
const sourceByFile = await Promise.all(files.map(async (file) => {
  const source = new Uint8Array(await readFile(file));
  const repoPath = (relative(process.cwd(), file) || file).replaceAll('\\', '/');
  const digest = createHash('sha256').update(source).digest('hex');
  return { repoPath, source, digest };
}));
const corpusSha256 = createHash('sha256').update(JSON.stringify(sourceByFile.map(({ repoPath, digest }) =>
  [repoPath, digest]))).digest('hex');
const parserInputs = sourceByFile.map(({ repoPath, source }) => ({ repoPath, source }));
// CLI already batches verified source bytes; do not incur one subprocess per
// file. NAPI uses its maintained parser; failures are counted, never omitted.
const [cliResults, napiResults] = await Promise.all([
  Effect.runPromise(cli.extractMany!(parserInputs)),
  Effect.runPromise(napi.extractMany!(parserInputs)),
]);
const reports = [];
const failedPaths: string[] = [];
for (const [index, file] of sourceByFile.entries()) {
  const cliResult = cliResults[index];
  const napiResult = napiResults[index];
  if (cliResult?._tag !== 'Ok' || napiResult?._tag !== 'Ok') {
    failedPaths.push(file.repoPath);
    continue;
  }
  reports.push(compareStructuralAnalyses(cliResult.value, napiResult.value));
}
const verdict = summarizeAstGrepCorpusParity(sourceByFile.map((entry) => entry.repoPath), reports, failedPaths);
const summaryOnly = process.env.ACE_AST_GREP_PARITY_SUMMARY_ONLY === 'true';
process.stdout.write(JSON.stringify({
  schemaVersion: 1,
  sourceBoundary: 'same_verified_source_bytes',
  corpusSha256,
  fileCount: sourceByFile.length,
  ...verdict,
  equivalent: verdict.status === 'equivalent',
  activeDefault: 'cli',
  candidatePromotion: 'NOT_APPROVED',
  ...(summaryOnly ? {} : { reports }),
}, null, 2) + '\n');
if (verdict.status !== 'equivalent') process.exitCode = 2;
