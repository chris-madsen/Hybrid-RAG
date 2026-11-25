import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { accessSync, constants, realpathSync } from 'node:fs';
import { basename, delimiter, dirname, isAbsolute, join, resolve, sep } from 'node:path';
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
  type MessageConnection,
} from 'vscode-jsonrpc/node';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { ProviderTraceSink } from '../application/ports.js';

/**
 * Application-owned, long-lived Codebase Memory stdio session.
 *
 * This is an INTERNAL provider transport. Its tool calls are selected by ACE
 * application code; no tool registry, prompt, or provider operation is ever
 * forwarded to Hermes, Bifrost, or a model. vscode-jsonrpc owns framing and
 * request correlation; we only implement the upstream session/tool contract.
 *
 * Upstream: DeusData/codebase-memory-mcp v0.12.1 (native stdio server).
 */
export interface CodebaseMemoryStdioOptions {
  readonly rootPath: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly timeoutMs?: number;
  /** Optional safe provider evidence; never receives tool arguments or results. */
  readonly trace?: ProviderTraceSink;
  /** Invalidate ACE's published graph identity on transport loss. */
  readonly onLost?: () => void;
}

export interface CodebaseMemoryStdio {
  readonly invoke: (tool: string, args: Readonly<Record<string, unknown>>, requestId?: string) => Promise<Result<unknown, DomainError>>;
  /** Suspend dispatch until the cancelled transaction has settled. */
  readonly suspend: () => Promise<void>;
  readonly resume: () => void;
  readonly close: () => Promise<void>;
}

interface Session {
  readonly child: ChildProcessWithoutNullStreams;
  readonly connection: MessageConnection;
  readonly exitHook: () => void;
  dead: boolean;
}

const expectedVersion = '0.12.1';
const protocolVersion = '2025-03-26';
const permitted = new Set([
  'index_repository', 'get_file_outline', 'search_graph',
  'trace_path', 'query_graph', 'detect_changes',
]);

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;

const deadline = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('provider operation exceeded deadline')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
};

/** Only CBM's structured JSON responses are admissible to the existing parsers. */
export const parseCodebaseMemoryToolResult = (value: unknown): Result<unknown, DomainError> => {
  const envelope = record(value);
  if (envelope === undefined || envelope.isError !== false) {
    return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'native provider rejected the operation'));
  }
  const structured = record(envelope.structuredContent);
  if (structured !== undefined) {
    if (structured.error !== undefined) {
      return err(domainError('UNSUPPORTED_PROVIDER', 'codebase_memory', 'native provider returned an error payload'));
    }
    return ok(structured);
  }
  const content = envelope.content;
  if (!Array.isArray(content) || content.length !== 1) {
    return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory', 'native provider returned no JSON result'));
  }
  const first = record(content[0]);
  if (first?.type !== 'text' || typeof first.text !== 'string') {
    return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory', 'native provider returned non-text content'));
  }
  try {
    const parsed: unknown = JSON.parse(first.text);
    const output = record(parsed);
    if (output === undefined || output.error !== undefined || output.isError === true) {
      return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory', 'invalid native JSON result'));
    }
    return ok(output);
  } catch {
    return err(domainError('INVALID_EXTERNAL_RESPONSE', 'codebase_memory', 'native provider returned invalid JSON'));
  }
};

/** The upstream npm shim uses spawnSync and is not the native process owner.
 * Resolve its documented installed binary directly, without invoking its
 * on-demand downloader. Ordinary native installs and explicit fixture
 * executables retain their path. The initialize handshake still pins identity.
 */
export const resolveCodebaseMemoryCommand = (command: string): string => {
  const locations = isAbsolute(command) || command.includes(sep)
    ? [resolve(command)]
    : (process.env.PATH ?? '').split(delimiter).filter(Boolean).map((directory) => join(directory, command));
  for (const location of locations) {
    try {
      accessSync(location, constants.X_OK);
      const actual = realpathSync(location);
      if (basename(actual) === 'bin.js' && basename(dirname(actual)) === 'codebase-memory-mcp') {
        // Return the binary path even if missing: spawning must fail closed,
        // not fall back to the shim's network installer.
        return join(dirname(actual), 'bin', process.platform === 'win32' ? 'codebase-memory-mcp.exe' : 'codebase-memory-mcp');
      }
      return actual;
    } catch { /* preserve normal PATH lookup on absent candidates */ }
  }
  return command;
};

