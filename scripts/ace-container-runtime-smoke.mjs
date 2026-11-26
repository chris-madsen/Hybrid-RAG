#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const usage = () => process.stdout.write('Usage: node scripts/ace-container-runtime-smoke.mjs --image <image>@sha256:<64hex> --bundle <bundle-dir>\n');
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { usage(); process.exit(0); }
let image;
let bundle;
while (args.length > 0) {
  const name = args.shift();
  const value = args.shift();
  if (name === '--image') image = value;
  else if (name === '--bundle') bundle = value;
  else throw new Error('Usage error: unknown argument');
}
const match = /^(.+)@(sha256:[a-f0-9]{64})$/u.exec(image ?? '');
if (match === null || bundle === undefined) { usage(); process.exit(2); }
const root = resolve(import.meta.dirname, '..');
const bundleRoot = resolve(bundle);
const run = (command, commandArgs, timeout = 10_000) => execFileSync(command, commandArgs, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout,
});
const containerName = 'ace-native-task-smoke-' + randomUUID();
try {
  const manifest = JSON.parse(await readFile(join(bundleRoot, 'runtime-manifest.json'), 'utf8'));
  const { verifyAceRuntimeBundle } = await import(pathToFileURL(join(root, 'dist/application/ace-runtime-bundle.js')).href);
  const verified = await verifyAceRuntimeBundle(bundleRoot, manifest.bundleSha256);
  if (verified.status !== 'ready') throw new Error(verified.reason);
  if (!manifest.taskImages.some((entry) => entry.reference === match[1] && entry.digest === match[2])) throw new Error('task image is not bound to the native bundle');
  const sourceCommit = run('git', ['-C', root, 'rev-parse', 'HEAD']).trim();
  if (manifest.sourceCommit !== sourceCommit) throw new Error('bundle does not match current source');
  // The expected digest can be an immutable local image ID or a registry
  // manifest digest. Resolve both to the local immutable image ID.
  let pinned;
  try {
    const localId = run('docker', ['image', 'inspect', '--format', '{{.Id}}', match[1]]).trim();
    if (localId === match[2]) pinned = localId;
  } catch { /* inspect exact repository digest next */ }
  if (pinned === undefined) {
    pinned = run('docker', ['image', 'inspect', '--format', '{{.Id}}', image]).trim();
  }
  if (!/^sha256:[a-f0-9]{64}$/u.test(pinned)) throw new Error('local pinned image identity unavailable');
  // Reuse real compiled RPC acceptance, not a second health-only preflight.
  // No model/provider wire, credentials or network.
  const observed = run('docker', ['run', '--rm', '--name', containerName, '--init', '--network', 'none', '--pull=never',
    '-v', `${bundleRoot}:/ace:ro`, '-v', `${root}:/evidence:ro`,
    '-e', 'GIT_OPTIONAL_LOCKS=0', '-e', 'GIT_CONFIG_COUNT=1',
    '-e', 'GIT_CONFIG_KEY_0=safe.directory', '-e', 'GIT_CONFIG_VALUE_0=/evidence',
    '-e', 'ACE_SOURCE_ROOT=/evidence', '-e', 'ACE_RUNTIME_ROOT=/ace',
    '-e', 'ACE_CBM_COMMAND=/ace/runtime/native/codebase-memory-mcp',
    '-e', 'ACE_REAL_PROJECTION_NATIVE_CBM=true', '-e', 'ACE_REAL_PROJECTION_NATIVE_MUTATIONS=true',
    '--entrypoint', 'node', pinned, '/evidence/scripts/real-projection-e2e.mjs'], 240_000);
  const statuses = observed.split(/\r?\n/u).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  if (!statuses.some((entry) => entry?.status === 'projection-pass')
    || !statuses.some((entry) => entry?.status === 'native-mutations-pass' && entry.providerWireCertified === false)) {
    throw new Error('actual native projection/mutation evidence missing');
  }
  process.stdout.write(observed);
  process.stdout.write(JSON.stringify({ schemaVersion: 1, status: 'READY', gatewayHttpLiveness: true, nativeProjection: true,
    providerWireCertified: false, runtimeId: manifest.runtimeId, bundleSha256: manifest.bundleSha256,
    sourceCommit, imageReference: match[1], imageDigest: match[2], localImageId: pinned }) + '\n');
} catch (error) {
  // Killing the Docker CLI on a timeout does not guarantee container exit.
  try { run('docker', ['rm', '-f', containerName]); } catch { /* already removed or Docker unavailable */ }
  process.stdout.write(JSON.stringify({ status: 'BLOCKED', reason: 'native bundle verification or isolated runtime projection failed' }) + '\n');
  process.stderr.write((error instanceof Error ? error.message.split('\n')[0] : 'native bundle smoke failed') + '\n');
  process.exitCode = 2;
}
