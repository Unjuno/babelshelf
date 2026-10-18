import {runtimeStatus} from '../src/runtime-status.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createTextInference} from '../src/text-inference.ts';
import {withLocalModels} from '../../../dist/local-model-manifest.js';
const base=JSON.parse(await readFile(new URL('../../../dist/model-manifest.json',import.meta.url),'utf8'));
// Actual hook/port source with controlled React effects and worker command completion.
// This checks scheduling/cancellation, not inference or device capability.
const source=(await readFile(new URL('../src/useBonsai.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/new URL\('\.\/(?:bonsai|onnx-text|lfm-text)-worker\.ts',import\.meta\.url\)/g,"'worker'");
function setup(loaded='',options={}){
 const effects=[],refs=[],calls=[],stateWrites=[];let index=0,resolveConfigure;
 class Engine{constructor(manifest){this.manifest=manifest;this.loaded=loaded;this.worker={terminate(){}};}init(){return Promise.resolve({});}call(cmd){calls.push(cmd);if(cmd==='configure')return new Promise(resolve=>{resolveConfigure=resolve;});if(cmd==='status'){if(options.statusError)return Promise.reject(options.statusError);return options.statusGate??Promise.resolve({'4B':{filesPresent:false}});}return Promise.resolve({});}abort(){calls.push('abort');}async load(model){calls.push('load:'+model);if(options.loadGate)await options.loadGate;if(options.loadError)throw options.loadError;this.loaded=model;}async unload(){calls.push('unload');this.loaded='';}async generate(){calls.push('generate');return {text:'controlled test output'};}}
 const useRef=value=>refs[index++]??(refs[index-1]={current:value}),useState=value=>[typeof value==='object'?{'4B':{filesPresent:true}}:value,next=>stateWrites.push(next)];
 const hook=new Function('createTextInference','useEffect','useRef','useState','Engine','withLocalModels','baseManifest','Worker','TextEngineRouter','createOnnxTextBackend','combinedTextManifest','lfmTextModels','describeLfmText','createLfmTextBackend','runtimeStatus',stripTypeScriptTypes(source)+';return useBonsai;')(createTextInference,f=>effects.push(f),useRef,useState,Engine,withLocalModels,base,class{},class{constructor(webml){return webml;}},()=>{},x=>x,[],()=>({}),()=>{},runtimeStatus);
 const api=hook([],true);effects[0]();return {api,calls,stateWrites,release:()=>resolveConfigure({})};
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


test('failed Load refreshes local presence without masking the original error or replaying',async()=>{
 const error=Error('Model not prepared'),f=setup('',{loadError:error}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();await assert.rejects(pending,e=>e===error);assert.deepEqual(f.calls,['configure','load:4B','status']);assert.ok(f.stateWrites.some(v=>v?.['4B']?.filesPresent===false));assert.equal(f.api.loaded,'');
});
test('failed presence probe preserves original Load error',async()=>{
 const error=Error('Model load failed'),f=setup('',{loadError:error,statusError:Error('Status failed')}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();await assert.rejects(pending,e=>e===error);assert.deepEqual(f.calls,['configure','load:4B','status']);
});
test('Stop before failed Load completion cannot start a presence probe',async()=>{
 let finish;const loadGate=new Promise(resolve=>finish=resolve),f=setup('',{loadGate,loadError:Error('Model failed')}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();for(let i=0;i<10&&!f.calls.includes('load:4B');i++)await Promise.resolve();f.api.stop();finish();await assert.rejects(pending,/Stopped/);assert.deepEqual(f.calls,['configure','load:4B','abort']);
});
test('Stop during a presence probe discards the late UI update',async()=>{
 let finish;const statusGate=new Promise(resolve=>finish=resolve),f=setup('',{statusGate,loadError:Error('Model failed')}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();for(let i=0;i<15&&!f.calls.includes('status');i++)await Promise.resolve();assert.ok(f.calls.includes('status'));f.api.stop();finish({'4B':{filesPresent:false}});await assert.rejects(pending,/Stopped/);assert.equal(f.stateWrites.some(v=>v?.['4B']?.filesPresent===false),false);
});
