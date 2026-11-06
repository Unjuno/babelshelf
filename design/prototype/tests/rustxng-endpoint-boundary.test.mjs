import test from 'node:test';
import assert from 'node:assert/strict';
import {searchRustXng,validateRustXngEndpoint} from '../src/rustxng-search-client.ts';

const invalidEndpoint=error=>error?.code==='invalid_endpoint';

test('HTTP loopback allowance rejects DNS names that only start with 127',async()=>{
 let requests=0;
 const fetcher=async()=>{requests++;return new Response('{"results":[]}');};
 for(const endpoint of ['http://127.search.example','http://127.0.0.1.example','http://127.localhost.example']){
  await assert.rejects(searchRustXng({endpoint,query:'private query',onlineMode:true,onlineSignal:true,fetcher}),invalidEndpoint,endpoint);
 }
 assert.equal(requests,0,'Rejected endpoints must never receive a query');
});

test('actual IPv4 and IPv6 loopback endpoints remain usable',()=>{
 for(const endpoint of ['http://localhost:29483','http://127.0.0.1:29483','http://127.1:29483','http://127.255.255.254:29483','http://[::1]:29483']){
  assert.equal(validateRustXngEndpoint(endpoint).protocol,'http:',endpoint);
 }
 assert.equal(validateRustXngEndpoint('https://127.search.example/base/').href,'https://127.search.example/base');
});

test('rejects backslash paths before the URL parser can erase dot segments',async()=>{
 let requests=0;
 const fetcher=async()=>{requests++;return new Response('{"results":[]}');};
 for(const endpoint of [String.raw`https://search.example/base\..\other`,String.raw`https://search.example/base\%2e%2e\other`,String.raw`https:\\search.example\base\..\other`]){
  await assert.rejects(searchRustXng({endpoint,query:'private query',onlineMode:true,onlineSignal:true,fetcher}),invalidEndpoint,endpoint);
 }
 assert.equal(requests,0,'Normalized traversal must never reach the transport');
});

test('keeps ordinary HTTPS subpaths and the existing slash traversal rejection',()=>{
 assert.equal(validateRustXngEndpoint('https://search.example/api/rustxng/').href,'https://search.example/api/rustxng');
 for(const endpoint of ['https://search.example/base/../other','https://search.example/base/%2e%2e/other']){
  assert.throws(()=>validateRustXngEndpoint(endpoint),invalidEndpoint,endpoint);
 }
});
