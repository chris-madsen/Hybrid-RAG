import { Effect } from 'effect';
import { admitMemoryEpisode, defaultMemoryAdmissionPolicy, type MemoryAdmission, type MemoryAdmissionPolicy } from '../domain/memory-admission.js';
import { domainError, type DomainError, type DomainErrorCode } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import {
  defaultProjectionRetryPolicy,
  projectionRetryDue,
  recordProjectionEnqueue,
  scheduleProjectionRetry,
  type EpisodeId,
  type ProjectionReceipt,
  type ProjectionRetryPolicy,
  type ProjectionStatus,
  type SessionEpisode,
} from '../domain/memory.js';
import type { GraphProjectionPort, MemoryArchivePort, ProjectionOutboxPort } from './ports.js';

export interface ProjectionSession {
  readonly projection: GraphProjectionPort;
  readonly close: () => Promise<void>;
}

export interface MemoryImportOutcome {
  readonly episodeId: EpisodeId;
  /** True only when this import created a new immutable archive record. */
  readonly persisted: boolean;
  readonly admission: MemoryAdmission;
  readonly projectionStatus?: ProjectionStatus;
  readonly projectionErrorCode?: DomainErrorCode;
}

export interface MemoryImportInput {
  readonly episodes: readonly SessionEpisode[];
  readonly archive: MemoryArchivePort;
  readonly createProjection: () => Promise<ProjectionSession>;
  readonly extractorVersion: string;
  readonly admissionPolicy?: MemoryAdmissionPolicy;
  readonly outbox?: ProjectionOutboxPort;
  readonly retryPolicy?: ProjectionRetryPolicy;
  readonly nowMs?: () => number;
  readonly verificationDelayMs?: number;
}

const errorFrom = (cause: unknown, path: string, message: string): DomainError =>
  domainError('EXTERNAL_UNAVAILABLE', path, cause instanceof Error ? `${message}: ${cause.message}` : message);

interface ArchivedEpisode {
  readonly episode: SessionEpisode;
  readonly created: boolean;
  readonly admission: MemoryAdmission;
}

/**
 * Two-phase import:
 * 1. archive every original episode first;
 * 2. only then attempt the derived Graphiti projection.
 *
 * A Graphiti/extractor outage must never prevent later originals from reaching
 * the immutable archive. Projection failures are reported as incomplete
 * outcomes and may be retried idempotently later.
 */
