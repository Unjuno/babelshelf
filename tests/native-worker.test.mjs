import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeResponseTools,nativeResponseText} from '../dist/native-response.js';
import {createPinnedFileSnapshots} from '../dist/pinned-file-snapshots.js';
const spec={name:'babelshelf_answer',parameters:{type:'object',properties:{answer:{type:'string'}},required:['answer'],additionalProperties:false}};
test('actual Worker counts tool definitions, serializes one call and rejects duplicate/truncated output',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,''),events=[],options=[];
 const call={type:'function',function:{name:spec.name,arguments:{answer:'56'}}};let duplicate=false;
 const context=vm.createContext({fetch:()=>{throw Error('network forbidden');},postMessage:m=>events.push(m),AbortController,DOMException,performance,console,nativeResponseTools,nativeResponseText,createPinnedFileSnapshots});
 vm.runInContext(source+'\nglobalThis.install=s=>{session=s;model={contextLength:512};};',context);
 context.install({count_tokens:(_m,o)=>{options.push(o);return {prompt_tokens:o.tools?280:20};},generate:(_m,o)=>{options.push(o);return {async *[Symbol.asyncIterator](){yield {type:'tool_call',tool_call:call};if(duplicate)yield {type:'tool_call',tool_call:call};},result:Promise.resolve({finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:duplicate?[call,call]:[call]}})};}});
 const args={messages:[],responseTool:spec,maxTokens:32};
 await context.onmessage({data:{id:1,cmd:'count',args}});assert.equal(events.at(-1).value.prompt_tokens,280);
 await context.onmessage({data:{id:2,cmd:'generate',args}});assert.equal(events.at(-1).type,'done');assert.equal(events.at(-1).value.text,'{"answer":"56"}');assert.deepEqual(options[0].tools,options[1].tools);assert.deepEqual(options[1].tools,options[2].tools);
 duplicate=true;await context.onmessage({data:{id:3,cmd:'generate',args}});assert.equal(events.at(-1).type,'error');assert.equal(events.at(-1).diagnostic.reason,'native:shape');
 await context.onmessage({data:{id:4,cmd:'generate',args:{...args,maxTokens:300}}});assert.match(events.at(-1).value,/Context limit/);
});
