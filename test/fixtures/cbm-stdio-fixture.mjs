import { appendFileSync } from 'node:fs';
import {
  createMessageConnection, StreamMessageReader, StreamMessageWriter,
} from 'vscode-jsonrpc/node';

const connection = createMessageConnection(
  new StreamMessageReader(process.stdin),
  new StreamMessageWriter(process.stdout),
);

const log = (value) => {
  if (process.env.ACE_CBM_TEST_LOG) {
    appendFileSync(process.env.ACE_CBM_TEST_LOG, JSON.stringify({ pid: process.pid, ...value }) + '\n');
  }
};

connection.onRequest('initialize', (input) => {
  log({ method: 'initialize' });
  if (process.argv.includes('--hang-initialize')) return new Promise(() => undefined);
  return {
    protocolVersion: input.protocolVersion,
    serverInfo: {
      name: 'codebase-memory-mcp',
      version: process.argv.includes('--wrong-version') ? '0.0.0' : '0.12.1',
    },
    capabilities: { tools: { listChanged: false } },
  };
});

let includeOverrideEdge = false;
connection.onRequest('tools/call', (input) => {
  log({ method: 'tools/call', tool: input.name });
  if (input.name === 'search_graph'
    && input.arguments?.semantic_query?.[0] === 'crash-provider') {
    process.exit(19);
  }
  if (input.name === 'search_graph'
    && input.arguments?.semantic_query?.[0] === 'close-input-provider') {
    // Deliberately leave the child alive with its input closed; a subsequent
    // parent write races JSON-RPC disposal rather than normal process exit.
    process.stdin.once('close', () => log({ method: 'stdin-closed' }));
    process.stdin.destroy();
    setInterval(() => undefined, 1000);
    return new Promise(() => undefined);
  }
  if (input.name === 'search_graph'
    && input.arguments?.semantic_query?.[0] === 'hang-provider') {
    if (process.argv.includes('--ignore-termination')) {
      process.on('SIGTERM', () => undefined);
      // Keep the process alive even when the cancelled parent closes stdin.
      setInterval(() => undefined, 1000);
    }
    return new Promise(() => undefined);
  }
  let data;
  switch (input.name) {
    case 'index_repository':
      data = { status: 'indexed', project: 'test-cbm' };
      break;
    case 'get_file_outline':
      data = {
        file_path: input.arguments.file_path,
        total: 1,
        has_more: false,
        cols: ['name', 'label', 'lines', 'qn'],
        rows: [['handler', 'Function', '1-3', 'test-cbm.src.handler']],
      };
      break;
    case 'search_graph':
      if (process.argv.includes('--partial-semantic-bm25')) {
        if (input.arguments.semantic_query) {
          includeOverrideEdge = input.arguments.semantic_query[0] === 'linked inheritance override';
        }
        data = input.arguments.semantic_query
          ? { semantic: { cols: ['qn', 'file', 'score'], rows: [
            ['fixture.semantic', 'src/semantic.ts', 0.9],
            ...(input.arguments.semantic_query[0] === 'duplicate semantic' ? [['fixture.semantic', 'src/semantic.ts', 0.8]] : []),
            ...(input.arguments.semantic_query[0] === 'unowned semantic' ? [['fixture.other', 'src/unindexed.ts', 0.8]] : []),
            ...(input.arguments.semantic_query[0] === 'unmatched semantic' ? [['fixture.other', 'src/exact-evidence.ts', 0.8]] : []),
            ...(input.arguments.semantic_query[0] === 'full semantic' ? [['fixture.exactEvidence', 'src/exact-evidence.ts', 0.8]] : []),
            ...(['linked underfill', 'linked inheritance override'].includes(input.arguments.semantic_query[0]) ? [
              ['fixture.exactEvidence', 'src/exact-evidence.ts', 0.8],
              ['fixture.third', 'src/third.ts', 0.7],
              ['fixture.fourth', 'src/fourth.ts', 0.6],
            ] : []),
          ] } }
          : { cols: ['qn', 'file', 'rank'], rows: [
            ['fixture.semantic', 'src/semantic.ts', -0.2],
            ['fixture.exactEvidence', 'src/exact-evidence.ts', -0.1],
          ] };
      } else {
        data = input.arguments.semantic_query
          ? { semantic: { cols: ['qn', 'file', 'score'], rows: [] } }
          : { cols: ['qn', 'file', 'rank'], rows: [] };
      }
      if (!input.arguments.semantic_query && input.arguments.query === 'full semantic') {
        data = { error: 'BM25 must not be called for a full valid semantic shortlist' };
      }
      if (!input.arguments.semantic_query && input.arguments.query === 'malformed lexical') {
        data = { cols: ['qn', 'file'], rows: [] };
      }
      break;
    case 'trace_path':
      data = { callees: { cols: ['name', 'hop'], groups: [] } };
      break;
    case 'query_graph': {
      // Model the pinned CBM relationship names, not aliases invented by ACE.
      const query = input.arguments.query;
      const edgeTypes = /\[r:([^\]]+)\]/u.exec(query)?.[1]?.split('|') ?? [];
      const rows = [];
      if (process.argv.includes('--partial-semantic-bm25') && query.includes("origin.file_path = 'src/third.ts'")) {
        if (query.startsWith('MATCH (origin)-') && edgeTypes.includes('INHERITS')) {
          rows.push(['fixture.linked', 'src/linked.ts']);
        }
        if (includeOverrideEdge && query.startsWith('MATCH (other)-') && edgeTypes.includes('OVERRIDE')) {
          rows.push(['fixture.overrideTarget', 'src/override.ts']);
        }
      }
      data = { columns: ['qn', 'file'], rows };
      break;
    }
    case 'detect_changes':
      data = { files: [] };
      break;
    default:
      data = { error: 'unsupported' };
  }
  if (input.name === 'query_graph' && process.argv.includes('--tool-error')) {
    return { isError: true, content: [{ type: 'text', text: 'query failed' }] };
  }
  return {
    isError: false,
    structuredContent: data,
    content: [{ type: 'text', text: JSON.stringify(data) }],
  };
});

connection.listen();
