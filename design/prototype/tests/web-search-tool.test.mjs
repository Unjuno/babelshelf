import test from 'node:test';
import assert from 'node:assert/strict';
import * as tool from '../src/tools/web.search/tool.ts';

test('web.search is an explicit-online tool and delegates only its validated query to the host',async()=>{
 assert.equal(tool.definition.id,'web.search');
 assert.equal(tool.definition.effect,'external');
 assert.equal(tool.definition.network,'explicit-online');
 let received;
 const host={check(){},signal:new AbortController().signal,webSearch:async(query,signal)=>{received={query,signal};return {provider:'RustXNG',results:[]};}};
 const result=await tool.run({query:'  fresh research  '},host);
 assert.equal(received.query,'  fresh research  ');
 assert.equal(received.signal,host.signal);
 assert.deepEqual(result,{provider:'RustXNG',results:[]});
});

test('web.search refuses absent host capability and malformed arguments',async()=>{
 const host={check(){}};
 await assert.rejects(()=>tool.run({query:'research'},host),/not available/);
 await assert.rejects(()=>tool.run({query:'research',url:'https://example.org'},host),/Invalid web search arguments/);
 await assert.rejects(()=>tool.run({query:' '},host),/Invalid tool query/);
});
