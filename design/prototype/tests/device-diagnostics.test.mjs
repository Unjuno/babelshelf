import test from 'node:test';
import assert from 'node:assert/strict';
import {canRunSelectedModelDiagnostic,claimOfflineRestartAttempt,clearOfflineRestartMarker,clearSavedDeviceTestReport,completeInterruptedOfflineRestartReport,completeOfflineRestartReport,formatDeviceDiagnosticReport,isStandalonePwa,parseDeviceModelSmokeAnswer,readOfflineRestartMarker,readSavedDeviceTestReport,runDeviceDiagnostics,wasmThreadCapability,writeOfflineRestartMarker,writeSavedDeviceTestReport} from '../src/device-diagnostics.ts';

function memoryStorage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}

test('Home Screen PWA detection accepts both standard display-mode and iOS standalone signals',()=>{
 assert.equal(isStandalonePwa(true,false),true);
 assert.equal(isStandalonePwa(false,true),true);
 assert.equal(isStandalonePwa(false,false),false);
 assert.equal(isStandalonePwa(false,undefined),false);
});

test('WASM thread readiness requires isolation, SharedArrayBuffer, and shared WebAssembly memory',()=>{
 assert.deepEqual(wasmThreadCapability({crossOriginIsolated:true,sharedArrayBuffer:true,sharedWasmMemory:true}),{crossOriginIsolated:true,sharedArrayBuffer:true,sharedWasmMemory:true,prerequisitesReady:true});
 for(const missing of ['crossOriginIsolated','sharedArrayBuffer','sharedWasmMemory']){
  const capability={crossOriginIsolated:true,sharedArrayBuffer:true,sharedWasmMemory:true};capability[missing]=false;
  assert.equal(wasmThreadCapability(capability).prerequisitesReady,false,`${missing} is required`);
 }
});

test('selected model diagnostic refuses another resident inference model without unloading it',()=>{
 const ready={modelSelected:true,filesPresent:true,busy:false,otherModelLoaded:false};
 assert.equal(canRunSelectedModelDiagnostic(ready),true);
 assert.equal(canRunSelectedModelDiagnostic({...ready,otherModelLoaded:true}),false);
 assert.equal(canRunSelectedModelDiagnostic({...ready,filesPresent:false}),false);
 assert.equal(canRunSelectedModelDiagnostic({...ready,busy:true}),false);
});

test('selected model smoke counts success only for the exact expected structured answer',()=>{
 assert.equal(parseDeviceModelSmokeAnswer('{"answer":"READY"}'),'READY');
 assert.equal(parseDeviceModelSmokeAnswer('{"answer":" READY "}'),'READY');
 for(const invalid of ['{"answer":"anything"}','{"answer":""}','{"answer":"READY","extra":true}','[]','null','not-json'])assert.throws(()=>parseDeviceModelSmokeAnswer(invalid),/Invalid structured response/);
});

test('device diagnostics run bounded local probes and distinguish readiness from model execution',async()=>{
 const storage=memoryStorage();
 const report=await runDeviceDiagnostics({now:()=>new Date('2026-10-21T00:00:00.000Z'),isSecureContext:true,platform:'iPhone',userAgent:'Mobile Safari',standalone:false,online:false,serviceWorker:{controller:{}},appBuild:'0123456789abcdef',bundle:'app-abc.js',cacheStorage:{keys:async()=>['babelshelf-product-0123456789abcdef']},storage,indexedDB:null,gpu:null,selectedModel:'local-model',modelFilesPresent:true,modelLoaded:false,connectionMode:'offline'});
 const checks=Object.fromEntries(report.checks.map(check=>[check.id,check]));
 assert.equal(checks['secure-context'].status,'pass');assert.equal(checks['service-worker'].status,'pass');assert.equal(checks['offline-cache'].status,'pass');
 assert.equal(checks['storage-roundtrip'].status,'pass');assert.equal(checks['indexeddb-roundtrip'].status,'fail');
 assert.equal(checks['webgpu'].status,'not-run');assert.equal(checks['selected-model'].status,'warning');
 assert.equal(checks['home-screen-launch'].status,'warning');assert.match(checks['home-screen-launch'].detail,/browser tab.*Home Screen app/i);
 assert.match(report.manualSteps[0],/Home Screen icon/i);
 assert.deepEqual(report.webgpu,{available:false,fallbackAdapter:null,features:[],limits:{}});
 assert.match(checks['offline-cache'].detail,/offline restart not proven/);assert.match(checks['selected-model'].detail,/generation not tested/);
 assert.equal(storage.values.size,0);assert.equal(report.connectionMode,'offline');assert.equal(report.standalone,false);
 const output=formatDeviceDiagnosticReport(report);assert.doesNotMatch(output,/PRIVATE_NOTE_SENTINEL|PROMPT_SENTINEL|MODEL_OUTPUT_SENTINEL/);assert.match(output,/successful offline cold launch/);
});

