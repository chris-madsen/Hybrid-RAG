#!/usr/bin/env node
// Repo-wide inventory and regression gate for rejected agent-invoked tool protocol.
// Construct the obsolete token rather than embedding it in the guard source itself.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const removed = String.fromCharCode(109, 99, 112);
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const results = [];
const matcher = new RegExp(removed, 'gi');
// Codebase Memory is a THIRD-PARTY native code-index CLI, not the retired
// model-invoked tool transport. Allow exactly its branded executable/package
// name while rejecting every other occurrence of the retired protocol token.
const approvedNativeCLI = new RegExp(`(?<![\\w-])codebase-memory-${removed}(?![\\w-])`, 'gi');
// Only the two maintained npm lockfiles and canonical, correctly sized SRI
// fields are exempt. Package names, URLs, other fields and malformed digests
// are still scanned.
const lockfiles = new Set(['package-lock.json', 'typespec/package-lock.json']);
const opaqueIntegrity = (line) => {
  const match = /^[ \t]*"integrity":[ \t]*"sha(256|512)-([A-Za-z0-9+/]+={0,2})"[ \t]*,?[ \t]*$/u.exec(line);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  return bytes.length === (match[1] === '256' ? 32 : 64)
    && bytes.toString('base64') === match[2];
};
for (const path of paths) {
  if (!existsSync(path)) continue;
  const pathMatch = matcher.test(path);
  matcher.lastIndex = 0;
  const bytes = readFileSync(path);
  const binary = bytes.includes(0);
  const lines = binary ? [] : bytes.toString('utf8').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    matcher.lastIndex = 0;
    // Pin integrity hashes are opaque bytes, not protocol references. Never
    // mutate a checked-in SRI digest solely because its base64 contains a
    // three-letter substring. The exception is restricted to this exact field.
    if (lockfiles.has(path) && opaqueIntegrity(lines[i])) continue;
    if (matcher.test(lines[i].replace(approvedNativeCLI, 'codebase-memory-native-cli'))) hits.push(i + 1);
  }
  if (pathMatch || hits.length) results.push({
    path, fileNameMatch: pathMatch, count: hits.length, lines: hits.slice(0, 20),
  });
}
const byArea = {};
for (const record of results) {
  const area = record.path.split('/')[0];
  byArea[area] = (byArea[area] ?? 0) + 1;
}
console.log(JSON.stringify({ scanned: paths.length, matchingFiles: results.length, byArea, matches: results }));
if (!process.argv.includes('--inventory') && results.length) process.exitCode = 1;
