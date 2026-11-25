import { Effect } from 'effect';
import { authorizeOutbound, type ProjectDataPolicy } from '../domain/policy.js';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { RetrievalEvidence } from '../domain/retrieval.js';
import type { WorkspaceId } from '../domain/workspace.js';
import { projectionKey, type ProjectionReceipt } from '../domain/memory.js';
import { containsLikelySecret } from '../domain/sensitive-text.js';
import type {
  DocumentationPort,
  GraphProjectionPort,
  HttpPort,
  HttpRequest,
  HttpResponse,
} from '../application/ports.js';

const object = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

const stringField = (value: Record<string, unknown>, key: string): Result<string, DomainError> =>
  typeof value[key] === 'string' && value[key].trim().length > 0
    ? ok(value[key].trim())
    : err(domainError('INVALID_EXTERNAL_RESPONSE', key, `external response field ${key} is required`));

const contentField = (value: Record<string, unknown>, key: string): Result<string, DomainError> =>
  typeof value[key] === 'string' && value[key].trim().length > 0
    ? ok(value[key])
    : err(domainError('INVALID_EXTERNAL_RESPONSE', key, `external response field ${key} is required`));

const externalFailure = (response: HttpResponse, provider: string): Result<never, DomainError> => {
  const body = object(response.body);
  const status = object(body?.status);
  const detail = typeof status?.error === 'string' ? `: ${status.error.slice(0, 240)}` : '';
  return err(domainError('EXTERNAL_UNAVAILABLE', provider, `external provider returned HTTP ${response.status}${detail}`));
};

const successful = (response: HttpResponse): boolean => response.status >= 200 && response.status < 300;

export const makeFetchHttpPort = (): HttpPort => ({
  request: (request: HttpRequest) => Effect.catchAll(Effect.tryPromise<Result<HttpResponse, DomainError>, DomainError>({
    try: async (signal) => {
      const timeout = AbortSignal.timeout(request.timeoutMs ?? 10_000);
      const response = await fetch(request.url, {
        method: request.method,
        headers: { 'content-type': 'application/json', ...request.headers },
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        signal: AbortSignal.any([signal, timeout]),
      });
      const text = await response.text();
      let body: unknown = text;
      try { body = text.length === 0 ? {} : JSON.parse(text) as unknown; } catch { /* preserve non-JSON body */ }
      return ok({ status: response.status, body });
    },
    catch: () => domainError('EXTERNAL_UNAVAILABLE', 'http', 'external HTTP request failed or timed out'),
  }), (failure) => Effect.succeed(err(failure))),
});

interface VertexConfig {
  readonly endpoint: string;
  readonly http: HttpPort;
  readonly policy: ProjectDataPolicy;
  readonly accessToken: () => string | undefined;
  readonly authorizedPaths?: readonly string[];
}

