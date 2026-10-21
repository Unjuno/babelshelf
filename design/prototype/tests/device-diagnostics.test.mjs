import test from 'node:test';
import assert from 'node:assert/strict';
import {clearOfflineRestartMarker,formatDeviceDiagnosticReport,readOfflineRestartMarker,runDeviceDiagnostics,writeOfflineRestartMarker} from '../src/device-diagnostics.ts';

function memoryStorage(){const values=new Map();return {values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};}

test('device diagnostics run bounded local probes and distinguish readiness from model execution',async()=>{
 const storage=memoryStorage();
 const report=await runDeviceDiagnostics({now:()=>new Date('2026-10-21T00:00:00.000Z'),isSecureContext:true,platform:'iPhone',userAgent:'Mobile Safari',standalone:true,online:false,serviceWorker:{controller:{}},appBuild:'0123456789abcdef',bundle:'app-abc.js',cacheStorage:{keys:async()=>['app-shell-v1']},storage,indexedDB:null,gpu:null,selectedModel:'local-model',modelFilesPresent:true,modelLoaded:false,connectionMode:'offline'});
 const checks=Object.fromEntries(report.checks.map(check=>[check.id,check]));
 assert.equal(checks['secure-context'].status,'pass');assert.equal(checks['service-worker'].status,'pass');assert.equal(checks['offline-cache'].status,'pass');
 assert.equal(checks['storage-roundtrip'].status,'pass');assert.equal(checks['indexeddb-roundtrip'].status,'fail');
 assert.equal(checks['webgpu'].status,'not-run');assert.equal(checks['selected-model'].status,'warning');
 assert.match(checks['offline-cache'].detail,/offline restart not proven/);assert.match(checks['selected-model'].detail,/generation not tested/);
 assert.equal(storage.values.size,0);assert.equal(report.connectionMode,'offline');assert.equal(report.standalone,true);
 const output=formatDeviceDiagnosticReport(report);assert.doesNotMatch(output,/PRIVATE_NOTE_SENTINEL|PROMPT_SENTINEL|MODEL_OUTPUT_SENTINEL/);assert.match(output,/successful offline cold launch/);
});

test('offline restart marker is a small local continuation record and rejects malformed data',()=>{
 const storage=memoryStorage(),marker={schema:1,startedAt:'2026-10-21T00:00:00.000Z',appBuild:'0123456789abcdef',baseline:{checkedAt:'2026-10-21T00:00:00.000Z',appBuild:'0123456789abcdef',standalone:true,onlineSignal:true,checks:[{id:'service-worker',status:'pass',detail:'controlled'}],modelGeneration:{status:'pass',model:'text-small',modelRevision:'rev-a',runtimeRevision:'runtime-a',durationMs:900,outputTokens:4,tokensPerSecond:4.44,answerCharacters:5}}};
 writeOfflineRestartMarker(storage,marker);assert.deepEqual(readOfflineRestartMarker(storage),marker);assert.equal(readOfflineRestartMarker(storage).baseline.modelGeneration.outputTokens,4);
 storage.setItem('babelshelf.device-test.offline-restart.v1','{"schema":1,"startedAt":"bad","appBuild":"x"}');assert.equal(readOfflineRestartMarker(storage),null);
 assert.throws(()=>writeOfflineRestartMarker(storage,{...marker,appBuild:'x'.repeat(41)}),/Invalid/);
 clearOfflineRestartMarker(storage);assert.equal(readOfflineRestartMarker(storage),null);
});