export const makeCodebaseMemoryStdio = (options: CodebaseMemoryStdioOptions): CodebaseMemoryStdio => {
  const root = resolve(options.rootPath);
  const timeoutMs = options.timeoutMs ?? 120_000;
  const command = resolveCodebaseMemoryCommand(options.command?.trim() || 'codebase-memory-mcp');
  let closed = false;
  let suspended = false;
  let retiring = Promise.resolve(true);
  let session: Session | undefined;
  let starting: Promise<Session> | undefined;

  // Reuse Node's process lifecycle rather than treating signal delivery as
  // process exit. No replacement writer may start while a retired child lives.
  const retire = async (child: ChildProcessWithoutNullStreams): Promise<boolean> => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return true;
    let done: () => void = () => undefined;
    const exited = new Promise<void>((resolveExit) => {
      done = resolveExit;
      child.once('exit', done);
      child.once('close', done);
    });
    try {
      if (child.exitCode !== null || child.signalCode !== null) return true;
      try { child.kill('SIGTERM'); } catch { /* confirm actual exit below */ }
      try { await deadline(exited, 750); return true; } catch { /* escalate */ }
      try { child.kill('SIGKILL'); } catch { /* confirm actual exit below */ }
      try { await deadline(exited, 1000); return true; } catch { return false; }
    } finally {
      child.off('exit', done);
      child.off('close', done);
    }
  };

  const discard = (current: Session): void => {
    if (current.dead) return;
    current.dead = true;
    process.removeListener('exit', current.exitHook);
    if (session === current) {
      session = undefined;
      starting = undefined;
      if (!closed) options.onLost?.();
    }
    try { current.connection.dispose(); } catch { /* already closed */ }
    try { current.child.stdin.end(); } catch { /* already closed */ }
    retiring = retire(current.child);
  };

  const connect = async (): Promise<Session> => {
    if (!await retiring || closed || suspended) throw new Error('native provider retirement or cancellation prevents startup');
    const env: NodeJS.ProcessEnv = { ...process.env, CBM_ALLOWED_ROOT: root };
    delete env.GIT_DIR;
    delete env.GIT_WORK_TREE;
    const child = spawn(command, [...(options.args ?? [])], {
      cwd: root, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env,
    });
    // Never leak source paths or native stderr into a model-visible response.
    child.stderr.resume();
    // ACE context extension and in-flight deadline timers own process liveness; a test
    // with no active calls must not hang because this provider is idle.
    child.unref();
    for (const stream of [child.stdin, child.stdout, child.stderr]) {
      (stream as unknown as { unref?: () => void }).unref?.();
    }
    const connection = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin),
    );
    const current: Session = {
      child, connection, dead: false, exitHook: () => { try { child.kill(); } catch { /* exited */ } },
    };
    // Own the child immediately, including during the initialize handshake:
    // close() must be able to cancel a stalled startup without waiting for its deadline.
    session = current;
    const lost = (): void => { discard(current); };
    child.once('error', lost);
    child.once('exit', lost);
    connection.onClose(lost);
    connection.onError(lost);
    process.once('exit', current.exitHook);
    connection.listen();

    try {
      const initialized: unknown = await deadline(connection.sendRequest('initialize', {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: 'ace-internal-codebase-memory', version: '0.1.0' },
      }), timeoutMs);
      const server = record(initialized);
      const identity = record(server?.serverInfo);
      if (current.dead || closed || server?.protocolVersion !== protocolVersion
        || identity?.name !== 'codebase-memory-mcp'
        || identity.version !== expectedVersion) {
        throw new Error('Codebase Memory protocol or pinned binary identity mismatch');
      }
      await deadline(connection.sendNotification('notifications/initialized', {}), timeoutMs);
      if (current.dead || closed) throw new Error('Codebase Memory session closed during initialization');
      session = current;
      return current;
    } catch (error) {
      discard(current);
      throw error;
    }
  };

  const getSession = (): Promise<Session> => {
    if (starting !== undefined) return starting;
    const attempt = connect();
    starting = attempt;
    void attempt.catch(() => { if (starting === attempt) starting = undefined; });
    return attempt;
  };

  const invoke: CodebaseMemoryStdio['invoke'] = async (tool, args, requestId) => {
    if (!permitted.has(tool)) {
      return err(domainError('INVALID_INPUT', 'codebase_memory.tool', 'tool is not authorized for ACE internal retrieval'));
    }
    if (closed || suspended) return err(domainError('NOT_READY', 'codebase_memory', 'native provider session is closed or suspended'));
    const startedAtMs = Date.now();
    const trace = (status: 'success' | 'failure', errorCode?: string, operation = tool): void => {
      try {
        options.trace?.record({
          timestampMs: Date.now(),
          provider: 'codebase_memory',
          providerVersion: `codebase-memory-mcp/${expectedVersion}`,
          operation,
          status,
          durationMs: Math.max(0, Date.now() - startedAtMs),
          ...(requestId === undefined ? {} : { requestId }),
          ...(errorCode === undefined ? {} : { errorCode }),
        });
      } catch {
        // Trace persistence must not change the provider result or fail open.
      }
    };
    let current: Session | undefined;
    try {
      current = await getSession();
      if (current.dead || closed || suspended) throw new Error('Codebase Memory session unavailable');
      const response = current.connection.sendRequest('tools/call', {
        name: tool, arguments: args,
      });
      // Local dispatch observation, not a successful native tool result.
      // The separate terminal event remains the only provider-result evidence.
      if (tool === 'index_repository') trace('success', undefined, 'index_repository_request_queued');
      const raw: unknown = await deadline(response, timeoutMs);
      if (current.dead || closed) throw new Error('Codebase Memory session lost during request');
      const result = parseCodebaseMemoryToolResult(raw);
      trace(result._tag === 'Ok' ? 'success' : 'failure', result._tag === 'Err' ? result.error.code : undefined);
      return result;
    } catch {
      if (current !== undefined) discard(current);
      trace('failure', 'NOT_READY');
      return err(domainError('NOT_READY', 'codebase_memory', 'native stdio provider unavailable or timed out'));
    }
  };

  const suspend = async (): Promise<void> => {
    suspended = true;
    const pending = starting;
    const active = session;
    if (active !== undefined) discard(active);
    if (pending !== undefined) {
      try { discard(await pending); } catch { /* failed startup already cleaned up */ }
    }
    await retiring;
  };

  const close = async (): Promise<void> => {
    closed = true;
    await suspend();
  };

  return { invoke, suspend, resume: () => { if (!closed) suspended = false; }, close };
};
