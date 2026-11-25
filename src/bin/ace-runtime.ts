#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import { makeFileAuditSink } from '../adapters/file-audit-sink.js';
import { makeGitHistoryPort } from '../adapters/git-history.js';
import { makeFetchHttpPort } from '../adapters/http-provider-boundaries.js';
import { buildLocalCodeIndex, type LocalCodeIndexBuild } from '../adapters/local-code-index.js';
import { makeNodeWorkspacePort } from '../adapters/node-workspace-port.js';
import { makeFileProviderTrace } from '../adapters/provider-trace.js';
import { makeFileRetrievalBenchmarkTrace } from '../adapters/retrieval-benchmark-trace.js';
import { makeNativeCbmContextProvider, type NativeCbmContextConfig } from '../adapters/native-cbm-context-provider.js';
import { makeCodebaseMemoryStructuralPort } from '../adapters/codebase-memory-structural.js';
import { makeCodebaseMemoryGraph } from '../adapters/codebase-memory-graph.js';
import { makeVertexRagRetrievalPort } from '../adapters/vertex-rag.js';
import { makeFileWorkspaceStore } from '../adapters/file-workspace-store.js';
import { defaultLocalPolicy, type DataClass } from '../domain/policy.js';
import { workingContextFromSnapshot, type WorkspaceId, type WorkspaceSnapshot } from '../domain/workspace.js';
import { nativeCodeRetrieval, type CodeCandidate } from '../domain/retrieval.js';
import type { RetrievalBenchmarkTraceSink } from '../domain/retrieval-benchmark.js';
import {
  workspaceManifestFromSnapshot,
  workspaceManifestEqual,
  type WorkspaceManifest,
} from '../domain/workspace-manifest.js';
import { observeWorkspace, registerWorkspace } from '../application/workspace-service.js';
import {
  candidateMembershipByPath,
  makeWorkspaceSync,
  type WorkspaceSyncState,
} from '../application/workspace-sync.js';
import { verifyCompiledRuntimeProvenance } from '../application/runtime-provenance.js';
import { makeContextTransformService } from '../application/context-transform-service.js';
import { makeContextAssembler } from '../application/context-assembler.js';
import { makeGatewayAttemptAuthorizationService } from '../application/gateway-attempt-authorization-service.js';
import { validateNativeResponsesStreamingRoutes } from '../application/gateway-security-contract.js';
import { makeRoutedLspSession } from '../application/lsp/routed-semantic.js';
import { makeResponsesProjectionService } from '../application/responses-projection-service.js';
import { runContextRpcHttp } from '../transport/context-rpc-http.js';

const required = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) throw new Error(`${name} is required`);
  return value.trim();
};

const optionalPath = (value: string | undefined, fallback: string): string =>
  resolve(value === undefined || value.trim().length === 0 ? fallback : value.trim());

const configuredStringArray = (name: string, fallback: readonly string[]): readonly string[] => {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw.length === 0) return fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`${name} must be a JSON array of strings`, { cause });
  }
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error(`${name} must be a JSON array of strings`);
  }
  return parsed;
};

