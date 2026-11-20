import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink, type FileHandle } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, ok, type Result } from '../domain/result.js';
import type { WorkspaceId } from '../domain/workspace.js';

/**
 * AR03 single-host authority. Qdrant's atomic alias update is NOT a CAS,
 * and in-process Promise queues cannot serialize distinct Node processes.
 *
 * The parent retains the OS file description after a util-linux flock child
 * acquires the lock on inherited fd 3. Linux releases it on process death,
 * including SIGKILL, without a stale lockfile eviction protocol.
 *
 * Publication epochs are reserved durably BEFORE building source candidates;
 * an older reservation may never publish after a newer one commits.
 * This authority requires one shared, owner-private directory on the same
 * Linux host for all writers of a workspace. Cross-host is NOT supported.
 */
export interface QdrantPublicationTicket {
  readonly workspaceId: WorkspaceId;
  readonly epoch: number;
}

export interface QdrantPublicationRecord {
  readonly schemaVersion: 1;
  readonly workspaceId: WorkspaceId;
  readonly lastIssuedEpoch: number;
  readonly committedEpoch: number;
  readonly committedIndexKey?: string;
  readonly committedCollection?: string;
}

export interface QdrantPublicationInput<Value> {
  readonly ticket: QdrantPublicationTicket;
  readonly indexKey: string;
  readonly collection: string;
  /** Exact source verification under the publication lock, before AND after I/O. */
  readonly verifySource: () => Promise<Result<boolean, DomainError>>;
  /** The complete Qdrant index publish, including any destructive cleanup. */
  readonly write: () => Promise<Result<Value, DomainError>>;
  /** Confirm physical workspace point membership under the same lock. */
  readonly verifyMembership: () => Promise<Result<boolean, DomainError>>;
}

export interface QdrantPublicationAuthority {
  readonly reserve: () => Promise<Result<QdrantPublicationTicket, DomainError>>;
  readonly publish: <Value>(input: QdrantPublicationInput<Value>) => Promise<Result<Value, DomainError>>;
  readonly inspect: () => Promise<Result<QdrantPublicationRecord, DomainError>>;
}

const initialRecord = (workspaceId: WorkspaceId): QdrantPublicationRecord => ({
  schemaVersion: 1,
  workspaceId,
  lastIssuedEpoch: 0,
  committedEpoch: 0,
});

const validRecord = (record: unknown, workspaceId: WorkspaceId): record is QdrantPublicationRecord => {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return false;
  const value = record as Partial<QdrantPublicationRecord>;
  return value.schemaVersion === 1
    && value.workspaceId === workspaceId
    && typeof value.lastIssuedEpoch === 'number'
    && Number.isSafeInteger(value.lastIssuedEpoch)
    && value.lastIssuedEpoch >= 0
    && typeof value.committedEpoch === 'number'
    && Number.isSafeInteger(value.committedEpoch)
    && value.committedEpoch >= 0
    && value.committedEpoch <= value.lastIssuedEpoch
    && (value.committedEpoch === 0 || value.committedIndexKey !== undefined)
    && (value.committedIndexKey === undefined
      || (typeof value.committedIndexKey === 'string' && /^[a-f0-9]{64}$/u.test(value.committedIndexKey)))
    && (value.committedCollection === undefined
      || (typeof value.committedCollection === 'string' && /^[a-zA-Z0-9_.-]{1,255}$/u.test(value.committedCollection)));
};

