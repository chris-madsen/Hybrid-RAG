import { createHash } from 'node:crypto';
import { Effect } from 'effect';
import type { StructuralAnalysisPort } from '../application/ports.js';
import { makeStructuralAnalysis, type StructuralAnalysis, type StructuralKind, type StructuralSymbol } from '../domain/semantic.js';
import { domainError, type DomainError } from '../domain/errors.js';
import { err, type Result } from '../domain/result.js';
import type { RepoPath } from '../domain/workspace.js';
import type { CodebaseMemoryRepoMap, NativeOutlineRow } from './codebase-memory-repo-map.js';

/**
 * Binds upstream CBM get_file_outline to ACE's verified-source pipeline.
 * No AST, regex parser or graph construction in ACE; CBM owns identification.
 * Only byte slices from ACE-verified original files become evidence.
 */
const labelKind = (label: string): StructuralKind => {
  switch (label.toLowerCase()) {
    case 'class': return 'class';
    case 'function': return 'function';
    case 'method': return 'method';
    case 'interface': return 'interface';
    case 'type': return 'type';
    case 'enum': return 'enum';
    case 'struct': return 'struct';
    case 'trait': return 'trait';
    case 'module': return 'module';
    case 'field': return 'field';
    default: return 'unknown';
  }
};

const byteStarts = (source: Uint8Array): number[] => {
  const starts = [0];
  for (let offset = 0; offset < source.byteLength; offset++) {
    if (source[offset] === 10) starts.push(offset + 1);
  }
  return starts;
};

export const cbmOutlineToAnalysis = (
  repoPath: RepoPath,
  source: Uint8Array,
  outline: readonly NativeOutlineRow[],
): Result<StructuralAnalysis, DomainError> => {
  const starts = byteStarts(source);
  const symbols: StructuralSymbol[] = [];
  const seen = new Set<string>();
  for (const entry of outline) {
    const start = starts[entry.startLine - 1];
    const end = starts[entry.endLine] ?? source.byteLength;
    if (start === undefined || !Number.isSafeInteger(end) || end <= start
      || end > source.byteLength) {
      return err(domainError('INVALID_EXTERNAL_RESPONSE', repoPath,
        'native CBM outline references bytes outside the verified source'));
    }
    const key = [entry.name, entry.startLine, entry.endLine, entry.label].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    const endLine = starts[entry.endLine] === undefined ? entry.endLine : entry.endLine + 1;
    symbols.push({
      name: entry.name, kind: labelKind(entry.label), providerKind: entry.label,
      startLine: entry.startLine, startColumn: 1, endLine,
      endColumn: starts[entry.endLine] === undefined
        ? end - (starts[entry.endLine - 1] ?? start) + 1 : 1,
      startByteOffset: start, endByteOffset: end,
    });
  }

  // Declaration-free files remain indexable as exact raw chunks. This is not
  // a fabricated function or an ACE call graph: just verified source bytes.
  if (symbols.length === 0 && source.byteLength > 0) {
    const maxLine = Math.min(starts.length, 160);
    const end = starts[maxLine] ?? source.byteLength;
    if (end > 0) symbols.push({
      name: repoPath, kind: 'module', providerKind: 'FileChunk',
      startLine: 1, startColumn: 1,
      endLine: starts[maxLine] === undefined ? maxLine : maxLine + 1,
      endColumn: starts[maxLine] === undefined ? end - (starts[maxLine - 1] ?? 0) + 1 : 1,
      startByteOffset: 0, endByteOffset: end,
    });
  }
  return makeStructuralAnalysis({
    repoPath,
    sourceDigest: createHash('sha256').update(source).digest('hex'),
    symbols,
    hasSyntaxErrors: false,
  });
};

export const makeCodebaseMemoryStructuralPort = (
  cbm: Pick<CodebaseMemoryRepoMap, 'outline'>,
): StructuralAnalysisPort => {
  const extract: StructuralAnalysisPort['extract'] = (input) =>
    Effect.gen(function* () {
      const outlined = yield* cbm.outline(input.repoPath as RepoPath);
      if (outlined._tag === 'Err') return outlined;
      return cbmOutlineToAnalysis(input.repoPath as RepoPath, input.source, outlined.value);
    });
  return {
    extract,
    extractMany: (inputs) => Effect.promise(async () => {
      const out: Result<StructuralAnalysis, DomainError>[] = [];
      for (let start = 0; start < inputs.length; start += 8) {
        const chunk = inputs.slice(start, start + 8);
        out.push(...await Promise.all(chunk.map((input) => Effect.runPromise(extract(input)))));
      }
      return out;
    }),
  };
};
