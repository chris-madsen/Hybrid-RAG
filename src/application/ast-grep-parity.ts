import type { StructuralAnalysis, StructuralSymbol } from '../domain/semantic.js';

export interface SymbolParityDifference {
  readonly repoPath: string;
  readonly kind: 'missing_from_cli' | 'missing_from_napi' | 'range_mismatch' | 'export_mismatch'
  | 'import_mismatch' | 'syntax_mismatch' | 'source_mismatch' | 'path_mismatch';
  readonly name: string;
  readonly detail: string;
}

export interface SymbolParityReport {
  readonly repoPath: string;
  readonly cliSymbolCount: number;
  readonly napiSymbolCount: number;
  readonly cliSourceDigest: string;
  readonly napiSourceDigest: string;
  readonly cliHasSyntaxErrors: boolean;
  readonly napiHasSyntaxErrors: boolean;
  readonly sourceDigestMatch: boolean;
  readonly differences: readonly SymbolParityDifference[];
  readonly equivalent: boolean;
}

const normalizedKind = (symbol: StructuralSymbol): string =>
  symbol.kind === 'struct' && symbol.language?.toLocaleLowerCase() === 'typescript' ? 'type' : symbol.kind;

const semanticIdentity = (symbol: StructuralSymbol): string =>
  `${symbol.name}\0${normalizedKind(symbol)}`;

const location = (symbol: StructuralSymbol): string => [
  symbol.startLine, symbol.startColumn, symbol.endLine, symbol.endColumn,
  symbol.startByteOffset ?? 'missing', symbol.endByteOffset ?? 'missing',
  symbol.nameStartLine ?? 'missing', symbol.nameStartColumn ?? 'missing',
  symbol.nameEndLine ?? 'missing', symbol.nameEndColumn ?? 'missing',
].join(':');

const bySemanticIdentity = (symbols: readonly StructuralSymbol[]): Map<string, StructuralSymbol[]> => {
  // Preserve multiplicity: overloaded functions and same-named class methods
  // must not silently overwrite one another in a Map<string, Symbol>.
  const groups = new Map<string, StructuralSymbol[]>();
  for (const symbol of symbols) {
    const key = semanticIdentity(symbol);
    const group = groups.get(key) ?? [];
    group.push(symbol);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => (
      left.startLine - right.startLine
      || left.startColumn - right.startColumn
      || left.endLine - right.endLine
      || left.endColumn - right.endColumn
      || location(left).localeCompare(location(right))
    ));
  }
  return groups;
};

const declarationRange = (symbol: StructuralSymbol): string => [
  symbol.startLine, symbol.startColumn, symbol.endLine, symbol.endColumn,
  symbol.startByteOffset ?? 'missing', symbol.endByteOffset ?? 'missing',
].join(':');

const nameRange = (symbol: StructuralSymbol): string => [
  symbol.nameStartLine ?? 'missing', symbol.nameStartColumn ?? 'missing',
  symbol.nameEndLine ?? 'missing', symbol.nameEndColumn ?? 'missing',
].join(':');