export const makeVertexDocumentationPort = (config: VertexConfig): DocumentationPort => ({
  search: (input) => Effect.gen(function* () {
    const action = authorizeOutbound({
      workspaceId: input.workspaceId,
      operation: 'documentation_search',
      destination: 'vertex',
      dataClasses: ['project_document'],
      paths: config.authorizedPaths ?? [],
      secretDetected: containsLikelySecret(input.query),
    }, config.policy);
    if (action._tag === 'Err') return action;
    if (action.value.outcome !== 'allowed') return err(domainError('POLICY_DENIED', 'vertex', action.value.reasonCode));
    const token = config.accessToken();
    if (token === undefined || token.trim() === '') return err(domainError('AUTH_REQUIRED', 'vertex', 'Vertex access token is unavailable'));
    const responseResult = yield* config.http.request({ method: 'POST', url: config.endpoint, headers: { authorization: `Bearer ${token}` }, body: { query: input.query, top_k: input.topK } });
    if (responseResult._tag === 'Err') return responseResult;
    const response = responseResult.value;
    if (!successful(response)) return externalFailure(response, 'vertex');
    const body = object(response.body);
    if (!Array.isArray(body?.documents)) return err(domainError('INVALID_EXTERNAL_RESPONSE', 'documents', 'Vertex response documents must be an array'));
    const evidence: RetrievalEvidence[] = [];
    for (const raw of body.documents) {
      const document = object(raw);
      if (document === undefined) return err(domainError('INVALID_EXTERNAL_RESPONSE', 'documents', 'Vertex document must be an object'));
      const citation = stringField(document, 'citation');
      const content = contentField(document, 'content');
      if (citation._tag === 'Err') return citation;
      if (content._tag === 'Err') return content;
      const evidenceId = stringField(document, 'evidence_id');
      if (evidenceId._tag === 'Err') return evidenceId;
      evidence.push({
        evidenceId: evidenceId.value as RetrievalEvidence['evidenceId'],
        source: 'documentation',
        citation: citation.value,
        content: content.value,
        proofClass: 'direct',
        freshness: 'current',
        ...(typeof document.conflict_key === 'string' ? { conflictKey: document.conflict_key } : {}),
        ...(typeof document.conflict_value === 'string' ? { conflictValue: document.conflict_value } : {}),
        ...(typeof document.source_revision === 'string' ? { sourceRevision: document.source_revision } : {}),
        ...(typeof document.source_timestamp_ms === 'number' ? { sourceTimestampMs: document.source_timestamp_ms } : {}),
      });
    }
    return ok(evidence);
  }),
});

interface GraphitiConfig {
  readonly endpoint: string;
  readonly http: HttpPort;
  readonly policy: ProjectDataPolicy;
  readonly workspaceId: WorkspaceId;
  readonly accessToken: () => string | undefined;
}

export const makeGraphitiProjectionPort = (config: GraphitiConfig): GraphProjectionPort => ({
  project: (input) => Effect.gen(function* () {
    const action = authorizeOutbound({
      workspaceId: config.workspaceId,
      operation: 'memory_projection',
      destination: 'other_external',
      dataClasses: ['private_conversation'],
      paths: [],
      secretDetected: containsLikelySecret(JSON.stringify(input.claims)),
    }, config.policy);
    if (action._tag === 'Err') return action;
    if (action.value.outcome !== 'allowed') return err(domainError('POLICY_DENIED', 'graphiti', action.value.reasonCode));
    const token = config.accessToken();
    if (token === undefined || token.trim() === '') return err(domainError('AUTH_REQUIRED', 'graphiti', 'Graphiti access token is unavailable'));
    const responseResult = yield* config.http.request({ method: 'POST', url: `${config.endpoint.replace(/\/$/u, '')}/episodes/${encodeURIComponent(input.episodeId)}/project`, headers: { authorization: `Bearer ${token}` }, body: { extractor_version: input.extractorVersion, claims: input.claims } });
    if (responseResult._tag === 'Err') return responseResult;
    const response = responseResult.value;
    if (!successful(response)) return externalFailure(response, 'graphiti');
    return ok({ key: projectionKey(input.episodeId, input.extractorVersion), episodeId: input.episodeId, extractorVersion: input.extractorVersion, status: 'projected', attempts: 1 } satisfies ProjectionReceipt);
  }),
  purge: (episodeId) => Effect.gen(function* () {
    const action = authorizeOutbound({ workspaceId: config.workspaceId, operation: 'memory_purge', destination: 'other_external', dataClasses: ['private_conversation'], paths: [], secretDetected: false }, config.policy);
    if (action._tag === 'Err') return action;
    if (action.value.outcome !== 'allowed') return err(domainError('POLICY_DENIED', 'graphiti', action.value.reasonCode));
    const token = config.accessToken();
    if (token === undefined || token.trim() === '') return err(domainError('AUTH_REQUIRED', 'graphiti', 'Graphiti access token is unavailable'));
    const responseResult = yield* config.http.request({ method: 'DELETE', url: `${config.endpoint.replace(/\/$/u, '')}/episodes/${encodeURIComponent(episodeId)}`, headers: { authorization: `Bearer ${token}` } });
    if (responseResult._tag === 'Err') return responseResult;
    return successful(responseResult.value) ? ok(undefined) : externalFailure(responseResult.value, 'graphiti');
  }),
});
