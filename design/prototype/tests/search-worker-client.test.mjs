import test from 'node:test';
import assert from 'node:assert/strict';
import {createPagedSearchClient} from '../src/search-worker-client.ts';
import {SearchSnapshotChangedError} from '../src/file-discovery.ts';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createNote,reviseNote} from '../../../dist/core.js';

class ControlledWorker {
 onmessage=null;onerror=null;onmessageerror=null;sent=[];terminated=false;
 postMessage(message){this.sent.push(structuredClone(message));}
 terminate(){this.terminated=true;}
 reply(message){this.onmessage?.({data:message});}
}

test('search worker correlates concurrent results and preserves snapshot errors',async()=>{
 const workers=[],client=createPagedSearchClient(()=>{const worker=new ControlledWorker();workers.push(worker);return worker;});
 const first=client.search([],'water',{offset:0,limit:12}),second=client.search([],'other',{offset:0,limit:12});
 const worker=workers[0];assert.equal(worker.sent.length,2);worker.reply({id:worker.sent[1].id,ok:true,value:{hits:[],hasMore:false}});worker.reply({id:worker.sent[0].id,ok:false,code:'snapshot_changed'});
 assert.deepEqual(await second,{hits:[],hasMore:false});await assert.rejects(first,SearchSnapshotChangedError);client.close();assert.equal(worker.terminated,true);
});

test('actual Node worker executes the same paging protocol and reports changed data',async()=>{
 const url=new URL('../src/search-worker.ts',import.meta.url).href;
 const source=`const {parentPort}=require('node:worker_threads');(async()=>{globalThis.self=globalThis;self.postMessage=value=>parentPort.postMessage(value);await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});})().catch(error=>{throw error;});`;
 const raw=new NodeWorker(source,{eval:true});
 await new Promise((resolve,reject)=>{raw.once('error',reject);raw.once('message',message=>message.ready?resolve():reject(Error('Unexpected worker startup')));});
 const queue=[];raw.on('message',message=>queue.shift()?.(message));const call=data=>new Promise(resolve=>{queue.push(resolve);raw.postMessage(data);});
 const notes=Array.from({length:15},(_,i)=>createNote({title:`water ${i}`,body:`water ${i}`,path:`Inbox/water-${i}.md`}));
 try{
  const first=await call({id:1,notes,query:'water',options:{offset:0,limit:12}});assert.equal(first.ok,true);assert.equal(first.value.nextOffset,12);
  const second=await call({id:2,notes,query:'water',options:{offset:12,limit:12,snapshot:first.value.snapshot}});assert.equal(second.ok,true);assert.equal(second.value.hits.length,3);
  const changed=[...notes];changed[0]=reviseNote(notes[0],{body:'changed'},1);
  const stale=await call({id:3,notes:changed,query:'water',options:{offset:12,limit:12,snapshot:first.value.snapshot}});assert.deepEqual(stale,{id:3,ok:false,code:'snapshot_changed'});
  const scoped=await call({id:4,notes,query:'water',options:{offset:0,limit:12,pathPrefix:'Inbox'}});assert.equal(scoped.ok,true);assert.equal(scoped.value.hits.length,12);
  const wrongScope=await call({id:5,notes,query:'water',options:{offset:12,limit:12,pathPrefix:'Elsewhere',snapshot:scoped.value.snapshot}});assert.deepEqual(wrongScope,{id:5,ok:false,code:'snapshot_changed'});
 }finally{await raw.terminate();}
});

test('stop terminates a busy worker and a later search creates a fresh worker',async()=>{
 const workers=[],client=createPagedSearchClient(()=>{const worker=new ControlledWorker();workers.push(worker);return worker;});const abort=new AbortController();
 const stopped=client.search([],'water',{offset:0,limit:12},abort.signal),other=client.search([],'food',{offset:0,limit:12});abort.abort();
 await assert.rejects(stopped,/Stopped/);await assert.rejects(other,/interrupted/i);assert.equal(workers[0].terminated,true);
 const fresh=client.search([],'water',{offset:0,limit:12});assert.equal(workers.length,2);workers[1].reply({id:workers[1].sent[0].id,ok:true,value:{hits:[],hasMore:false}});assert.deepEqual(await fresh,{hits:[],hasMore:false});client.close();
});

test('worker failures settle all pending searches and late results cannot affect the replacement',async()=>{
 const workers=[],client=createPagedSearchClient(()=>{const worker=new ControlledWorker();workers.push(worker);return worker;});
 const first=client.search([],'water',{offset:0,limit:12}),second=client.search([],'food',{offset:0,limit:12});
 workers[0].onerror({});await assert.rejects(first,/interrupted/i);await assert.rejects(second,/interrupted/i);assert.equal(workers[0].terminated,true);
 const fresh=client.search([],'water',{offset:0,limit:12});workers[0].reply({id:workers[0].sent[0].id,ok:true,value:'late'});workers[1].reply({id:workers[1].sent[0].id,ok:true,value:'fresh'});
 assert.equal(await fresh,'fresh');client.close();
});

test('a request that cannot be posted does not interrupt other searches',async()=>{
 const worker=new ControlledWorker(),post=worker.postMessage.bind(worker);worker.postMessage=message=>{if(message.query==='bad')throw Error('Cannot clone');post(message);};
 const client=createPagedSearchClient(()=>worker),running=client.search([],'water',{offset:0,limit:12}),bad=client.search([],'bad',{offset:0,limit:12});
 await assert.rejects(bad,/search failed/i);assert.equal(worker.terminated,false);
 worker.reply({id:worker.sent[0].id,ok:true,value:'water result'});assert.equal(await running,'water result');client.close();
});

test('a malformed worker reply fails pending requests rather than hanging',async()=>{
 for(const response of [{unexpected:true},{id:999,ok:true,value:[]},{id:1,ok:'invalid'}]){
  const worker=new ControlledWorker(),client=createPagedSearchClient(()=>worker),pending=client.search([],'water',{offset:0,limit:12});
  worker.reply(response);await assert.rejects(pending,/interrupted/i);assert.equal(worker.terminated,true);client.close();
 }
});
