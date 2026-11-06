import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberFailedStaging,failedStagingNames,retryFailedStaging,retrySessionStaging,acquireStagingLease,retryLeasedStaging,leasedStagingNames} from '../src/staging-cleanup.ts';

function markers(){const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}
const first='download-00000000-0000-4000-8000-000000000001.gguf',second='download-00000000-0000-4000-8000-000000000002.gguf';
test('a live staging lease prevents another tab from deleting a review file and permits recovery after release',async()=>{
 const saved=markers(),active=new Set(),removed=[];
 const locks={async request(name,options,callback){if(typeof options==='function'){callback=options;options={};}if(active.has(name)){if(options.ifAvailable)return callback(null);throw Error('unexpected lock contention');}active.add(name);try{return await callback({name});}finally{active.delete(name);}}};
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async removeEntry(name){removed.push(name);}};}};}};
 const release=await acquireStagingLease(first,saved,locks);rememberFailedStaging(first,saved);
 assert.deepEqual(await retryLeasedStaging(saved,storage,locks),{removed:0,pending:1});
 assert.deepEqual(await retryFailedStaging(saved,storage),{removed:0,failed:0});assert.deepEqual(removed,[]);
 await release();assert.deepEqual(await retryLeasedStaging(saved,storage,locks),{removed:1,pending:0});assert.deepEqual(removed,[first]);assert.deepEqual(leasedStagingNames(saved),[]);
});
test('native lock manager skips a live lease and recovers after release',{skip:!globalThis.navigator?.locks},async()=>{
 const saved=markers(),removed=[];
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async removeEntry(name){removed.push(name);}};}};}};
 const release=await acquireStagingLease(first,saved,navigator.locks);
 try{
  assert.deepEqual(await retryLeasedStaging(saved,storage,navigator.locks),{removed:0,pending:1});
  assert.deepEqual(removed,[]);
 }finally{await release();}
 assert.deepEqual(await retryLeasedStaging(saved,storage,navigator.locks),{removed:1,pending:0});
 assert.deepEqual(removed,[first]);assert.deepEqual(leasedStagingNames(saved),[]);
});
test('restart retry targets only validated recorded failed files and keeps failed entries',async()=>{
 const saved=markers();assert.equal(rememberFailedStaging(first,saved),true);assert.equal(rememberFailedStaging(second,saved),true);assert.equal(rememberFailedStaging('../user.gguf',saved),false);
 saved.setItem('babelshelf.model-cleanup.v1:../other','1');const removed=[];
 const storage={async getDirectory(){return {async getDirectoryHandle(name){assert.equal(name,'model-download-staging');return {async removeEntry(name){removed.push(name);if(name===second)throw Error('busy');}};}};}};
 assert.deepEqual(await retryFailedStaging(saved,storage),{removed:1,failed:1});assert.deepEqual(removed,[first,second]);assert.deepEqual(failedStagingNames(saved),[second]);assert.equal(saved.getItem('babelshelf.model-cleanup.v1:../other'),'1');
});
test('failed marker writes do not pretend recovery was recorded',()=>{const saved=markers();saved.setItem=()=>{throw Error('quota');};assert.equal(rememberFailedStaging(first,saved),false);assert.deepEqual(failedStagingNames(saved),[]);});
test('an unavailable marker store is not reported as an empty successful cleanup',async()=>{
 const saved=markers();saved.key=()=>{throw Error('unavailable');};saved.setItem('record','1');let accessed=false;
 await assert.rejects(retryFailedStaging(saved,{async getDirectory(){accessed=true;}}),/unavailable/);
 assert.equal(accessed,false);
});
test('a recorded file removed first does not leave a stale session retry',async()=>{
 const saved=markers();rememberFailedStaging(first,saved);let exists=true;
 const storage={async getDirectory(){return {async getDirectoryHandle(){return {async removeEntry(){exists=false;}};}};}};
 const cleanup=async()=>{if(exists)throw Error('busy');};
 const result=await retrySessionStaging([cleanup],saved,storage);
 assert.equal(result.failed,false);assert.deepEqual(result.pending,[]);assert.deepEqual(failedStagingNames(saved),[]);
});
