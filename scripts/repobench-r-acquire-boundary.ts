import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const maxRecordsBytes = 512 * 1024 * 1024;

const httpsUrl = (value: string): URL => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('records URL must use HTTPS without embedded credentials or a fragment');
  }
  return url;
};

/** The expected digest is operator-provided, not obtained from the response. */
export const downloadPinnedRepoBenchRecords = async (
  recordsUrl: string,
  expectedSha256: string,
  request: typeof fetch = fetch,
  maximumBytes: number = maxRecordsBytes,
): Promise<Uint8Array> => {
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) throw new Error('independently pinned SHA-256 is required');
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > maxRecordsBytes) {
    throw new Error('invalid records size limit');
  }
  let url = httpsUrl(recordsUrl);
  const signal = AbortSignal.timeout(30_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await request(url, { redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (location === null || redirects === 5) throw new Error('invalid records redirect');
      url = httpsUrl(new URL(location, url).href);
      continue;
    }
    if (!response.ok || response.body === null) {
      await response.body?.cancel();
      throw new Error('records download failed');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    const hash = createHash('sha256');
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > maximumBytes) throw new Error('records size limit exceeded');
        chunks.push(chunk.value);
        hash.update(chunk.value);
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
    if (size === 0 || hash.digest('hex') !== expectedSha256) throw new Error('records digest mismatch or empty download');
    return Buffer.concat(chunks, size);
  }
  throw new Error('records redirect limit exceeded');
};

type RepoBenchArtifactName = 'records.raw' | 'manifest.json' | 'source-snapshots.json' | 'acquisition.json';

/** The caller owns a freshly reserved output directory; never follow a final symlink or replace a file. */
export const writeRepoBenchArtifact = async (
  directory: string,
  name: RepoBenchArtifactName,
  data: string | Uint8Array,
): Promise<void> => {
  await writeFile(resolve(directory, name), data, { flag: 'wx', mode: 0o600 });
};
