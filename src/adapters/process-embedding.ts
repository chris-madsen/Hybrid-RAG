import { createHash } from 'node:crypto';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { ProviderTraceSink, VectorEmbeddingPort } from '../application/ports.js';
import { noopProviderTrace, providerTraceEvent } from './provider-trace.js';

interface EmbeddingResponse {
  readonly id?: unknown;
  readonly vectors?: unknown;
  readonly error?: unknown;
  readonly type?: unknown;
  readonly identity?: unknown;
}

interface PendingRequest {
  readonly expectedCount: number;
  readonly resolve: (result: Result<readonly (readonly number[])[], DomainError>) => void;
  readonly timer: NodeJS.Timeout;
}


interface EmbeddingSession {
  readonly child: ChildProcessWithoutNullStreams;
  readonly pending: Map<number, PendingRequest>;
  readonly readyWaiters: Set<(result: Result<EmbeddingWorkerIdentity, DomainError>) => void>;
  stdoutBuffer: string;
  identity?: Result<EmbeddingWorkerIdentity, DomainError>;
  failure?: DomainError;
  retired: boolean;
}

export interface ResolvedEmbeddingConfig {
  readonly provider: string;
  readonly model: string;
  readonly modelRevision: string;
  readonly artifactModel: string;
  readonly artifactRevision: string;
  /** A pinned SHA-256 or the explicit experimental marker "unverified". */
  readonly artifactDigest: string;
  readonly dimension: number;
  readonly preprocessing: string;
  /** Pinned is an explicit mode, never inferred from a model label. */
  readonly executionMode: 'pinned' | 'experimental-unpinned';
  readonly pinned: boolean;
}

export interface EmbeddingWorkerIdentity extends ResolvedEmbeddingConfig {
  /** Hash of the worker implementation that produced the receipt. */
  readonly runtimeBuild: string;
  /** Runtime/library versions actually reported by the worker. */
  readonly runtimeVersion: string;
}

export const verifiedEmbeddingIdentityFingerprint = (
  identity: EmbeddingWorkerIdentity,
): string => createHash('sha256').update([
  'embedding-identity-v1',
  identity.provider,
  identity.model,
  identity.modelRevision,
  identity.artifactModel,
  identity.artifactRevision,
  identity.artifactDigest,
  String(identity.dimension),
  identity.preprocessing,
  identity.executionMode,
  String(identity.pinned),
  identity.runtimeBuild,
  identity.runtimeVersion,
].join('|'), 'utf8').digest('hex');

export interface ProcessEmbeddingOptions {
  readonly command: string;
  readonly args?: readonly string[];
  readonly dimension: number;
  readonly timeoutMs?: number;
  readonly providerVersion?: string;
  readonly trace?: ProviderTraceSink;
  /** Explicit, non-secret environment supplied to the worker. */
  readonly env?: Readonly<Record<string, string>>;
  /** When present, a verified worker startup receipt is mandatory. */
  readonly expectedIdentity?: ResolvedEmbeddingConfig;
}

export interface ManagedVectorEmbeddingPort extends VectorEmbeddingPort {
  readonly close: () => void;
  readonly probe: () => Effect.Effect<Result<void, DomainError>>;
  readonly identity: () => EmbeddingWorkerIdentity | undefined;
}

const providerError = (message: string): Result<never, DomainError> =>
  err(domainError('UNSUPPORTED_PROVIDER', 'embedding', message));

const responseObject = (value: unknown): EmbeddingResponse | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as EmbeddingResponse
    : undefined;

