export interface AceRuntimeBundleManifest {
  readonly schemaVersion: 2;
  readonly runtimeId: 'ace-harbor-runtime-v1';
  readonly retrieval: 'native_cbm';
  readonly sourceCommit: string;
  readonly bundleSha256: string;
  readonly taskImages: readonly { readonly reference: string; readonly digest: string }[];
  readonly codebaseMemoryVersion: '0.12.1';
  readonly nativeBinarySha256: string;
}

export const requiredAceRuntimeBundlePaths = [
  'dist/bin/ace-runtime.js',
  'dist/bin/ace-context-rpc.js',
  'dist/runtime-provenance.json',
  'node_modules/effect/package.json',
  'node_modules/typescript-language-server/package.json',
  'runtime-manifest.json',
  'runtime/native/codebase-memory-mcp',
] as const;

const isSha256 = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const isDockerDigest = (value: unknown): value is string => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export const validateAceRuntimeBundleManifest = (value: unknown): readonly string[] => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return ['manifest_invalid'];
  const manifest = value as Record<string, unknown>;
  const taskImages = manifest.taskImages;
  const failures: string[] = [];
  if (manifest.schemaVersion !== 2) failures.push('manifest_schema_invalid');
  if (manifest.runtimeId !== 'ace-harbor-runtime-v1') failures.push('runtime_id_mismatch');
  if (!nonEmpty(manifest.sourceCommit)) failures.push('source_commit_missing');
  else if (!/^[a-f0-9]{40,64}$/iu.test(manifest.sourceCommit)) failures.push('source_commit_invalid');
  if (!isSha256(manifest.bundleSha256)) failures.push('bundle_digest_invalid');
  if (!Array.isArray(taskImages) || taskImages.length === 0) failures.push('task_images_missing');
  else if (taskImages.some((item) => typeof item !== 'object' || item === null
    || !nonEmpty((item as Record<string, unknown>).reference)
    || !isDockerDigest((item as Record<string, unknown>).digest))) {
    failures.push('task_images_invalid');
  }
  if (manifest.retrieval !== 'native_cbm') failures.push('retrieval_mode_invalid');
  if (manifest.codebaseMemoryVersion !== '0.12.1') failures.push('codebase_memory_pin_invalid');
  if (!isSha256(manifest.nativeBinarySha256)) failures.push('native_binary_digest_invalid');
  return failures;
};
