import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePinnedInWorker} from '../src/lfm3-text-backend.ts';
import {deserializeLfm3AssetFailure,serializeLfm3AssetFailure} from '../src/lfm3-asset-worker-protocol.ts';

test('pinned LFM3 worker bridge preserves bounded quota diagnostics including zero counters',async()=>{
 const source=Object.assign(Error('The browser could not store more model data'),{code:'storage-quota-exceeded',downloadedBytes:0,downloadedAssets:0});let terminated=false;
 const worker={postMessage(message){if(message.type==='cancel')return;queueMicrotask(()=>worker.onmessage({data:serializeLfm3AssetFailure(message.id,source)}));},terminate(){terminated=true;}};
 await assert.rejects(preparePinnedInWorker('lfm3-1.7b-qad-q4-0',new AbortController().signal,()=>{},()=>worker),error=>error.message===source.message&&error.code==='storage-quota-exceeded'&&error.downloadedBytes===0&&error.downloadedAssets===0);
 assert.equal(terminated,true,'asset worker is closed after failure');
});

test('pinned LFM3 worker bridge keeps finite partial transfer counters and ignores untrusted fields',async()=>{
 const serialized=serializeLfm3AssetFailure(4,Object.assign(Error('Quota'),{code:'untrusted-code',downloadedBytes:128,downloadedAssets:1,privatePath:'C:/private'}));
 assert.deepEqual(serialized,{id:4,error:'Quota',downloadedBytes:128,downloadedAssets:1});
 const malformed=deserializeLfm3AssetFailure({error:'Quota',code:'untrusted-code',downloadedBytes:-1,downloadedAssets:65,privatePath:'C:/private'});
 assert.equal(malformed.message,'Quota');assert.equal('code'in malformed,false);assert.equal('downloadedBytes'in malformed,false);assert.equal('downloadedAssets'in malformed,false);assert.equal('privatePath'in malformed,false);
});

test('pinned LFM3 worker bridge rejects invalid and excessive transfer counters',()=>{
 assert.deepEqual(serializeLfm3AssetFailure(1,Object.assign(Error('Quota'),{downloadedBytes:Number.MAX_SAFE_INTEGER+1,downloadedAssets:100})),{id:1,error:'Quota'});
 const remote=deserializeLfm3AssetFailure({error:'x'.repeat(3000),code:'storage-quota-exceeded',downloadedBytes:Number.MAX_SAFE_INTEGER+1,downloadedAssets:100});
 assert.equal(remote.message.length,2000);assert.equal(remote.code,'storage-quota-exceeded');assert.equal('downloadedBytes'in remote,false);assert.equal('downloadedAssets'in remote,false);
});