test('device diagnostics marks Home Screen app launch when the installed PWA is active',async()=>{
 const report=await runDeviceDiagnostics({standalone:true,isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB:null,gpu:null});
 const check=report.checks.find(item=>item.id==='home-screen-launch');
 assert.equal(check.status,'pass');assert.match(check.detail,/standalone display mode detected/i);assert.match(report.manualSteps[0],/Select Run tests/i);
});

test('IndexedDB browser exception text is replaced before it enters the diagnostic report',async()=>{
 const indexedDB={open(){const request={error:new DOMException('PRIVATE_BROWSER_ERROR_SENTINEL','UnknownError')};queueMicrotask(()=>request.onerror());return request;},deleteDatabase(){throw Error('unexpected cleanup');}};
 const report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB,gpu:null});
 const check=report.checks.find(item=>item.id==='indexeddb-roundtrip');
 assert.equal(check.status,'fail');
 assert.equal(check.detail,'Temporary IndexedDB probe failed');
 assert.doesNotMatch(formatDeviceDiagnosticReport(report),/PRIVATE_BROWSER_ERROR_SENTINEL/);
});

test('device diagnostics verifies OPFS with a disposable file and refuses name collisions without overwrite',async()=>{
 const values=new Map(),removed=[];
 const opfs={async getDirectory(){return {
  async getFileHandle(name,{create=false}={}){
   if(values.has(name)){if(create)return makeHandle(name);const error=Error('exists');error.name='TypeMismatchError';throw error;}
   if(!create){const error=Error('missing');error.name='NotFoundError';throw error;}
   values.set(name,new Blob([]));return makeHandle(name);
  },
  async removeEntry(name){removed.push(name);values.delete(name);}
 };}};
 function makeHandle(name){return {async getFile(){return values.get(name);},async createWritable(){let chunks=[];return {async write(chunk){chunks.push(chunk);},async close(){values.set(name,new Blob(chunks));},async abort(){chunks=[];}};}};}
 const report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB:null,gpu:null,opfs});
 assert.deepEqual(report.checks.find(check=>check.id==='opfs-roundtrip'),{id:'opfs-roundtrip',status:'pass',detail:'Temporary OPFS file write/read/delete passed'});
 assert.equal(values.size,0);assert.equal(removed.length,1);

 const collisionFiles=new Map();let collisionName='';const original=new Blob(['untouched']);
 const collisionPort={async getDirectory(){return {async getFileHandle(name,{create=false}={}){collisionName=name;if(!create){collisionFiles.set(name,original);return makeCollisionHandle(name);}throw Error('must not create over a collision');},async removeEntry(name){collisionFiles.delete(name);}};}};
 function makeCollisionHandle(name){return {async getFile(){return collisionFiles.get(name);},async createWritable(){throw Error('must not overwrite a collision');}};}
 const collisionReport=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB:null,gpu:null,opfs:collisionPort});
 assert.equal(collisionReport.checks.find(check=>check.id==='opfs-roundtrip').status,'fail');
 assert.equal(collisionFiles.get(collisionName),original,'pre-existing data must never be overwritten or removed');
});

test('device diagnostics reports the isolated production-memory smoke outcome without surfacing test content',async()=>{
 const indexedDB={open(){throw Error('not called');},deleteDatabase(){throw Error('not called');}};
 const passed=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB,gpu:null,applicationSmoke:async()=>{}});
 assert.deepEqual(passed.checks.find(check=>check.id==='memory-store-smoke'),{id:'memory-store-smoke',status:'pass',detail:'Isolated production Memory workflow passed · temporary database deleted'});
 const failed=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB,gpu:null,applicationSmoke:async()=>{const error=Error('PRIVATE_SMOKE_CONTENT');error.stage='search';throw error;}});
 assert.equal(failed.checks.find(check=>check.id==='memory-store-smoke').status,'fail');
 assert.equal(failed.checks.find(check=>check.id==='memory-store-smoke').detail,'Memory search check failed');
 assert.doesNotMatch(JSON.stringify(failed),/PRIVATE_SMOKE_CONTENT/);
});

