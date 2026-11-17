import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

const checker = new URL('../scripts/ace-sdlc-stage-trial-check.mjs', import.meta.url).pathname;
const SH = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runGit = (root, ...cmd) => execFileSync('git', ['-C', root, ...cmd], { encoding: 'utf8' }).trim();
const write = (root, path, data) => { const dest=join(root,path); mkdirSync(dirname(dest), {recursive:true}); writeFileSync(dest,data); };
const stages = ['R','S','A','P','X'];
const skills = ['ace-stage-handoff','ace-sdd-prepare','ace-architecture-design','ace-to-tickets','ace-phase-plan'];
function trial(action) {
  const root=mkdtempSync(join(tmpdir(),'ace-sdlc-chain-'));
  const home='openspec/changes/trial-loop/';
  try {
    runGit(root,'init','-q','-b','baseline');
    runGit(root,'config','user.email','trial@example.invalid');
    runGit(root,'config','user.name','ACE trial');
    write(root,'AGENTS.md','# Invariant\nResponses only. No Chat fallback.\n');
    runGit(root,'add','.'); runGit(root,'commit','-qm','initial');
    const scenario = { schemaVersion:'ace.sdlc.handoff-trial.v1',changeId:'trial-loop',transport:'openai.responses',g02:'REVIEW_REQUIRED',stages:[] };
    let parentRef='baseline';
    for(const stage of stages){
      const branch='trial-'+stage.toLowerCase();
      const parentHead=runGit(root,'rev-parse','HEAD');
      const paths={R:['AGENTS.md'],S:['docs/reviews/trial.md'],A:[home+'proposal.md',home+'specs'],P:[home+'design.md'],X:[home+'tasks.md',home+'design.md']}[stage];
      const inputs=paths.map(path=>({path,oid:runGit(root,'rev-parse',parentHead+':'+path)}));
      runGit(root,'checkout','-qb',branch);
      if(stage==='R')write(root,'docs/reviews/trial.md','Research under SHA: source observed\n');
      if(stage==='S'){
        write(root,home+'.openspec.yaml','schema: spec-driven\n');
        write(root,home+'proposal.md','# Proposal\n## Why\nNeed safe trial\n## What Changes\nPlanning only\n');
        write(root,home+'specs/trial/spec.md','# Spec Delta\n### Requirement: Trial\nShall be safe.\n#### Scenario: TRL-001 — safe\n- WHEN run\n- THEN plan\n');
      }
      if(stage==='A')write(root,home+'design.md','# Design\n## Decisions\nTarget agent transport: openai.responses\nLegacy Chat route: RETIRED_NOT_SUPPORTED\nG02: REVIEW_REQUIRED\nTRL-001\n');
      if(stage==='P')write(root,home+'tasks.md','# Tasks\n- [ ] C01 — TRL-001 [phase](phases/C01.md)\n');
      if(stage==='X')write(root,home+'phases/C01.md','# Executable C01\n**Phase ID:** C01\n**Acceptance IDs:** TRL-001\n');
      runGit(root,'add','.');runGit(root,'commit','-qm','stage '+stage);
      const head=runGit(root,'rev-parse','HEAD');
      const outPaths={R:['docs/reviews/trial.md'],S:[home+'proposal.md',home+'specs'],A:[home+'design.md'],P:[home+'tasks.md'],X:[home+'phases']}[stage];
      const outputs=outPaths.map(path=>({path,oid:runGit(root,'rev-parse',head+':'+path)}));
      scenario.stages.push({id:stage,branch,head,parentRef,parentHead,inputs,outputs});
      parentRef=branch;
    }
    const session='hermes-session-immutable-trial';
    const events=[{kind:'user_request',session}];
    for(let i=0;i<stages.length;i++){
      events.push({kind:'tool_call',tool:'skill_view',skill:skills[i],success:true,session});
      if(i<stages.length-1)events.push({kind:'handoff',from:stages[i],to:stages[i+1],session});
    }
    const evidence = join(root,'evidence');mkdirSync(evidence,{recursive:true});
    // Evidence is not committed; the recorded Git heads are immutable inputs.
    const traceFile=join(evidence,'hermes-events.jsonl');
    const saveTrace=()=>{const bytes=events.map(e=>JSON.stringify(e)).join('\n')+'\n'; writeFileSync(traceFile,bytes);scenario.trace={file:traceFile,sha256:SH(bytes)};};
    saveTrace();
    const verify=()=>{const path=join(root,'trial.json');writeFileSync(path,JSON.stringify(scenario));const x=spawnSync(process.execPath,[checker,'--root',root,'--manifest',path,'--json'],{encoding:'utf8'});return {code:x.status,result:JSON.parse(x.stdout),stderr:x.stderr};};
    action({root,home,scenario,events,traceFile,saveTrace,verify,git:(...x)=>runGit(root,...x),write:(p,c)=>write(root,p,c)});
  } finally { rmSync(root,{recursive:true,force:true}); }
}
function blocked(value,id,reason){assert.equal(value.code,2,value.stderr);assert.ok(value.result.checks.some(x=>x.id===id && x.status==='BLOCKED' && (!reason||x.reason.includes(reason))),JSON.stringify(value.result));}
test('R/S/A/P/X and native Responses trace is structural only, never live or G02 proof',()=>trial(x=>{const v=x.verify();assert.equal(v.code,0,JSON.stringify(v.result));assert.equal(v.result.verdict,'STRUCTURAL_REVIEW_ONLY');assert.equal(v.result.liveHermes,'NOT_ATTESTED_BY_THIS_CHECK');assert.equal(v.result.g02,'REVIEW_REQUIRED');}));
test('omitted stage is blocked',()=>trial(x=>{x.scenario.stages.splice(2,1);blocked(x.verify(),'INPUT');}));
test('extra owner prompt between stages is blocked',()=>trial(x=>{x.events.splice(3,0,{kind:'user_request',session:x.events[0].session});x.saveTrace();blocked(x.verify(),'HERMES_TRACE');}));
test('missing tool invocation is blocked',()=>trial(x=>{x.events.splice(x.events.findIndex(e=>e.skill==='ace-to-tickets'),1);x.saveTrace();blocked(x.verify(),'HERMES_TRACE');}));
test('trace tampering without digest refresh is blocked',()=>trial(x=>{writeFileSync(x.traceFile,readFileSync(x.traceFile,'utf8')+'{"kind":"other"}\n');blocked(x.verify(),'HERMES_TRACE','trace SHA');}));
test('changed parent Research memo marks Requirements descendant stale',()=>trial(x=>{x.git('checkout','-q','trial-r');x.write('docs/reviews/trial.md','Research changed decision\n');x.git('add','.');x.git('commit','-qm','reviewer changes R');const v=x.verify();assert.equal(v.result.verdict,'STALE');blocked(v,'PARENT_DRIFT','STALE_PARENT S');}));
test('unrelated parent change requires restack but does not impersonate stale inputs',()=>trial(x=>{x.git('checkout','-q','trial-r');x.write('docs/other.md','unrelated\n');x.git('add','.');x.git('commit','-qm','unrelated R update');const v=x.verify();assert.equal(v.result.verdict,'NEEDS_RESTACK');blocked(v,'PARENT_DRIFT','NEEDS_RESTACK');}));
test('Chat-first target in manifest is prohibited',()=>trial(x=>{x.scenario.transport='openai.chat.completions';blocked(x.verify(),'INPUT');}));
test('Chat-first design cannot hide behind Responses manifest',()=>trial(x=>{x.git('checkout','-q','trial-a');x.write(x.home+'design.md','# Design\n## Decisions\nTarget agent transport: openai.responses\nLegacy Chat route: RETIRED_NOT_SUPPORTED\nFirst validate Chat Completions then add Responses\n');x.git('add','.');x.git('commit','-qm','bad chat-first design');x.scenario.stages[2].head=x.git('rev-parse','HEAD');x.scenario.stages[2].outputs[0].oid=x.git('rev-parse','HEAD:'+x.home+'design.md');const v=x.verify();blocked(v,'ARTIFACTS_AND_PROTOCOL','Chat-first');}));
test('omitted phase from tasks is blocked',()=>trial(x=>{x.git('checkout','-q','trial-x');x.write(x.home+'tasks.md','# Tasks\n- [ ] C01 — missing link\n');x.git('add','.');x.git('commit','-qm','bad phase link');x.scenario.stages[4].head=x.git('rev-parse','HEAD');blocked(x.verify(),'ARTIFACTS_AND_PROTOCOL','orphan phase');}));