export const makeLocalQdrantPublicationAuthority = (config: {
  readonly workspaceId: WorkspaceId;
  readonly directory: string;
}): QdrantPublicationAuthority => {
  const workspaceHash = createHash('sha256').update(String(config.workspaceId)).digest('hex');
  const lockFile = join(config.directory, workspaceHash + '.lock');
  const stateFile = join(config.directory, workspaceHash + '.json');

  const prepareDirectory = async (): Promise<void> => {
    if (process.platform !== 'linux' || !isAbsolute(config.directory)) {
      throw new Error('Qdrant publication requires explicit absolute shared Linux lock directory');
    }
    await mkdir(config.directory, { recursive: true, mode: 0o700 });
    const stat = await lstat(config.directory);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0
      || (process.getuid !== undefined && stat.uid !== process.getuid())) {
      throw new Error('Qdrant publication lock directory must be an owner-private real directory');
    }
  };

  const readRecord = async (): Promise<QdrantPublicationRecord> => {
    let handle: FileHandle;
    try {
      handle = await open(stateFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return initialRecord(config.workspaceId);
      throw cause;
    }
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1
        || (process.getuid !== undefined && stat.uid !== process.getuid())) {
        throw new Error('Qdrant publication record has untrusted ownership or links');
      }
      const parsed: unknown = JSON.parse(await handle.readFile({ encoding: 'utf8' }));
      if (!validRecord(parsed, config.workspaceId)) {
        throw new Error('Qdrant publication record is malformed or belongs to another workspace');
      }
      return parsed;
    } finally {
      await handle.close();
    }
  };

  const saveRecord = async (record: QdrantPublicationRecord): Promise<void> => {
    const temporary = stateFile + '.' + randomUUID() + '.tmp';
    const handle = await open(
      temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600,
    );
    try {
      await handle.writeFile(JSON.stringify(record) + '\n', { encoding: 'utf8' });
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(temporary, stateFile);
      // A successful rename alone does not make the published fence durable
      // across a machine crash. Flush the parent directory as well.
      const dir = await open(config.directory, constants.O_RDONLY | constants.O_DIRECTORY);
      try { await dir.sync(); } finally { await dir.close(); }
    } finally {
      await unlink(temporary).catch((cause: NodeJS.ErrnoException) => {
        if (cause.code !== 'ENOENT') throw cause;
      });
    }
  };

  const acquireKernelLock = async (fd: number): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      // Numeric descriptor mode: flock(1) locks the parent's open-file
      // description inherited on fd 3. The lock survives child exit.
      const child = spawn('flock', ['--exclusive', '--wait', '30', '3'], {
        stdio: ['ignore', 'ignore', 'pipe', fd],
      });
      let diagnostic = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        diagnostic = (diagnostic + chunk.toString('utf8')).slice(-1024);
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error('flock failed or timed out: ' + diagnostic));
      });
    });
  };

  const withAuthority = async <Value>(
    operation: (record: QdrantPublicationRecord) => Promise<Result<Value, DomainError>>,
  ): Promise<Result<Value, DomainError>> => {
    try {
      await prepareDirectory();
      const handle = await open(
        lockFile, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600,
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) !== 0
          || (process.getuid !== undefined && stat.uid !== process.getuid())) {
          throw new Error('Qdrant publication lock file has untrusted permissions');
        }
        await acquireKernelLock(handle.fd);
        const record = await readRecord();
        return await operation(record);
      } finally {
        // Closing the parent's last fd releases its kernel lock even when
        // the operation throws. No process-id or timeout-based lock stealing.
        await handle.close();
      }
    } catch (cause) {
      return err(domainError(
        'PERSISTENCE_FAILED',
        'qdrant_publication',
        'durable single-host writer authority unavailable: '
          + (cause instanceof Error ? cause.message : 'unknown filesystem failure'),
      ));
    }
  };

  return {
    reserve: () => withAuthority(async (record) => {
      if (record.lastIssuedEpoch === Number.MAX_SAFE_INTEGER) {
        return err(domainError('NOT_READY', 'qdrant_publication', 'publication epoch exhausted'));
      }
      const epoch = record.lastIssuedEpoch + 1;
      await saveRecord({ ...record, lastIssuedEpoch: epoch });
      return ok({ workspaceId: config.workspaceId, epoch });
    }),
    publish: <Value>(input: QdrantPublicationInput<Value>) => withAuthority(async (record) => {
      if (input.ticket.workspaceId !== config.workspaceId
        || !Number.isSafeInteger(input.ticket.epoch)
        || input.ticket.epoch <= record.committedEpoch
        || input.ticket.epoch > record.lastIssuedEpoch) {
        return err(domainError(
          'NOT_READY', 'qdrant_publication',
          'stale, foreign or unreserved publication epoch; newer writer may have committed',
        ));
      }
      if (!/^[a-f0-9]{64}$/u.test(input.indexKey)
        || !/^[a-zA-Z0-9_.-]{1,255}$/u.test(input.collection)) {
        return err(domainError('INVALID_INPUT', 'qdrant_publication', 'invalid index or collection identity'));
      }
      const before = await input.verifySource();
      if (before._tag === 'Err') return before;
      if (!before.value) {
        return err(domainError('WORKTREE_RACED', 'qdrant_publication', 'source changed before fenced write'));
      }
      const written = await input.write();
      if (written._tag === 'Err') return written;
      const after = await input.verifySource();
      if (after._tag === 'Err') return after;
      if (!after.value) {
        return err(domainError('WORKTREE_RACED', 'qdrant_publication', 'source changed while publishing'));
      }
      const membership = await input.verifyMembership();
      if (membership._tag === 'Err') return membership;
      if (!membership.value) {
        return err(domainError(
          'INVALID_EXTERNAL_RESPONSE', 'qdrant_publication', 'physical Qdrant membership does not match committed source',
        ));
      }
      await saveRecord({
        ...record,
        committedEpoch: input.ticket.epoch,
        committedIndexKey: input.indexKey,
        committedCollection: input.collection,
      });
      return written;
    }),
    inspect: () => withAuthority(async (record) => ok(record)),
  };
};