test('device report captures bounded WASM threading prerequisites without claiming runtime activation',async()=>{
 const storage=memoryStorage(),report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage,indexedDB:null,gpu:null,crossOriginIsolated:true,sharedArrayBuffer:true,sharedWasmMemory:true});
 assert.deepEqual(report.wasmThreads,{crossOriginIsolated:true,sharedArrayBuffer:true,sharedWasmMemory:true,prerequisitesReady:true});
 assert.equal(report.checks.find(check=>check.id==='wasm-threads').status,'pass');
 assert.match(report.scope.join(' '),/does not prove a selected engine used a worker pool/);
 const saved=formatDeviceDiagnosticReport(report);writeSavedDeviceTestReport(storage,saved);assert.equal(readSavedDeviceTestReport(storage),saved);
 const forged=JSON.stringify({...report,wasmThreads:{...report.wasmThreads,prerequisitesReady:false}});assert.throws(()=>writeSavedDeviceTestReport(storage,forged),/Invalid/);
});

test('device diagnostics warns when cross-tab model coordination is unavailable',async()=>{
 const base={isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB:null,gpu:null};
 const supported=await runDeviceDiagnostics({...base,inferenceLocks:true});
 assert.deepEqual(supported.checks.find(check=>check.id==='cross-tab-inference'),{id:'cross-tab-inference',status:'pass',detail:'Web Locks API available for origin-wide model coordination'});
 const unsupported=await runDeviceDiagnostics({...base,inferenceLocks:false});
 assert.deepEqual(unsupported.checks.find(check=>check.id==='cross-tab-inference'),{id:'cross-tab-inference',status:'warning',detail:'Web Locks API unavailable · simultaneous BabelShelf tabs may compete for device memory'});
});

test('device report keeps the selected model, engine and runtime revisions when model files are not ready',async()=>{
 const report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB:null,gpu:null,selectedModel:'bonsai-9b',selectedModelRevision:'model-r17',selectedModelEngine:'webml-qwen35',runtimeRevision:'webgpu-runtime-r4',modelFilesPresent:false,modelLoaded:false});
 assert.deepEqual(report.selectedModel,{id:'bonsai-9b',revision:'model-r17',engine:'webml-qwen35',runtimeRevision:'webgpu-runtime-r4',filesPresent:false,loaded:false});
});

test('device report records the registered backend without presenting it as adapter evidence',async()=>{
 const storage=memoryStorage(),report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage,indexedDB:null,gpu:null,selectedModel:'smollm-webgpu',selectedModelRevision:'model-r1',selectedModelEngine:'transformers-causal-webgpu',selectedModelBackend:'webgpu',runtimeRevision:'onnx-r3'});
 assert.deepEqual(report.selectedModel,{id:'smollm-webgpu',revision:'model-r1',engine:'transformers-causal-webgpu',backend:'webgpu',runtimeRevision:'onnx-r3',filesPresent:false,loaded:false});
 assert.match(report.scope.join(' '),/do not prove which hardware adapter executed/);
 const serialized=formatDeviceDiagnosticReport(report);writeSavedDeviceTestReport(storage,serialized);assert.equal(readSavedDeviceTestReport(storage),serialized);
 assert.throws(()=>writeSavedDeviceTestReport(storage,JSON.stringify({...report,selectedModel:{...report.selectedModel,backend:'hardware-inferred'}})),/Invalid/);
});

test('device report captures only bounded WebGPU features and selected numeric limits',async()=>{
 const report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB:null,gpu:{requestAdapter:async()=>({features:new Set(['shader-f16','timestamp-query']),limits:{maxBufferSize:4294967296,maxStorageBufferBindingSize:2147483647,maxComputeWorkgroupSizeX:256,unlistedLimit:99},isFallbackAdapter:false,vendor:'private-adapter-vendor'})}});
 assert.deepEqual(report.webgpu,{available:true,fallbackAdapter:false,features:['shader-f16','timestamp-query'],limits:{maxBufferSize:4294967296,maxStorageBufferBindingSize:2147483647,maxComputeWorkgroupSizeX:256}});
 assert.equal(Object.hasOwn(report.webgpu,'vendor'),false);assert.equal(report.checks.find(check=>check.id==='webgpu').status,'pass');
});

