import { Effect } from 'effect';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { GraphProjectionPort, GraphProjectionStatePort, ProjectionOutboxPort } from './ports.js';
import type { EpisodeId } from '../domain/memory.js';
import type { AsyncMemoryArchivePort } from './ports.js';

export interface VerifiedProjectionDeleteOptions {
  readonly verificationAttempts?: number;
  readonly verificationDelayMs?: number;
  readonly deletionFence?: ProjectionOutboxPort;
}

const boundedPositiveInteger = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isSafeInteger(value) && value > 0 ? value : fallback;

const nonNegativeInteger = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : fallback;

const delay = (milliseconds: number): Effect.Effect<void> =>
  Effect.promise(() => new Promise<void>((resolve) => { setTimeout(resolve, milliseconds); }));

/**
 * Archive-only deletion requires an independently persisted never-projected
 * proof recorded before the original commit. An old archive with no marker is
 * UNKNOWN, not safe to delete just because Graphiti is unavailable.
 *
 * The outbox deletion fence atomically checks for any contradictory receipt
 * before the archive tombstone; retries after a crash between archive delete
 * and fence finalization are idempotent.
 */
export const deleteNeverProjectedArchiveEpisode = async (
  archive: AsyncMemoryArchivePort,
  outbox: ProjectionOutboxPort,
  id: EpisodeId,
): Promise<Result<void, DomainError>> => {
  if (outbox.isArchiveOnly === undefined) {
    return err(domainError('INVALID_MEMORY', 'archive_only', 'durable never-projected proof is unavailable'));
  }
  const proof = await outbox.isArchiveOnly(id);
  if (proof._tag === 'Err') return proof;
  if (!proof.value) {
    return err(domainError('INVALID_MEMORY', 'archive_only', 'never-projected state is unknown'));
  }

  // A marker may have committed just before a SIGKILL interrupted archive
  // insertion. Do not tombstone an original that is not durably readable yet.
  const original = await archive.readEpisode(id);
  if (original._tag === 'Err') {
    if (original.error.code !== 'ARCHIVE_TOMBSTONED') return original;
    // Crash after original tombstone, before outbox finalize: resume only a
    // deletion that was already durably fenced. Never forge a new fence.
    const blocked = await outbox.isDeletionBlocked(id);
    if (blocked._tag === 'Err') return blocked;
    return blocked.value ? outbox.finalizeDeletion(id) : original;
  }

  const fenced = await outbox.beginDeletion(id);
  if (fenced._tag === 'Err') return fenced;
  const deleted = await archive.deleteEpisode(id);
  if (deleted._tag === 'Err') return deleted;
  return outbox.finalizeDeletion(id);
};

/**
 * Delete derived graph data before tombstoning source truth, then prove that the
 * derived Graphiti episode is absent. A successful delete tool response alone is
 * not sufficient evidence because the provider may acknowledge before the
 * derived episode is actually gone.
 *
 * This remains a coordinated operation rather than a distributed transaction:
 * - Graphiti purge or verification failure leaves the archive intact.
 * - Archive deletion starts only after verified derived absence.
 * - Archive deletion failure is reported and can be retried idempotently.
 */
export const deleteEpisodeWithProjection = (
  archive: AsyncMemoryArchivePort,
  graph: GraphProjectionPort,
  projectionState: GraphProjectionStatePort,
  id: EpisodeId,
  options: VerifiedProjectionDeleteOptions = {},
): Effect.Effect<Result<void, DomainError>> => Effect.gen(function* () {
  if (options.deletionFence !== undefined) {
    const fenced = yield* Effect.promise(() => options.deletionFence!.beginDeletion(id));
    if (fenced._tag === 'Err') return fenced;
  }
  const purged = yield* graph.purge(id);
  if (purged._tag === 'Err') return purged;

  const attempts = boundedPositiveInteger(options.verificationAttempts, 3);
  const delayMs = nonNegativeInteger(options.verificationDelayMs, 50);
  let present = true;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const checked = yield* projectionState.isPresent(id);
    if (checked._tag === 'Err') return checked;
    present = checked.value;
    if (!present) break;
    if (attempt < attempts && delayMs > 0) {
      yield* delay(delayMs);
    }
  }
  if (present) {
    return err(domainError(
      'INVALID_EXTERNAL_RESPONSE',
      'graphiti.delete_episode',
      'Graphiti acknowledged purge but the derived episode is still present; original archive bytes were preserved',
      { verificationAttempts: attempts },
    ));
  }

  const stored = yield* Effect.promise(() => archive.deleteEpisode(id));
  if (stored._tag === 'Err') {
    return err(domainError(
      'PERSISTENCE_FAILED',
      'archive',
      'Graphiti purge was verified but archive delete failed; retry and reconcile before accepting deletion',
    ));
  }
  if (options.deletionFence !== undefined) {
    const finalized = yield* Effect.promise(() => options.deletionFence!.finalizeDeletion(id));
    if (finalized._tag === 'Err') return finalized;
  }
  return ok(undefined);
});