const nonEmpty = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const parseIdentity = (value: unknown): Result<EmbeddingWorkerIdentity, DomainError> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return err(domainError('INVALID_EXTERNAL_RESPONSE', 'embedding.identity', 'embedding worker identity must be an object'));
  }
  const raw = value as Record<string, unknown>;
  const fields = [
    'provider', 'model', 'modelRevision', 'artifactModel', 'artifactRevision',
    'artifactDigest', 'preprocessing', 'executionMode', 'runtimeBuild', 'runtimeVersion',
  ] as const;
  const executionMode = raw.executionMode;
  if (!fields.every((field) => nonEmpty(raw[field]))
    || typeof raw.dimension !== 'number' || !Number.isSafeInteger(raw.dimension) || raw.dimension < 1
    || !/^[a-f0-9]{64}$/u.test(String(raw.artifactDigest))
    || (executionMode !== 'pinned' && executionMode !== 'experimental-unpinned')
    || typeof raw.pinned !== 'boolean'
    || raw.pinned !== (executionMode === 'pinned')) {
    return err(domainError('INVALID_EXTERNAL_RESPONSE', 'embedding.identity', 'embedding worker returned an invalid effective identity'));
  }
  return ok({
    provider: String(raw.provider),
    model: String(raw.model),
    modelRevision: String(raw.modelRevision),
    artifactModel: String(raw.artifactModel),
    artifactRevision: String(raw.artifactRevision),
    artifactDigest: String(raw.artifactDigest),
    dimension: raw.dimension,
    preprocessing: String(raw.preprocessing),
    executionMode,
    pinned: raw.pinned,
    runtimeBuild: String(raw.runtimeBuild),
    runtimeVersion: String(raw.runtimeVersion),
  });
};

const compareIdentity = (
  expected: ResolvedEmbeddingConfig,
  actual: EmbeddingWorkerIdentity,
): Result<EmbeddingWorkerIdentity, DomainError> => {
  const comparisons: Array<readonly [string, string | number | boolean, string | number | boolean]> = [
    ['provider', expected.provider, actual.provider],
    ['model', expected.model, actual.model],
    ['modelRevision', expected.modelRevision, actual.modelRevision],
    ['artifactModel', expected.artifactModel, actual.artifactModel],
    ['artifactRevision', expected.artifactRevision, actual.artifactRevision],
    ['dimension', expected.dimension, actual.dimension],
    ['preprocessing', expected.preprocessing, actual.preprocessing],
    ['executionMode', expected.executionMode, actual.executionMode],
    ['pinned', expected.pinned, actual.pinned],
  ];
  if (expected.artifactDigest !== 'unverified') {
    comparisons.push(['artifactDigest', expected.artifactDigest, actual.artifactDigest]);
  }
  const mismatch = comparisons.find(([, wanted, observed]) => wanted !== observed);
  return mismatch === undefined
    ? ok(actual)
    : err(domainError(
      'INVALID_EXTERNAL_RESPONSE',
      'embedding.identity',
      `embedding worker identity mismatch for ${mismatch[0]}`,
    ));
};

const vectorsFromResponse = (
  value: EmbeddingResponse,
  expectedCount: number,
  dimension: number,
): Result<readonly (readonly number[])[], DomainError> => {
  if (!Array.isArray(value.vectors) || value.vectors.length !== expectedCount) {
    return err(domainError('INVALID_EXTERNAL_RESPONSE', 'embedding.vectors', 'embedding worker returned an invalid batch size'));
  }
  const vectors: number[][] = [];
  for (const [index, rawVector] of value.vectors.entries()) {
    if (!Array.isArray(rawVector) || rawVector.length !== dimension
      || !rawVector.every((item) => typeof item === 'number' && Number.isFinite(item))) {
      return err(domainError('INVALID_EXTERNAL_RESPONSE', `embedding.vectors[${index}]`, 'embedding vector has invalid dimensions or values'));
    }
    vectors.push([...rawVector]);
  }
  return ok(vectors);
};

const safeInheritedEnvironment = (): NodeJS.ProcessEnv => {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'XDG_CACHE_HOME'];
  return Object.fromEntries(allowed.flatMap((key) => process.env[key] === undefined ? [] : [[key, process.env[key] as string]]));
};

