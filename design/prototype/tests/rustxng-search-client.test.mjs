import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRustXng,validateRustXngEndpoint,RustXngSearchError} from '../src/rustxng-search-client.ts';

const response=(payload,status=200,headers={})=>new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json',...headers}});

test('validates secure endpoints and allows loopback HTTP for a locally hosted service',()=>{
 assert.equal(validateRustXngEndpoint('https://search.example/base/').href,'https://search.example/base');
 assert.equal(validateRustXngEndpoint('http://127.0.0.1:29483').href,'http://127.0.0.1:29483/');
 for(const value of ['http://search.example','https://user:pass@search.example','https://search.example/?x=1','file:///tmp/search','not an url'])assert.throws(()=>validateRustXngEndpoint(value),RustXngSearchError);
});

test('does not send requests unless both app Online and browser online signal are true',async()=>{
 let requests=0;const fetcher=async()=>{requests++;return response({results:[]});};
 for(const flags of [{onlineMode:false,onlineSignal:true},{onlineMode:true,onlineSignal:false}])await assert.rejects(searchRustXng({endpoint:'https://search.example',query:'query',...flags,fetcher}),error=>error.code==='offline');
 assert.equal(requests,0);
});

test('calls the configured RustXNG endpoint without credentials and projects bounded search results',async()=>{
 let request;
 const results=Array.from({length:9},(_,i)=>({title:`Result ${i}`,url:`https://example.com/${i}`,content:'x'.repeat(1400),engine:'public-engine',raw_content:'do not expose'}));
 const value=await searchRustXng({endpoint:'https://search.example/rx',query:'  local query  ',onlineMode:true,onlineSignal:true,now:()=>new Date('2026-11-05T00:00:00.000Z'),fetcher:async(url,init)=>{request={url:String(url),init};return response({results});}});
 assert.equal(request.url,'https://search.example/rx/search?q=local+query&format=json&max_results=5');assert.equal(request.init.credentials,'omit');assert.equal(request.init.referrerPolicy,'no-referrer');
 assert.equal(value.provider,'RustXNG');assert.equal(value.query,'local query');assert.equal(value.retrievedAt,'2026-11-05T00:00:00.000Z');assert.equal(value.results.length,5);assert.equal(value.results[0].snippet.length,1200);assert.equal('raw_content' in value.results[0],false);
});

test('rejects invalid URLs and sanitizes provider-controlled fields',async()=>{
 const value=await searchRustXng({endpoint:'https://search.example',query:'q',onlineMode:true,onlineSignal:true,fetcher:async()=>response({results:[
  {title:'bad scheme',url:'javascript:alert(1)',content:'x'},
  {title:'credentials',url:'https://user:pass@example.com/',content:'x'},
  {title:'  valid\u0000 title  ',url:'https://example.com/a',content:' a\u0001\n b ',engine:' eng\u0001ine '},
 ]})});
 assert.equal(value.results.length,1);assert.equal(value.results[0].title,'valid title');assert.equal(value.results[0].snippet,'a b');assert.equal(value.results[0].engine,'eng ine');
});

test('rejects HTTP errors, malformed JSON shapes, and oversized bodies',async()=>{
 const base={endpoint:'https://search.example',query:'q',onlineMode:true,onlineSignal:true};
 await assert.rejects(searchRustXng({...base,fetcher:async()=>response({},503)}),error=>error.code==='unavailable');
 await assert.rejects(searchRustXng({...base,fetcher:async()=>response({oops:[]})}),error=>error.code==='invalid_response');
 await assert.rejects(searchRustXng({...base,fetcher:async()=>new Response(' '.repeat(100_000))}),error=>error.code==='invalid_response');
});

test('propagates caller cancellation and refuses oversized result limits',async()=>{
 const controller=new AbortController();controller.abort(new Error('cancelled'));
 await assert.rejects(searchRustXng({endpoint:'https://search.example',query:'q',onlineMode:true,onlineSignal:true,signal:controller.signal}),/cancelled/);
 await assert.rejects(searchRustXng({endpoint:'https://search.example',query:'q',onlineMode:true,onlineSignal:true,maxResults:6}),error=>error.code==='invalid_response');
});
