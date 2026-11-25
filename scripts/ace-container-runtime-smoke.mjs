#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
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
const run = (command, commandArgs) => execFileSync(command, commandArgs, {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
});
try {
  const manifest = JSON.parse(await readFile(join(bundleRoot, 'runtime-manifest.json'), 'utf8'));
  const { verifyAceRuntimeBundle } = await import(pathToFileURL(join(root, 'dist/application/ace-runtime-bundle.js')).href);
  const verified = await verifyAceRuntimeBundle(bundleRoot, manifest.bundleSha256);
  if (verified.status !== 'ready') throw new Error(verified.reason);
  if (!manifest.taskImages.some((entry) => entry.reference === match[1] && entry.digest === match[2])) throw new Error('task image is not bound to the native bundle');
  let pinned = image;
  try {
    if (run('docker', ['image', 'inspect', '--format', '{{.Id}}', match[1]]).trim() === match[2]) pinned = match[2];
  } catch { /* digest-qualified registry reference remains authoritative */ }
  // Reuse real compiled RPC acceptance, not a second health-only preflight.
  // No model/provider wire, credentials or network.
  const observed = run('docker', ['run', '--rm', '--init', '--network', 'none', '--pull=never',
    '-v', `${bundleRoot}:/ace:ro`, '-v', `${root}:/evidence:ro`,
    '-e', 'GIT_OPTIONAL_LOCKS=0', '-e', 'GIT_CONFIG_COUNT=1',
    '-e', 'GIT_CONFIG_KEY_0=safe.directory', '-e', 'GIT_CONFIG_VALUE_0=/evidence',
    '-e', 'ACE_SOURCE_ROOT=/evidence', '-e', 'ACE_RUNTIME_ROOT=/ace',
    '-e', 'ACE_CBM_COMMAND=/ace/runtime/native/codebase-memory-mcp',
    '-e', 'ACE_REAL_PROJECTION_NATIVE_CBM=true', '-e', 'ACE_REAL_PROJECTION_NATIVE_MUTATIONS=true',
    '--entrypoint', 'node', pinned, '/evidence/scripts/real-projection-e2e.mjs']);
  if (!observed.includes('"status":"projection-pass"') || !observed.includes('"status":"native-mutations-pass"')) throw new Error('actual native projection/mutation evidence missing');
  process.stdout.write(observed);
  process.stdout.write(JSON.stringify({ status: 'READY', gatewayHttpLiveness: true, nativeProjection: true,
    providerWireCertified: false, runtimeId: manifest.runtimeId, bundleSha256: manifest.bundleSha256 }) + '\n');
} catch (error) {
  process.stdout.write(JSON.stringify({ status: 'BLOCKED', reason: 'native bundle verification or isolated runtime projection failed' }) + '\n');
  process.stderr.write((error instanceof Error ? error.message.split('\n')[0] : 'native bundle smoke failed') + '\n');
  process.exitCode = 2;
}