const allowedWorkerEnvironment = new Set([
  'ACE_EMBEDDING_PROVIDER',
  'ACE_EMBEDDING_MODEL',
  'ACE_EMBEDDING_MODEL_REVISION',
  'ACE_EMBEDDING_ARTIFACT_MODEL',
  'ACE_EMBEDDING_ARTIFACT_REVISION',
  'ACE_EMBEDDING_ARTIFACT_DIGEST',
  'ACE_EMBEDDING_DIMENSION',
  'ACE_EMBEDDING_PREPROCESSING',
  'ACE_EMBEDDING_EXECUTION_MODE',
  'ACE_EMBEDDING_PINNED',
  'ACE_EMBEDDING_PYTHON',
  'ACE_EMBEDDING_LD_LIBRARY_PATH',
  'ACE_EMBEDDING_DELAY_MS',
  'FASTEMBED_CACHE_PATH',
  'HF_HOME',
  'HF_HUB_CACHE',
]);

const controlledWorkerEnvironment = (
  environment: Readonly<Record<string, string>> | undefined,
): NodeJS.ProcessEnv => Object.fromEntries(
  Object.entries(environment ?? {}).filter(([key]) => allowedWorkerEnvironment.has(key)),
);

/**
 * Long-lived maintained embedding runtime with an optional mandatory startup
 * receipt. The parent never infers effective model identity from labels alone.
 */