export const compareStructuralAnalyses = (
  cli: StructuralAnalysis,
  napi: StructuralAnalysis,
): SymbolParityReport => {
  const cliGroups = bySemanticIdentity(cli.symbols);
  const napiGroups = bySemanticIdentity(napi.symbols);
  const differences: SymbolParityDifference[] = [];

  if (cli.repoPath !== napi.repoPath) {
    differences.push({
      repoPath: cli.repoPath,
      kind: 'path_mismatch',
      name: '<file>',
      detail: `${cli.repoPath} != ${napi.repoPath}`,
    });
  }
  if (cli.sourceDigest !== napi.sourceDigest) {
    differences.push({
      repoPath: cli.repoPath,
      kind: 'source_mismatch',
      name: '<file>',
      detail: `${cli.sourceDigest} != ${napi.sourceDigest}`,
    });
  }

  for (const identity of [...new Set([...cliGroups.keys(), ...napiGroups.keys()])].sort()) {
    const fromCli = cliGroups.get(identity) ?? [];
    const fromNapi = napiGroups.get(identity) ?? [];
    const pairs = Math.min(fromCli.length, fromNapi.length);
    for (let index = 0; index < pairs; index += 1) {
      const cliSymbol = fromCli[index]!;
      const napiSymbol = fromNapi[index]!;
      const name = cliSymbol.name;
      if (declarationRange(cliSymbol) !== declarationRange(napiSymbol)
        || nameRange(cliSymbol) !== nameRange(napiSymbol)) {
        differences.push({
          repoPath: cli.repoPath,
          kind: 'range_mismatch',
          name,
          detail: `declaration ${declarationRange(cliSymbol)} != ${declarationRange(napiSymbol)}; name ${nameRange(cliSymbol)} != ${nameRange(napiSymbol)}`,
        });
      }
      if ((cliSymbol.isExported ?? false) !== (napiSymbol.isExported ?? false)) {
        differences.push({
          repoPath: cli.repoPath, kind: 'export_mismatch', name,
          detail: `${String(cliSymbol.isExported)} != ${String(napiSymbol.isExported)}`,
        });
      }
      if ((cliSymbol.isImport ?? false) !== (napiSymbol.isImport ?? false)) {
        differences.push({
          repoPath: cli.repoPath, kind: 'import_mismatch', name,
          detail: `${String(cliSymbol.isImport)} != ${String(napiSymbol.isImport)}`,
        });
      }
    }
    for (const symbol of fromCli.slice(pairs)) {
      differences.push({
        repoPath: cli.repoPath, kind: 'missing_from_napi', name: symbol.name,
        detail: `${identity} @ ${location(symbol)}`,
      });
    }
    for (const symbol of fromNapi.slice(pairs)) {
      differences.push({
        repoPath: napi.repoPath, kind: 'missing_from_cli', name: symbol.name,
        detail: `${identity} @ ${location(symbol)}`,
      });
    }
  }
  if (cli.hasSyntaxErrors !== napi.hasSyntaxErrors) {
    differences.push({
      repoPath: cli.repoPath, kind: 'syntax_mismatch', name: '<file>',
      detail: `${String(cli.hasSyntaxErrors)} != ${String(napi.hasSyntaxErrors)}`,
    });
  }
  return {
    repoPath: cli.repoPath,
    cliSymbolCount: cli.symbols.length,
    napiSymbolCount: napi.symbols.length,
    cliSourceDigest: cli.sourceDigest,
    napiSourceDigest: napi.sourceDigest,
    cliHasSyntaxErrors: cli.hasSyntaxErrors,
    napiHasSyntaxErrors: napi.hasSyntaxErrors,
    sourceDigestMatch: cli.sourceDigest === napi.sourceDigest,
    differences,
    equivalent: differences.length === 0,
  };
};

export const symbolParityFingerprint = (report: SymbolParityReport): string =>
  JSON.stringify({
    repoPath: report.repoPath,
    cliSourceDigest: report.cliSourceDigest,
    napiSourceDigest: report.napiSourceDigest,
    cliHasSyntaxErrors: report.cliHasSyntaxErrors,
    napiHasSyntaxErrors: report.napiHasSyntaxErrors,
    cliSymbolCount: report.cliSymbolCount,
    napiSymbolCount: report.napiSymbolCount,
    differences: report.differences,
  });

/**
 * A corpus parity verdict is all-or-nothing, not an average symbol score.
 * 121 disagreements in 125 files are NOT 125/125 equivalent. Every pinned
 * path must have exactly one successful same-source comparison and zero
 * differences; failed/excluded paths are not silently dropped.
 */
export interface AstGrepCorpusParityVerdict {
  readonly status: 'equivalent' | 'not_equivalent';
  readonly expectedPathCount: number;
  readonly comparedPathCount: number;
  readonly matchingPathCount: number;
  readonly mismatchedPaths: readonly string[];
  readonly failedPaths: readonly string[];
  readonly missingPaths: readonly string[];
}

export const summarizeAstGrepCorpusParity = (
  expectedPaths: readonly string[],
  reports: readonly SymbolParityReport[],
  failed: readonly string[] = [],
): AstGrepCorpusParityVerdict => {
  const expected = new Set(expectedPaths);
  const counts = new Map<string, number>();
  const byPath = new Map<string, SymbolParityReport>();
  for (const report of reports) {
    counts.set(report.repoPath, (counts.get(report.repoPath) ?? 0) + 1);
    byPath.set(report.repoPath, report);
  }
  const failedPaths = [...new Set([
    ...failed,
    ...[...counts].filter(([path, count]) => count !== 1 || !expected.has(path)).map(([path]) => path),
  ])].sort();
  const missingPaths = [...expected].filter((path) => !byPath.has(path) && !failedPaths.includes(path)).sort();
  const mismatchedPaths = [...expected].filter((path) =>
    byPath.has(path) && byPath.get(path)?.equivalent !== true).sort();
  const matchingPathCount = [...expected].filter((path) =>
    byPath.get(path)?.equivalent === true && !failedPaths.includes(path)).length;
  const equivalent = expectedPaths.length > 0
    && expected.size === expectedPaths.length
    && reports.length === expectedPaths.length
    && failedPaths.length === 0 && missingPaths.length === 0
    && mismatchedPaths.length === 0 && matchingPathCount === expectedPaths.length;
  return {
    status: equivalent ? 'equivalent' : 'not_equivalent',
    expectedPathCount: expectedPaths.length,
    comparedPathCount: reports.length,
    matchingPathCount,
    mismatchedPaths,
    failedPaths,
    missingPaths,
  };
};
