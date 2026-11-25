import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { ReadRetainedJson } from './release-selection-source-validation.js';

const inside = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep);
};

/** A separate opt-in read boundary for retained native retrieval artifacts.
 * Existing repository-contained policy/DBC/semantic readers remain unchanged.
 */
export const nativeReleaseEvidenceReader = async (
  repositoryRoot: string, externalRoot: string | undefined, readRepositoryJson: ReadRetainedJson,
): Promise<ReadRetainedJson> => {
  const repo = await realpath(repositoryRoot);
  const external = externalRoot === undefined ? undefined : await realpath(resolve(externalRoot));
  if (external !== undefined && (external === repo || inside(repo, external) || inside(external, repo)
    || !(await stat(external)).isDirectory() || external === resolve(sep))) {
    throw new Error('native release evidence root must be a separate external directory');
  }
  return async (path) => {
    const absolute = resolve(repo, path);
    const canonical = await realpath(absolute);
    if (inside(repo, absolute) && inside(repo, canonical)) return readRepositoryJson(path);
    if (external === undefined || !inside(external, absolute) || !inside(external, canonical)
      || !(await stat(canonical)).isFile()) {
      throw new Error('native retrieval evidence path escapes the authorized evidence root');
    }
    const bytes = await readFile(canonical);
    return { path: canonical, sha256: createHash('sha256').update(bytes).digest('hex'),
      value: JSON.parse(bytes.toString('utf8')) as unknown };
  };
};