export const makeProcessEmbeddingPort = (options: ProcessEmbeddingOptions): ManagedVectorEmbeddingPort => {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const environment = { ...safeInheritedEnvironment(), ...controlledWorkerEnvironment(options.env) };
  const args = [...(options.args ?? [])];
  let activeSession: EmbeddingSession | undefined;
  let closed = false;
  let nextId = 1;
  let initialIdentityFingerprint: string | undefined;

  const settleIdentity = (
    session: EmbeddingSession,
    result: Result<EmbeddingWorkerIdentity, DomainError>,
  ): void => {
    if (session.identity !== undefined) return;
    session.identity = result;
    for (const waiter of [...session.readyWaiters]) waiter(result);
    session.readyWaiters.clear();
  };

  const failSession = (session: EmbeddingSession, error: DomainError): void => {
    if (session.failure !== undefined) return;
    session.failure = error;
    settleIdentity(session, err(error));
    const requests = [...session.pending.values()];
    session.pending.clear();
    for (const request of requests) {
      clearTimeout(request.timer);
      request.resolve(err(error));
    }
  };

  // A timed-out inference cannot be removed from Python's serial stdin loop.
  // Retire its entire session, including queued requests, before accepting
  // another request. Old stdout frames cannot be associated with a new session.
  const retireSession = (session: EmbeddingSession, error: DomainError): void => {
    if (activeSession === session) activeSession = undefined;
    failSession(session, error);
    if (session.retired) return;
    session.retired = true;
    const child = session.child;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const hardKill = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }, 250);
    hardKill.unref();
    child.once('exit', () => clearTimeout(hardKill));
    try { child.kill('SIGTERM'); } catch { /* spawn may have already failed */ }
  };

  const startSession = (): EmbeddingSession => {
    const child = spawn(options.command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: environment,
    });
    const session: EmbeddingSession = {
      child,
      pending: new Map(),
      readyWaiters: new Set(),
      stdoutBuffer: '',
      retired: false,
    };
    child.stdout.on('data', (chunk: Buffer) => {
      if (activeSession !== session || session.retired) return;
      session.stdoutBuffer += chunk.toString('utf8');
      let newline = session.stdoutBuffer.indexOf('\n');
      while (newline >= 0 && !session.retired) {
        const line = session.stdoutBuffer.slice(0, newline);
        session.stdoutBuffer = session.stdoutBuffer.slice(newline + 1);
        newline = session.stdoutBuffer.indexOf('\n');
        if (line.trim().length === 0) continue;
        let decoded: unknown;
        try {
          decoded = JSON.parse(line) as unknown;
        } catch {
          retireSession(session, domainError('INVALID_EXTERNAL_RESPONSE', 'embedding', 'embedding worker returned invalid JSON'));
          return;
        }
        const response = responseObject(decoded);
        if (response?.type === 'ready') {
          const parsed = parseIdentity(response.identity);
          const checked = parsed._tag === 'Err' || options.expectedIdentity === undefined
            ? parsed
            : compareIdentity(options.expectedIdentity, parsed.value);
          if (checked._tag === 'Err') {
            retireSession(session, checked.error);
            return;
          }
          const fingerprint = verifiedEmbeddingIdentityFingerprint(checked.value);
          if (initialIdentityFingerprint !== undefined && fingerprint !== initialIdentityFingerprint) {
            retireSession(session, domainError(
              'INVALID_EXTERNAL_RESPONSE',
              'embedding.identity',
              'embedding worker runtime identity changed after restart',
            ));
            return;
          }
          if (session.identity !== undefined) {
            retireSession(session, domainError('INVALID_EXTERNAL_RESPONSE', 'embedding.identity', 'duplicate worker startup receipt'));
            return;
          }
          initialIdentityFingerprint = fingerprint;
          settleIdentity(session, checked);
          continue;
        }
        const id = response?.id;
        if (response === undefined || typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) {
          retireSession(session, domainError('INVALID_EXTERNAL_RESPONSE', 'embedding', 'embedding worker response id is invalid'));
          return;
        }
        const request = session.pending.get(id);
        if (request === undefined) {
          // Ignore an unsolicited/expired frame; it must never satisfy another ID.
          continue;
        }
        request.resolve(typeof response.error === 'string'
          ? providerError(response.error)
          : vectorsFromResponse(response, request.expectedCount, options.dimension));
      }
    });
    child.stderr.on('data', () => undefined);
    child.on('error', () => retireSession(
      session,
      domainError('UNSUPPORTED_PROVIDER', 'embedding', 'embedding worker failed to start'),
    ));
    child.on('exit', (code) => {
      if (activeSession === session) {
        retireSession(session, domainError(
          'UNSUPPORTED_PROVIDER',
          'embedding',
          'embedding worker exited with code ' + (code ?? 'unknown'),
        ));
      }
    });
    return session;
  };

  const ensureSession = (): EmbeddingSession | undefined => {
    if (closed) return undefined;
    if (activeSession === undefined) activeSession = startSession();
    return activeSession;
  };

  // Preserve eager startup/probe behavior of the original managed port.
  activeSession = startSession();

  const awaitIdentity = (session: EmbeddingSession): Effect.Effect<Result<EmbeddingWorkerIdentity | undefined, DomainError>> => {
    if (session.failure !== undefined) return Effect.succeed(err(session.failure));
    if (options.expectedIdentity === undefined) return Effect.succeed(ok(undefined));
    if (session.identity !== undefined) return Effect.succeed(session.identity);
    return Effect.async((resume, signal) => {
      let finished = false;
      const finish = (result: Result<EmbeddingWorkerIdentity, DomainError>): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        session.readyWaiters.delete(finish);
        signal.removeEventListener('abort', onAbort);
        resume(Effect.succeed(result));
      };
      const onAbort = (): void => retireSession(session, domainError(
        'EXTERNAL_UNAVAILABLE', 'embedding.identity', 'embedding worker startup was cancelled',
      ));
      const timer = setTimeout(() => retireSession(session, domainError(
        'EXTERNAL_UNAVAILABLE', 'embedding.identity', 'embedding worker startup receipt timed out',
      )), timeoutMs);
      session.readyWaiters.add(finish);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
      if (session.identity !== undefined) finish(session.identity);
      else if (session.failure !== undefined) finish(err(session.failure));
    });
  };

  const issueEmbedding = (
    session: EmbeddingSession,
    input: readonly string[],
  ): Effect.Effect<Result<readonly (readonly number[])[], DomainError>> => Effect.async((resume, signal) => {
    if (input.length === 0 || input.some((text) => text.trim().length === 0)) {
      resume(Effect.succeed(err(domainError('INVALID_INPUT', 'embedding_text', 'embedding input must contain non-empty text'))));
      return;
    }
    if (session !== activeSession || session.failure !== undefined || session.child.stdin.destroyed) {
      resume(Effect.succeed(err(session.failure ?? domainError(
        'EXTERNAL_UNAVAILABLE', 'embedding', 'embedding worker is unavailable',
      ))));
      return;
    }
    if (!Number.isSafeInteger(nextId)) {
      retireSession(session, domainError('EXTERNAL_UNAVAILABLE', 'embedding', 'embedding request ID exhausted'));
      resume(Effect.succeed(err(domainError('EXTERNAL_UNAVAILABLE', 'embedding', 'embedding request ID exhausted'))));
      return;
    }
    const id = nextId;
    nextId += 1;
    let finished = false;
    const finish = (result: Result<readonly (readonly number[])[], DomainError>): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      session.pending.delete(id);
      signal.removeEventListener('abort', onAbort);
      resume(Effect.succeed(result));
    };
    const onAbort = (): void => retireSession(session, domainError(
      'EXTERNAL_UNAVAILABLE', 'embedding', 'embedding request was cancelled',
    ));
    const timer = setTimeout(() => retireSession(session, domainError(
      'EXTERNAL_UNAVAILABLE', 'embedding', 'embedding worker timed out',
    )), timeoutMs);
    session.pending.set(id, { expectedCount: input.length, timer, resolve: finish });
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    session.child.stdin.write(JSON.stringify({ id, texts: input }) + '\n', (error) => {
      if (error !== undefined && error !== null && session.pending.has(id)) {
        retireSession(session, domainError('EXTERNAL_UNAVAILABLE', 'embedding', 'embedding worker write failed'));
      }
    });
  });

  const embedMany = (
    input: readonly string[],
    requestId?: string,
  ): Effect.Effect<Result<readonly (readonly number[])[], DomainError>> => {
    const startedAtMs = Date.now();
    const operation = Effect.gen(function* () {
      const session = ensureSession();
      if (session === undefined) {
        return { session, result: err(domainError('EXTERNAL_UNAVAILABLE', 'embedding', 'embedding worker closed')) };
      }
      const ready = yield* awaitIdentity(session);
      const result = ready._tag === 'Err' ? ready : yield* issueEmbedding(session, input);
      return { session, result };
    });
    return Effect.map(operation, ({ session, result }) => {
      const identity = session?.identity?._tag === 'Ok' ? session.identity.value : undefined;
      providerTraceEvent(options.trace ?? noopProviderTrace, {
        provider: 'embedding',
        providerVersion: identity === undefined
          ? options.providerVersion ?? 'process-worker/unknown'
          : [
            identity.provider,
            'model=' + identity.model + '@' + identity.modelRevision,
            'artifact=' + identity.artifactModel + '@' + identity.artifactRevision + '#' + identity.artifactDigest,
            'mode=' + identity.executionMode,
            'runtime=' + identity.runtimeBuild + '@' + identity.runtimeVersion,
          ].join('|'),
        operation: 'embed_many',
        status: result._tag === 'Ok' ? 'success' : 'failure',
        durationMs: Math.max(0, Date.now() - startedAtMs),
        vectorDimension: options.dimension,
        ...(requestId === undefined ? {} : { requestId }),
        ...(result._tag === 'Err' ? { errorCode: result.error.code } : {}),
      });
      return result;
    });
  };

  const probe = (): Effect.Effect<Result<void, DomainError>> => Effect.gen(function* () {
    const session = ensureSession();
    if (session === undefined) return err(domainError('EXTERNAL_UNAVAILABLE', 'embedding', 'embedding worker closed'));
    const ready = yield* awaitIdentity(session);
    if (ready._tag === 'Err') return ready;
    const result = yield* issueEmbedding(session, ['ace_embedding_provider_probe']);
    return result._tag === 'Err' ? result : ok(undefined);
  });

  const close = (): void => {
    if (closed) return;
    closed = true;
    if (activeSession !== undefined) {
      retireSession(activeSession, domainError('EXTERNAL_UNAVAILABLE', 'embedding', 'embedding worker closed'));
    }
  };

  return {
    embedMany,
    close,
    probe,
    identity: () => activeSession?.identity?._tag === 'Ok' ? activeSession.identity.value : undefined,
  };
};