export const importMemoryEpisodes = async (input: MemoryImportInput): Promise<Result<readonly MemoryImportOutcome[], DomainError>> => {
  const policy = input.admissionPolicy ?? defaultMemoryAdmissionPolicy;
  const retryPolicy = input.retryPolicy ?? defaultProjectionRetryPolicy;
  const nowMs = input.nowMs ?? Date.now;
  const verificationDelayMs = input.verificationDelayMs ?? retryPolicy.baseDelayMs;
  const archived: ArchivedEpisode[] = [];
  let admissionPreparationError: DomainError | undefined;

  // Phase 1: source truth first. Any archive failure is fatal because ACE cannot
  // honestly claim the original history was preserved.
  for (const episode of input.episodes) {
    const admission = admitMemoryEpisode(episode, policy);
    if (input.outbox !== undefined && admissionPreparationError === undefined) {
      if (admission.kind === 'archive_only' && input.outbox.markArchiveOnly !== undefined) {
        // WRITE-AHEAD positive proof: the previous created:true -> marker
        // sequence lost its proof on SIGKILL and created:false replay cannot
        // honestly infer that an old episode was never sent to Graphiti.
        // Only mark a genuinely new original; legacy originals with no proof
        // remain UNKNOWN and require actual graph verification for deletion.
        const existing = await input.archive.readEpisode(episode.episodeId);
        if (existing._tag === 'Err' && existing.error.code !== 'FILE_NOT_FOUND') return existing;
        if (existing._tag === 'Err') {
          const marked = await input.outbox.markArchiveOnly(episode.episodeId);
          if (marked._tag === 'Err') admissionPreparationError = marked.error;
        }
      } else if (admission.kind === 'project') {
        // Durable graph intent MUST precede the archive commit and every
        // possible provider send, including a restart/replay after SIGKILL.
        const begun = await input.outbox.begin(episode.episodeId, input.extractorVersion);
        if (begun._tag === 'Err') admissionPreparationError = begun.error;
      }
    }
    const saved = await input.archive.importEpisode(episode);
    if (saved._tag === 'Err') return saved;
    archived.push({ episode, created: saved.value.created, admission });
  }
  // An outbox outage must not lose later originals; after all archives are
  // written, fail closed before starting ANY Graphiti provider session.
  if (admissionPreparationError !== undefined) return err(admissionPreparationError);

  const outcomes: MemoryImportOutcome[] = [];
  let session: ProjectionSession | undefined;
  let projectionUnavailable: DomainError | undefined;

  try {
    for (const item of archived) {
      const { episode, created, admission } = item;
      if (admission.kind === 'archive_only') {
        outcomes.push({ episodeId: episode.episodeId, persisted: created, admission });
        continue;
      }

      // An unrecorded Graphiti attempt cannot be fenced against concurrent
      // deletion or uncertain recovery. Source originals are still archived.
      if (input.outbox === undefined) {
        outcomes.push({
          episodeId: episode.episodeId,
          persisted: created,
          admission,
          projectionStatus: 'incomplete',
          projectionErrorCode: 'PERSISTENCE_FAILED',
        });
        continue;
      }

      let queued: ProjectionReceipt | undefined;
      if (input.outbox !== undefined) {
        const begun = await input.outbox.begin(episode.episodeId, input.extractorVersion);
        if (begun._tag === 'Err') return begun;
        queued = begun.value;
        if (queued.status === 'projected' || queued.status === 'tombstoned' || queued.status === 'dead_letter'
          || queued.inflightAttemptId !== undefined || !projectionRetryDue(queued, nowMs())) {
          // A pending acknowledgement can still be awaiting provider
          // materialization, and an incomplete receipt may be in backoff.
          // Re-import must not bypass the durable next-attempt fence.
          outcomes.push({
            episodeId: episode.episodeId,
            persisted: created,
            admission,
            projectionStatus: queued.status,
          });
          continue;
        }
      }

      if (projectionUnavailable !== undefined) {
        if (queued !== undefined && input.outbox !== undefined) {
          const incomplete = scheduleProjectionRetry(queued, nowMs(), projectionUnavailable.code, retryPolicy);
          if (incomplete._tag === 'Err') return incomplete;
          const stored = await input.outbox.put(incomplete.value);
          if (stored._tag === 'Err') return stored;
          queued = incomplete.value;
        }
        outcomes.push({
          episodeId: episode.episodeId,
          persisted: created,
          admission,
          projectionStatus: queued?.status ?? 'incomplete',
          projectionErrorCode: projectionUnavailable.code,
        });
        continue;
      }

      if (session === undefined) {
        try {
          session = await input.createProjection();
        } catch (cause) {
          projectionUnavailable = errorFrom(cause, 'graphiti', 'Graphiti projection session could not start');
          if (queued !== undefined && input.outbox !== undefined) {
            const incomplete = scheduleProjectionRetry(queued, nowMs(), projectionUnavailable.code, retryPolicy);
            if (incomplete._tag === 'Err') return incomplete;
            const stored = await input.outbox.put(incomplete.value);
            if (stored._tag === 'Err') return stored;
            queued = incomplete.value;
          }
          outcomes.push({
            episodeId: episode.episodeId,
            persisted: created,
            admission,
            projectionStatus: 'incomplete',
            projectionErrorCode: projectionUnavailable.code,
          });
          continue;
        }
      }

      // The durable claim prevents two importers from concurrently sending
      // the same episode and one prematurely enabling archive deletion.
      const claim = await input.outbox.startAttempt(episode.episodeId, input.extractorVersion);
      if (claim._tag === 'Err') {
        outcomes.push({
          episodeId: episode.episodeId,
          persisted: created,
          admission,
          projectionStatus: 'incomplete',
          projectionErrorCode: claim.error.code,
        });
        continue;
      }
      queued = claim.value;

      let projected: Result<ProjectionReceipt, DomainError>;
      try {
        projected = await Effect.runPromise(session.projection.project({
          episodeId: episode.episodeId,
          occurredAtMs: episode.occurredAtMs,
          extractorVersion: input.extractorVersion,
          claims: [{
            original_digest: episode.contentDigest,
            text: episode.searchText,
            original_pointer: episode.sourcePointer,
          }],
        }));
      } catch {
        // An Effect defect/rejection is also an unavailable Graphiti provider,
        // not permission to throw away outcomes for already archived originals.
        projected = err(domainError('EXTERNAL_UNAVAILABLE', 'graphiti', 'Graphiti projection execution failed'));
      }
      if (projected._tag === 'Err') {
        if (queued !== undefined && input.outbox !== undefined) {
          const incomplete = scheduleProjectionRetry(
            { ...queued, uncertainGraphAttempt: true }, nowMs(), projected.error.code, retryPolicy,
          );
          if (incomplete._tag === 'Err') return incomplete;
          const stored = await input.outbox.put(incomplete.value);
          if (stored._tag === 'Err') return stored;
          queued = incomplete.value;
        }
        outcomes.push({
          episodeId: episode.episodeId,
          persisted: created,
          admission,
          projectionStatus: queued?.status ?? 'incomplete',
          projectionErrorCode: projected.error.code,
        });
        continue;
      }
      if (input.outbox !== undefined) {
        const base: ProjectionReceipt = queued ?? {
          ...projected.value,
          status: 'pending',
          attempts: 0,
        };
        const receipt = recordProjectionEnqueue(base, projected.value, nowMs(), verificationDelayMs);
        if (receipt._tag === 'Err') return receipt;
        const stored = await input.outbox.put(receipt.value);
        if (stored._tag === 'Err') return stored;
      }
      outcomes.push({
        episodeId: episode.episodeId,
        persisted: created,
        admission,
        projectionStatus: projected.value.status,
      });
    }
  } finally {
    if (session !== undefined) {
      try {
        await session.close();
      } catch (cause) {
        return err(errorFrom(cause, 'graphiti', 'Graphiti session close failed'));
      }
    }
  }

  return ok(outcomes);
};
