import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {withLocalModels,verifyLocalModelFile} from '../dist/local-model-manifest.js';
const base=JSON.parse(await readFile(new URL('../dist/model-manifest.json',import.meta.url)));
const sha256='a'.repeat(64);
const record=()=>({id:'local-'+sha256,label:'My fine tune',role:'text',engine:'webml-qwen35',revision:'sha256:'+sha256,file:{bytes:1000,sha256},inspection:{format:'GGUF',version:3,bytes:1000,name:'My model',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}});
test('custom manifest extends builtins with data only and preserves fixed runtime/budget',()=>{
 const before=structuredClone(base),r=record(),out=withLocalModels(base,[r]);assert.deepEqual(base,before);assert.deepEqual(out.runtime,base.runtime);assert.deepEqual(out.models.slice(0,base.models.length),base.models);assert.equal(out.contextTokens,2048);
 const model=out.models.at(-1);assert.equal(model.id,r.id);assert.equal(model.revision,r.revision);assert.equal(model.file.url,undefined);assert.equal(model.file.name,sha256+'.gguf');assert.equal(model.license,undefined);assert.equal(model.localModel.engine,'webml-qwen35');
 assert.throws(()=>withLocalModels(base,[r,r]),/Duplicate/);assert.throws(()=>withLocalModels(base,[{...r,runtime:{url:'https://example.com'}}]),/model/);assert.throws(()=>withLocalModels(base,Array(65).fill(r)),/registry/);
});
test('an LFM2 custom model never enters the WebML Qwen3.5 registry',()=>{
 const value=record();value.engine='wllama-lfm2';value.inspection.architecture='lfm2';value.inspection.tensorTypes=[0,2,14];value.inspection.tensorCount=3;
 const out=withLocalModels(base,[value]);assert.equal(out.models.length,base.models.length);assert.ok(!out.models.some(model=>model.id===value.id));
});
test('registered declaration cannot verify unrelated local bytes',async()=>{
 await assert.rejects(verifyLocalModelFile(new Blob([new Uint8Array(1000)]),record()),/GGUF|verification/i);
});

test('worker registration preserves engine authority and custom preparation cannot fetch',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');let fetched=0;const events=[];
 const context=vm.createContext({withLocalModels,verifyLocalModelFile,structuredClone,fetch:()=>{fetched++;throw Error('unexpected network');},postMessage:e=>events.push(e),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.workerTest={manifest:()=>manifest,setLoaded:()=>{model={};},clear:()=>{model=null;}};',context);
 context.root={}; // status catches unavailable asset metadata, never prepares it.
 async function command(cmd,args){const id=events.length+1;await context.onmessage({data:{id,cmd,args}});return events.findLast(e=>e.id===id);}
 assert.equal((await command('init',{manifest:base})).type,'done');assert.equal((await command('configure',{models:[record()]})).type,'done');assert.equal(context.workerTest.manifest().models.length,base.models.length+1);
 const pinned=context.workerTest.manifest();assert.equal((await command('configure',{models:[{...record(),ready:true}]})).type,'error');assert.equal(context.workerTest.manifest(),pinned);
 context.workerTest.setLoaded();assert.match((await command('configure',{models:[]})).value,/Unload/);context.workerTest.clear();
 assert.match((await command('prepare',{model:record().id,allowNetwork:true})).value,/local files/);
 assert.match((await command('prepare',{model:record().id,allowNetwork:false,localFiles:[]})).value,/Local model file required/);
 assert.match((await command('prepare',{model:record().id,allowNetwork:false,modelFile:new Blob([new Uint8Array(1000)])})).value,/GGUF|verification/);assert.equal(fetched,0);
});
