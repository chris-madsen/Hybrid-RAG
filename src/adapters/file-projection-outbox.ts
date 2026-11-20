import { mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { beginProjection, type EpisodeId, type ProjectionReceipt } from '../domain/memory.js';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { ProjectionOutboxPort } from '../application/ports.js';
import { withMemoryArchiveLock } from './memory-archive-lock.js';

const validReceipt = (value: unknown): value is ProjectionReceipt => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const receipt = value as Partial<ProjectionReceipt>;
  return typeof receipt.key === 'string' && receipt.key.length > 0
    && typeof receipt.episodeId === 'string' && receipt.episodeId.length > 0
    && typeof receipt.extractorVersion === 'string' && receipt.extractorVersion.trim().length > 0
    && ['pending', 'projected', 'incomplete', 'dead_letter', 'tombstoned'].includes(String(receipt.status))
    && typeof receipt.attempts === 'number' && Number.isSafeInteger(receipt.attempts) && receipt.attempts >= 0
    && (receipt.totalAttempts === undefined
      || typeof receipt.totalAttempts === 'number' && Number.isSafeInteger(receipt.totalAttempts) && receipt.totalAttempts >= receipt.attempts)
    && (receipt.nextAttemptAtMs === undefined
      || typeof receipt.nextAttemptAtMs === 'number' && Number.isSafeInteger(receipt.nextAttemptAtMs) && receipt.nextAttemptAtMs >= 0)
    && (receipt.lastErrorCode === undefined
      || typeof receipt.lastErrorCode === 'string' && receipt.lastErrorCode.trim().length > 0)
    && (receipt.deadLetteredAtMs === undefined
      || typeof receipt.deadLetteredAtMs === 'number' && Number.isSafeInteger(receipt.deadLetteredAtMs) && receipt.deadLetteredAtMs >= 0)
    && (receipt.manualRepairCount === undefined
      || typeof receipt.manualRepairCount === 'number' && Number.isSafeInteger(receipt.manualRepairCount) && receipt.manualRepairCount >= 0)
    && (receipt.inflightAttemptId === undefined
      || typeof receipt.inflightAttemptId === 'string' && receipt.inflightAttemptId.trim().length > 0)
    && (receipt.uncertainGraphAttempt === undefined || typeof receipt.uncertainGraphAttempt === 'boolean')
    && (receipt.graphDispatchAcknowledged === undefined || typeof receipt.graphDispatchAcknowledged === 'boolean');
};

