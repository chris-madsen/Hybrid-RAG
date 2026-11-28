import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  dockerImageDigestPattern,
  feedbackHermesProviderPrefix,
  dockerImageMatchesDigest,
  validateMatchingFeedbackHarborJobs,
  type FeedbackHarborJobIdentity,
  type FeedbackHarborPairIdentity,
} from '../src/domain/feedback-harbor-config.js';
import {
  classifyFeedbackVerifierHttpStatus,
  inspectFeedbackVerifierModelsResponse,
  hermesCodexAuthenticationRoute,
  inspectFeedbackVerifierConfiguration,
  verifierDeclarationMatches,
  isApprovedVerifierTransport,
  inspectHermesBifrostEndpoint,
  inspectHermesAuthJson,
  validateFeedbackImageOverride,
  validateFeedbackPreflightBinding,
  validateNativeTaskProjectionReceipt,
} from '../src/domain/feedback-preflight.js';
import {
  validateFeedbackExperimentManifest,
  validateFeedbackTaskManifest,
  type FeedbackExperimentManifest,
} from '../src/domain/feedback-loop-experiment.js';
import { verifyCompiledRuntimeProvenance } from '../src/application/runtime-provenance.js';
import { verifyAceRuntimeBundle } from '../src/application/ace-runtime-bundle.js';
import { assessTaskRuntimeProbe, readHermesTaskRuntimeReceipt, type HermesTaskRuntimeReceipt, type TaskRuntimeProbeStages } from '../src/domain/hermes-task-runtime-probe.js';

type CheckStatus = 'ready' | 'not_ready' | 'unknown' | 'not_required';

interface PreflightCheck {
  readonly status: CheckStatus;
  readonly reason: string;
  readonly identity?: string;
  readonly hermesRuntimeReceipts?: readonly HermesTaskRuntimeReceipt[];
  readonly agentAdapterSha256?: string;
  readonly stages?: TaskRuntimeProbeStages;
}

interface PreflightManifest {
  readonly schemaVersion: 2;
  readonly status: 'READY' | 'BLOCKED';
  readonly generatedAt: string;
  readonly sourceCommit: string;
  readonly runtimeRoot: string;
  readonly authenticationRoute: typeof hermesCodexAuthenticationRoute;
  readonly checks: Readonly<Record<string, PreflightCheck>>;
  readonly runtime?: {
    readonly agent: 'hermes';
    readonly agentVersion: string;
    readonly model: string;
    readonly reasoningEffort: FeedbackHarborJobIdentity['reasoningEffort'];
    readonly bifrostEndpointSha256?: string;
    readonly harborVersion: string;
    readonly imageDigest?: string;
    readonly taskImages?: readonly { readonly reference: string; readonly digest: string }[];
    readonly mode: 'cold';
    readonly nConcurrentTrials: 1;
    readonly nAttempts: 1;
    readonly authenticationRoute: typeof hermesCodexAuthenticationRoute;
  };
}

const aceRuntimeBundle = async (
  bundlePath: string | undefined,
  expectedDigest: string | undefined,
): Promise<PreflightCheck> => {
  if (bundlePath === undefined) return { status: 'not_ready', reason: 'ACE runtime bundle is required for container preflight' };
  return verifyAceRuntimeBundle(bundlePath, expectedDigest);
};

// Local no-egress evidence cannot certify the Hermes executable,
// Bifröst post-auth hook or a physical provider send.
const nativeTaskProjection = (
  bundlePath: string | undefined,
  expectedBundleDigest: string | undefined,
  sourceCommit: string,
  taskImages: readonly { readonly reference: string; readonly digest: string }[] | undefined,
  prerequisites: readonly PreflightCheck[],
): PreflightCheck => {
  if (bundlePath === undefined || expectedBundleDigest === undefined || !taskImages?.length
    || prerequisites.some((check) => check.status !== 'ready')) {
    return { status: 'not_ready', reason: 'native task projection requires a clean checkout, verified bundle and pinned local task images' };
  }
  for (const image of taskImages) {
    const result = spawnSync(process.execPath, [
      resolve('scripts/ace-container-runtime-smoke.mjs'),
      '--image', `${image.reference}@${image.digest}`,
      '--bundle', bundlePath, '--bundle-sha256', expectedBundleDigest,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 270_000 });
    if (result.error !== undefined || result.status !== 0) {
      return { status: 'not_ready', reason: 'native task-image zero-egress projection failed or timed out' };
    }
    if (!validateNativeTaskProjectionReceipt(result.stdout, {
      sourceCommit, bundleSha256: expectedBundleDigest, reference: image.reference, digest: image.digest,
    })) {
      return { status: 'not_ready', reason: 'native task-image projection receipt does not match the frozen source, bundle and image' };
    }
  }
  return {
    status: 'ready',
    reason: 'compiled native Context RPC projection and mutation passed in every pinned task image without network; provider wire remains uncertified',
    identity: expectedBundleDigest,
  };
};

