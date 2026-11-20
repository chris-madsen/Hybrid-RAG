import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { join } from 'node:path';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, type Result } from '../domain/result.js';

/**
 * Single-host archive mutex shared by original writes, deletion and backup.
 * The Linux kernel holds the lock on the parent's open file description,
 * including after the flock acquisition helper exits. SIGKILL releases it.
 * No unreliable PID/mtime-based stale lock stealing is performed.
 */
export const withMemoryArchiveLock = async <Value>(
  root: string,
  mode: 'exclusive' | 'shared',
  operation: () => Promise<Result<Value, DomainError>>,
): Promise<Result<Value, DomainError>> => {
  if (process.platform !== 'linux') {
    return err(domainError('PERSISTENCE_FAILED', 'archive_lock',
      'single-host archive locking requires a Linux flock filesystem'));
  }
  try {
    const handle = await open(
      join(root, '.archive-write.lock'),
      constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      const file = await handle.stat();
      if (!file.isFile() || file.nlink !== 1 || (file.mode & 0o077) !== 0
        || (process.getuid !== undefined && file.uid !== process.getuid())) {
        return err(domainError('PERSISTENCE_FAILED', 'archive_lock',
          'archive lock must be an owner-only regular file'));
      }
      await new Promise<void>((resolve, reject) => {
        const child = spawn('flock', [
          mode === 'exclusive' ? '--exclusive' : '--shared',
          mode === 'exclusive' ? '--timeout' : '--nonblock',
          ...(mode === 'exclusive' ? ['20'] : []),
          '3',
        ], {
          stdio: ['ignore', 'ignore', 'pipe', handle.fd],
        });
        let stderr = '';
        child.stderr?.on('data', (chunk: Buffer) => {
          stderr = (stderr + chunk.toString('utf8')).slice(-512);
        });
        child.once('error', reject);
        child.once('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('archive writer active or flock unavailable: ' + stderr));
        });
      });
      return await operation();
    } finally {
      await handle.close();
    }
  } catch {
    return err(domainError('PERSISTENCE_FAILED', 'archive_lock',
      'could not acquire crash-recoverable local archive lock'));
  }
};
