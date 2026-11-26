import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { canonicalBenchmarkCandidateId, type BenchmarkCandidateRange } from '../src/domain/retrieval-benchmark.js';
import { exactUtf8SourceSpan } from '../src/domain/utf8-range.js';
import { ingestRepoPath } from '../src/domain/workspace.js';
import { writeFrozenArtifactPair } from './write-frozen-artifact-pair.js';
import { assertNativeReleaseHoldout } from './native-projection-evidence.js';
import type {
  RetrievalHoldout,
  RetrievalHoldoutCase,
  RetrievalHoldoutRepository,
} from '../src/domain/retrieval-quality-evaluation.js';

interface RepositorySpec {
  readonly id: string;
  readonly revision: string;
}

interface SpanSpec extends BenchmarkCandidateRange {
  readonly repoPath: string;
}

interface CaseSpec {
  readonly id: string;
  readonly repositoryId: string;
  readonly query: string;
  readonly relevantSpans: readonly SpanSpec[];
  readonly critical?: boolean;
  readonly kind?: RetrievalHoldoutCase['kind'];
  readonly focusedPath?: string;
}

interface SourceSpec {
  readonly schemaVersion: 1;
  readonly status: 'frozen_multi_repository_holdout';
  readonly repositories: readonly RepositorySpec[];
  readonly cases: readonly CaseSpec[];
}

interface ManifestEntry {
  readonly path: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

const [sourceArg, holdoutArg, manifestDirectoryArg, ...repositoryArgs] = process.argv.slice(2);
if (sourceArg === undefined || holdoutArg === undefined || manifestDirectoryArg === undefined || repositoryArgs.length === 0) {
  throw new Error('Usage: tsx scripts/freeze-retrieval-holdout.ts <source-spec.json> <holdout.json> <manifest-dir> <repository-id>=<checkout-root> [...]');
}

// Resolve symlinked parents even when the final evidence path does not exist.
const canonicalTarget = async (path: string): Promise<string> => {
  const target = resolve(path);
  try { return await realpath(target); } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'ENOENT' || dirname(target) === target) throw cause;
    return resolve(await canonicalTarget(dirname(target)), basename(target));
  }
};
const within = (root: string, path: string): boolean => {
  const relation = relative(root, path);
  return relation === '' || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith('..' + sep));
};
const aceRepositoryRoot = await realpath(process.cwd());

const repositoryRoots = new Map<string, string>();
for (const argument of repositoryArgs) {
  const separator = argument.indexOf('=');
  if (separator < 1 || separator === argument.length - 1) throw new Error(`invalid repository mapping: ${argument}`);
  const id = argument.slice(0, separator);
  if (repositoryRoots.has(id)) throw new Error(`duplicate repository mapping: ${id}`);
  repositoryRoots.set(id, resolve(argument.slice(separator + 1)));
}

const forbiddenRoots = [aceRepositoryRoot, ...await Promise.all([...repositoryRoots.values()].map((root) => realpath(root)))];
const holdoutTarget = await canonicalTarget(holdoutArg);
const manifestTarget = await canonicalTarget(manifestDirectoryArg);
if (forbiddenRoots.some((root) => within(root, holdoutTarget) || within(root, manifestTarget)
  || within(root, resolve(holdoutArg)) || within(root, resolve(manifestDirectoryArg)))) {
  throw new Error('frozen holdout and manifest outputs must be outside all source checkouts');
}

