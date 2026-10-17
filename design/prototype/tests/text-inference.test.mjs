import test from 'node:test';import assert from 'node:assert/strict';
import {createTextInference} from '../src/text-inference.ts';
const fixture=()=>({manifest:{contextTokens:2048,models:[{id:'local',revision:'weights'}],runtime:{revision:'runtime'}},loaded:'local',assets:{local:{filesPresent:true}},load:async()=>{},stop:()=>{},count:async()=>({prompt_tokens:9}),generate:async()=>({text:'actual port output'})});
test('inference boundary delegates exact messages and exposes no download or storage authority',async()=>{const p=fixture(),messages=[{role:'user',content:'Original 日本語'}];p.generate=async(m,max)=>{assert.equal(m,messages);assert.equal(max,64);return {text:'port result'};};const e=createTextInference(()=>p);assert.equal((await e.generate(messages,64)).text,'port result');assert.equal(e.prepare,undefined);assert.equal(e.save,undefined);assert.equal(e.manifest.contextTokens,2048);});
test('Stop and changed model during asynchronous inference refuse late output',async()=>{const p=fixture();let release;p.generate=()=>new Promise(r=>release=r);const e=createTextInference(()=>p),pending=e.generate([]);e.stop();release({text:'late'});await assert.rejects(pending,/Stopped/);const changed=e.generate([]);p.loaded='other';release({text:'wrong model'});await assert.rejects(changed,/Model changed/);});
test('unprepared load and invalid runtime results fail without manufacturing output',async()=>{const p=fixture(),e=createTextInference(()=>p);let loads=0;p.load=async()=>loads++;await assert.rejects(e.load('missing'),/not prepared/);assert.equal(loads,0);p.count=async()=>({prompt_tokens:NaN});await assert.rejects(e.count([]),/token count/);p.generate=async()=>({text:'partial',stopped:true});await assert.rejects(e.generate([]),/Stopped/);p.generate=async()=>({text:42});await assert.rejects(e.generate([]),/generation result/);});

test('counting uses live port state and late counts after Stop do not become budgets',async()=>{let release;const p={manifest:{contextTokens:128,models:[],runtime:{revision:'r'}},loaded:'local',assets:{},load:async()=>{},stop:()=>{},count:()=>new Promise(r=>release=r),generate:async()=>({text:''})};const e=createTextInference(()=>p),pending=e.count([]);e.stop();release({prompt_tokens:4});await assert.rejects(pending,/Stopped/);p.loaded='';await assert.rejects(e.generate([]),/not loaded/);});


test('same-ID model revision, runtime revision and context changes invalidate pending results',async()=>{
 for(const change of [p=>p.manifest.models[0].revision='new-weights',p=>p.manifest.runtime.revision='new-runtime',p=>p.manifest.contextTokens=4096]){
  for(const method of ['count','generate']){
   const p=fixture();let release;p[method]=()=>new Promise(r=>release=r);
   const e=createTextInference(()=>p),pending=e[method]([]);change(p);
   release(method==='count'?{prompt_tokens:9}:{text:'old engine output'});
   await assert.rejects(pending,/Model changed/);
  }
 }
});
test('equivalent live adapter replacement keeps valid results without relying on React object identity',async()=>{
 let p=fixture(),release;p.generate=()=>new Promise(r=>release=r);
 const e=createTextInference(()=>p),pending=e.generate([]);p=fixture();release({text:'same pinned engine'});
 assert.equal((await pending).text,'same pinned engine');
});
