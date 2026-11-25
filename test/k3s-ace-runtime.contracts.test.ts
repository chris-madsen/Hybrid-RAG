import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('ACE image requires an operator-supplied pinned base and contains pinned local provider runtimes', async () => {
  const dockerfile = await readFile('Dockerfile.ace', 'utf8');
  assert.match(dockerfile, /^ARG ACE_NODE_IMAGE\nFROM \$\{ACE_NODE_IMAGE\}/mu);
  assert.doesNotMatch(dockerfile, /ACE_AST_GREP_COMMAND|ast-grep/u);
  const manifest = JSON.parse(await readFile('package.json', 'utf8')) as {
    readonly dependencies: Readonly<Record<string, string>>;
    readonly devDependencies: Readonly<Record<string, string>>;
  };
  assert.equal(manifest.dependencies['@ast-grep/cli'], undefined);
  assert.match(manifest.devDependencies['@ast-grep/cli'] ?? '', /^\d+\.\d+\.\d+$/u);
  assert.doesNotMatch(dockerfile, /fastembed|onnxruntime|historical-vector/u);
  const native = dockerfile.split('FROM ace-base AS native-cbm')[1];
  assert.ok(native, 'native target must be independently buildable');
  assert.match(native, /npm install --global codebase-memory-mcp@0\.12\.1/u);
  assert.doesNotMatch(native, /ACE_CODE_RETRIEVAL_MODE|ACE_ENABLE_EXPERIMENTAL_QDRANT|ACE_RERANKER_MODE/u);
  assert.match(native, /USER node/u);
  assert.doesNotMatch(native, /python3|pip install|fastembed==|onnxruntime==/u);
  assert.match(dockerfile, /npm ci --ignore-scripts/u);
  assert.match(dockerfile, /npm prune --omit=dev --ignore-scripts/u);
  assert.match(dockerfile, /USER node/u);
  assert.doesNotMatch(dockerfile, /(?:TOKEN|PASSWORD|PRIVATE_KEY)=\S+/u);
});


test('Bifröst-only deployment never falls back to a retired kubectl tool launcher', async () => {
  await assert.rejects(readFile('infra/k8s/ace-local/ace-' + String.fromCharCode(109, 99, 112) + '.yaml', 'utf8'), { code: 'ENOENT' });
  await assert.rejects(readFile('scripts/kubectl-ace-' + String.fromCharCode(109, 99, 112) + '.sh', 'utf8'), { code: 'ENOENT' });
  const http = await readFile('src/transport/context-rpc-http.ts', 'utf8');
  assert.match(http, /isLoopbackContextRpcHost/u);
  assert.match(http, /ACE_CONTEXT_RPC_HOST/u);
});
