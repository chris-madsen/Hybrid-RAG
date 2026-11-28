import { constants } from 'node:fs';
import { open, stat, type FileHandle } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';

const maximumEvidenceBytes = 16 * 1024;

type EvidenceFileOpener = (path: string, flags: number) => Promise<FileHandle>;

const isWithin = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
};

const sameFileVersion = (left: import('node:fs').Stats, right: import('node:fs').Stats): boolean =>
  left.isFile() && right.isFile() && left.dev === right.dev && left.ino === right.ino
  && left.size === right.size && left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;

/** Read only a small external receipt, binding its path checks and byte read to one stable descriptor. */
export const readLocalNativeChainEvidence = async (
  path: string | undefined,
  sourceRoot: string,
  openFile: EvidenceFileOpener = open,
): Promise<{ readonly status: 'not_run' | 'loaded' | 'unavailable'; readonly evidence?: unknown }> => {
  if (path === undefined) return { status: 'not_run' };
  const unavailable = { status: 'unavailable' } as const;
  try {
    const evidencePath = realpathSync(path);
    const checkoutRoot = realpathSync(sourceRoot);
    if (isWithin(checkoutRoot, evidencePath)) return unavailable;

    const descriptor = await openFile(evidencePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const before = await descriptor.stat();
      if (!before.isFile() || before.size > maximumEvidenceBytes) return unavailable;

      // Confirm that the pathname still identifies the opened inode after open().
      const currentEvidencePath = realpathSync(path);
      if (currentEvidencePath !== evidencePath || isWithin(checkoutRoot, currentEvidencePath)) return unavailable;
      const pathMetadata = await stat(currentEvidencePath);
      if (!sameFileVersion(before, pathMetadata)) return unavailable;

      // Read at most one byte beyond the cap so a concurrently enlarged file stays bounded.
      const bytes = Buffer.alloc(maximumEvidenceBytes + 1);
      let byteLength = 0;
      while (byteLength < bytes.length) {
        const result = await descriptor.read(bytes, byteLength, bytes.length - byteLength, byteLength);
        if (result.bytesRead === 0) break;
        byteLength += result.bytesRead;
      }
      const after = await descriptor.stat();
      if (byteLength > maximumEvidenceBytes || !sameFileVersion(before, after) || byteLength !== after.size) {
        return unavailable;
      }
      return { status: 'loaded', evidence: JSON.parse(bytes.subarray(0, byteLength).toString('utf8')) as unknown };
    } finally {
      await descriptor.close();
    }
  } catch {
    return unavailable;
  }
};