export const makeFileProjectionOutbox = async (rootPath: string): Promise<ProjectionOutboxPort> => {
  await mkdir(rootPath, { recursive: true });
  const deletionRoot = join(rootPath, 'deletions');
  const archiveOnlyRoot = join(rootPath, 'archive-only');
  await mkdir(deletionRoot, { recursive: true });
  await mkdir(archiveOnlyRoot, { recursive: true });
  const pathFor = (key: string): string => join(rootPath, `${Buffer.from(key).toString('base64url')}.json`);
  const deletionPathFor = (episodeId: EpisodeId): string => join(deletionRoot, `${Buffer.from(episodeId).toString('base64url')}.json`);
  const archiveOnlyPathFor = (episodeId: EpisodeId): string => join(archiveOnlyRoot, `${Buffer.from(episodeId).toString('base64url')}.json`);
  // Reuse AR04's kernel-backed, SIGKILL-releasing file lock. A stale mkdir
  // lock from a killed process must never block import or deletion indefinitely.
  const withLock = <T>(operation: () => Promise<Result<T, DomainError>>): Promise<Result<T, DomainError>> =>
    withMemoryArchiveLock(rootPath, 'exclusive', operation);

  // Proof, graph intent and deletion fences must survive a crash before any
  // external projection or destructive archive call can follow. Stage/fsync,
  // publish by rename, then fsync the containing directory (Linux-only lock).
  const persist = async (
    path: string,
    value: unknown,
    errorPath: string,
    message: string,
  ): Promise<Result<void, DomainError>> => {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try {
        await handle.writeFile(JSON.stringify(value), 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, path);
      const directory = await open(dirname(path), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
      return ok(undefined);
    } catch {
      await rm(temporary, { force: true }).catch(() => undefined);
      return err(domainError('PERSISTENCE_FAILED', errorPath, message));
    }
  };

  const read = async (path: string): Promise<Result<ProjectionReceipt | undefined, DomainError>> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
      return validReceipt(parsed)
        ? ok(parsed)
        : err(domainError('PERSISTENCE_FAILED', 'projection_outbox', 'projection receipt on disk is invalid'));
    } catch (cause) {
      return (cause as NodeJS.ErrnoException).code === 'ENOENT'
        ? ok(undefined)
        : err(domainError('PERSISTENCE_FAILED', 'projection_outbox', 'could not read projection receipt'));
    }
  };

  type DeletionStatus = 'deleting' | 'tombstoned';
  const readDeletion = async (episodeId: EpisodeId): Promise<Result<DeletionStatus | undefined, DomainError>> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(deletionPathFor(episodeId), 'utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
        || (parsed as { episodeId?: unknown }).episodeId !== episodeId
        || !['deleting', 'tombstoned'].includes(String((parsed as { status?: unknown }).status))) {
        return err(domainError('PERSISTENCE_FAILED', 'projection_deletion', 'projection deletion fence on disk is invalid'));
      }
      return ok((parsed as { status: DeletionStatus }).status);
    } catch (cause) {
      return (cause as NodeJS.ErrnoException).code === 'ENOENT'
        ? ok(undefined)
        : err(domainError('PERSISTENCE_FAILED', 'projection_deletion', 'could not read projection deletion fence'));
    }
  };

  const writeDeletion = (episodeId: EpisodeId, status: DeletionStatus): Promise<Result<void, DomainError>> =>
    persist(deletionPathFor(episodeId), { episodeId, status }, 'projection_deletion',
      'could not durably publish projection deletion fence');

  const readArchiveOnly = async (episodeId: EpisodeId): Promise<Result<boolean, DomainError>> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(archiveOnlyPathFor(episodeId), 'utf8'));
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)
        || (parsed as { episodeId?: unknown }).episodeId !== episodeId
        || (parsed as { status?: unknown }).status !== 'never_projected') {
        return err(domainError('PERSISTENCE_FAILED', 'archive_only', 'invalid archive-only proof'));
      }
      return ok(true);
    } catch (cause) {
      return (cause as NodeJS.ErrnoException).code === 'ENOENT'
        ? ok(false)
        : err(domainError('PERSISTENCE_FAILED', 'archive_only', 'cannot verify archive-only proof'));
    }
  };

  const putUnlocked = async (receipt: ProjectionReceipt): Promise<Result<void, DomainError>> => {
    if (!validReceipt(receipt)) {
      return err(domainError('INVALID_MEMORY', 'projection_receipt', 'cannot persist an invalid projection receipt'));
    }
    const archiveOnly = await readArchiveOnly(receipt.episodeId);
    if (archiveOnly._tag === 'Err') return archiveOnly;
    if (archiveOnly.value && receipt.status !== 'tombstoned') {
      return err(domainError('ARCHIVE_TOMBSTONED', 'projection_outbox', 'never-projected episode cannot acquire a graph receipt'));
    }
    const deletion = await readDeletion(receipt.episodeId);
    if (deletion._tag === 'Err') return deletion;
    if (deletion.value !== undefined && receipt.status !== 'tombstoned') {
      return err(domainError('ARCHIVE_TOMBSTONED', 'projection_outbox', 'deletion fence rejects a stale projection receipt'));
    }
    // A tombstone receipt is a POST-deletion bookkeeping fact. Without a
    // durable completed deletion fence, a caller could rewrite an unsettled
    // pending intent to tombstoned, then trick beginDeletion into treating
    // the fabricated receipt as positive evidence of completed projection.
    if (receipt.status === 'tombstoned') {
      const finalizedFence = await readDeletion(receipt.episodeId);
      if (finalizedFence._tag === 'Err') return finalizedFence;
      if (finalizedFence.value !== 'tombstoned') {
        return err(domainError('INVALID_MEMORY', 'projection_outbox',
          'graph receipt tombstone requires completed durable archive deletion'));
      }
    }
    const path = pathFor(receipt.key);
    const prior = await read(path);
    if (prior._tag === 'Err') return prior;
    if (prior.value?.inflightAttemptId !== undefined
      && receipt.inflightAttemptId !== prior.value.inflightAttemptId) {
      return err(domainError('INVALID_MEMORY', 'projection_attempt',
        'only the durable dispatch owner may settle an in-flight graph attempt'));
    }
    if (prior.value?.uncertainGraphAttempt && !receipt.uncertainGraphAttempt) {
      return err(domainError('INVALID_MEMORY', 'projection_attempt',
        'cannot erase uncertain Graphiti side effects without verification'));
    }
    if (receipt.graphDispatchAcknowledged && !prior.value?.graphDispatchAcknowledged
      && prior.value?.inflightAttemptId === undefined) {
      return err(domainError('INVALID_MEMORY', 'projection_attempt',
        'cannot claim a verified graph dispatch without a durable attempt'));
    }
    if (prior.value?.graphDispatchAcknowledged && !receipt.graphDispatchAcknowledged) {
      return err(domainError('INVALID_MEMORY', 'projection_attempt',
        'cannot erase an acknowledged graph attempt'));
    }
    if (prior.value?.status === 'projected' && receipt.status !== 'projected' && receipt.status !== 'tombstoned') {
      return err(domainError('INVALID_MEMORY', 'projection_outbox', 'cannot demote a verified projection'));
    }
    // Put settles the claim under the same OS lock. SIGKILL before this write
    // leaves an in-flight marker and a conservative deletion barrier.
    const { inflightAttemptId: discardedClaim, ...settled } = receipt;
    void discardedClaim;
    return persist(path, settled, 'projection_outbox',
      'could not durably publish projection receipt');
  };

  return {
    begin: async (episodeId: EpisodeId, extractorVersion: string) => {
      return withLock(async () => {
        const archiveOnly = await readArchiveOnly(episodeId);
        if (archiveOnly._tag === 'Err') return archiveOnly;
        if (archiveOnly.value) {
          return err(domainError('ARCHIVE_TOMBSTONED', 'projection_outbox', 'archive-only episode cannot start graph projection'));
        }
        const deletion = await readDeletion(episodeId);
        if (deletion._tag === 'Err') return deletion;
        if (deletion.value !== undefined) {
          return err(domainError('ARCHIVE_TOMBSTONED', 'projection_outbox', 'projection is fenced by episode deletion'));
        }
        const candidate = beginProjection([], episodeId, extractorVersion);
        if (candidate._tag === 'Err') return candidate;
        const existing = await read(pathFor(candidate.value.key));
        if (existing._tag === 'Err') return existing;
        if (existing.value !== undefined) return ok(existing.value);
        const persisted = await putUnlocked(candidate.value);
        return persisted._tag === 'Err' ? persisted : ok(candidate.value);
      });
    },
    put: (receipt) => withLock(() => putUnlocked(receipt)),
    startAttempt: (episodeId, extractorVersion) => withLock(async () => {
      const candidate = beginProjection([], episodeId, extractorVersion);
      if (candidate._tag === 'Err') return candidate;
      const current = await read(pathFor(candidate.value.key));
      if (current._tag === 'Err') return current;
      if (current.value === undefined) {
        return err(domainError('INVALID_MEMORY', 'projection_attempt',
          'no durable graph projection intent exists for this episode'));
      }
      if (current.value.status !== 'pending' && current.value.status !== 'incomplete') {
        return err(domainError('INVALID_MEMORY', 'projection_attempt',
          'a terminal projection cannot start a new graph attempt'));
      }
      // An incomplete attempt marked uncertain may have reached Graphiti and
      // could still materialize after process failure. A retry based only on
      // local backoff would send a second graph write without reconciliation.
      if (current.value.uncertainGraphAttempt === true) {
        return err(domainError('INVALID_MEMORY', 'projection_attempt',
          'unresolved Graphiti outcome cannot be retried without external reconciliation'));
      }
      const deletion = await readDeletion(episodeId);
      if (deletion._tag === 'Err') return deletion;
      if (deletion.value !== undefined) {
        return err(domainError('ARCHIVE_TOMBSTONED', 'projection_attempt',
          'deletion fence blocks new graph attempt'));
      }
      const archiveOnly = await readArchiveOnly(episodeId);
      if (archiveOnly._tag === 'Err') return archiveOnly;
      if (archiveOnly.value) {
        return err(domainError('ARCHIVE_TOMBSTONED', 'projection_attempt',
          'never-projected episode cannot be sent to Graphiti'));
      }
      let names: string[];
      try {
        names = (await readdir(rootPath)).filter((name) => name.endsWith('.json'));
      } catch {
        return err(domainError('PERSISTENCE_FAILED', 'projection_attempt', 'could not inspect active attempts'));
      }
      for (const name of names) {
        const observed = await read(join(rootPath, name));
        if (observed._tag === 'Err') return observed;
        if (observed.value?.episodeId === episodeId && observed.value.inflightAttemptId !== undefined) {
          return err(domainError('INVALID_MEMORY', 'projection_attempt',
            'a Graphiti attempt is already in-flight for this episode'));
        }
      }
      const reserved = { ...current.value, inflightAttemptId: randomUUID() };
      const stored = await persist(pathFor(reserved.key), reserved, 'projection_attempt',
        'could not durably reserve graph attempt before dispatch');
      return stored._tag === 'Err' ? stored : ok(reserved);
    }),
    get: (key) => read(pathFor(key)),
    list: async () => {
      try {
        const entries = (await readdir(rootPath)).filter((entry) => entry.endsWith('.json')).sort();
        const receipts: ProjectionReceipt[] = [];
        for (const entry of entries) {
          const receipt = await read(join(rootPath, entry));
          if (receipt._tag === 'Err') return receipt;
          if (receipt.value !== undefined) receipts.push(receipt.value);
        }
        return ok(receipts);
      } catch {
        return err(domainError('PERSISTENCE_FAILED', 'projection_outbox', 'could not enumerate projection receipts'));
      }
    },
    markArchiveOnly: (episodeId) => withLock(async () => {
      const already = await readArchiveOnly(episodeId);
      if (already._tag === 'Err') return already;
      if (already.value) return ok(undefined);
      const deletion = await readDeletion(episodeId);
      if (deletion._tag === 'Err') return deletion;
      if (deletion.value !== undefined) return err(domainError('ARCHIVE_TOMBSTONED', 'archive_only', 'episode already fenced for deletion'));
      // Under the same cross-process lock used by begin/put. Never infer
      // unprojected state merely because the current service is offline.
      let entries: string[];
      try {
        entries = (await readdir(rootPath)).filter((name) => name.endsWith('.json'));
      } catch {
        return err(domainError('PERSISTENCE_FAILED', 'archive_only', 'could not inspect projection receipts'));
      }
      for (const entry of entries) {
        const found = await read(join(rootPath, entry));
        if (found._tag === 'Err') return found;
        if (found.value?.episodeId === episodeId) {
          return err(domainError('INVALID_MEMORY', 'archive_only', 'projection receipt already exists'));
        }
      }
      return persist(archiveOnlyPathFor(episodeId),
        { episodeId, status: 'never_projected' }, 'archive_only',
        'could not durably record never-projected proof');
    }),
    isArchiveOnly: (episodeId) => readArchiveOnly(episodeId),
    beginDeletion: (episodeId) => withLock(async () => {
      const existing = await readDeletion(episodeId);
      if (existing._tag === 'Err') return existing;
      if (existing.value !== undefined) return ok(undefined);
      const archiveOnly = await readArchiveOnly(episodeId);
      if (archiveOnly._tag === 'Err') return archiveOnly;
      // Durable graph intent is published BEFORE a provider attempt. A pending,
      // failed or dead-lettered receipt means an attempt may still materialize;
      // a Graphiti absence query alone cannot dismiss a concurrent/unknown send.
      let entries: string[];
      try {
        entries = (await readdir(rootPath)).filter((name) => name.endsWith('.json'));
      } catch {
        return err(domainError('PERSISTENCE_FAILED', 'projection_deletion', 'could not inspect graph intents before deletion'));
      }
      let foundGraphIntent = false;
      for (const entry of entries) {
        const found = await read(join(rootPath, entry));
        if (found._tag === 'Err') return found;
        const receipt = found.value;
        if (receipt?.episodeId !== episodeId) continue;
        foundGraphIntent = true;
        if (archiveOnly.value || receipt.inflightAttemptId !== undefined
          || receipt.uncertainGraphAttempt === true
          || (receipt.status === 'projected' && receipt.graphDispatchAcknowledged !== true)
          || (receipt.status !== 'projected' && receipt.status !== 'tombstoned')) {
          return err(domainError('INVALID_MEMORY', 'projection_deletion',
            'unsettled or contradictory graph projection intent blocks deletion'));
        }
      }
      if (!archiveOnly.value && !foundGraphIntent) {
        return err(domainError('INVALID_MEMORY', 'projection_deletion',
          'missing graph intent and missing never-projected proof leave historical state unknown'));
      }
      return writeDeletion(episodeId, 'deleting');
    }),
    finalizeDeletion: (episodeId) => withLock(async () => {
      const existing = await readDeletion(episodeId);
      if (existing._tag === 'Err') return existing;
      if (existing.value === undefined) {
        return err(domainError('PERSISTENCE_FAILED', 'projection_deletion', 'cannot finalize an unstarted projection deletion'));
      }
      return writeDeletion(episodeId, 'tombstoned');
    }),
    isDeletionBlocked: async (episodeId) => {
      const status = await readDeletion(episodeId);
      return status._tag === 'Err' ? status : ok(status.value !== undefined);
    },
  };
};
