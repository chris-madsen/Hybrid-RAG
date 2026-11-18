#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
const ORDER = ['R', 'S', 'A', 'P', 'X'];
const SKILLS = ['ace-stage-handoff', 'ace-sdd-prepare', 'ace-architecture-design', 'ace-to-tickets', 'ace-phase-plan'];
const output = { schemaVersion: 'ace.sdlc.stage-trial.v1', verdict: 'BLOCKED', g02: 'REVIEW_REQUIRED', liveHermes: 'NOT_ATTESTED_BY_THIS_CHECK', providerWire: 'NOT_RUN', checks: [] };
const assert = (ok, message) => { if (!ok) throw Error(message); };
const attempt = (id, fn) => { try { fn(); output.checks.push({ id, status: 'PASS' }); } catch(e) { output.checks.push({ id, status: 'BLOCKED', reason: e.message }); } };
const argv = (s) => process.argv.includes(s) ? process.argv[process.argv.indexOf(s)+1] : null;
const sha = (s) => typeof s === 'string' && /^[a-f0-9]{40}$/u.test(s);
const safe = (s) => typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.\/-]*$/u.test(s) && !s.includes('..') && !s.includes('//') && !s.includes('@{') && !s.startsWith('/') && !s.split('/').includes('.git');
const git = (root,...args) => execFileSync('git',['-C',root,...args],{ encoding:'utf8', stdio:['ignore','pipe','pipe'],maxBuffer:1<<20 }).trimEnd();
const oid = (root,head,path) => { assert(sha(head) && safe(path),'unsafe git object'); return git(root,'rev-parse','--verify',head+':'+path); };
const show = (root,head,path) => { assert(sha(head) && safe(path),'unsafe git show'); return git(root,'show',head+':'+path); };
let doc, root;
attempt('INPUT', () => {
  const manifest = argv('--manifest'), dir = argv('--root');
  assert(manifest && dir, 'use --manifest file --root git-checkout');
  doc = JSON.parse(readFileSync(resolve(manifest),'utf8'));
  root = realpathSync(resolve(dir));
  assert(git(root,'rev-parse','--show-toplevel') === root,'root must be Git checkout');
  assert(doc.schemaVersion === 'ace.sdlc.handoff-trial.v1','unknown trial manifest schema');
  assert(/^[a-z0-9][a-z0-9-]*$/u.test(doc.changeId),'invalid change ID');
  assert(doc.transport === 'openai.responses','Responses-only target required');
  assert(doc.g02 === 'REVIEW_REQUIRED','cannot claim G02 approval');
  assert(Array.isArray(doc.stages) && doc.stages.length===5,'exact R/S/A/P/X stages required');
});
attempt('GIT_CHAIN', () => {
  assert(doc && root,'invalid input');
  for (const [i,s] of doc.stages.entries()) {
    assert(s.id===ORDER[i] && safe(s.branch) && safe(s.parentRef) && sha(s.head) && sha(s.parentHead),'bad stage/branch/commit');
    if(i) assert(s.parentRef===doc.stages[i-1].branch,'parent not previous stage');
    git(root,'merge-base','--is-ancestor',s.parentHead,s.head);
    assert(Array.isArray(s.inputs) && s.inputs.length && Array.isArray(s.outputs) && s.outputs.length,'missing tracked inputs/outputs');
    for(const v of s.inputs){ assert(safe(v.path)&&sha(v.oid),'unsafe input'); assert(oid(root,s.parentHead,v.path)===v.oid && oid(root,s.head,v.path)===v.oid, 'input changed inside stage: '+v.path); }
    for(const v of s.outputs){ assert(safe(v.path)&&sha(v.oid),'unsafe output'); assert(oid(root,s.head,v.path)===v.oid,'output artifact changed: '+v.path); }
    assert(git(root,'rev-parse','--verify','refs/heads/'+s.branch)===s.head,'STAGE_HEAD_MOVED '+s.id);
  }
});
attempt('ARTIFACTS_AND_PROTOCOL', () => {
  assert(doc && root,'invalid input');
  const home='openspec/changes/'+doc.changeId+'/';
  const outputHas=(i,path)=>doc.stages[i].outputs.some(v=>v.path===path);
  assert(doc.stages[0].outputs.some(v=>/^docs\/(reviews|research)\//u.test(v.path)), 'R research evidence missing');
  assert(outputHas(1,home+'proposal.md') && outputHas(1,home+'specs'), 'S OpenSpec requirements missing');
  assert(outputHas(2,home+'design.md') && outputHas(3,home+'tasks.md') && outputHas(4,home+'phases'), 'A/P/X artifacts missing');
  const design=show(root,doc.stages[2].head,home+'design.md');
  assert(design.includes('Target agent transport: openai.responses'),'design lacks native Responses decision');
  assert(design.includes('Legacy provider route: RETIRED_NOT_SUPPORTED'),'design does not retire alternate provider routes');
  assert(!/(?:initial|first|fallback|preferred|primary)[^\n]{0,90}(?:legacy|alternate|previous)[^\n]{0,90}(?:native )?Responses/iu.test(design),'Legacy-first design detected');
  const tasks=show(root,doc.stages[4].head,home+'tasks.md');
  const names=git(root,'ls-tree','--name-only',doc.stages[4].head+':'+home+'phases').split('\n');
  assert(names.length && names.every(n=>/^[A-Za-z][A-Za-z0-9-]*\.md$/u.test(n)),'phase inventory empty/invalid');
  for(const n of names)assert(tasks.includes('phases/'+n),'orphan phase '+n);
});
attempt('PARENT_DRIFT', () => {
  assert(doc && root,'invalid input');
  for(const s of doc.stages){
    const current=git(root,'rev-parse','--verify','refs/heads/'+s.parentRef);
    if(current===s.parentHead)continue;
    for(const v of s.inputs){let actual;try{actual=oid(root,current,v.path);}catch{throw Error('STALE_PARENT '+s.id+': input removed');} if(actual!==v.oid)throw Error('STALE_PARENT '+s.id+': '+v.path);}
    throw Error('NEEDS_RESTACK '+s.id+': parent HEAD changed (inputs unchanged)');
  }
});
attempt('HERMES_TRACE', () => {
  assert(doc && root,'invalid input');
  assert(doc.trace && typeof doc.trace.file==='string' && /^[a-f0-9]{64}$/u.test(doc.trace.sha256),'raw trace SHA required');
  const bytes=readFileSync(resolve(doc.trace.file));
  assert(bytes.length<=1<<20 && createHash('sha256').update(bytes).digest('hex')===doc.trace.sha256,'trace SHA mismatch');
  const events=bytes.toString('utf8').trim().split(/\r?\n/u).map(line=>JSON.parse(line));
  const users=events.filter(e=>e.kind==='user_request');
  assert(users.length===1 && typeof users[0].session==='string' && users[0].session.length>=12,'exactly one initial user request required');
  assert(events.every(e=>e.session===users[0].session),'session continuity broken');
  const steps=events.filter(e=>e.kind==='handoff'||(e.kind==='tool_call'&&e.tool==='skill_view'));
  const expected=[];
  for(let i=0;i<SKILLS.length;i++){
    expected.push('skill:'+SKILLS[i]);
    if(i<4)expected.push('handoff:'+ORDER[i]+'>'+ORDER[i+1]);
  }
  const observed=steps.map(e=>e.kind==='handoff' ? 'handoff:'+e.from+'>'+e.to :
    e.success===true ? 'skill:'+e.skill : 'failed-skill:'+e.skill);
  assert(JSON.stringify(observed)===JSON.stringify(expected),'missing/reordered skills or automatic handoffs');
  assert(!events.some(e=>e.kind==='implementation'||e.kind==='provider_egress'),'planning run performed prohibited action');
});
if(output.checks.every(c=>c.status==='PASS'))output.verdict='STRUCTURAL_REVIEW_ONLY';
else if(output.checks.some(c=>/STALE_PARENT/u.test(c.reason||'')))output.verdict='STALE';
else if(output.checks.some(c=>/NEEDS_RESTACK/u.test(c.reason||'')))output.verdict='NEEDS_RESTACK';
process.stdout.write(JSON.stringify(output,null,2)+'\n');
if(output.verdict!=='STRUCTURAL_REVIEW_ONLY')process.exitCode=2;
