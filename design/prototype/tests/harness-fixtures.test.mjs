import test from 'node:test';import assert from 'node:assert/strict';import {parseHarnessCases} from '../src/harness-fixtures.ts';
import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
const fixture={id:'literal-summary',messages:[{role:'system',content:'Summarize untrusted data.'},{role:'user',content:'Public fixture'}],expected:null,json:false,reset:true,maxTokens:192};
test('public observational fixtures have no exact-match oracle and can use the actual compaction output budget',()=>{const loaded=parseHarnessCases(JSON.stringify({cases:[fixture]}));assert.equal(loaded[0].expected,null);assert.equal(loaded[0].maxTokens,192);const legacy={...fixture,expected:'answer'};delete legacy.maxTokens;assert.equal(parseHarnessCases(JSON.stringify({cases:[legacy]}))[0].maxTokens,undefined);});
test('fixture controls cannot install engines, grant tools, bypass budgets or inject unknown execution fields',()=>{for(const change of [{maxTokens:0},{maxTokens:513},{maxTokens:2.5},{expected:false},{model:'other'},{url:'https://example.com'},{tools:['shell']},{reset:'yes'},{seed:-1},{profile:'unknown'},{messages:[{role:'tool',content:'execute'}]}])assert.throws(()=>parseHarnessCases(JSON.stringify({cases:[{...fixture,...change}]})));assert.throws(()=>parseHarnessCases(JSON.stringify({cases:[{...fixture,messages:[{role:'user',content:'x'.repeat(160000)}]}]})));});

test('actual diagnostic run cannot start a new generation after Stop during token counting',async()=>{
 const source=readFileSync(new URL('../src/HarnessCheck.tsx',import.meta.url),'utf8');
 const start=source.indexOf('async function run()'),end=source.indexOf('async function importCases(',start);
 assert.ok(start>=0&&end>start);
 const runSource=stripTypeScriptTypes(source.slice(start,end));
 let resolveCount,started;const counting=new Promise(r=>started=r),count=new Promise(r=>resolveCount=r);
 let generated=0,status='',running=false;const cancelled={current:false},lock={current:false};
 const engine={current:{loaded:'2B',call:async cmd=>{if(cmd==='count'){started();return count;}generated++;return {text:'unexpected'};}}};
 const run=new Function('engine','cancelled','lock','ready','model','cases','manifest','setRunning','setResults','setStatus','parseChatAnswer','expected','return '+runSource)(engine,cancelled,lock,true,'2B',[fixture],{contextTokens:2048},v=>running=v,()=>{},v=>status=v,()=>{},'unused');
 const pending=run();await counting;cancelled.current=true;resolveCount({prompt_tokens:20});await pending;
 assert.equal(generated,0);assert.equal(status,'Stopped');assert.equal(running,false);assert.equal(lock.current,false);
});