test('saved device report retains bounded runtime performance counters and rejects raw payloads',async()=>{
 const storage=memoryStorage(),report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage,indexedDB:null,gpu:null});
 report.modelGeneration={status:'pass',model:'bonsai',modelRevision:'r1',runtimeRevision:'runtime-r1',durationMs:1200,runtimeMetrics:{visibleTextTtftMs:240,runtimeDecodeTokensPerSecond:8.5,memoryBefore:{gpuBytes:1024},memoryAfter:{gpuBytes:2048}}};
 const serialized=formatDeviceDiagnosticReport(report);writeSavedDeviceTestReport(storage,serialized);assert.equal(readSavedDeviceTestReport(storage),serialized);
 const forged={...report,modelGeneration:{...report.modelGeneration,runtimeMetrics:{...report.modelGeneration.runtimeMetrics,raw:'PRIVATE'}}};
 assert.throws(()=>writeSavedDeviceTestReport(storage,JSON.stringify(forged)),/Invalid device test report/);
 const forgedEngine={...report,selectedModel:{id:'m',revision:'r',engine:'PRIVATE NOTE',runtimeRevision:'r',filesPresent:true,loaded:false}};
 assert.throws(()=>writeSavedDeviceTestReport(storage,JSON.stringify(forgedEngine)),/Invalid device test report/);
});

test('an IndexedDB probe name collision never deletes an existing database',async()=>{
 let deleted=false;
 const database={close(){},transaction(){throw Error('must not use an existing database');}};
 const indexedDB={open(){const request={result:database};queueMicrotask(()=>request.onsuccess());return request;},deleteDatabase(){deleted=true;throw Error('must not delete a database after a collision');}};
 const report=await runDeviceDiagnostics({isSecureContext:true,serviceWorker:{controller:{}},cacheStorage:{keys:async()=>[]},storage:memoryStorage(),indexedDB,gpu:null});
 const result=report.checks.find(check=>check.id==='indexeddb-roundtrip');
 assert.equal(result.status,'fail');assert.match(result.detail,/name collision/);assert.equal(deleted,false);
});

test('offline restart marker is a small local continuation record and rejects malformed data',()=>{
 const storage=memoryStorage(),marker={schema:1,startedAt:'2026-10-21T00:00:00.000Z',appBuild:'0123456789abcdef',baseline:{checkedAt:'2026-10-21T00:00:00.000Z',appBuild:'0123456789abcdef',standalone:true,onlineSignal:true,checks:[{id:'service-worker',status:'pass',detail:'controlled'}],modelGeneration:{status:'pass',model:'text-small',modelRevision:'rev-a',runtimeRevision:'runtime-a',durationMs:900,outputTokens:4,tokensPerSecond:4.44,answerCharacters:5}}};
 writeOfflineRestartMarker(storage,marker);assert.deepEqual(readOfflineRestartMarker(storage,Date.parse('2026-10-21T00:00:00.000Z')),marker);assert.equal(readOfflineRestartMarker(storage,Date.parse('2026-10-21T00:00:00.000Z')).baseline.modelGeneration.outputTokens,4);
 assert.equal(readOfflineRestartMarker(storage,Date.parse('2026-10-22T00:00:00.001Z')),null,'expired continuation is ignored');assert.equal(storage.getItem('babelshelf.device-test.offline-restart.v1'),null,'expired marker is removed');
 writeOfflineRestartMarker(storage,marker);assert.equal(readOfflineRestartMarker(storage,Date.parse('2026-10-20T23:59:59.999Z')),null,'future continuation is ignored');assert.equal(storage.getItem('babelshelf.device-test.offline-restart.v1'),null,'future marker is removed');
 storage.setItem('babelshelf.device-test.offline-restart.v1','{"schema":1,"startedAt":"bad","appBuild":"x"}');assert.equal(readOfflineRestartMarker(storage),null);assert.equal(storage.getItem('babelshelf.device-test.offline-restart.v1'),null,'malformed marker is removed');
 assert.throws(()=>writeOfflineRestartMarker(storage,{...marker,appBuild:'x'.repeat(41)}),/Invalid/);
 clearOfflineRestartMarker(storage);assert.equal(readOfflineRestartMarker(storage),null);
});

