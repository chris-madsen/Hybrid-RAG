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
    && input.arguments?.semantic_query?.[0] === 'crash-provider') {
    process.exit(19);
  }
  if (input.name === 'search_graph'
    && input.arguments?.semantic_query?.[0] === 'hang-provider') {
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
      data = input.arguments.semantic_query
        ? { semantic: { cols: ['qn', 'file', 'score'], rows: [] } }
        : { cols: ['qn', 'file', 'rank'], rows: [] };
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