test('independent but non-interleaved skills/handoffs are not an automatic pipeline',()=>trial(x=>{const moves=x.events.filter(e=>e.kind==='handoff');for(let i=x.events.length-1;i>=0;i--)if(x.events[i].kind==='handoff')x.events.splice(i,1);x.events.push(...moves);x.saveTrace();blocked(x.verify(),'HERMES_TRACE','reordered');}));

test('a changed parent can be reconciled by restacking all descendants and regenerating OIDs',()=>trial(x=>{
  x.git('checkout','-q','trial-r');
  x.write('docs/reviews/trial.md','Research refreshed after parent review\n');
  x.git('add','.');x.git('commit','-qm','reviewed research update');
  let nextParentHead=x.git('rev-parse','HEAD');
  x.scenario.stages[0].head=nextParentHead;
  x.scenario.stages[0].outputs[0].oid=x.git('rev-parse',nextParentHead+':docs/reviews/trial.md');
  for(let i=1;i<x.scenario.stages.length;i++){
    const stage=x.scenario.stages[i];
    const oldParent=stage.parentHead;
    x.git('checkout','-q',stage.branch);
    x.git('rebase','-q','--onto',nextParentHead,oldParent,stage.branch);
    stage.parentHead=nextParentHead;
    stage.head=x.git('rev-parse','HEAD');
    for(const item of stage.inputs)item.oid=x.git('rev-parse',stage.parentHead+':'+item.path);
    for(const item of stage.outputs)item.oid=x.git('rev-parse',stage.head+':'+item.path);
    nextParentHead=stage.head;
  }
  const result=x.verify();assert.equal(result.code,0,JSON.stringify(result.result));
  assert.equal(result.result.verdict,'STRUCTURAL_REVIEW_ONLY');
}));