test('offline restart marker binds an optional model test to the model explicitly selected before restart',()=>{
 const storage=memoryStorage(),now=Date.now(),at=new Date(now).toISOString(),marker={schema:1,startedAt:at,appBuild:'build-a',modelTestRequested:true,modelTestModel:'bonsai-4b',baseline:{checkedAt:at,appBuild:'build-a',standalone:true,onlineSignal:true,checks:[]}};
 writeOfflineRestartMarker(storage,marker);assert.deepEqual(readOfflineRestartMarker(storage,now),marker);
 assert.throws(()=>writeOfflineRestartMarker(storage,{...marker,modelTestModel:undefined}),/Invalid/);
 storage.setItem('babelshelf.device-test.offline-restart.v1',JSON.stringify({...marker,modelTestModel:'x'.repeat(121)}));assert.equal(readOfflineRestartMarker(storage),null,'oversized model identity invalidates the one-shot request');
});

test('offline return attempt is claimed once before work and cannot auto-run again after interruption',()=>{
 const storage=memoryStorage(),now=Date.now(),at=new Date(now).toISOString(),marker={schema:1,startedAt:at,appBuild:'build-a',modelTestRequested:true,modelTestModel:'text-local',baseline:{checkedAt:at,appBuild:'build-a',standalone:true,onlineSignal:true,checks:[]}};
 writeOfflineRestartMarker(storage,marker);
 const pending=readOfflineRestartMarker(storage,now);
 assert.ok(pending);assert.equal(claimOfflineRestartAttempt(storage,pending,now),true);
 const claimed=readOfflineRestartMarker(storage,now);assert.equal(claimed?.returnAttempted,true);
 assert.equal(claimOfflineRestartAttempt(storage,claimed,now),false,'a relaunch cannot claim and rerun the same physical test');
});

test('interrupted one-run return produces an honest warning without claiming an offline pass',async()=>{
 const storage=memoryStorage(),baseline=await runDeviceDiagnostics({isSecureContext:true,standalone:true,online:true,serviceWorker:{controller:{}},appBuild:'build-a',storage,indexedDB:null,gpu:null});
 const marker={schema:1,startedAt:baseline.createdAt,appBuild:baseline.appBuild,returnAttempted:true,modelTestRequested:true,modelTestModel:'text-local',baseline:{checkedAt:baseline.createdAt,appBuild:baseline.appBuild,standalone:true,onlineSignal:true,checks:baseline.checks}};
 const interrupted=completeInterruptedOfflineRestartReport(baseline,marker),checks=Object.fromEntries(interrupted.checks.map(item=>[item.id,item]));
 assert.equal(checks['offline-cold-reopen'].status,'warning');assert.match(checks['offline-cold-reopen'].detail,/interrupted/i);
 assert.equal(interrupted.modelGeneration.status,'interrupted');assert.equal(interrupted.modelGeneration.model,'text-local');
 assert.equal(interrupted.offlineRestart?.returnObserved,true);assert.ok(interrupted.scope.some(line=>/not automatically repeated/i.test(line)));
 assert.equal(interrupted.manualSteps.length,0);
});

test('offline return report uses browser-observed signals and does not claim iOS system state',async()=>{
 const storage=memoryStorage(),baseline=await runDeviceDiagnostics({isSecureContext:true,standalone:true,online:true,serviceWorker:{controller:{}},appBuild:'before',storage,indexedDB:null,gpu:null});
 const marker={schema:1,startedAt:baseline.createdAt,appBuild:baseline.appBuild,baseline:{checkedAt:baseline.createdAt,appBuild:baseline.appBuild,standalone:true,onlineSignal:true,checks:baseline.checks}};
 const returned=await runDeviceDiagnostics({isSecureContext:true,standalone:true,online:false,serviceWorker:{controller:{}},appBuild:'after',storage,indexedDB:null,gpu:null});
 const report=completeOfflineRestartReport(returned,marker),checks=Object.fromEntries(report.checks.map(item=>[item.id,item]));
 assert.equal(checks['offline-cold-reopen'].status,'pass');assert.match(checks['offline-cold-reopen'].detail,/cannot be independently verifiable|not independently verifiable/i);assert.equal(checks['ios-system-state'].status,'warning');assert.equal(report.offlineRestart.returnObserved,true);assert.equal(report.manualSteps.length,0);
});

