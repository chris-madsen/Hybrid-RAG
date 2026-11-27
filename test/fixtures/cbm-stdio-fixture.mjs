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

connection.onRequest('tools/call', (input) => {
  log({ method: 'tools/call', tool: input.name });
  if (input.name === 'search_graph'
    && (input.arguments?.query ?? input.arguments?.semantic_query?.[0]) === 'crash-provider') {
    process.exit(19);
  }
  if (input.name === 'search_graph'
    && (input.arguments?.query ?? input.arguments?.semantic_query?.[0]) === 'close-input-provider') {
    // Deliberately leave the child alive with its input closed; a subsequent
    // parent write races JSON-RPC disposal rather than normal process exit.
    process.stdin.once('close', () => log({ method: 'stdin-closed' }));
    process.stdin.destroy();
    setInterval(() => undefined, 1000);
    return new Promise(() => undefined);
  }
  if (input.name === 'search_graph'
    && (input.arguments?.query ?? input.arguments?.semantic_query?.[0]) === 'hang-provider') {
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
      if (process.argv.includes('--native-bm25')) {
        const query = input.arguments.query;
        // An unexpected search mode or rewritten input fails the contract.
        if (input.arguments.semantic_query || !['find exact evidence', 'duplicate lexical', 'unowned lexical',
          'unmatched lexical', 'full lexical', 'Find exactEvidence and third', 'paged lexical',
          'malformed lexical'].includes(query)) {
          data = { error: 'expected unchanged native BM25 query' };
        } else if (query === 'malformed lexical') {
          data = { cols: ['qn', 'file'], rows: [] };
        } else if (query === 'paged lexical') {
          const offset = input.arguments.offset ?? 0;
          data = { cols: ['qn', 'file', 'rank'], rows: offset === 0
            ? Array.from({ length: input.arguments.limit }, (_, index) =>
              ['fixture.unowned.' + index, 'src/unindexed.ts', -1 + index / 100])
            : [['fixture.semantic', 'src/semantic.ts', -0.1]] };
        } else {
          data = { cols: ['qn', 'file', 'rank'], rows: [
            ['fixture.semantic', 'src/semantic.ts', -0.9],
            ...(query === 'duplicate lexical' ? [['fixture.semantic', 'src/semantic.ts', -0.8]] : []),
            ...(query === 'unowned lexical' ? [['fixture.other', 'src/unindexed.ts', -0.8]] : []),
            ...(query === 'unmatched lexical' ? [['fixture.other', 'src/exact-evidence.ts', -0.8]] : []),
            ['fixture.exactEvidence', 'src/exact-evidence.ts', -0.7],
            ...(query === 'Find exactEvidence and third' ? [
              ['fixture.third', 'src/third.ts', -0.6],
              ['fixture.fourth', 'src/fourth.ts', -0.5],
            ] : []),
          ] };
        }
      } else {
        data = input.arguments.semantic_query
          ? { semantic: { cols: ['qn', 'file', 'score'], rows: [] } }
          : { cols: ['qn', 'file', 'rank'], rows: [] };
      }
      break;
    case 'trace_path':
      data = { callees: { cols: ['name', 'hop'], groups: [] } };
      break;
    case 'query_graph':
      data = { columns: ['qn', 'file'], rows: [] };
      break;
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
