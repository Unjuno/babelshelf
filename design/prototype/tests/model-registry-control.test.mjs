import {runtimeStatus} from '../src/runtime-status.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createTextInference} from '../src/text-inference.ts';
import {withLocalModels} from '../../../dist/local-model-manifest.js';
import {settings} from '../src/app-settings.ts';
import {textExecutionRoute} from '../src/text-execution-route.ts';
const base=JSON.parse(await readFile(new URL('../../../dist/model-manifest.json',import.meta.url),'utf8'));
// Actual hook/port source with controlled React effects and worker command completion.
// This checks scheduling/cancellation, not inference or device capability.
const source=(await readFile(new URL('../src/useBonsai.ts',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/new URL\('\.\/[^']+-worker\.ts',import\.meta\.url\)/g,"'worker'");
function setup(loaded='',options={}){
 const effects=[],refs=[],calls=[],stateWrites=[];let index=0,resolveConfigure;const inferenceLeaseManager=options.inferenceLeaseManager??{async acquire(){return {protected:false,release:async()=>{}};}};
 class Engine{get needsRecovery(){return options.needsRecovery===true;}async recover(){calls.push('recover');return await options.recover();}constructor(manifest){this.manifest=manifest;this.loaded=loaded;this.worker={terminate(){}};}mustUnloadForRegistryUpdate(baseManifestChanged){return !!this.loaded&&baseManifestChanged;}init(){return Promise.resolve({});}call(cmd){calls.push(cmd);if(cmd==='configure')return new Promise(resolve=>{resolveConfigure=resolve;});if(cmd==='status'){if(options.statusError)return Promise.reject(options.statusError);return options.statusGate??Promise.resolve({'4B':{filesPresent:false}});}if(cmd==='count'&&options.countError){if(options.unloadOnCountError)this.loaded='';return Promise.reject(options.countError);}return Promise.resolve({});}abort(){calls.push('abort');if(options.unloadOnAbort)this.loaded='';return options.abortGate;}async load(model){calls.push('load:'+model);if(options.loadGate)await options.loadGate;if(options.unloadOnAbort&&calls.includes('abort'))throw Error('Stopped');if(options.loadError)throw options.loadError;this.loaded=model;return options.loadResult;}async unload(){calls.push('unload');this.loaded='';if(options.unloadError)throw options.unloadError;}async generate(){calls.push('generate');return {text:'controlled test output'};}}
 const useRef=value=>refs[index++]??(refs[index-1]={current:value}),useState=value=>[typeof value==='object'?{'4B':{filesPresent:true}}:value,next=>stateWrites.push(next)];
 const hook=new Function('createTextInference','useEffect','useRef','useState','Engine','withLocalModels','baseManifest','Worker','TextEngineRouter','createOnnxTextBackend','combinedTextManifest','lfmTextModels','describeLfmText','createLfmTextBackend','inferenceLeaseManager','runtimeStatus','createQwen3TextBackend','customQwen3Models','describeQwen3Text','createLfm3TextBackend','customLfm3TextModels','describeLfm3Text','lfm3TextModels','settings','textExecutionRoute',stripTypeScriptTypes(source)+';return useBonsai;')(createTextInference,f=>effects.push(f),useRef,useState,Engine,withLocalModels,base,class{},class{constructor(webml){return webml;}},()=>{},x=>x,[],()=>({}),()=>{},inferenceLeaseManager,runtimeStatus,()=>{},()=>[],()=>({contextTokens:2048,runtime:{revision:'cpu'},models:[]}),()=>{},()=>[],()=>({contextTokens:2048,runtime:{revision:'webgpu'},models:[]}),[],settings,textExecutionRoute);
 const api=hook([],true),cleanup=effects[0]();return {api,calls,stateWrites,cleanup,release:()=>resolveConfigure({})};
}
for(const operation of ['load','prepare'])test('Stop during registry synchronization cannot start '+operation,async()=>{
 const {api,calls,release}=setup(),pending=operation==='load'?api.load('4B'):api.prepare('4B',false,[]);
 await Promise.resolve();await Promise.resolve();api.stop();release();await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,['configure','abort']);assert.equal(api.loaded,'');
});

test('Stop immediately after successful worker replacement still invalidates the old registry cache',async()=>{
 const options={},f=setup('',options),first=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();await first;
 options.needsRecovery=true;options.recover=async()=>{options.needsRecovery=false;f.api.stop();return true;};
 await assert.rejects(f.api.load('4B'),/Stopped/);assert.equal(f.calls.filter(c=>c==='configure').length,1);
 const retry=f.api.load('4B');for(let i=0;i<10&&f.calls.filter(c=>c==='configure').length<2;i++)await Promise.resolve();assert.equal(f.calls.filter(c=>c==='configure').length,2,'replacement must receive canonical registry before Load');f.release();await retry;assert.equal(f.calls.filter(c=>c==='load:4B').length,2);
});

test('Stop during pending custom registration cannot begin weight preparation',async()=>{
 const {api,calls,release}=setup(),sha256='a'.repeat(64),record={id:'local-'+sha256,label:'Local',role:'text',engine:'webml-qwen35',revision:'sha256:'+sha256,file:{bytes:1000,sha256},contextTokens:2048,inspection:{format:'GGUF',version:3,bytes:1000,name:'Local',architecture:'qwen35',contextLength:4096,tokenizer:'gpt2',chatTemplate:true,tokenCount:1024,tensorCount:1,tensorTypes:[143],tensorExtentsChecked:true,dataOffset:512}};
 const pending=api.importCustom(record,[]);await Promise.resolve();await Promise.resolve();api.stop();release();await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,['configure','abort']);
});
test('Stop while a changed registry unloads/configures cannot start generation',async()=>{
 const {api,calls,release}=setup('4B'),pending=api.generate([{role:'user',content:'test'}],16);
 for(let i=0;i<10&&!calls.includes('configure');i++)await Promise.resolve();assert.ok(calls.includes('configure'));api.stop();release();await assert.rejects(pending,/Stopped/);assert.deepEqual(calls,['unload','configure','abort']);assert.equal(api.loaded,'');
});


test('failed Load refreshes local presence without masking the original error or replaying',async()=>{
 const error=Error('Model not prepared'),f=setup('',{loadError:error}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();await assert.rejects(pending,e=>e===error);assert.deepEqual(f.calls,['configure','load:4B','status']);assert.ok(f.stateWrites.some(v=>v?.['4B']?.filesPresent===false));assert.equal(f.api.loaded,'');
});
test('hook carries worker load timings through the same safe public inference boundary',async()=>{
 const f=setup('',{loadResult:{timings:{verificationMs:4,importMs:2,runtimeLoadMs:30,totalLoadMs:40,runtimeModuleReused:false,device:'PRIVATE'}}}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();
 assert.deepEqual(await pending,{verificationMs:4,importMs:2,runtimeLoadMs:30,totalLoadMs:40,runtimeModuleReused:false});
 await f.api.unload();
});

test('Text model residency holds one cross-tab lease until explicit Unload',async()=>{
 const leases=[],manager={async acquire(role){const lease={role,released:false,protected:true,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 assert.equal(leases.length,1);assert.equal(leases[0].role,'Text');assert.equal(leases[0].released,false);
 await f.api.unload();assert.equal(leases[0].released,true);
});
test('Stop waits for worker cleanup before releasing a lost model lease',async()=>{
 let finish;const abortGate=new Promise(resolve=>{finish=resolve;}),leases=[];
 const manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,unloadOnAbort:true,abortGate}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 f.api.stop();await Promise.resolve();assert.equal(leases[0].released,false);
 finish();for(let i=0;i<10&&!leases[0].released;i++)await Promise.resolve();assert.equal(leases[0].released,true);
});
test('unmount waits for pending worker disposal before releasing its lease',async()=>{
 let finish;const abortGate=new Promise(resolve=>{finish=resolve;}),leases=[];
 const manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,unloadOnAbort:true,abortGate}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 f.cleanup();await Promise.resolve();assert.equal(leases[0].released,false);
 finish();for(let i=0;i<10&&!leases[0].released;i++)await Promise.resolve();assert.equal(leases[0].released,true);
});
test('unconfirmed cleanup keeps the lease and blocks a new load',async()=>{
 let fail;const abortGate=new Promise((_resolve,reject)=>{fail=reject;}),leases=[];
 const manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,unloadOnAbort:true,abortGate}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 f.api.stop();fail(Error('Worker cleanup not confirmed'));for(let i=0;i<5;i++)await Promise.resolve();
 await assert.rejects(f.api.load('4B'),/cleanup not confirmed/);assert.equal(leases[0].released,false);assert.equal(f.calls.filter(call=>call==='load:4B').length,1);
});
test('Stop during load keeps its temporary lease until disposal completes',async()=>{
 let finishLoad,finishAbort;const loadGate=new Promise(resolve=>{finishLoad=resolve;}),abortGate=new Promise(resolve=>{finishAbort=resolve;}),leases=[];
 const manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,loadGate,abortGate,unloadOnAbort:true}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();for(let i=0;i<10&&!f.calls.includes('load:4B');i++)await Promise.resolve();
 f.api.stop();finishLoad();for(let i=0;i<10;i++)await Promise.resolve();assert.equal(leases[0].released,false);
 finishAbort();await assert.rejects(pending,/Stopped/);assert.equal(leases[0].released,true);
});
test('Stop retains the lease while a model stays resident',async()=>{
 for(const unloadOnAbort of [true,false]){
  const leases=[],manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,unloadOnAbort}),pending=f.api.load('4B');
  for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
  f.api.stop();for(let i=0;i<10;i++)await Promise.resolve();assert.equal(leases[0].released,unloadOnAbort);
  await f.api.unload();assert.equal(leases[0].released,true);
 }
});
test('a failed inference retains its lease until explicit unload while cleanup is unconfirmed',async()=>{
 for(const unloadOnCountError of [true,false]){
  const leases=[],failure=Error('Text worker stopped'),manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,countError:failure,unloadOnCountError}),pending=f.api.load('4B');
  for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
  await assert.rejects(f.api.count([{role:'user',content:'hello'}]),error=>error===failure);
  assert.equal(leases[0].released,false);
  await f.api.unload();assert.equal(leases[0].released,true);
 }
});
test('failed presence probe preserves original Load error',async()=>{
 const error=Error('Model load failed'),f=setup('',{loadError:error,statusError:Error('Status failed')}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();await assert.rejects(pending,e=>e===error);assert.deepEqual(f.calls,['configure','load:4B','status']);
});
test('unconfirmed cleanup after failed Load retains its lease and blocks retry',async()=>{
 const leases=[],failure=Object.assign(Error('Model cleanup not confirmed · reopen app'),{cleanupUnconfirmed:true}),manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,loadError:failure}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await assert.rejects(pending,error=>error===failure);
 assert.equal(leases[0].released,false);await assert.rejects(f.api.load('4B'),/cleanup not confirmed/);assert.equal(f.calls.filter(call=>call==='load:4B').length,1);
});
test('unconfirmed cleanup after failed Unload retains the lease and blocks reload',async()=>{
 const leases=[],failure=Object.assign(Error('Model cleanup not confirmed · reopen app'),{cleanupUnconfirmed:true}),manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,unloadError:failure}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 await assert.rejects(f.api.unload(),error=>error===failure);assert.equal(leases[0].released,false);
 await assert.rejects(f.api.load('4B'),/cleanup not confirmed/);assert.equal(f.calls.filter(call=>call==='load:4B').length,1);
});
test('explicit Unload checks a lost resident before releasing its lease',async()=>{
 const leases=[],failure=Object.assign(Error('Model cleanup not confirmed · reopen app'),{cleanupUnconfirmed:true}),options={countError:Error('Text worker stopped'),unloadOnCountError:true,unloadError:failure};
 options.inferenceLeaseManager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}};
 const f=setup('',options),pending=f.api.load('4B');for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 await assert.rejects(f.api.count([{role:'user',content:'hello'}]),/Text worker stopped/);
 await assert.rejects(f.api.unload(),error=>error===failure);assert.equal(leases[0].released,false);
});
test('confirmed cleanup after failed Unload releases the lease and preserves the error',async()=>{
 const leases=[],failure=Object.assign(Error('Unload failed'),{cleanupConfirmed:true}),manager={async acquire(){const lease={protected:true,released:false,async release(){this.released=true;}};leases.push(lease);return lease;}},f=setup('',{inferenceLeaseManager:manager,unloadError:failure}),pending=f.api.load('4B');
 for(let i=0;i<10&&!f.calls.includes('configure');i++)await Promise.resolve();f.release();await pending;
 await assert.rejects(f.api.unload(),error=>error===failure);assert.equal(leases[0].released,true);
});
test('Stop before failed Load completion cannot start a presence probe',async()=>{
 let finish;const loadGate=new Promise(resolve=>finish=resolve),f=setup('',{loadGate,loadError:Error('Model failed')}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();for(let i=0;i<10&&!f.calls.includes('load:4B');i++)await Promise.resolve();f.api.stop();finish();await assert.rejects(pending,/Stopped/);assert.deepEqual(f.calls,['configure','load:4B','abort']);
});
test('Stop during a presence probe discards the late UI update',async()=>{
 let finish;const statusGate=new Promise(resolve=>finish=resolve),f=setup('',{statusGate,loadError:Error('Model failed')}),pending=f.api.load('4B');await Promise.resolve();await Promise.resolve();f.release();for(let i=0;i<15&&!f.calls.includes('status');i++)await Promise.resolve();assert.ok(f.calls.includes('status'));f.api.stop();finish({'4B':{filesPresent:false}});await assert.rejects(pending,/Stopped/);assert.equal(f.stateWrites.some(v=>v?.['4B']?.filesPresent===false),false);
});