const sourceSpec = JSON.parse(await readFile(resolve(sourceArg), 'utf8')) as SourceSpec;
if (sourceSpec.schemaVersion !== 1 || sourceSpec.status !== 'frozen_multi_repository_holdout') {
  throw new Error('source spec must declare frozen_multi_repository_holdout schema version 1');
}
if (sourceSpec.repositories.length < 2) throw new Error('a frozen holdout requires at least two repositories');
const repositoryIds = sourceSpec.repositories.map((repository) => repository.id);
if (repositoryIds.some((id) => !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id))
  || new Set(repositoryIds).size !== repositoryIds.length) {
  throw new Error('frozen repository IDs must be unique safe filename components');
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const git = (root: string, args: readonly string[]): Buffer => execFileSync('git', ['-C', root, ...args]);
const gitText = (root: string, args: readonly string[]): string => git(root, args).toString('utf8');
const sourceBytes = (root: string, revision: string, repoPath: string): Buffer =>
  git(root, ['show', `${revision}:${repoPath}`]);

const excluded = (repoPath: string): boolean => {
  const lower = repoPath.toLocaleLowerCase();
  return repoPath.split('/').some((part) => ['node_modules', 'dist', 'build', 'artifacts', '.cache', 'coverage', 'vendor'].includes(part))
    || ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.zip', '.tar', '.gz', '.exe', '.dll'].some((suffix) => lower.endsWith(suffix));
};

const manifestFor = (repository: RepositorySpec, root: string): { readonly bytes: Buffer; readonly digest: string; readonly entries: readonly ManifestEntry[] } => {
  const paths = gitText(root, ['ls-tree', '-r', '-z', repository.revision])
    .split('\0')
    .filter((value) => /^(100644|100755) blob [a-f0-9]+\t/u.test(value))
    .map((value) => value.slice(value.indexOf('\t') + 1))
    .sort((left, right) => left.localeCompare(right));
  const entries: ManifestEntry[] = [];
  for (const repoPath of paths) {
    if (excluded(repoPath) || ingestRepoPath(repoPath)._tag !== 'Ok') continue;
    const bytes = sourceBytes(root, repository.revision, repoPath);
    if (bytes.includes(0)) continue;
    entries.push({ path: repoPath, sizeBytes: bytes.byteLength, sha256: sha256(bytes) });
  }
  const value = {
    schemaVersion: 1,
    repositoryId: repository.id,
    revision: repository.revision,
    exclusions: ['.git', 'node_modules', 'dist', 'build', 'artifacts', '.cache', 'coverage', 'vendor', 'binary files'],
    entries,
  };
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8');
  return { bytes, digest: sha256(bytes), entries };
};

const repositories: RetrievalHoldoutRepository[] = [];
const pendingManifests: { readonly path: string; readonly bytes: Buffer; readonly digest: string }[] = [];
const manifestByRepository = new Map<string, { readonly digest: string; readonly root: string; readonly revision: string; readonly entries: ReadonlyMap<string, ManifestEntry> }>();
for (const repository of sourceSpec.repositories) {
  const root = repositoryRoots.get(repository.id);
  if (root === undefined || !existsSync(root)) throw new Error(`missing checkout for repository ${repository.id}`);
  const actualRevision = gitText(root, ['rev-parse', repository.revision]).trim();
  if (actualRevision !== repository.revision) {
    throw new Error(`repository ${repository.id} revision mismatch: expected ${repository.revision}, got ${actualRevision}`);
  }
  const manifest = manifestFor(repository, root);
  const manifestPath = resolve(manifestTarget, `manifest-${repository.id}.json`);
  pendingManifests.push({ path: manifestPath, bytes: manifest.bytes, digest: manifest.digest });
  repositories.push({ id: repository.id, revision: repository.revision, sourceManifestSha256: manifest.digest });
  manifestByRepository.set(repository.id, { digest: manifest.digest, root, revision: repository.revision,
    entries: new Map(manifest.entries.map((entry) => [entry.path, entry])) });
}

const seenCaseIds = new Set<string>();
const cases: RetrievalHoldoutCase[] = sourceSpec.cases.map((item) => {
  if (seenCaseIds.has(item.id)) throw new Error(`duplicate holdout case ${item.id}`);
  seenCaseIds.add(item.id);
  const repository = manifestByRepository.get(item.repositoryId);
  if (repository === undefined) throw new Error(`case ${item.id} references an unknown repository`);
  if (item.relevantSpans.length === 0) throw new Error(`case ${item.id} requires at least one relevant span`);
  const relevantCandidateIds = item.relevantSpans.map((span) => {
    if (!repository.entries.has(span.repoPath)
      || !Number.isSafeInteger(span.startLine)
      || !Number.isSafeInteger(span.endLine)
      || span.startLine < 1
      || span.endLine < span.startLine
      || (span.startColumn !== undefined && (!Number.isSafeInteger(span.startColumn) || span.startColumn < 1))
      || (span.endColumn !== undefined && (!Number.isSafeInteger(span.endColumn) || span.endColumn < 1))) {
      throw new Error(`case ${item.id} has an invalid or excluded range in ${span.repoPath}`);
    }
    const bytes = sourceBytes(repository.root, repository.revision, span.repoPath);
    if (exactUtf8SourceSpan(bytes, span) === undefined) {
      throw new Error(`case ${item.id} has an invalid range in ${span.repoPath}`);
    }
    const digest = repository.entries.get(span.repoPath)!.sha256;
    if (sha256(bytes) !== digest) throw new Error(`case ${item.id} source differs from frozen manifest`);
    return canonicalBenchmarkCandidateId(item.repositoryId, span.repoPath, digest, span);
  });
  return {
    id: item.id,
    repositoryId: item.repositoryId,
    query: item.query,
    relevantCandidateIds,
    ...(item.critical === undefined ? {} : { critical: item.critical }),
    ...(item.kind === undefined ? {} : { kind: item.kind }),
    ...(item.focusedPath === undefined ? {} : { focusedPath: item.focusedPath }),
  };
});

for (const item of cases) {
  if (new Set(item.relevantCandidateIds).size !== item.relevantCandidateIds.length) {
    throw new Error(`case ${item.id} contains duplicate canonical candidate labels`);
  }
}

if (!cases.some((item) => item.critical === true)) throw new Error('holdout needs at least one critical case');
for (const repository of repositories) {
  if (!cases.some((item) => item.repositoryId === repository.id)) throw new Error(`repository ${repository.id} has no cases`);
}

const holdout: RetrievalHoldout = {
  schemaVersion: 1,
  status: 'frozen_multi_repository_holdout',
  repositories,
  cases,
};
assertNativeReleaseHoldout(holdout);
const holdoutPath = holdoutTarget;
const holdoutBytes = Buffer.from(JSON.stringify(holdout, null, 2) + '\n', 'utf8');
// Validate every label before publishing any manifest or holdout artifact.
for (const manifest of pendingManifests) await writeFrozenArtifactPair(manifest.path, manifest.bytes, manifest.digest);
await writeFrozenArtifactPair(holdoutPath, holdoutBytes, sha256(holdoutBytes));
process.stdout.write(JSON.stringify({ holdout: holdoutPath, holdoutSha256: sha256(holdoutBytes), cases: cases.length, repositories: repositories.length }) + '\n');
