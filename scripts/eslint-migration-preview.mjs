import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import assert from 'node:assert/strict';
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:'inherit'});
const capture=(cmd,args)=>execFileSync(cmd,args,{encoding:'utf8',maxBuffer:32*1024*1024});
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const oldLock=read('package-lock.json');
run('npm',['ci','--ignore-scripts']);
const old=JSON.parse(capture('node_modules/.bin/eslint',['--print-config','src/domain/policy.ts']));
const oldTest=JSON.parse(capture('node_modules/.bin/eslint',['--print-config','test/bertrand-contracts.test.ts']));
assert.deepEqual(old.rules,oldTest.rules,'source and test rules differ; review separately');
console.log('BASELINE_RULES '+JSON.stringify(old.rules));
const pkg=read('package.json');
for(const name of ['eslint-config-airbnb-typescript','eslint-plugin-import','@typescript-eslint/parser','@typescript-eslint/eslint-plugin','eslint','eslint-import-resolver-typescript'])delete pkg.devDependencies[name];
pkg.scripts.lint='eslint "src/**/*.ts" "test/**/*.ts" --max-warnings=0';
writeFileSync('package.json',JSON.stringify(pkg,null,2)+'\n');
run('npm',['install','--ignore-scripts','--save-dev','--save-exact','eslint@10','@typescript-eslint/parser@8','@typescript-eslint/eslint-plugin@8','@stylistic/eslint-plugin@5','eslint-plugin-import-x@4','eslint-import-resolver-typescript@4']);
run('npm',['ci','--ignore-scripts']);
const {builtinRules}=await import('eslint/use-at-your-own-risk');
const ts=(await import('@typescript-eslint/eslint-plugin')).default;
const sty=(await import('@stylistic/eslint-plugin')).default;
const imp=(await import('eslint-plugin-import-x')).importX;
const aliases={'@typescript-eslint/no-throw-literal':'@typescript-eslint/only-throw-error','@typescript-eslint/no-loss-of-precision':'no-loss-of-precision'};
const severity=v=>Array.isArray(v)?v[0]:v;
const active=v=>!['off',0].includes(severity(v));
const mapped={};const rules={};const missing=[];
function exists(id){const i=id.lastIndexOf('/');if(i<0)return builtinRules.has(id);const ns=id.slice(0,i),n=id.slice(i+1);return !!({'@typescript-eslint':ts,'@stylistic':sty,'import-x':imp}[ns]?.rules?.[n]);}
function rename(id){
 if(aliases[id])return aliases[id];
 if(id.startsWith('import/'))return id.replace('import/','import-x/');
 const raw=id.replace(/^@typescript-eslint\//,'');
 const styleName=raw==='func-call-spacing'?'function-call-spacing':raw;
 if(sty.rules[styleName]&&(id.startsWith('@typescript-eslint/')&&!exists(id)||!id.includes('/')&&builtinRules.get(id)?.meta?.deprecated))return '@stylistic/'+styleName;
 return id;
}
for(const [id,opts] of Object.entries(old.rules)){
 const next=rename(id);
 if(!exists(next)){if(active(opts))missing.push(id);continue;}
 // A disabled core rule and its active TypeScript extension may map to one
 // Stylistic rule. Keep the active extension and never let off override it.
 if(next in rules&&active(rules[next])&&!active(opts))continue;
 if(next in rules&&active(rules[next])&&active(opts))assert.deepEqual(rules[next],opts,'conflicting mapped rules '+next);
 rules[next]=opts;
 if(next!==id&&active(opts))mapped[id]=next;
}
assert.deepEqual(missing,[],'unmapped active rules');
for(const [id,v] of Object.entries(old.rules))if(active(v))assert(active(rules[rename(id)]),'lost active rule '+id);
const settings=Object.fromEntries(Object.entries(old.settings??{}).map(([k,v])=>[k.replace(/^import\//,'import-x/'),v]));
delete settings['import-x/resolver'];
const config=[
"import tsParser from '@typescript-eslint/parser';",
"import tsPlugin from '@typescript-eslint/eslint-plugin';",
"import stylistic from '@stylistic/eslint-plugin';",
"import { importX, createNodeResolver } from 'eslint-plugin-import-x';",
"import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';",
"",
"// Explicit rules migrated from the previous effective Airbnb TypeScript config.",
"// Keep the original typed project, source/test scope and generated-code exclusions.",
"export default [",
"  { ignores: ['dist/**', 'node_modules/**', 'src/generated/ace-context/**'] },",
"  {",
"    files: ['src/**/*.ts', 'test/**/*.ts'],",
"    languageOptions: {",
"      parser: tsParser, ecmaVersion: 2022, sourceType: 'module',",
"      parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: import.meta.dirname },",
"    },",
"    plugins: { '@typescript-eslint': tsPlugin, '@stylistic': stylistic, 'import-x': importX },",
"    // ESLint 8 did not report unused disable directives by default.",
"    linterOptions: { reportUnusedDisableDirectives: 'off' },",
"    settings: {",
"      ..."+JSON.stringify(settings,null,2).replace(/\n/g,'\n      ')+",",
"      'import-x/resolver-next': [",
"        createTypeScriptImportResolver({ project: './tsconfig.eslint.json' }),",
"        createNodeResolver({ extensions: ['.mjs', '.js', '.json', '.ts', '.d.ts'] }),",
"      ],",
"    },",
"    rules: "+JSON.stringify(Object.fromEntries(Object.entries(rules).sort(([a],[b])=>a.localeCompare(b))),null,2).replace(/\n/g,'\n    ')+",",
"  },",
"];",
""].join('\n');
writeFileSync('eslint.config.mjs',config);
unlinkSync('.eslintrc.cjs');
const changed=['package.json','package-lock.json','eslint.config.mjs'];
// Update only explicit lint directives that refer to renamed rules.
const paths=capture('git',['ls-files','-z','src','test']).split('\0').filter(p=>p.endsWith('.ts')&&!p.startsWith('src/generated/'));
for(const p of paths){const s=readFileSync(p,'utf8');const n=s.replace(/(?:\/\*|\/\/)\s*eslint(?:-disable(?:-next-line|-line)?|-enable)?\b[^\n]*(?:\*\/)?/g,comment=>comment.replace(/(?:@typescript-eslint|import)\/[a-z][a-z-]+/g,id=>rename(id)));if(n!==s){writeFileSync(p,n);changed.push(p)}}
console.log('RULE_MAPPING '+JSON.stringify(mapped));
console.log('RULE_COUNTS '+JSON.stringify({before:Object.values(old.rules).filter(active).length,after:Object.values(rules).filter(active).length}));
const lock=read('package-lock.json');
const depNames=['eslint','glob','rimraf','inflight','@humanwhocodes/config-array','@humanwhocodes/object-schema','eslint-config-airbnb-typescript','eslint-plugin-import'];
function versions(obj){return Object.fromEntries(depNames.map(n=>[n,Object.entries(obj.packages).filter(([k])=>k.endsWith('node_modules/'+n)).map(([k,v])=>({path:k,version:v.version}))]));}
console.log('LOCK_DIFF '+JSON.stringify({old:versions(oldLock),new:versions(lock)}));
for(const p of changed){const b=Buffer.from(readFileSync(p)).toString('base64');const chunks=b.match(/.{1,10000}/g)||[''];for(let i=0;i<chunks.length;i++)console.log('ACE_ESLINT_FILE '+JSON.stringify({p,i,n:chunks.length,data:chunks[i]}));}
run('npm',['run','lint']);
run('npm',['run','check']);
run('npm',['audit','--audit-level=high']);
