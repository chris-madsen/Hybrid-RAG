#!/usr/bin/env node
process.env.ACE_GATEWAY_HTTP_MODE = 'true';
await import('./ace-runtime.js');
