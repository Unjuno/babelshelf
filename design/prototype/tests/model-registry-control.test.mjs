import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createTextInference} from '../src/text-inference.ts';
import {withLocalModels} from '../../../dist/local-model-manifest.js';
const base=JSON.parse(await readFile(new URL('../../../dist/model-manifest.json',import.meta.url),'utf8'));
// Actual hook/port source with controlled React effects and worker command completion.
// This checks scheduling/cancellation, not inference or device capability.
const source=(await readFile(new URL('../src/useBonsai.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/new URL\('\.\/bonsai-worker\.ts',import\.meta\.url\)/g,"'worker'");
function setup(loaded=''){
 const effects=[],refs=[],calls=[];let index=0,resolveConfigure;
 class Engine{constructor(manifest){this.manifest=manifest;this.loaded=loaded;this.worker={terminate(){}};}init(){return Promise.resolve({});}call(cmd){calls.push(cmd);if(cmd==='configure')return new Promise(resolve=>{resolveConfigure=resolve;});return Promise.resolve({});}abort(){calls.push('abort');}async load(model){calls.push('load:'+model);this.loaded=model;}async unload(){calls.push('unload');this.loaded='';}async generate(){calls.push('generate');return {text:'controlled test output'};}}
 const useRef=value=>refs[index++]??(refs[index-1]={current:value}),useState=value=>[typeof value==='object'?{'4B':{filesPresent:true}}:value,()=>{}];
 const hook=new Function('createTextInference','useEffect','useRef','useState','Engine','withLocalModels','baseManifest','Worker',stripTypeScriptTypes(source)+';return useBonsai;')(createTextInference,f=>effects.push(f),useRef,useState,Engine,withLocalModels,base,class{});
 const api=hook([],true);effects[0]();return {api,calls,release:()=>resolveConfigure({})};
}
for(const operation of ['load','prepare'])test('Stop during registry synchronization cannot start '+operation,async()=>{
 const {api,calls,release}=setup(),pending=operation==='load'?api.load('4B'):api.prepare('4B',false,[]);
 await Promise.resolve();await Promise.resolve();api.stop();release();await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,['configure','abort']);assert.equal(api.loaded,'');
});

test('Stop during pending custom registration cannot begin weight preparation',async()=>{
 const {api,calls,release}=setup(),sha256='a'.repeat(64),record={id:'local-'+sha256,label:'Local',role:'text',engine:'webml-qwen35',revision:'sha256:'+sha256,file:{bytes:1000,sha256},inspection:{format:'GGUF',version:3,bytes:1000,name:'Local',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}};
 const pending=api.importCustom(record,[]);await Promise.resolve();await Promise.resolve();api.stop();release();await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,['configure','abort']);
});
test('Stop while a changed registry unloads/configures cannot start generation',async()=>{
 const {api,calls,release}=setup('4B'),pending=api.generate([{role:'user',content:'test'}],16);
 for(let i=0;i<10&&!calls.includes('configure');i++)await Promise.resolve();assert.ok(calls.includes('configure'));api.stop();release();await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,['unload','configure','abort']);assert.equal(api.loaded,'');
});
