#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmod, cp, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const CBM_VERSION = '0.12.1';

const usage = () => {
  process.stdout.write('Usage: node scripts/build-harbor-ace-runtime.mjs --source-root <clean-checkout> --output <bundle-dir> --task-image <reference>@sha256:<64hex> [--task-image ...]\n');
};

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  usage();
  process.exit(0);
}
const values = { sourceRoot: undefined, output: undefined, taskImages: [] };
while (args.length > 0) {
  const name = args.shift();
  if (name === '--task-image') {
    const value = args.shift();
    if (value === undefined) throw new Error('BLOCKED: --task-image requires a value');
    values.taskImages.push(value);
  } else if (name === '--source-root') values.sourceRoot = args.shift();
  else if (name === '--output') values.output = args.shift();
  else throw new Error(`Usage error: unknown argument ${name}`);
}
if (values.sourceRoot === undefined || values.output === undefined || values.taskImages.length === 0) {
  usage();
  process.exitCode = 2;
  process.exit();
}

const sourceRoot = resolve(values.sourceRoot);
const output = resolve(values.output);

// Resolve symlinked parents before any recursive deletion. --output must never
// replace all or part of the source checkout, including through an alias.
const canonicalTarget = async (target) => {
  const suffix = [];
  let ancestor = target;
  while (true) {
    try {
      return resolve(await realpath(ancestor), ...suffix);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      const parent = dirname(ancestor);
      if (parent === ancestor) throw error;
      suffix.unshift(basename(ancestor));
      ancestor = parent;
    }
  }
};
const containsPath = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};
const sourceCanonical = await canonicalTarget(sourceRoot);
const outputCanonical = await canonicalTarget(output);
if (containsPath(sourceCanonical, outputCanonical) || containsPath(outputCanonical, sourceCanonical)) {
  throw new Error('BLOCKED: --output overlaps the source checkout; refusing recursive deletion');
}

const dockerDigest = /^(.+)@sha256:([a-f0-9]{64})$/u;
const imageRefs = values.taskImages.map((value) => {
  const match = dockerDigest.exec(value);
  if (match?.[1] === undefined || match[2] === undefined) throw new Error(`BLOCKED: task image must be pinned by digest: ${value}`);
  return { reference: match[1], digest: `sha256:${match[2]}` };
});

const run = (command, commandArgs, options = {}) => execFileSync(command, commandArgs, {
  cwd: options.cwd,
  encoding: 'utf8',
  stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ...(options.env || {}) },
});
const executionImage = (image) => {
  try {
    const localId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', image.reference]).trim();
    // Execute the verified immutable IMAGE ID, never a mutable tag that could be retargeted.
    return localId === image.digest ? localId : `${image.reference}@${image.digest}`;
  } catch {
    return `${image.reference}@${image.digest}`;
  }
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fileDigest = async (path) => digest(await readFile(path));

const sourceStatus = run('git', ['-C', sourceRoot, 'status', '--porcelain=v1', '--untracked-files=all']).trim();
if (sourceStatus.length > 0) throw new Error('BLOCKED: ACE source checkout is dirty');
const sourceCommit = run('git', ['-C', sourceRoot, 'rev-parse', 'HEAD']).trim();
if (!/^[a-f0-9]{40,64}$/iu.test(sourceCommit)) throw new Error('BLOCKED: source checkout has no valid commit');

try {
  await stat(join(sourceRoot, 'node_modules/.bin/tsc'));
  await stat(join(sourceRoot, 'node_modules/@types/node'));
} catch {
  run('npm', ['ci', '--ignore-scripts'], { cwd: sourceRoot, stdio: 'inherit' });
}

run('npm', ['run', 'build'], { cwd: sourceRoot, stdio: 'inherit' });
try {
  await stat(output);
  const writableImage = executionImage(imageRefs[0]);
  run('docker', ['run', '--rm', '--entrypoint', 'sh', '-v', `${output}:/ace`, writableImage, '-lc', 'chmod -R a+rwX /ace'], { stdio: 'inherit' });
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['dist', 'src', 'scripts', 'package.json', 'package-lock.json', 'tsconfig.json']) {
  await cp(join(sourceRoot, path), join(output, path), { recursive: true });
}
// Runtime-only bundle. Keep the independent TypeScript LSP package, but
// omit npm launcher symlinks from the no-follow byte manifest.
run('npm', ['ci', '--omit=dev', '--ignore-scripts', '--bin-links=false'], { cwd: output, stdio: 'inherit' });
const nativeDir = join(output, 'runtime/native');
await mkdir(nativeDir, { recursive: true });
const binary = join(nativeDir, 'codebase-memory-mcp');
const installRoot = await mkdtemp(join(tmpdir(), 'ace-pinned-cbm-'));
try {
  // The pinned upstream installer verifies the native release checksum.
  run('npm', ['install', '--prefix', installRoot, '--no-save', '--package-lock=false', 'codebase-memory-mcp@' + CBM_VERSION], { stdio: 'inherit' });
  await cp(join(installRoot, 'node_modules/codebase-memory-mcp/bin/codebase-memory-mcp'), binary);
  await chmod(binary, 0o755);
} finally {
  await rm(installRoot, { recursive: true, force: true });
}
const assertNativeVersion = (value) => {
  if (!/(?:^|\s)0\.12\.1(?:\s|$)/u.test(value)) throw new Error('BLOCKED: unexpected native CBM version');
};
assertNativeVersion(run(binary, ['--version']));
for (const image of imageRefs) {
  const pinnedImage = executionImage(image);
  assertNativeVersion(run('docker', ['run', '--rm', '--network', 'none', '--entrypoint', '/ace/runtime/native/codebase-memory-mcp', '-v', `${output}:/ace:ro`, pinnedImage, '--version']));
}
const nativeBinarySha256 = await fileDigest(binary);
const { computeAceRuntimeBundleDigest } = await import(pathToFileURL(join(sourceRoot, 'dist/application/ace-runtime-bundle.js')).href);
const bundleSha256 = await computeAceRuntimeBundleDigest(output);
const provenancePath = join(output, 'dist/runtime-provenance.json');
const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
provenance.bundleManifestSha256 = bundleSha256;
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
const runtimeManifest = {
  schemaVersion: 2,
  runtimeId: 'ace-harbor-runtime-v1',
  retrieval: 'native_cbm',
  sourceCommit,
  bundleSha256,
  taskImages: imageRefs,
  codebaseMemoryVersion: CBM_VERSION,
  nativeBinarySha256,
};
await writeFile(join(output, 'runtime-manifest.json'), `${JSON.stringify(runtimeManifest, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ status: 'READY', output, sourceCommit, bundleSha256, taskImages: imageRefs, codebaseMemoryVersion: CBM_VERSION })}\n`);
