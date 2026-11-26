import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RetrievalHoldout } from '../src/domain/retrieval-quality-evaluation.js';
import { assertNativeReleaseHoldout, checkedFrozenManifest } from './native-projection-evidence.js';

const [holdoutArg, manifestDirectoryArg] = process.argv.slice(2);
if (holdoutArg === undefined || manifestDirectoryArg === undefined) {
  throw new Error('Usage: tsx scripts/validate-retrieval-holdout.ts <holdout.json> <manifest-dir>');
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const holdoutPath = resolve(holdoutArg);
const holdoutBytes = await readFile(holdoutPath);
const holdout = JSON.parse(holdoutBytes.toString('utf8')) as RetrievalHoldout;
assertNativeReleaseHoldout(holdout);
for (const repository of holdout.repositories ?? []) {
  const manifestPath = resolve(manifestDirectoryArg, `manifest-${repository.id}.json`);
  checkedFrozenManifest(holdout, repository.id, await readFile(manifestPath));
}
const holdoutSha256 = sha256(holdoutBytes);
process.stdout.write(JSON.stringify({
  status: holdout.status,
  holdoutSha256,
  repositories: holdout.repositories.map((item) => item.id),
  cases: holdout.cases.length,
}) + '\n');
