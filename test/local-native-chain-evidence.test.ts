import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readLocalNativeChainEvidence } from '../scripts/local-native-chain-evidence.js';

const withFixture = async (run: (paths: { sourceRoot: string; evidencePath: string }) => Promise<void>): Promise<void> => {
  const root = mkdtempSync(join(tmpdir(), 'ace-local-chain-evidence-'));
  const sourceRoot = join(root, 'checkout');
  const evidencePath = join(root, 'evidence.json');
  mkdirSync(sourceRoot);
  try {
    await run({ sourceRoot, evidencePath });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

test('local chain evidence reads a bounded regular external file', async () => withFixture(async ({ sourceRoot, evidencePath }) => {
  const evidence = { schemaVersion: 1, status: 'READY', marker: 'expected' };
  writeFileSync(evidencePath, JSON.stringify(evidence));
  assert.deepEqual(await readLocalNativeChainEvidence(evidencePath, sourceRoot), { status: 'loaded', evidence });
}));

test('local chain evidence rejects checkout paths, missing files, and oversized files', async () => withFixture(async ({ sourceRoot, evidencePath }) => {
  const inCheckout = join(sourceRoot, 'evidence.json');
  writeFileSync(inCheckout, '{}');
  assert.deepEqual(await readLocalNativeChainEvidence(inCheckout, sourceRoot), { status: 'unavailable' });
  assert.deepEqual(await readLocalNativeChainEvidence(join(sourceRoot, 'missing.json'), sourceRoot), { status: 'unavailable' });
  writeFileSync(evidencePath, ' '.repeat(16 * 1024 + 1));
  assert.deepEqual(await readLocalNativeChainEvidence(evidencePath, sourceRoot), { status: 'unavailable' });
}));

test('local chain evidence detects a path replaced after its descriptor is opened', async () => withFixture(async ({ sourceRoot, evidencePath }) => {
  const original = { schemaVersion: 1, status: 'READY', marker: 'opened-before-replacement' };
  const replacement = { schemaVersion: 1, status: 'READY', marker: 'replacement' };
  writeFileSync(evidencePath, JSON.stringify(original));
  const originalPath = `${evidencePath}.opened`;
  let swapped = false;
  const openAndReplace = async (path: string, flags: number) => {
    const descriptor = await open(path, flags);
    if (!swapped) {
      swapped = true;
      renameSync(evidencePath, originalPath);
      writeFileSync(evidencePath, JSON.stringify(replacement));
    }
    return descriptor;
  };
  const result = await readLocalNativeChainEvidence(evidencePath, sourceRoot, openAndReplace);
  assert.deepEqual(result, { status: 'unavailable' });
  assert.equal(swapped, true);
  assert.equal(realpathSync(originalPath), originalPath);
}));

test('local chain evidence rejects symlinks into the checkout', async () => withFixture(async ({ sourceRoot }) => {
  const inCheckout = join(sourceRoot, 'evidence.json');
  writeFileSync(inCheckout, '{}');
  const link = join(sourceRoot, 'linked-evidence.json');
  symlinkSync(inCheckout, link);
  assert.deepEqual(await readLocalNativeChainEvidence(link, sourceRoot), { status: 'unavailable' });
}));