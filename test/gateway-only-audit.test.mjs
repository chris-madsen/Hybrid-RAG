import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

const script = resolve('scripts/gateway-only-audit.mjs');
const retiredToken = String.fromCharCode(109, 99, 112);
const exec = (command, args, cwd) => {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.error, undefined);
  return result;
};

test('Gateway-only audit rejects old protocol in content and filenames', () => {
  const root = mkdtempSync(join(tmpdir(), 'ace-gateway-audit-'));
  try {
    assert.equal(exec('git', ['init', '--quiet'], root).status, 0);
    mkdirSync(join(root, 'src'));
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'src', 'gateway.ts'), 'export const gateway = true;\n');
    assert.equal(exec('git', ['add', '.'], root).status, 0);
    const clean = exec(process.execPath, [script], root);
    assert.equal(clean.status, 0, clean.stderr || clean.stdout);
    assert.equal(JSON.parse(clean.stdout).matchingFiles, 0);

    const removed = join(root, 'docs', 'removed.md');
    writeFileSync(removed, 'unrelated historical note\n');
    assert.equal(exec('git', ['add', '.'], root).status, 0);
    rmSync(removed);
    const deletedTracked = exec(process.execPath, [script], root);
    assert.equal(deletedTracked.status, 0, deletedTracked.stderr || deletedTracked.stdout);
    assert.equal(JSON.parse(deletedTracked.stdout).matchingFiles, 0);

    const violation = join(root, 'src', 'unwanted-tool.ts');
    writeFileSync(violation, "export const rejected = '"+retiredToken+"';\n");
    assert.equal(exec('git', ['add', '.'], root).status, 0);
    const badContent = exec(process.execPath, [script], root);
    assert.equal(badContent.status, 1, badContent.stdout);
    assert.equal(JSON.parse(badContent.stdout).matchingFiles, 1);

    rmSync(violation);
    writeFileSync(join(root, 'docs', 'obsolete-'+retiredToken+'.md'), '# Archived protocol\n');
    assert.equal(exec('git', ['add', '-A'], root).status, 0);
    const badPath = exec(process.execPath, [script], root);
    assert.equal(badPath.status, 1, badPath.stdout);
    assert.equal(JSON.parse(badPath.stdout).matches.some((x) => x.fileNameMatch), true);

    // A third-party local indexing CLI must not be misclassified as an
    // obsolete model-invoked transport. Only its exact brand is exempt.
    rmSync(join(root, 'docs', 'obsolete-'+retiredToken+'.md'));
    writeFileSync(join(root, 'src', 'native-code-index.ts'),
      "export const executable = 'codebase-memory-" + retiredToken + "';\n");
    assert.equal(exec('git', ['add', '-A'], root).status, 0);
    const nativeCliAllowed = exec(process.execPath, [script], root);
    assert.equal(nativeCliAllowed.status, 0, nativeCliAllowed.stdout);
    assert.equal(JSON.parse(nativeCliAllowed.stdout).matchingFiles, 0);

    writeFileSync(join(root, 'src', 'retired-provider.ts'),
      "export const obsoleteToolProtocol = '" + retiredToken + "';\n");
    assert.equal(exec('git', ['add', '.'], root).status, 0);
    const stillRejected = exec(process.execPath, [script], root);
    assert.equal(stillRejected.status, 1, stillRejected.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
