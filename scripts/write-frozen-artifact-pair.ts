import { constants } from 'node:fs';
import { mkdir, open } from 'node:fs/promises';
import { basename, dirname } from 'node:path';

// Freeze outputs are immutable evidence, never mutable files. Atomically reserve
// each filename using O_EXCL + O_NOFOLLOW before writing any bytes. A collision
// is a hard failure, not permission to overwrite a prior holdout or a symlink.
// Two distinct files cannot be committed atomically as one filesystem operation;
// if the second reservation fails the first file remains empty and must be
// explicitly inspected/removed by the operator (never unlink a raced path).
export const writeFrozenArtifactPair = async (
  outputPath: string,
  bytes: Uint8Array,
  digest: string,
): Promise<void> => {
  await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
  const flags = constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0);
  const data = await open(outputPath, flags, 0o600);
  try {
    const checksum = await open(outputPath + '.sha256', flags, 0o600);
    try {
      await data.writeFile(bytes);
      await checksum.writeFile(digest + '  ' + basename(outputPath) + '\n', 'utf8');
      await data.sync();
      await checksum.sync();
    } finally {
      await checksum.close();
    }
  } finally {
    await data.close();
  }
};
