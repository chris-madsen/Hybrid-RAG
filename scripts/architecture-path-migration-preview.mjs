#!/usr/bin/env node
// Temporary read-only migration preview. It never changes tracked files or uses credentials.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { posix } from 'node:path';
const nested = 'docs/' + 'docs/';
const group = process.argv[2];
const tracked = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const names = new Set(tracked);
for (const path of tracked) {
  let dir = posix.dirname(path);
  while (dir !== '.') { names.add(dir); dir = posix.dirname(dir); }
}
const dest = path => path.startsWith(nested) ? 'docs/' + path.slice(nested.length) : path;
const immutable = new Set(['.agents/matt-pocock-skills-v1.3.2-manifest.json','.agents/codebase-design-v1.3.2-manifest.json']);
for (const manifest of [...immutable]) {
  for (const file of JSON.parse(readFileSync(manifest,'utf8')).files) immutable.add(file.path);
}
function isImmutable(path) {
  return immutable.has(path) || path.startsWith('benchmarks/reports/') ||
    path.startsWith('third_party/') || path.endsWith('.jsonl') ||
    path.endsWith('.csv') || path === 'package-lock.json';
}
function bucket(path) {
  if (path.startsWith(nested)) return 'nested';
  if (path.startsWith('docs/operations/')) return 'operations';
  if (path.startsWith('docs/plans/')) return 'plans';
  if (path.startsWith('docs/')) return 'other-docs';
  if (path.startsWith('openspec/')) return 'openspec';
  return 'repo';
}
function resolve(path, target) {
  const abs = posix.normalize(posix.join(posix.dirname(path), target)).replace(/\/$/,'');
  return !abs.startsWith('../') && names.has(abs) ? abs : null;
}
function rebase(path, target) {
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) return target;
  const idx = target.search(/[?#]/);
  const raw = idx < 0 ? target : target.slice(0,idx);
  const suffix = idx < 0 ? '' : target.slice(idx);
  const decoded = (()=>{ try{return decodeURIComponent(raw)}catch{return raw} })();
  const abs = resolve(path, decoded);
  if (!abs) return target;
  if (dest(path) === path && dest(abs) === abs) return target;
  let rel = posix.relative(posix.dirname(dest(path)),dest(abs)) || '.';
  if (raw.includes('%20')) rel=rel.replaceAll(' ','%20');
  return rel+(raw.endsWith('/')?'/':'')+suffix;
}
function migrate(path, original) {
  // Keep explicitly pinned history URLs intact. Rewrite current-branch URLs and repository path literals.
  const urls = [];
  let s=original.replace(/https?:\/\/[^\s<>()\x60"']+/g, url=>{
    const current=url.replace(/(\/(?:blob|tree)\/(?:main|HEAD)\/)docs\/docs\//g,'$1docs/');
    return '\u0001URL'+(urls.push(current)-1)+'\u0002';
  });
  // Markdown links (including reference definitions), then inline relative paths.
  if (path.endsWith('.md')) {
    s=s.replace(/(\]\(|^\s*\[[^\]\n]+\]:[ \t]*)(<?)([^ \t\n)>]+)(>?)/gm,
      (_,p,lt,t,gt)=>p+lt+rebase(path,t)+gt);
  }
  // Do not rebase a link a second time: relative paths in inline code only.
  s=s.replace(/(\x60)((?:\.\.\/|\.\/)+[^ \t\n\x60]+)(\x60)/g,(_,a,t,b)=>a+rebase(path,t)+b);
  // Non-Markdown source/config paths are repository-root paths. Textual root path references also follow the move.
  s=s.replaceAll(nested,'docs/');
  // Some documents refer to former paths relative to docs/ rather than the repository root.
  // Rebase bare inline-code paths if they resolve to a moved entry.
  if (path.startsWith('docs/')) {
    s=s.replace(/(\x60)(docs\/(?:architecture|references|operations|spikes)\/[^ \t\n\x60]+)(\x60)/g,(_,a,t,b)=>{
      const abs=resolve(path,t);return a+(abs&&dest(abs)!==abs?rebase(path,t):t)+b;
    });
  }
  return s.replace(/\u0001URL(\d+)\u0002/g,(_,n)=>urls[Number(n)]);
}
let selected=0,changed=0,skipped=0;
for (const path of tracked) {
  if(bucket(path)!==group)continue;
  if(dest(path)!==path&&names.has(dest(path)))throw Error('destination collision: '+dest(path));
  const raw=readFileSync(path);
  if(raw.includes(0))continue;
  const original=raw.toString('utf8');
  if(!Buffer.from(original,'utf8').equals(raw))continue;
  selected++;
  if(isImmutable(path)){if(original.includes(nested)){console.log('ACE_PRESERVED '+JSON.stringify(path));skipped++}continue}
  const content=migrate(path,original);
  if(content===original&&dest(path)===path)continue;
  const record={path:dest(path),old:path,mode:execFileSync('git',['ls-files','-s','--',path],{encoding:'utf8'}).split(' ')[0],base64:Buffer.from(content,'utf8').toString('base64')};
  // Limit line size; a long document is emitted as separately indexed chunks.
  const serialized=JSON.stringify(record);
  const encoded=Buffer.from(serialized).toString('base64');
  const chunks=encoded.match(/.{1,12000}/g);
  for(let i=0;i<chunks.length;i++)console.log('ACE_MOVE '+JSON.stringify({id:changed,i,n:chunks.length,data:chunks[i]}));
  changed++;
}
console.log('ACE_MOVE_SUMMARY '+JSON.stringify({group,selected,changed,skipped}));
