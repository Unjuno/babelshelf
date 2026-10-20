import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRuntimeModuleCache} from '../dist/runtime-module.js';
const source=new Blob(['verified runtime']),pin={revision:'a'.repeat(40),file:{bytes:source.size,sha256:createHash('sha256').update('verified runtime').digest('hex')}};
function setup(importModule=async()=>({factory(){}})){const created=[],revoked=[];return {created,revoked,load:createRuntimeModuleCache({importModule,createURL:blob=>{created.push(blob);return 'blob:controlled-'+created.length;},revokeURL:url=>revoked.push(url)})};}
test('one verified code import is reused, but a same-size changed file is still rejected',async()=>{
 let imports=0;const api={factory(){}},f=setup(async()=>{imports++;return api;});
 const a=await f.load(source,pin),b=await f.load(source,pin);assert.equal(a.api,api);assert.equal(b.api,api);assert.equal(a.reused,false);assert.equal(b.reused,true);assert.equal(imports,1);assert.equal(f.created.length,1);assert.equal(f.revoked.length,1);
 await assert.rejects(f.load(new Blob(['corrupt! runtime']),pin),/verification/);assert.equal(imports,1);
});
test('a different runtime pin requires a new Worker, with no second code import',async()=>{
 const f=setup();await f.load(source,pin);await assert.rejects(f.load(source,{...pin,revision:'b'.repeat(40)}),/restart model worker/);assert.equal(f.created.length,1);
});
test('failed import is released and only a later explicit call retries it',async()=>{
 let n=0;const error=Error('controlled import failure'),f=setup(async()=>{if(++n===1)throw error;return{};});await assert.rejects(f.load(source,pin),e=>e===error);assert.equal(n,1);assert.equal(f.revoked.length,1);await f.load(source,pin);assert.equal(n,2);assert.equal(f.revoked.length,2);
});
test('Stop during import returns no API to the caller; later explicit retry reuses only the verified code',async()=>{
 let finish;const f=setup(()=>new Promise(resolve=>finish=resolve)),stop=new AbortController(),pending=f.load(source,pin,stop.signal);
 while(!finish)await new Promise(resolve=>setTimeout(resolve,0));stop.abort(Error('Stopped'));finish({factory(){}});await assert.rejects(pending,/Stopped/);assert.equal(f.created.length,1);assert.equal(f.revoked.length,1);assert.equal((await f.load(source,pin)).reused,true);
});
test('an already stopped request neither hashes nor imports',async()=>{
 const f=setup(),stop=new AbortController();stop.abort(Error('Stopped'));await assert.rejects(f.load(source,pin,stop.signal),/Stopped/);assert.equal(f.created.length,0);
});
test('synchronous URL creation failure preserves its cause and permits explicit retry',async()=>{
 const error=Error('controlled URL failure');let n=0;
 const load=createRuntimeModuleCache({createURL(){if(++n===1)throw error;return 'blob:second';},importModule:async()=>({}),revokeURL(){}});
 await assert.rejects(load(source,pin),e=>e===error);assert.equal((await load(source,pin)).reused,false);
});
