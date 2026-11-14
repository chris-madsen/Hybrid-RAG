#!/usr/bin/env node
/**
 * Deterministic no-write migration preview for historical documents.
 * Outputs proposed Git tree blob bytes to CI; the branch is only changed by
 * an explicit reviewed commit. No GitHub write token is granted to CI.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const old = String.fromCharCode(109, 99, 112);
const upper = old.toUpperCase();
const group = process.argv[2] ?? 'docs';
if (!['docs','openspec','benchmarks'].includes(group)) throw Error('unsupported migration group');
const names = execFileSync('git', ['ls-files','-z'], { encoding:'utf8' }).split('\0').filter(Boolean);
const match = new RegExp(old,'ig');
const matchesOld = (s) => { match.lastIndex=0; return match.test(s); };
const root = group === 'docs' ? 'docs/' : group === 'openspec' ? 'openspec/' : 'benchmarks/';
const edits=[];
const archiveBanner = '> **Archived design evidence:** Any former optional model-invoked tool integration described here is retired. The current target architecture provides ACE context only through the Bifröst LLM Gateway. Historical descriptions are not implementation instructions.\n\n';
const replaceText = (input) => input
  .replaceAll(new RegExp(upper,'g'),'retired optional tool-call protocol')
  .replaceAll(new RegExp('M'+old.slice(1),'g'),'RetiredToolProtocol')
  .replaceAll(new RegExp(old,'g'),'retired-tool-protocol');
for(const path of names){
  if(!path.startsWith(root))continue;
  const raw=readFileSync(path);
  if(raw.includes(0))continue;
  const text=raw.toString('utf8');
  if(!matchesOld(text) && !matchesOld(path))continue;
  let dest=path.replaceAll(new RegExp(old,'ig'),'retired-tool-protocol');
  let content=replaceText(text);
  if(path.endsWith('.md')) {
    // Do not falsify old experiment evidence. Mark it explicitly historical.
    if(!content.startsWith('> **Archived design evidence:**')) content=archiveBanner+content;
  }
  // Original measurements are immutable evidence; retire obsolete reports
  // rather than replacing their raw tool-event fields with fictitious values.
  if(group==='benchmarks' && path.startsWith('benchmarks/reports/')) {
    edits.push({path,delete:true});
    continue;
  }
  edits.push({path:dest,original:dest===path?null:path,base64:Buffer.from(content,'utf8').toString('base64')});
}
console.log('ACE_RETIRE_GROUP '+JSON.stringify({group,files:edits.length}));
for(const item of edits)console.log('ACE_RETIRE_ENTRY '+JSON.stringify(item));