test('final device report is retained locally for a later one-tap copy and rejects oversized or malformed values',async()=>{
 const storage=memoryStorage(),report=formatDeviceDiagnosticReport(await runDeviceDiagnostics({isSecureContext:true,standalone:true,online:false,serviceWorker:{controller:{}},appBuild:'build-a',storage,indexedDB:null,gpu:null}));
 assert.equal(readSavedDeviceTestReport(storage),'');writeSavedDeviceTestReport(storage,report);assert.equal(readSavedDeviceTestReport(storage),report);
 storage.setItem('babelshelf.device-test.report.v1','{"schema":2}');assert.equal(readSavedDeviceTestReport(storage),'');assert.throws(()=>writeSavedDeviceTestReport(storage,'x'.repeat(40001)),/too large/);
 writeSavedDeviceTestReport(storage,report);clearSavedDeviceTestReport(storage);assert.equal(readSavedDeviceTestReport(storage),'');
});

test('saved device report accepts the prior schema and rejects malformed WebGPU metadata',()=>{
 const storage=memoryStorage(),oldReport=JSON.stringify({schema:1,createdAt:'2026-10-20T00:00:00.000Z',checks:[]});
 writeSavedDeviceTestReport(storage,oldReport);assert.equal(readSavedDeviceTestReport(storage),oldReport);
 const malformed=JSON.stringify({schema:1,createdAt:'2026-10-20T00:00:00.000Z',checks:[],webgpu:{available:true,features:['x'.repeat(65)],fallbackAdapter:null,limits:{}}});
 storage.setItem('babelshelf.device-test.report.v1',malformed);assert.equal(readSavedDeviceTestReport(storage),'');assert.throws(()=>writeSavedDeviceTestReport(storage,malformed),/Invalid/);
});

test('load phase counters survive local reports and malformed or private fields refuse storage',()=>{
 const storage=memoryStorage(),base={schema:1,createdAt:new Date().toISOString(),checks:[],modelGeneration:{status:'pass',model:'m',modelRevision:'r',runtimeRevision:'rt'}};
 for(const loadMetrics of [{verificationMs:-1},{importMs:'private'},{runtimeLoadMs:Infinity},{device:'PRIVATE'}])assert.throws(()=>writeSavedDeviceTestReport(storage,JSON.stringify({...base,modelGeneration:{...base.modelGeneration,loadMetrics}})),/Invalid/);
 const value={...base,modelGeneration:{...base.modelGeneration,loadMetrics:{verificationMs:12,importMs:0,runtimeLoadMs:25,totalLoadMs:42,runtimeModuleReused:false}}};writeSavedDeviceTestReport(storage,JSON.stringify(value));assert.deepEqual(JSON.parse(readSavedDeviceTestReport(storage)).modelGeneration.loadMetrics,value.modelGeneration.loadMetrics);
});

test('bounded CPU runtime thread and prompt counters survive saved performance reports',()=>{
 const storage=memoryStorage(),value={schema:1,createdAt:new Date().toISOString(),checks:[],modelGeneration:{status:'pass',model:'cpu',modelRevision:'rev',runtimeRevision:'runtime',testMode:'performance',runtimeMetrics:{requestedThreads:4,runtimeThreads:4,runtimePromptTokens:100,runtimeCachedTokens:0,runtimePrefillMs:10}}};
 writeSavedDeviceTestReport(storage,JSON.stringify(value));assert.equal(JSON.parse(readSavedDeviceTestReport(storage)).modelGeneration.runtimeMetrics.runtimeThreads,4);
});

test('unrelated and historical cache buckets cannot pass the current-build cache check',async()=>{
 const env={appBuild:'0123456789abcdef',storage:memoryStorage(),indexedDB:null,gpu:null};
 const check=async(build,keys)=>(await runDeviceDiagnostics({...env,appBuild:build,cacheStorage:{keys:async()=>keys}})).checks.find(item=>item.id==='offline-cache');
 const old=['babelshelf-product-fedcba9876543210','babelshelf-product-assets-v1','model-assets','unrelated'];
 assert.equal((await check(env.appBuild,old)).status,'warning');
 assert.match((await check(env.appBuild,old)).detail,/Current build cache not listed/);
 const result=await check(env.appBuild,[...old,'babelshelf-product-'+env.appBuild]);
 assert.equal(result.status,'pass');assert.match(result.detail,/1 other app build/);assert.match(result.detail,/offline restart not proven/);
 assert.equal((await check('Unknown',['babelshelf-product-Unknown'])).status,'warning');
 assert.equal((await check(env.appBuild,[])).status,'warning');
});