const configuredStringArrayMap = (name: string): Readonly<Record<string, readonly string[]>> => {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw.length === 0) return Object.freeze(Object.create(null) as Record<string, readonly string[]>);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`${name} must be a JSON object mapping providers to model arrays`, { cause });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${name} must be a JSON object mapping providers to model arrays`);
  }
  const result = Object.create(null) as Record<string, readonly string[]>;
  for (const [rawProvider, rawModels] of Object.entries(parsed)) {
    const provider = rawProvider.trim().toLowerCase();
    if (!provider || Object.prototype.hasOwnProperty.call(result, provider)
      || !Array.isArray(rawModels)
      || !rawModels.every((model) => typeof model === 'string' && model.trim().length > 0)) {
      throw new Error(`${name} must map unique provider names to non-empty model ID arrays`);
    }
    result[provider] = Object.freeze(rawModels.map((model: string) => model.trim()));
  }
  return Object.freeze(result);
};

const configuredNativeResponsesStreamingRoutes = (name: string) => {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw.length === 0) return validateNativeResponsesStreamingRoutes([]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new Error(`${name} must be a JSON array of exact provider/model/destination routes`, { cause });
  }
  return validateNativeResponsesStreamingRoutes(parsed);
};

const gcloudAccessToken = (): string | undefined => {
  try {
    const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return token.length === 0 ? undefined : token;
  } catch {
    return undefined;
  }
};

const makeDocumentationProvider = (
  workspaceId: WorkspaceId,
  http: ReturnType<typeof makeFetchHttpPort>,
  providerTrace: ReturnType<typeof makeFileProviderTrace>,
) => {
  const project = process.env.ACE_VERTEX_PROJECT?.trim();
  const corpusId = process.env.ACE_VERTEX_CORPUS_ID?.trim();
  if (process.env.ACE_ENABLE_VERTEX !== 'true' || project === undefined || corpusId === undefined) return undefined;
  const cloudOptIn = process.env.ACE_CLOUD_DOCS_OPT_IN === 'true';
  const policy = {
    ...defaultLocalPolicy(workspaceId),
    cloudOptIn,
    allowedCloudProviders: cloudOptIn ? ['vertex'] as const : [],
    allowedCloudDataClassesByProvider: cloudOptIn
      ? { vertex: ['project_document'] as const }
      : {},
  };
  return makeVertexRagRetrievalPort({
    project,
    location: process.env.ACE_VERTEX_LOCATION?.trim() || 'europe-west4',
    corpusId,
    accessToken: gcloudAccessToken,
    policy,
    http,
    trace: providerTrace,
    providerVersion: process.env.ACE_VERTEX_PROVIDER_VERSION?.trim() || 'vertex-rag/v1beta1',
  });
};

const main = async (): Promise<void> => {
  // Legacy Graphiti agent-tool transport is retired. Reject an explicitly
  // unsupported memory configuration before workspace registration/indexing.
  // Normal code-only Gateway startup remains unaffected when it is disabled.
  if (process.env.ACE_ENABLE_GRAPHITI === 'true') {
    throw new Error('Legacy Graphiti tool-server adapter has been retired; Gateway-native memory provider is not configured');
  }
  const sourceRuntime = /[\\/]src[\\/]/u.test(fileURLToPath(import.meta.url));
  const runtimeRoot = resolve(
    process.env.ACE_RUNTIME_ROOT?.trim() || resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  );
  let verifiedRuntimeCommit: string | undefined;
  if (sourceRuntime) {
    if (process.env.ACE_ALLOW_SOURCE_RUNTIME !== 'true') {
      throw new Error('source ACE runtime requires explicit ACE_ALLOW_SOURCE_RUNTIME=true; compiled dist provenance is mandatory otherwise');
    }
    process.stderr.write('ace-runtime source runtime explicitly allowed for development/test; compiled provenance was not used\n');
  } else {
    const provenance = await verifyCompiledRuntimeProvenance(runtimeRoot, fileURLToPath(import.meta.url));
    if (provenance._tag === 'Err') throw new Error(`${provenance.error.code}: ${provenance.error.message}`);
    verifiedRuntimeCommit = provenance.value.sourceCommit;
    process.stderr.write(`ace-runtime runtime provenance runtime_id=${provenance.value.runtimeId} source_commit=${provenance.value.sourceCommit} source_manifest_sha256=${provenance.value.sourceManifestSha256} executable_sha256=${provenance.value.executableSha256} runtime_root=${runtimeRoot} node=${process.version} build_node=${provenance.value.buildRuntime.node}\n`);
    process.stderr.write('ace-runtime provider identities codebase_memory=codebase-memory-mcp/0.12.1 lsp=not_configured\n');
  }
  // Transitional false/disabled values are allowed for existing native deployments;
  // any attempted legacy mode or remote helper is rejected before source access.
  if ((process.env.ACE_CODE_RETRIEVAL_MODE?.trim() || 'cbm') !== 'cbm'
    || (process.env.ACE_ENABLE_EXPERIMENTAL_QDRANT?.trim() || 'false') !== 'false'
    || (process.env.ACE_RERANKER_MODE?.trim() || 'disabled') !== 'disabled') {
    throw new Error('Only native CBM code retrieval is supported');
  }
  if (process.env.ACE_WORKTREE_HELPER_URL?.trim()) {
    throw new Error('Native CBM requires an ACE-local workspace; remote helper topology is not accepted');
  }
  if (process.env.ACE_TEST_FAILPOINT?.trim() || process.env.ACE_ENABLE_TEST_FAILPOINTS === 'true') {
    throw new Error('Retired vector runtime test failpoints are unsupported');
  }
  const rootPath = resolve(required('ACE_WORKSPACE_ROOT'));
  const allowedRoots = (process.env.ACE_ALLOWED_ROOTS ?? rootPath)
    .split(delimiter)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => resolve(value));
  const stateDirectory = optionalPath(process.env.ACE_STATE_DIR, `${homedir()}/.local/state/ace`);
  const configuredWorkspaceId = process.env.ACE_WORKSPACE_ID?.trim();
  const files = makeNodeWorkspacePort({ allowedRoots });
  const workspaceState = resolve(stateDirectory, 'workspaces.json');
  const store = makeFileWorkspaceStore(workspaceState);
  const ports = {
    clock: { nowMs: () => Date.now() },
    ids: { newWorkspaceId: () => configuredWorkspaceId ?? randomUUID(), newRequestId: () => randomUUID() },
    files,
    store,
  };
  const registered = await Effect.runPromise(registerWorkspace(ports, { rootPath }));
  if (registered._tag === 'Err') throw new Error(`${registered.error.code}: ${registered.error.message}`);
  const observed = await Effect.runPromise(observeWorkspace(ports, registered.value.workspaceId));
  if (observed._tag === 'Err') throw new Error(`${observed.error.code}: ${observed.error.message}`);
  const observationEpoch = observed.value.observationEpoch;
  const providerTrace = makeFileProviderTrace(process.env.ACE_PROVIDER_TRACE_FILE);
  const benchmarkTracePath = process.env.ACE_BENCHMARK_TRACE_FILE?.trim();
  const benchmarkRepositoryId = process.env.ACE_BENCHMARK_REPOSITORY_ID?.trim();
  let benchmarkTrace: RetrievalBenchmarkTraceSink | undefined;
  if (benchmarkTracePath !== undefined && benchmarkTracePath.length > 0) {
    const resolvedBenchmarkTracePath = resolve(benchmarkTracePath);
    const declaredCommit = process.env.ACE_EVIDENCE_SOURCE_COMMIT?.trim();
    if (declaredCommit && declaredCommit !== verifiedRuntimeCommit) {
      throw new Error('benchmark source commit must match verified compiled ACE runtime provenance');
    }
    // The indexed workspace HEAD is a corpus revision, not the ACE runtime
    // commit. Development source-runtime traces remain explicitly unbound.
    benchmarkTrace = await makeFileRetrievalBenchmarkTrace(resolvedBenchmarkTracePath, {
      ...(verifiedRuntimeCommit === undefined ? {} : { sourceCommit: verifiedRuntimeCommit }),
      runnerVersion: process.env.ACE_BENCHMARK_RUNNER_VERSION?.trim() || 'ace-harness/0.1.0',
    });
  }
  const history = makeGitHistoryPort({ trace: providerTrace, providerVersion: 'git/cli' });
  let closeCodebaseMemory: (() => Promise<void>) | undefined;
  const scopeFingerprint = process.env.ACE_INDEX_SCOPE_FINGERPRINT?.trim()
    || createHash('sha256').update('ace-scope/default-v1', 'utf8').digest('hex');
  let context: ReturnType<typeof makeNativeCbmContextProvider> | undefined;
  // Provider provenance follows committed workspace publication, not an
  // unobserved default LS from process configuration.
  let activeContextProviderIdentities: Readonly<Record<string, string>> | undefined;
  const cbmStructuralIdentity = nativeCodeRetrieval.providerIdentities.structural;
  {
    const candidateLimit = Number(process.env.ACE_CONTEXT_CANDIDATE_LIMIT ?? '6');
    if (!Number.isSafeInteger(candidateLimit) || candidateLimit < 1 || candidateLimit > 20) {
      throw new Error('ACE_CONTEXT_CANDIDATE_LIMIT must be an integer between 1 and 20');
    }
    const structuralFingerprint = createHash('sha256').update(cbmStructuralIdentity).digest('hex');
    let candidates: readonly CodeCandidate[] = [];
    let latestBuild: LocalCodeIndexBuild | undefined;
    let nativeGeneration = observationEpoch;
    let nativePublished = false;
    const graph = makeCodebaseMemoryGraph({
      rootPath: registered.value.rootPath,
      ...(process.env.ACE_CBM_COMMAND?.trim() ? { command: process.env.ACE_CBM_COMMAND.trim() } : {}),
      trace: providerTrace,
      candidates: () => candidates,
    });
    closeCodebaseMemory = graph.close;
    const structural = makeCodebaseMemoryStructuralPort(graph);
    const documentation = makeDocumentationProvider(registered.value.workspaceId, makeFetchHttpPort(), providerTrace);
    // The current Context RPC requests code only. A separate exact identifier
    // selection/definition contract remains open (#364); do not claim that
    // native line-based outlines provide independent LSP confirmation.
    const semantics = makeRoutedLspSession([]);
    const nativeIdentities = nativeCodeRetrieval.providerIdentities;
    const rebuildNative = async (expected?: WorkspaceManifest, sourceSnapshot?: WorkspaceSnapshot): Promise<Result<NativeCbmContextConfig, DomainError>> => {
      const before = sourceSnapshot === undefined
        ? await Effect.runPromise(files.snapshot(registered.value.rootPath, Date.now()))
        : ok(sourceSnapshot);
      if (before._tag === 'Err') return before;
      const manifest = workspaceManifestFromSnapshot(before.value, scopeFingerprint);
      if (expected !== undefined && !workspaceManifestEqual(manifest, expected)) {
        return err(domainError('WORKTREE_RACED', 'workspace_manifest', 'workspace changed before native CBM reconciliation'));
      }
      // Structural reuse is valid only across a still-owned native session.
      // On transport/generation loss, rebuild even unchanged source outlines.
      if (!nativePublished || !graph.isIndexed()) latestBuild = undefined;
      // Invalidate candidates before any native index mutation. A failed
      // reindex must not reuse previously certified candidate membership.
      nativePublished = false;
      candidates = [];
      const indexed = await Effect.runPromise(graph.reindex());
      if (indexed._tag === 'Err') return indexed;
      nativeGeneration += 1;
      const built = await Effect.runPromise(buildLocalCodeIndex(
        files, registered.value.workspaceId, registered.value.rootPath, {
          generation: nativeGeneration,
          ...(latestBuild === undefined ? {} : { previous: latestBuild }),
          scopeFingerprint, structural, parserVersion: structuralFingerprint,
          snapshot: before.value,
        },
      ));
      if (built._tag === 'Err') return built;
      const after = await Effect.runPromise(files.snapshot(registered.value.rootPath, Date.now()));
      if (after._tag === 'Err') return after;
      if (!workspaceManifestEqual(built.value.workspaceManifest,
        workspaceManifestFromSnapshot(after.value, scopeFingerprint))) {
        return err(domainError('WORKTREE_RACED', 'workspace_manifest', 'workspace changed during native CBM indexing'));
      }
      if (!graph.isIndexed()) {
        return err(domainError('NOT_READY', 'codebase_memory', 'native session lost before publication'));
      }
      latestBuild = built.value;
      candidates = built.value.index.candidates;
      nativePublished = true;
      return ok({
        mode: 'cbm',
        workspaceId: registered.value.workspaceId,
        rootPath: registered.value.rootPath,
        files, semantics, codeGraph: graph, candidateLimit,
        newRequestId: () => randomUUID(),
        generation: nativeGeneration,
        indexKey: createHash('sha256').update(cbmStructuralIdentity).update(manifest.contentIdentity).digest('hex'),
        coverage: built.value.coverage,
        workspaceManifest: built.value.workspaceManifest,
        scopeFingerprint,
        isPublished: () => nativePublished && graph.isIndexed(),
        trace: providerTrace,
        ...(benchmarkTrace === undefined ? {} : { benchmarkTrace }),
        ...(benchmarkRepositoryId === undefined ? {} : { benchmarkRepositoryId }),
        benchmarkProviderIdentities: nativeIdentities,
        history,
        ...(documentation === undefined ? {} : { documentation }),
      });
    };
    const native = await rebuildNative();
    if (native._tag === 'Err') {
      process.stderr.write(`ace-runtime context NOT_READY: native CBM index failed (${native.error.code})\n`);
    } else {
      let published = native.value;
      const syncState = (config: NativeCbmContextConfig): WorkspaceSyncState => ({
        workspaceId: config.workspaceId,
        workspaceManifest: config.workspaceManifest!,
        generation: config.generation!,
        indexKey: config.indexKey!,
        candidateIdsByPath: candidateMembershipByPath(candidates.map((candidate) => ({
          candidate, score: 0, freshness: 'unknown',
        }))),
      });
      const sync = makeWorkspaceSync({
        initial: syncState(published),
        isPublished: () => nativePublished && graph.isIndexed(),
        // Git-diff hints alone do not establish full source membership on
        // reverted dirty files, ignored paths or trust-index flags. Keep exact
        // observation; only changed paths need new structural extraction.
        observeChanges: (current) => Effect.gen(function* () {
          const snapshot = yield* files.snapshot(registered.value.rootPath, Date.now());
          if (snapshot._tag === 'Err') return snapshot;
          const manifest = workspaceManifestFromSnapshot(snapshot.value, scopeFingerprint);
          return ok({
            changed: !workspaceManifestEqual(current.workspaceManifest, manifest)
              || current.workspaceManifest.headRevision !== manifest.headRevision,
            manifest, sourceSnapshot: snapshot.value,
            workingContext: workingContextFromSnapshot(snapshot.value),
          });
        }),
        rebuild: ({ nextManifest, sourceSnapshot }) => Effect.promise(async () => {
          if (sourceSnapshot === undefined) {
            return err(domainError('NOT_READY', 'workspace_sync', 'native rebuild requires an exact observed snapshot'));
          }
          const rebuilt = await rebuildNative(nextManifest, sourceSnapshot);
          if (rebuilt._tag === 'Err') return rebuilt;
          published = rebuilt.value;
          return ok(syncState(published));
        }),
      });
      const reconcileNative: NonNullable<NativeCbmContextConfig['reconcile']> = (manifest) => Effect.sync(() => {
        if (!nativePublished || !graph.isIndexed() || published.workspaceManifest === undefined
          || !workspaceManifestEqual(published.workspaceManifest, manifest)) {
          return err(domainError('NOT_READY', 'workspace_sync', 'native publication does not match synchronized source'));
        }
        return ok({ ...published, workspaceSync: sync, reconcile: reconcileNative });
      });
      const provider = makeNativeCbmContextProvider({ ...published, workspaceSync: sync, reconcile: reconcileNative });
      // Serialize the complete search/reconciliation transaction; no query
      // may read a candidate list while another query mutates the native index.
      const semaphore = await Effect.runPromise(Effect.makeSemaphore(1));
      context = {
        // Interrupt the caller's wait, retire its actual native I/O, then
        // drain the owned transaction in the interrupt finalizer BEFORE
        // releasing the semaphore. The nested promise cannot publish after
        // suspension; subsequent calls cannot dispatch to another child.
        search: (input) => semaphore.withPermits(1)(Effect.suspend(() => {
          graph.resume();
          let pending: Promise<unknown> | undefined;
          const operation = Effect.promise(() => {
            const work = Effect.runPromise(provider.search(input));
            pending = work;
            return work;
          });
          return Effect.onInterrupt(operation, () => Effect.promise(async () => {
            nativePublished = false;
            candidates = [];
            await graph.suspend();
            try { await pending; } catch { /* interrupted transaction cannot deliver */ }
            nativePublished = false;
            candidates = [];
          }));
        })),
      };
      activeContextProviderIdentities = nativeIdentities;
      process.stderr.write('ace-runtime native CBM code retrieval initialized; external vector and embedding providers are not started\n');
    }
  }
  const gatewayAllowedLlmProviders = configuredStringArray('ACE_CONTEXT_ALLOWED_LLM_PROVIDERS_JSON', [])
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider) => provider.length > 0);
  const gatewayAllowedLlmDestinations = configuredStringArray('ACE_CONTEXT_ALLOWED_LLM_DESTINATIONS_JSON', [])
    .map((destination) => destination.trim())
    .filter((destination) => destination.length > 0);
  const gatewayAllowedLlmModelsByProvider = configuredStringArrayMap('ACE_CONTEXT_ALLOWED_LLM_MODELS_BY_PROVIDER_JSON');
  const gatewayAllowedLlmStreamingRoutes = configuredNativeResponsesStreamingRoutes('ACE_CONTEXT_ALLOWED_LLM_STREAMING_ROUTES_JSON');
  for (const route of gatewayAllowedLlmStreamingRoutes) {
    if (!gatewayAllowedLlmProviders.includes(route.provider)
      || !(gatewayAllowedLlmModelsByProvider[route.provider] ?? []).includes(route.model)
      || !gatewayAllowedLlmDestinations.includes(route.destination)) {
      throw new Error('ACE_CONTEXT_ALLOWED_LLM_STREAMING_ROUTES_JSON must be a subset of the provider, model, and destination allowlists');
    }
  }
  const configuredGatewayDataClasses = configuredStringArray('ACE_CONTEXT_ALLOWED_LLM_DATA_CLASSES_JSON', [])
    .map((dataClass) => dataClass.trim());
  const allowedGatewayDataClasses = new Set<Exclude<DataClass, 'secret'>>([
    'private_source', 'private_conversation', 'project_document', 'public',
  ]);
  if (configuredGatewayDataClasses.some((dataClass) => !allowedGatewayDataClasses.has(dataClass as Exclude<DataClass, 'secret'>))) {
    throw new Error('ACE_CONTEXT_ALLOWED_LLM_DATA_CLASSES_JSON contains an unsupported or secret data class');
  }
  const gatewayAllowedLlmDataClasses = [...new Set(configuredGatewayDataClasses)] as Exclude<DataClass, 'secret'>[];
  const gatewayExternalLlmOptIn = process.env.ACE_CONTEXT_EXTERNAL_LLM_OPT_IN === 'true';
  const gatewayPolicy = {
    ...defaultLocalPolicy(registered.value.workspaceId),
    cloudOptIn: gatewayExternalLlmOptIn,
    allowedCloudProviders: gatewayExternalLlmOptIn ? ['other_external'] as const : [],
    allowedCloudDataClassesByProvider: gatewayExternalLlmOptIn
      ? { other_external: gatewayAllowedLlmDataClasses }
      : {},
  };

  const contextBridge = context === undefined
    ? undefined
    : makeContextTransformService({
      ids: ports.ids,
      store,
      context,
      assembler: makeContextAssembler(),
      providerIdentities: () => activeContextProviderIdentities ?? {},
    });
  // The LLM Gateway is the single agent-facing context-delivery owner.
  // There is no model-invoked fallback, even when the provider is not ready.
  if (process.env.ACE_CONTEXT_BRIDGE_MODE === 'true') {
    throw new Error('Direct agent context bridge mode is retired; configure the agent endpoint through Bifrost');
  }
  // Keep the Gateway available for readiness and explicit blocked projection
  // receipts during provider outages. Never turn missing retrieval into an
  // unmodified model request, and never install an optional tool fallback.
  const unavailableContext = {
    transform: () => Effect.succeed(err(domainError(
      'NOT_READY', 'unified_context', 'required context provider is unavailable',
    ))),
  };
  const gatewaySecurity = {
    policy: gatewayPolicy,
    allowedProviders: gatewayAllowedLlmProviders,
    allowedModelsByProvider: gatewayAllowedLlmModelsByProvider,
    allowedDestinations: gatewayAllowedLlmDestinations,
    allowedStreamingRoutes: gatewayAllowedLlmStreamingRoutes,
    // Projection receipts are intentionally process-scoped. After a restart,
    // any in-flight Bifröst attempt fails closed and must prepare again.
    receiptSigningKey: randomBytes(32).toString('base64url'),
    clock: ports.clock,
    audit: makeFileAuditSink(resolve(stateDirectory, 'gateway-policy-audit.jsonl')),
  };
  const contextProvider = contextBridge ?? unavailableContext;
  try {
    const projection = makeResponsesProjectionService(contextProvider, gatewaySecurity, benchmarkTrace?.recordProjection);
    const attemptAuthorization = makeGatewayAttemptAuthorizationService(gatewaySecurity);
    await runContextRpcHttp({
      projectResponses: projection.projectResponses,
      authorizePhysicalSend: attemptAuthorization.authorizePhysicalSend,
    });
  } finally {
    let cleanupError: unknown;
    try {
      if (closeCodebaseMemory !== undefined) await closeCodebaseMemory();
    } catch (error) {
      cleanupError = error;
    } finally {
      try {
        if (benchmarkTrace !== undefined) await benchmarkTrace.close();
      } catch (error) {
        cleanupError ??= error;
      }
    }
    if (cleanupError instanceof Error) throw cleanupError;
    if (cleanupError !== undefined) throw new Error('ACE cleanup failed');
  }
};

try {
  await main();
} catch (error) {
  process.stderr.write(`ace-runtime failed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
  process.exitCode = 1;
}
