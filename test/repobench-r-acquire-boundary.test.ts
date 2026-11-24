import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
// eslint-disable-next-line import-x/extensions -- NodeNext resolves the source module through its emitted extension.
import { downloadPinnedRepoBenchRecords, writeRepoBenchArtifact } from '../scripts/repobench-r-acquire-boundary.js';

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

test('records require an independently pinned digest before they can be retained', async () => {
  const request: typeof fetch = async () => new Response('official bytes');
  const url = 'https://example.invalid/records';
  assert.equal(Buffer.from(await downloadPinnedRepoBenchRecords(url, digest('official bytes'), request)).toString(), 'official bytes');
  await assert.rejects(downloadPinnedRepoBenchRecords(url, digest('different bytes'), request), /digest mismatch/u);
  await assert.rejects(downloadPinnedRepoBenchRecords(url, digest('official bytes'), request, 2), /size limit/u);
  await assert.rejects(downloadPinnedRepoBenchRecords(url, '', request), /pinned SHA-256/u);
});

test('records redirects never downgrade HTTPS or forward credentials', async () => {
  let calls = 0;
  const request: typeof fetch = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: 'http://example.invalid/records' } });
  };
  await assert.rejects(downloadPinnedRepoBenchRecords('https://example.invalid/start', digest('x'), request), /HTTPS/u);
  assert.equal(calls, 1);
});

test('record evidence cannot overwrite existing files or follow final symlinks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ace-repobench-acquire-'));
  try {
    await writeRepoBenchArtifact(directory, 'records.raw', 'verified');
    await assert.rejects(writeRepoBenchArtifact(directory, 'records.raw', 'replacement'));
    assert.equal(await readFile(join(directory, 'records.raw'), 'utf8'), 'verified');
    const victim = join(directory, 'victim');
    await writeFile(victim, 'unchanged');
    await symlink(victim, join(directory, 'manifest.json'));
    await assert.rejects(writeRepoBenchArtifact(directory, 'manifest.json', 'replacement'));
    assert.equal(await readFile(victim, 'utf8'), 'unchanged');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
