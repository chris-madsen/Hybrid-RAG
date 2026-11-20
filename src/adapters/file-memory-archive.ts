import { link, mkdir, open, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { ContentDigest } from '../domain/workspace.js';
import { makeEpisode, makeEpisodeId, type EpisodeId, type SessionEpisode } from '../domain/memory.js';
import type { AsyncMemoryArchivePort } from '../application/ports.js';
import { withMemoryArchiveLock } from './memory-archive-lock.js';

// Preserve existing type-only adapter imports while the application owns the port.
export type { AsyncMemoryArchivePort } from '../application/ports.js';

const digestOf = (bytes: Uint8Array): ContentDigest => createHash('sha256').update(bytes).digest('hex') as ContentDigest;

export const makeAsyncFileMemoryArchive = async (rootPath: string): Promise<AsyncMemoryArchivePort> => {
  const episodesPath = join(rootPath, 'episodes');
  const tombstonesPath = join(rootPath, 'tombstones');
  await mkdir(episodesPath, { recursive: true });
  await mkdir(tombstonesPath, { recursive: true });
  const metadataPath = (id: EpisodeId) => join(episodesPath, `${id}.json`);
  const contentPath = (digest: ContentDigest) => join(episodesPath, `${digest}.bin`);
  const tombstonePath = (id: EpisodeId) => join(tombstonesPath, `${id}.json`);
  const missing = (path: string) => err(domainError('FILE_NOT_FOUND', path, 'archive episode not found'));
  const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
  // Serialize within this instance; the kernel lock also serializes OTHER
  // processes and releases automatically after SIGKILL. No stale mkdir lease.
  let tail: Promise<void> = Promise.resolve();
  const exclusive = <Value>(operation: () => Promise<Result<Value, DomainError>>): Promise<Result<Value, DomainError>> => {
    const current = tail.then(
      () => withMemoryArchiveLock(rootPath, 'exclusive', operation),
      () => withMemoryArchiveLock(rootPath, 'exclusive', operation),
    );
    tail = current.then(() => undefined, () => undefined);
    return current;
  };
  const persistence = (message: string): Result<never, DomainError> =>
    err(domainError('PERSISTENCE_FAILED', 'archive', message));

  // Always use O_NOFOLLOW and a regular-file check. A final-path symlink or
  // special file cannot masquerade as an immutable archive original.
  const verifiedReadFile = async (path: string): Promise<Uint8Array> => {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stats = await file.stat();
      if (!stats.isFile()) throw new Error('archive original is not a regular file');
      return new Uint8Array(await file.readFile());
    } finally {
      await file.close();
    }
  };
  const syncEpisodesDirectory = async (): Promise<void> => {
    const directory = await open(episodesPath, constants.O_RDONLY | constants.O_DIRECTORY);
    try { await directory.sync(); } finally { await directory.close(); }
  };
  const validateMetadata = (raw: unknown, id: EpisodeId): Result<Omit<SessionEpisode, 'content'>, DomainError> => {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return persistence('immutable episode metadata is malformed');
    }
    const entry = raw as Partial<SessionEpisode>;
    const permitted = new Set([
      'episodeId', 'workspaceId', 'sessionId', 'sourcePointer', 'occurredAtMs',
      'importedAtMs', 'contentDigest', 'searchText', 'memoryHint', 'tombstoned',
    ]);
    if (Object.keys(raw).some((key) => !permitted.has(key))
      || entry.episodeId !== id || entry.tombstoned !== false
      || typeof entry.workspaceId !== 'string' || entry.workspaceId.trim() === ''
      || typeof entry.sessionId !== 'string' || entry.sessionId.trim() === ''
      || typeof entry.sourcePointer !== 'string' || entry.sourcePointer.trim() === ''
      || typeof entry.searchText !== 'string'
      || !Number.isSafeInteger(entry.occurredAtMs)
      || !Number.isSafeInteger(entry.importedAtMs)
      || typeof entry.contentDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.contentDigest)
      || (entry.memoryHint !== undefined && entry.memoryHint !== 'project' && entry.memoryHint !== 'archive_only')) {
      return persistence('immutable episode metadata identity or fields are invalid');
    }
    return ok(entry as Omit<SessionEpisode, 'content'>);
  };
  const verifyBlob = async (
    digest: ContentDigest,
    expectedBytes?: Uint8Array,
  ): Promise<Result<Uint8Array, DomainError>> => {
    let bytes: Uint8Array;
    try {
      bytes = await verifiedReadFile(contentPath(digest));
    } catch {
      return persistence('committed episode blob is missing or unreadable');
    }
    if (digestOf(bytes) !== digest
      || (expectedBytes !== undefined && Buffer.compare(Buffer.from(bytes), Buffer.from(expectedBytes)) !== 0)) {
      return err(domainError('DIGEST_MISMATCH', 'episode', 'immutable original blob does not match its SHA-256 digest'));
    }
    return ok(bytes);
  };
  const readCommitted = async (id: EpisodeId): Promise<Result<SessionEpisode | undefined, DomainError>> => {
    let metadataBytes: Uint8Array;
    try {
      metadataBytes = await verifiedReadFile(metadataPath(id));
    } catch (cause) {
      if (isMissing(cause)) return ok(undefined);
      return persistence('committed episode metadata is unreadable');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(metadataBytes).toString('utf8')) as unknown;
    } catch {
      return persistence('committed episode metadata is not valid JSON');
    }
    const metadata = validateMetadata(parsed, id);
    if (metadata._tag === 'Err') return metadata;
    const blob = await verifyBlob(metadata.value.contentDigest);
    if (blob._tag === 'Err') return blob;
    return ok({ ...metadata.value, content: blob.value });
  };

  // Write+fsync temporary bytes first. Hard-link publication is atomic and
  // no-clobber (unlike rename); EEXIST MUST verify final content before reuse.
  const publishImmutable = async (
    finalPath: string,
    bytes: Uint8Array,
    kind: 'blob' | 'metadata',
    inspectExisting: () => Promise<Result<void, DomainError>>,
  ): Promise<Result<void, DomainError>> => {
    const staged = join(episodesPath, `.ar04-${randomUUID()}.stage`);
    try {
      const file = await open(staged, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try {
        // Dual opt-in destructive failpoint for deterministic OS-process crash
        // tests only. Production never enables this and never kills itself.
        const failpoint = process.env.ACE_ARCHIVE_TEST_FAILPOINT;
        if (failpoint !== undefined && failpoint.trim() !== ''
          && process.env.ACE_ENABLE_TEST_FAILPOINTS !== 'true') {
          throw new Error('ACE_ARCHIVE_TEST_FAILPOINT requires ACE_ENABLE_TEST_FAILPOINTS=true');
        }
        const partialStage = failpoint === `during_${kind}_stage`;
        if (partialStage) {
          await file.writeFile(bytes.subarray(0, Math.max(1, Math.floor(bytes.byteLength / 2))));
          process.kill(process.pid, 'SIGKILL');
          throw new Error('archive test failpoint did not terminate process');
        }
        await file.writeFile(bytes);
        await file.sync();
      } finally { await file.close(); }
      try {
        await link(staged, finalPath);
        await syncEpisodesDirectory();
        if (process.env.ACE_ENABLE_TEST_FAILPOINTS === 'true'
          && process.env.ACE_ARCHIVE_TEST_FAILPOINT === `after_${kind}_link`) {
          process.kill(process.pid, 'SIGKILL');
          throw new Error('archive test failpoint did not terminate process');
        }
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause;
        return await inspectExisting();
      }
      return ok(undefined);
    } catch {
      return persistence('could not durably stage and publish immutable episode original');
    } finally {
      await unlink(staged).catch(() => undefined);
    }
  };
  const recoverInterruptedStages = async (): Promise<void> => {
    // No other writer can have an active stage while the kernel lock is held.
    const files = await readdir(episodesPath);
    for (const name of files) {
      if (/^\.ar04-[0-9a-f-]{36}\.stage$/u.test(name)) {
        await unlink(join(episodesPath, name));
      }
    }
  };
  const hasOtherReference = async (digest: ContentDigest): Promise<boolean> => {
    const entries = await readdir(episodesPath);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const metadata = JSON.parse(await readFile(join(episodesPath, entry), 'utf8')) as { contentDigest?: string };
      if (metadata.contentDigest === digest) return true;
    }
    return false;
  };

  return {
    listEpisodes: async () => {
      try {
        const names = (await readdir(episodesPath)).filter((name) => name.endsWith('.json')).sort();
        const episodes: SessionEpisode[] = [];
        for (const name of names) {
          const id = makeEpisodeId(name.slice(0, -'.json'.length));
          if (id._tag === 'Err') return persistence('archive contains unsafe episode filename');
          try {
            await verifiedReadFile(tombstonePath(id.value));
            continue;
          } catch (cause) {
            if (!isMissing(cause)) return persistence('could not inspect archive tombstone');
          }
          const stored = await readCommitted(id.value);
          if (stored._tag === 'Err') return stored;
          if (stored.value === undefined) return persistence('listed episode metadata vanished');
          episodes.push(stored.value);
        }
        return ok(episodes);
      } catch {
        return persistence('could not enumerate immutable archive episodes');
      }
    },
    importEpisode: (episode) => exclusive<{ readonly created: boolean; readonly episode: SessionEpisode }>(async () => {
      const checked = makeEpisode(episode);
      if (checked._tag === 'Err') return checked;
      if (checked.value.tombstoned) {
        return err(domainError('INVALID_MEMORY', 'episode', 'tombstoned originals cannot be imported'));
      }
      const actualDigest = digestOf(checked.value.content);
      if (actualDigest !== checked.value.contentDigest) {
        return err(domainError('DIGEST_MISMATCH', 'episode', 'episode bytes do not match declared digest'));
      }
      try {
        await recoverInterruptedStages();
        await verifiedReadFile(tombstonePath(checked.value.episodeId));
        return err(domainError('ARCHIVE_TOMBSTONED', 'episode', 'tombstoned episode cannot be re-imported'));
      } catch (cause) {
        if (!isMissing(cause)) return persistence('could not inspect tombstone or recover staging files');
      }
      const existing = await readCommitted(checked.value.episodeId);
      if (existing._tag === 'Err') return existing;
      if (existing.value !== undefined) {
        const expected = checked.value;
        const stored = existing.value;
        if (stored.contentDigest !== expected.contentDigest
          || stored.workspaceId !== expected.workspaceId
          || stored.sessionId !== expected.sessionId
          || stored.sourcePointer !== expected.sourcePointer
          || stored.occurredAtMs !== expected.occurredAtMs
          // importedAtMs belongs to the FIRST durable import, not a retry.
          || stored.searchText !== expected.searchText
          || stored.memoryHint !== expected.memoryHint
          || Buffer.compare(Buffer.from(stored.content), Buffer.from(expected.content)) !== 0) {
          return err(domainError('DIGEST_MISMATCH', 'episode', 'reimport conflicts with immutable episode identity'));
        }
        return ok({ created: false, episode: stored });
      }
      const verifiedBlob = await publishImmutable(contentPath(checked.value.contentDigest),
        checked.value.content, 'blob', async () => {
          const verified = await verifyBlob(checked.value.contentDigest, checked.value.content);
          return verified._tag === 'Err' ? verified : ok(undefined);
        });
      if (verifiedBlob._tag === 'Err') return verifiedBlob;
      const serialized = new TextEncoder().encode(JSON.stringify({ ...checked.value, content: undefined }));
      const savedMetadata = await publishImmutable(metadataPath(checked.value.episodeId), serialized, 'metadata', async () => {
        const current = await readCommitted(checked.value.episodeId);
        if (current._tag === 'Err') return current;
        if (current.value === undefined) return persistence('episode metadata disappeared during publication');
        const expected = checked.value;
        return current.value.contentDigest === expected.contentDigest
          && current.value.workspaceId === expected.workspaceId
          && current.value.sessionId === expected.sessionId
          && current.value.sourcePointer === expected.sourcePointer
          && current.value.occurredAtMs === expected.occurredAtMs
          && current.value.importedAtMs === expected.importedAtMs
          && current.value.searchText === expected.searchText
          && current.value.memoryHint === expected.memoryHint
          ? ok(undefined)
          : err(domainError('DIGEST_MISMATCH', 'episode', 'existing metadata conflicts with immutable source'));
      });
      if (savedMetadata._tag === 'Err') return savedMetadata;
      const committed = await readCommitted(checked.value.episodeId);
      if (committed._tag === 'Err') return committed;
      if (committed.value === undefined) return persistence('episode commit is not visible after sync');
      return ok({ created: true, episode: committed.value });
    }),
    readEpisode: async (episodeId) => {
      const id = makeEpisodeId(episodeId);
      if (id._tag === 'Err') return id;
      try {
        await verifiedReadFile(tombstonePath(id.value));
        return err(domainError('ARCHIVE_TOMBSTONED', 'episode', 'episode was deleted'));
      } catch (cause) {
        if (!isMissing(cause)) return persistence('could not inspect archive tombstone');
      }
      const stored = await readCommitted(id.value);
      if (stored._tag === 'Err') return stored;
      return stored.value === undefined
        ? missing(`episode:${episodeId}`)
        : ok(stored.value);
    },
    deleteEpisode: (episodeId) => exclusive(async () => {
      const id = makeEpisodeId(episodeId);
      if (id._tag === 'Err') return id;
      const existing = await (async () => {
        try {
          return JSON.parse(await readFile(metadataPath(episodeId), 'utf8')) as Omit<SessionEpisode, 'content'>;
        } catch (error) {
          return isMissing(error) ? undefined : null;
        }
      })();
      if (existing === null) return err(domainError('PERSISTENCE_FAILED', 'archive', 'could not read episode metadata'));
      if (existing === undefined) {
        try { await readFile(tombstonePath(episodeId)); return ok(undefined); } catch (error) {
          return isMissing(error) ? missing(`episode:${episodeId}`) : err(domainError('PERSISTENCE_FAILED', 'archive', 'could not inspect tombstone'));
        }
      }
      try {
        // Tombstone BEFORE removing any blob: a crashed delete cannot resurrect an episode.
        await writeFile(tombstonePath(episodeId), JSON.stringify({ episodeId, deletedAtMs: Date.now() }), { flag: 'wx' }).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== 'EEXIST') throw error;
        });
        await rm(metadataPath(episodeId), { force: true });
        // Content addressing permits multiple episodes to point to one blob.
        // Delete bytes only when the last metadata reference disappears.
        if (!await hasOtherReference(existing.contentDigest)) {
          await rm(contentPath(existing.contentDigest), { force: true });
        }
        return ok(undefined);
      } catch {
        return err(domainError('PERSISTENCE_FAILED', 'archive', 'could not safely delete episode'));
      }
    }),
  };
};
