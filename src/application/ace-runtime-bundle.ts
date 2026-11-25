import { createHash } from 'node:crypto';
import { constants, existsSync } from 'node:fs';
import { access, open, readFile, readdir, type FileHandle } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { requiredAceRuntimeBundlePaths, validateAceRuntimeBundleManifest } from '../domain/ace-runtime-bundle.js';

export const missingAceRuntimeBundlePaths = (runtimeRoot: string): readonly string[] =>
  requiredAceRuntimeBundlePaths.filter((path) => !existsSync(join(runtimeRoot, path)));

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

interface BundleEntry {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

// Keep each directory FD open until all its descendants are scanned.
// /proc/self/fd (Linux) or /dev/fd (Darwin) refers to the opened directory
// inode rather than a pathname that could be replaced after an earlier check.
const descriptorPath = (fd: number): string =>
  process.platform === 'linux' ? `/proc/self/fd/${fd}` : `/dev/fd/${fd}`;

const stableStat = async (descriptor: FileHandle): Promise<import('node:fs').Stats> =>
  descriptor.stat();

const assertStable = (before: import('node:fs').Stats, after: import('node:fs').Stats): void => {
  if (before.ino !== after.ino || before.dev !== after.dev
    || before.size !== after.size || before.ctimeMs !== after.ctimeMs
    || before.mtimeMs !== after.mtimeMs) {
    throw new Error('ACE runtime bundle bytes or directory changed while hashing');
  }
};

// Deliberately uses the same stable ordering and exclusions as the release builder.
// The provenance file contains bundleSha256 (circular) and is checked separately.
const scanBundleDirectory = async (directory: FileHandle, prefix: string): Promise<readonly BundleEntry[]> => {
  const beforeDirectory = await stableStat(directory);
  if (!beforeDirectory.isDirectory()) throw new Error('ACE runtime bundle entry is not a directory');
  const entries: BundleEntry[] = [];
  const directoryPath = descriptorPath(directory.fd);
  for (const name of (await readdir(directoryPath)).sort()) {
    const relPath = prefix === '' ? name : prefix + '/' + name;
    if (relPath === 'runtime-manifest.json' || relPath === 'dist/runtime-provenance.json') continue;
    const child = await open(join(directoryPath, name), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const info = await stableStat(child);
      if (info.isDirectory()) {
        entries.push(...await scanBundleDirectory(child, relPath));
      } else if (info.isFile()) {
        const bytes = await child.readFile();
        assertStable(info, await stableStat(child));
        if (bytes.byteLength !== info.size) throw new Error('ACE runtime bundle short file read');
        entries.push({ path: relPath, sha256: sha256(bytes), sizeBytes: bytes.byteLength });
      } else {
        throw new Error('ACE runtime bundle contains an unsupported entry');
      }
    } finally {
      await child.close();
    }
  }
  assertStable(beforeDirectory, await stableStat(directory));
  return entries;
};

const bundleEntries = async (root: string): Promise<readonly BundleEntry[]> => {
  const directory = await open(root, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_DIRECTORY ?? 0));
  try {
    return await scanBundleDirectory(directory, '');
  } finally {
    await directory.close();
  }
};

export const computeAceRuntimeBundleDigest = async (runtimeRoot: string): Promise<string> =>
  sha256(Buffer.from(JSON.stringify(await bundleEntries(resolve(runtimeRoot)), null, 2) + '\n', 'utf8'));

export interface AceBundleVerification {
  readonly status: 'ready' | 'not_ready';
  readonly reason: string;
  readonly identity?: string;
}

export const verifyAceRuntimeBundle = async (
  runtimeRoot: string,
  expectedDigest?: string,
): Promise<AceBundleVerification> => {
  const root = resolve(runtimeRoot);
  try {
    const missing = missingAceRuntimeBundlePaths(root);
    if (missing.length !== 0) return { status: 'not_ready', reason: `ACE runtime bundle is incomplete: ${missing.join(',')}` };
    const manifest = JSON.parse(await readFile(join(root, 'runtime-manifest.json'), 'utf8')) as Record<string, unknown>;
    const failures = validateAceRuntimeBundleManifest(manifest);
    if (failures.length > 0) return { status: 'not_ready', reason: `ACE runtime manifest invalid: ${failures.join(',')}` };
    const binary = join(root, 'runtime/native/codebase-memory-mcp');
    await access(binary, constants.X_OK);
    if (sha256(await readFile(binary)) !== manifest.nativeBinarySha256) {
      return { status: 'not_ready', reason: 'ACE native binary digest differs from manifest' };
    }
    if (existsSync(join(root, 'runtime/python')) || existsSync(join(root, 'runtime/model-cache'))) {
      return { status: 'not_ready', reason: 'ACE native bundle contains retired embedding runtime' };
    }
    const declared = manifest.bundleSha256 as string;
    if (expectedDigest !== undefined && expectedDigest !== declared) {
      return { status: 'not_ready', reason: 'ACE runtime bundle digest differs from expected digest' };
    }
    const actual = await computeAceRuntimeBundleDigest(root);
    if (actual !== declared) {
      return { status: 'not_ready', reason: 'ACE runtime bundle bytes do not match manifest bundleSha256' };
    }
    const provenance = JSON.parse(await readFile(join(root, 'dist/runtime-provenance.json'), 'utf8')) as Record<string, unknown>;
    if (provenance.bundleManifestSha256 !== declared || provenance.sourceCommit !== manifest.sourceCommit) {
      return { status: 'not_ready', reason: 'ACE runtime provenance does not match bundle manifest' };
    }
    return { status: 'ready', reason: 'ACE bundle content hashes and runtime provenance verified', identity: declared };
  } catch (error) {
    return { status: 'not_ready', reason: error instanceof Error ? error.message : 'ACE runtime bundle could not be verified' };
  }
};
