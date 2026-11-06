import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRustXng} from '../src/rustxng-search-client.ts';

const base={endpoint:'https://search.example',query:'local draft',onlineMode:true,onlineSignal:true};
const response=()=>new Response(JSON.stringify({results:[{title:'Found',url:'https://example.com/found',content:'Result'}]}));

test('a canceled search cannot return success when transport ignores abort before headers',async()=>{
 const controller=new AbortController(),reason=new Error('user stopped while requesting');
 let receivedSignal;
 const fetcher=async(_url,init)=>{
  receivedSignal=init.signal;
  controller.abort(reason);
  return response(); // Transport deliberately resolves despite cancellation.
 };
 await assert.rejects(searchRustXng({...base,signal:controller.signal,fetcher}),error=>error===reason);
 assert.equal(receivedSignal.aborted,true);
});

test('a canceled search cannot return success when body reading completes after abort',async()=>{
 const controller=new AbortController(),reason=new Error('user stopped during body');
 const bytes=new TextEncoder().encode(JSON.stringify({results:[{title:'Found',url:'https://example.com/found',content:'Result'}]}));
 let bodyReads=0;
 const fetcher=async()=>new Response(new ReadableStream({
  pull(stream){
   bodyReads++;
   stream.enqueue(bytes);
   stream.close();
   controller.abort(reason);
  },
 },{highWaterMark:0}));
 await assert.rejects(searchRustXng({...base,signal:controller.signal,fetcher}),error=>error===reason);
 assert.equal(bodyReads,1,'The caller aborted during streamed body consumption, not before fetch');
});

test('a successful search still accepts a non-aborted transport and bounded results',async()=>{
 const value=await searchRustXng({...base,signal:new AbortController().signal,fetcher:async()=>response()});
 assert.equal(value.results.length,1);
 assert.equal(value.results[0].title,'Found');
});