const sha256 = (value: string | Uint8Array): string => {
  const hash = createHash('sha256');
  if (typeof value === 'string') hash.update(value, 'utf8');
  else hash.update(value);
  return hash.digest('hex');
};

const gitBytes = (root: string, args: readonly string[]): Buffer => execFileSync('git', ['-C', root, ...args]);
const gitText = (root: string, args: readonly string[]): string => gitBytes(root, args).toString('utf8').trim();


const command = (name: string, args: readonly string[], environment?: Readonly<Record<string, string>>): PreflightCheck => {
  const result = spawnSync(name, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(environment === undefined ? {} : { env: { ...process.env, ...environment } }),
  });
  if (result.error !== undefined) return { status: 'not_ready', reason: `${name} unavailable` };
  if (result.status !== 0) return { status: 'not_ready', reason: `${name} exited ${String(result.status)}` };
  const identity = result.stdout.trim().split(/\r?\n/u)[0]?.trim();
  return {
    status: identity === undefined || identity.length === 0 ? 'unknown' : 'ready',
    reason: identity === undefined || identity.length === 0 ? `${name} returned no identity` : 'provider executable responded',
    ...(identity === undefined || identity.length === 0 ? {} : { identity: identity.slice(0, 200) }),
  };
};

const harborDataset = (datasetId: string): PreflightCheck => {
  if (datasetId === 'local/ace-suite') {
    return { status: 'not_required', reason: 'local deterministic dataset does not require Harbor registry access', identity: datasetId };
  }
  const result = spawnSync('harbor', ['datasets', 'list', '--legacy'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error !== undefined || result.status !== 0) return { status: 'not_ready', reason: 'Harbor dataset registry could not be queried' };
  return result.stdout.includes('scale-ai/swe-atlas-qna')
    ? { status: 'ready', reason: 'pinned SWE-Atlas dataset is listed by the registry', identity: 'scale-ai/swe-atlas-qna' }
    : { status: 'not_ready', reason: 'pinned scale-ai/swe-atlas-qna is not listed by the Harbor registry' };
};

const verifierEnvSection = (taskToml: string): string =>
  taskToml.match(/\[verifier\.env\]([\s\S]*?)(?=\n\[|$)/u)?.[1] ?? '';

const verifierTomlValue = (section: string, name: string): string | undefined => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(`^\\s*${escaped}\\s*=\\s*"([^"]*)"\\s*$`, 'mu').exec(section)?.[1];
};

const taskPathsFromJob = async (jobPath: string | undefined): Promise<readonly string[]> => {
  if (jobPath === undefined) return [];
  const value = JSON.parse(await readFile(jobPath, 'utf8')) as { readonly tasks?: readonly { readonly path?: unknown }[] };
  return (value.tasks ?? []).map((task) => typeof task.path === 'string' ? resolve(task.path) : undefined)
    .filter((path): path is string => path !== undefined);
};

const taskVerifier = async (nativeJobPath: string | undefined): Promise<PreflightCheck> => {
  const taskPaths = await taskPathsFromJob(nativeJobPath);
  if (taskPaths.length === 0) return { status: 'not_ready', reason: 'task verifier probe requires generated task paths' };
  const identities: string[] = [];
  for (const taskPath of taskPaths) {
    let taskToml: string;
    try {
      taskToml = await readFile(resolve(taskPath, 'task.toml'), 'utf8');
    } catch {
      return { status: 'not_ready', reason: 'task verifier probe could not read task.toml' };
    }
    const section = verifierEnvSection(taskToml);
    const declaredVerifierKeys = ['EVAL_API_KEY', 'EVAL_BASE_URL', 'EVAL_MODEL']
      .map((name) => verifierTomlValue(section, name))
      .filter((value): value is string => value !== undefined);
    if (declaredVerifierKeys.length === 0) {
      identities.push('local-task-verifier');
      continue;
    }
    // The operator must approve the verifier endpoint and credential together.
    // Task-supplied literals/templates cannot choose a different secret or URL.
    const apiKey = process.env.EVAL_API_KEY ?? process.env.OPENAI_API_KEY;
    const baseUrl = process.env.EVAL_BASE_URL ?? process.env.OPENAI_API_BASE;
    const model = process.env.EVAL_MODEL;
    if (apiKey === undefined || baseUrl === undefined || model === undefined
      || !isApprovedVerifierTransport(baseUrl)
      || !verifierDeclarationMatches(verifierTomlValue(section, 'EVAL_API_KEY'), apiKey, ['EVAL_API_KEY', 'OPENAI_API_KEY'], process.env)
      || !verifierDeclarationMatches(verifierTomlValue(section, 'EVAL_BASE_URL'), baseUrl, ['EVAL_BASE_URL', 'OPENAI_API_BASE'], process.env)
      || !verifierDeclarationMatches(verifierTomlValue(section, 'EVAL_MODEL'), model, ['EVAL_MODEL'], process.env)) {
      return { status: 'not_ready', reason: 'task verifier declaration does not match operator-approved endpoint, credential and model' };
    }
    const configuration = inspectFeedbackVerifierConfiguration({ apiKey, baseUrl, model });
    if (configuration.status !== 'ready' || configuration.identity === undefined) {
      return { status: 'not_ready', reason: configuration.reason };
    }
    try {
      const response = await fetch(`${baseUrl.trim().replace(/\/+$/u, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
      const readiness = classifyFeedbackVerifierHttpStatus(response.status, configuration.identity);
      if (readiness.status !== 'ready') return { status: 'not_ready', reason: readiness.reason, identity: readiness.identity };
      const models = inspectFeedbackVerifierModelsResponse(await response.json() as unknown, model.trim(), configuration.identity);
      if (models.status !== 'ready') return { status: 'not_ready', reason: models.reason, identity: models.identity };
      identities.push(configuration.identity);
    } catch {
      return { status: 'not_ready', reason: 'task verifier endpoint is unavailable', identity: configuration.identity };
    }
  }
  return {
    status: 'ready',
    reason: 'task verifier accepted an authenticated readiness probe for every frozen task',
    identity: [...new Set(identities)].sort().join(','),
  };
};

const hermesCodexAuth = async (): Promise<PreflightCheck> => {
  const configured = process.env.HERMES_AUTH_JSON_PATH?.trim();
  const hermesHome = process.env.HERMES_HOME?.trim();
  const authPath = configured && configured.length > 0
    ? resolve(configured)
    : resolve(hermesHome && hermesHome.length > 0 ? hermesHome : resolve(process.env.HOME ?? '/', '.hermes'), 'auth.json');
  if (!existsSync(authPath)) return { status: 'not_ready', reason: 'Hermes auth file is unavailable' };
  try {
    return inspectHermesAuthJson(authPath, await readFile(authPath, 'utf8'));
  } catch {
    return { status: 'not_ready', reason: 'Hermes auth file could not be read' };
  }
};

const sourceCheckout = (): { readonly check: PreflightCheck; readonly commit: string } => {
  try {
    const runtimeRoot = resolve('.');
    const actualRoot = resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { encoding: 'utf8' }).trim();
    if (realpathSync(actualRoot) !== realpathSync(runtimeRoot)) {
      return { check: { status: 'not_ready', reason: 'preflight must run from the ACE Git checkout root' }, commit };
    }
    if (!/^[a-f0-9]{40,64}$/iu.test(commit)) {
      return { check: { status: 'not_ready', reason: 'ACE Git commit identity is invalid' }, commit: 'unknown' };
    }
    if (dirty.length > 0) {
      return { check: { status: 'not_ready', reason: 'ACE checkout is dirty; exact-current preflight requires frozen source bytes' }, commit };
    }
    return { check: { status: 'ready', reason: 'ACE checkout is clean at an exact Git commit', identity: commit }, commit };
  } catch {
    return { check: { status: 'not_ready', reason: 'ACE Git checkout identity could not be verified' }, commit: 'unknown' };
  }
};

const compiledRuntime = async (): Promise<PreflightCheck> => {
  const runtimeRoot = resolve('.');
  const executable = resolve(runtimeRoot, 'dist/bin/ace-runtime.js');
  if (!existsSync(executable)) return { status: 'not_ready', reason: 'compiled ACE runtime is missing' };
  const verified = await verifyCompiledRuntimeProvenance(runtimeRoot, executable);
  return verified._tag === 'Err'
    ? { status: 'not_ready', reason: verified.error.message }
    : {
      status: 'ready',
      reason: 'compiled ACE runtime provenance matches the current source checkout',
      identity: `${verified.value.sourceCommit}:${verified.value.executableSha256}`,
    };
};

const agentRuntimeDigestCheck = async (
  experiment: FeedbackExperimentManifest | undefined,
  bundlePath: string | undefined,
  sourceCommit: string,
  images: readonly { readonly reference: string; readonly digest: string }[] | undefined,
  prerequisites: readonly PreflightCheck[],
): Promise<PreflightCheck> => {
  if (experiment?.bifrostEndpointSha256 === undefined || experiment.aceRuntimeBundleSha256 === undefined
    || bundlePath === undefined || !images?.length || prerequisites.some((check) => check.status !== 'ready')) {
    return { status: 'not_ready', reason: 'Hermes runtime probe requires frozen source, image, bundle and endpoint identities' };
  }
  if (!experiment.model.startsWith(feedbackHermesProviderPrefix)) return { status: 'not_ready', reason: 'Hermes Codex model identity is invalid' };
  const wireModel = experiment.model.slice(feedbackHermesProviderPrefix.length);
  if (wireModel.length === 0 || experiment.agentVersion !== 'v0.22.3'
    || sha256(await readFile('scripts/harbor_hermes_codex_oauth.py')) !== experiment.agentAdapterSha256) {
    return { status: 'not_ready', reason: 'installed agent adapter or pinned Hermes version differs from experiment identity' };
  }
  const receipts: HermesTaskRuntimeReceipt[] = [];
  for (const image of images) {
    const result = spawnSync(process.execPath, [resolve('scripts/ace-container-runtime-smoke.mjs'),
      '--image', `${image.reference}@${image.digest}`,
      '--bundle', bundlePath, '--bundle-sha256', experiment.aceRuntimeBundleSha256,
      '--hermes-endpoint-sha256', experiment.bifrostEndpointSha256, '--hermes-model', wireModel,
      '--hermes-reasoning', experiment.reasoningEffort,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 150_000 });
    const receipt = result.error === undefined && result.status === 0
      ? readHermesTaskRuntimeReceipt(result.stdout, {
        sourceCommit, bundleSha256: experiment.aceRuntimeBundleSha256, reference: image.reference, digest: image.digest,
        endpointSha256: experiment.bifrostEndpointSha256, modelSha256: sha256(wireModel), reasoningEffort: experiment.reasoningEffort,
      }) : undefined;
    if (receipt === undefined) {
      return { status: 'not_ready', reason: 'pinned task image lacks verified installed Hermes native Responses runtime or endpoint parity',
        hermesRuntimeReceipts: receipts, agentAdapterSha256: experiment.agentAdapterSha256 };
    }
    receipts.push(receipt);
  }
  return { status: 'ready', reason: 'actual pinned Hermes runtime and native SDK route observed in every task image without egress; Gateway final-send evidence must be collected independently',
    identity: sha256(JSON.stringify({ agentAdapterSha256: experiment.agentAdapterSha256, receipts })),
    hermesRuntimeReceipts: receipts, agentAdapterSha256: experiment.agentAdapterSha256 };
};

const harborJobIdentity = async (
  nativeJobPath: string | undefined,
  aceJobPath: string | undefined,
): Promise<{ readonly check: PreflightCheck; readonly identity?: FeedbackHarborPairIdentity }> => {
  if (nativeJobPath === undefined || aceJobPath === undefined) {
    return { check: { status: 'not_ready', reason: 'native and ACE optional Harbor job paths are required' } };
  }
  try {
    const [nativeBytes, aceBytes] = await Promise.all([readFile(nativeJobPath), readFile(aceJobPath)]);
    const nativeJob = JSON.parse(nativeBytes.toString('utf8')) as unknown;
    const aceJob = JSON.parse(aceBytes.toString('utf8')) as unknown;
    const checked = validateMatchingFeedbackHarborJobs(nativeJob, aceJob);
    if (checked._tag === 'Err') return { check: { status: 'not_ready', reason: checked.error.message } };
    return {
      check: { status: 'ready', reason: 'native and ACE optional jobs pin the same serial Hermes/model/reasoning/Bifröst endpoint identity', identity: checked.value.model },
      identity: checked.value,
    };
  } catch (error) {
    return { check: { status: 'not_ready', reason: error instanceof Error ? error.message : 'Harbor job identity could not be read' } };
  }
};

const hermesBifrostEndpoint = (expectedSha256: string | undefined): PreflightCheck => {
  const endpoint = process.env.HERMES_CODEX_BASE_URL?.trim();
  const normalized = endpoint?.replace(/\/+$/u, '');
  const endpointSha256 = normalized === undefined || normalized.length === 0 ? undefined : sha256(normalized);
  const allowedHosts = (process.env.ACE_HERMES_ALLOWED_BIFROST_HOSTS ?? '')
    .split(',').map((host) => host.trim()).filter((host) => host.length > 0);
  const readiness = inspectHermesBifrostEndpoint({
    endpoint, endpointSha256, expectedSha256, allowedHosts,
  });
  return readiness.status === 'ready'
    ? { status: 'ready', reason: readiness.reason, identity: readiness.identity }
    : { status: 'not_ready', reason: readiness.reason };
};

const inspectDockerImage = (target: string, digest: string): PreflightCheck => {
  if (!dockerImageDigestPattern.test(digest)) return { status: 'not_ready', reason: `invalid Docker image digest for ${target}` };
  const result = spawnSync('docker', ['image', 'inspect', '--format', '{{json .}}', target], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error !== undefined || result.status !== 0) {
    return { status: 'not_ready', reason: `Docker image ${target} is not available for inspection at ${digest}` };
  }
  try {
    const inspection = JSON.parse(result.stdout.trim()) as unknown;
    return dockerImageMatchesDigest(digest, inspection)
      ? { status: 'ready', reason: 'Docker resolved the pinned image digest', identity: `${target}@${digest}` }
      : { status: 'not_ready', reason: `Docker inspection for ${target} did not match image digest ${digest}` };
  } catch {
    return { status: 'not_ready', reason: 'Docker image inspection returned malformed JSON' };
  }
};

const dockerImages = (
  imageDigest: string | undefined,
  taskImages: readonly { readonly reference: string; readonly digest: string }[] | undefined,
): PreflightCheck => {
  const images = taskImages !== undefined && taskImages.length > 0
    ? taskImages.map((image) => ({ target: image.reference, digest: image.digest }))
    : imageDigest === undefined ? [] : [{ target: imageDigest, digest: imageDigest }];
  if (images.length === 0) return { status: 'not_ready', reason: 'an explicit Docker image digest or task image manifest is required' };
  const checks = images.map((image) => inspectDockerImage(image.target, image.digest));
  const failed = checks.find((check) => check.status !== 'ready');
  return failed ?? { status: 'ready', reason: 'Docker resolved every pinned task image', identity: images.map((image) => `${image.target}@${image.digest}`).join(',') };
};

const parseArgs = (): {
  readonly outputDirectory: string;
  readonly taskManifestPath?: string;
  readonly nativeJobPath?: string;
  readonly aceJobPath?: string;
  readonly aceRuntimeBundlePath?: string;
  readonly imageDigest?: string;
  readonly experimentManifestPath?: string;
  readonly localNativeChainEvidencePath?: string;
  readonly fastLocal: boolean;
} => {
  const args = process.argv.slice(2);
  let outputDirectory = process.env.ACE_FEEDBACK_OUTPUT?.trim() || 'artifacts/feedback/preflight';
  let taskManifestPath: string | undefined;
  let nativeJobPath: string | undefined;
  let aceJobPath: string | undefined;
  let aceRuntimeBundlePath: string | undefined;
  let imageDigest: string | undefined;
  let experimentManifestPath: string | undefined;
  let localNativeChainEvidencePath: string | undefined;
  let fastLocal = false;
  while (args.length > 0) {
    const current = args.shift();
    if (current === '--fast-local') {
      fastLocal = true;
      continue;
    }
    const value = args.shift();
    if (current === '--output' && value !== undefined) outputDirectory = value;
    else if (current === '--task-manifest' && value !== undefined) taskManifestPath = resolve(value);
    else if (current === '--native-job' && value !== undefined) nativeJobPath = resolve(value);
    else if (current === '--ace-job' && value !== undefined) aceJobPath = resolve(value);
    else if (current === '--ace-runtime-bundle' && value !== undefined) aceRuntimeBundlePath = resolve(value);
    else if (current === '--image-digest' && value !== undefined) imageDigest = value.trim();
    else if (current === '--experiment-manifest' && value !== undefined) experimentManifestPath = resolve(value);
    else if (current === '--local-native-chain-evidence' && value !== undefined) localNativeChainEvidencePath = resolve(value);
    else throw new Error('Usage: tsx scripts/feedback-loop-preflight.ts [--fast-local] [--output dir] [--task-manifest path] [--native-job path] [--ace-job path] [--ace-runtime-bundle path] [--image-digest sha256:<64hex>] [--experiment-manifest path] [--local-native-chain-evidence path]');
  }
  return {
    outputDirectory: resolve(outputDirectory),
    ...(taskManifestPath === undefined ? {} : { taskManifestPath }),
    ...(nativeJobPath === undefined ? {} : { nativeJobPath }),
    ...(aceJobPath === undefined ? {} : { aceJobPath }),
    ...(aceRuntimeBundlePath === undefined ? {} : { aceRuntimeBundlePath }),
    ...(imageDigest === undefined ? {} : { imageDigest }),
    ...(experimentManifestPath === undefined ? {} : { experimentManifestPath }),
    ...(localNativeChainEvidencePath === undefined ? {} : { localNativeChainEvidencePath }),
    fastLocal,
  };
};

const readLocalNativeChainEvidence = async (path: string | undefined, sourceRoot: string): Promise<{
  readonly status: 'not_run' | 'loaded' | 'unavailable';
  readonly evidence?: unknown;
}> => {
  if (path === undefined) return { status: 'not_run' };
  try {
    const evidencePath = realpathSync(path);
    const checkoutRoot = realpathSync(sourceRoot);
    const relativePath = relative(checkoutRoot, evidencePath);
    const isWithinCheckout = relativePath === '' || (!isAbsolute(relativePath)
      && relativePath !== '..' && !relativePath.startsWith(`..${sep}`));
    if (isWithinCheckout) {
      return { status: 'unavailable' };
    }
    const metadata = await stat(evidencePath);
    if (!metadata.isFile() || metadata.size > 16 * 1024) return { status: 'unavailable' };
    return { status: 'loaded', evidence: JSON.parse(await readFile(evidencePath, 'utf8')) as unknown };
  } catch {
    return { status: 'unavailable' };
  }
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  let datasetId = 'scale-ai/swe-atlas-qna';
  if (args.taskManifestPath !== undefined) {
    const taskManifest = validateFeedbackTaskManifest(JSON.parse(await readFile(args.taskManifestPath, 'utf8')) as unknown);
    if (taskManifest._tag === 'Err') throw new Error(`BLOCKED: ${taskManifest.error.path}: ${taskManifest.error.message}`);
    datasetId = taskManifest.value.dataset.id;
  }
  let experimentManifest: FeedbackExperimentManifest | undefined;
  let manifestTaskImages: readonly { readonly reference: string; readonly digest: string }[] | undefined;
  let manifestImageDigest: string | undefined;
  if (args.experimentManifestPath !== undefined) {
    const experiment = validateFeedbackExperimentManifest(JSON.parse(await readFile(args.experimentManifestPath, 'utf8')) as unknown);
    if (experiment._tag === 'Err') throw new Error(`BLOCKED: ${experiment.error.path}: ${experiment.error.message}`);
    experimentManifest = experiment.value;
    manifestTaskImages = experiment.value.taskImages;
    manifestImageDigest = experiment.value.imageDigest;
  }
  const effectiveImageDigest = args.imageDigest ?? manifestImageDigest;
  const imageBindingFailures = validateFeedbackImageOverride(
    args.imageDigest,
    manifestImageDigest,
    manifestTaskImages ?? [],
  );
  const harborJobs = await harborJobIdentity(args.nativeJobPath, args.aceJobPath);
  const source = sourceCheckout();
  const currentSourceCommit = source.commit;
  const checks: Record<string, PreflightCheck> = {
    sourceCheckout: source.check,
    runtimeProvenance: await compiledRuntime(),
    node: command('node', ['--version']),
    npm: command('npm', ['--version']),
    astGrep: command('./node_modules/.bin/ast-grep', ['--version']),
    typescriptLanguageServer: command('./node_modules/.bin/typescript-language-server', ['--version']),
    harbor: command('harbor', ['--version']),
    harborRun: command('harbor', ['run', '--help']),
    harborDatasets: command('harbor', ['datasets', 'list']),
    harborDatasetPinned: harborDataset(datasetId),
    hermesCodexAuth: await hermesCodexAuth(),
    bifrostEndpoint: hermesBifrostEndpoint(experimentManifest?.bifrostEndpointSha256),
    providerTokenWindow: {
      // Unknown provider-native telemetry is NOT a route or model admission
      // failure. Full task-economics acceptance must still report UNKNOWN.
      status: 'unknown',
      reason: 'provider-native counter and context window have no independently certified values; economics remain UNKNOWN',
    },
    docker: command('docker', ['--version']),
    harborJobs: harborJobs.check,
    taskVerifier: await taskVerifier(args.nativeJobPath),
    harborImageDigest: dockerImages(effectiveImageDigest, manifestTaskImages),
    aceRuntimeBundle: await aceRuntimeBundle(args.aceRuntimeBundlePath, experimentManifest?.aceRuntimeBundleSha256),
  };
  const localChainEvidence = await readLocalNativeChainEvidence(args.localNativeChainEvidencePath, resolve('.'));
  const harborVersion = checks.harbor.identity;
  if (experimentManifest === undefined) {
    checks.experimentBinding = { status: 'not_ready', reason: 'experiment manifest is required for exact-current feedback preflight' };
  } else if (harborJobs.identity === undefined || harborVersion === undefined) {
    checks.experimentBinding = { status: 'not_ready', reason: 'experiment identity cannot be bound until Harbor jobs/version are ready' };
  } else {
    const failures = [
      ...validateFeedbackPreflightBinding({
        currentSourceCommit,
        actualHarborVersion: harborVersion,
        expectedAuthenticationRoute: hermesCodexAuthenticationRoute,
        jobAgent: harborJobs.identity.agent,
        jobAgentVersion: harborJobs.identity.agentVersion,
        jobModel: harborJobs.identity.model,
        jobReasoningEffort: harborJobs.identity.reasoningEffort,
        actualBifrostEndpointSha256: checks.bifrostEndpoint.identity,
        jobBifrostEndpointSha256: harborJobs.identity.bifrostEndpointSha256,
        experiment: experimentManifest,
      }),
      ...imageBindingFailures,
    ];
    checks.experimentBinding = failures.length === 0
      ? { status: 'ready', reason: 'experiment identity matches checkout, Harbor jobs/version, Bifröst endpoint, image provenance and OAuth route' }
      : { status: 'not_ready', reason: `experiment identity mismatch: ${[...new Set(failures)].join(', ')}` };
  }
  // Resolve single-image legacy experiments through the verified bundle's
  // explicit image reference; never invent a tag from a content digest.
  let probeImages = manifestTaskImages;
  if (probeImages?.length === 0 && effectiveImageDigest !== undefined
    && args.aceRuntimeBundlePath !== undefined && checks.aceRuntimeBundle.status === 'ready') {
    const manifest = JSON.parse(await readFile(resolve(args.aceRuntimeBundlePath, 'runtime-manifest.json'), 'utf8')) as {
      readonly taskImages: readonly { readonly reference: string; readonly digest: string }[];
    };
    probeImages = manifest.taskImages.length === 1 && manifest.taskImages[0]?.digest === effectiveImageDigest
      ? manifest.taskImages : [];
  }
  checks.nativeTaskProjection = nativeTaskProjection(
    args.aceRuntimeBundlePath, experimentManifest?.aceRuntimeBundleSha256, currentSourceCommit, probeImages,
    [checks.sourceCheckout, checks.runtimeProvenance, checks.aceRuntimeBundle, checks.harborImageDigest, checks.experimentBinding],
  );
  checks.agentRuntimeDigest = await agentRuntimeDigestCheck(
    experimentManifest, args.aceRuntimeBundlePath, currentSourceCommit, probeImages,
    [checks.sourceCheckout, checks.runtimeProvenance, checks.aceRuntimeBundle, checks.harborImageDigest, checks.experimentBinding, checks.bifrostEndpoint],
  );
  checks.taskRuntimeProbe = assessTaskRuntimeProbe({
    sourceCommit: currentSourceCommit,
    bundleSha256: experimentManifest?.aceRuntimeBundleSha256,
    endpointSha256: experimentManifest?.bifrostEndpointSha256,
    modelSha256: experimentManifest?.model.startsWith(feedbackHermesProviderPrefix)
      ? sha256(experimentManifest.model.slice(feedbackHermesProviderPrefix.length)) : undefined,
    reasoningEffort: experimentManifest?.reasoningEffort,
    taskImages: probeImages,
    taskImageStatus: checks.harborImageDigest.status,
    aceBundleStatus: checks.aceRuntimeBundle.status,
    nativeProjectionStatus: checks.nativeTaskProjection.status,
    hermesRuntimeStatus: checks.agentRuntimeDigest.status,
    hermesRuntimeReceipts: checks.agentRuntimeDigest.hermesRuntimeReceipts ?? [],
    localChainEvidenceStatus: localChainEvidence.status,
    localChainEvidence: localChainEvidence.evidence,
    expectedRuntimeSha256: checks.runtimeProvenance.status === 'ready'
      && checks.runtimeProvenance.identity?.startsWith(`${currentSourceCommit}:`) === true
      ? checks.runtimeProvenance.identity.slice(currentSourceCommit.length + 1) : undefined,
  });
  const required = [
    'sourceCheckout', 'runtimeProvenance', 'node', 'npm', 'astGrep', 'typescriptLanguageServer',
    'harbor', 'harborRun', 'harborDatasetPinned',
    'hermesCodexAuth', 'bifrostEndpoint', 'docker', 'harborJobs', 'harborImageDigest', 'agentRuntimeDigest', 'aceRuntimeBundle', 'nativeTaskProjection', 'taskRuntimeProbe', 'experimentBinding',
    'taskVerifier',
  ];
  const blocked = required.filter((name) => !['ready', 'not_required'].includes(checks[name]?.status ?? 'not_ready'));
  const manifest: PreflightManifest = {
    schemaVersion: 2,
    status: blocked.length === 0 ? 'READY' : 'BLOCKED',
    generatedAt: new Date().toISOString(),
    sourceCommit: currentSourceCommit,
    runtimeRoot: resolve('.'),
    authenticationRoute: hermesCodexAuthenticationRoute,
    checks,
    ...(blocked.length === 0 && harborJobs.identity !== undefined && (effectiveImageDigest !== undefined || manifestTaskImages !== undefined)
      ? {
        runtime: {
          agent: harborJobs.identity.agent,
          agentVersion: harborJobs.identity.agentVersion,
          model: harborJobs.identity.model,
          reasoningEffort: harborJobs.identity.reasoningEffort,
          ...(harborJobs.identity.bifrostEndpointSha256 === undefined
            ? {} : { bifrostEndpointSha256: harborJobs.identity.bifrostEndpointSha256 }),
          harborVersion: checks.harbor.identity ?? 'unknown',
          ...(effectiveImageDigest === undefined ? {} : { imageDigest: effectiveImageDigest }),
          ...(manifestTaskImages === undefined ? {} : { taskImages: manifestTaskImages }),
          mode: 'cold' as const,
          nConcurrentTrials: 1 as const,
          nAttempts: 1 as const,
          authenticationRoute: hermesCodexAuthenticationRoute,
        },
      }
      : {}),
  };
  await mkdir(args.outputDirectory, { recursive: true });
  await writeFile(resolve(args.outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({
    status: manifest.status,
    blocked,
    output: resolve(args.outputDirectory, 'manifest.json'),
    manifestSha256: sha256(`${JSON.stringify(manifest, null, 2)}\n`),
  })}\n`);
  if (blocked.length > 0) process.exitCode = 2;
};

await main();
