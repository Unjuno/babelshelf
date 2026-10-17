import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('explicit diagnostic reset isolates a generation and reports runtime completion metadata',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const events=[];let resets=0;
 const stream={async *[Symbol.asyncIterator](){yield {type:'text',text:'actual worker fixture'};},result:Promise.resolve({finish_reason:'stop',usage:{prompt_tokens:12,cached_tokens:0,completion_tokens:3}})};
 const context=vm.createContext({fetch:()=>{},postMessage:m=>events.push(m),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.setTestSession=(s)=>{session=s;model={contextLength:2048};};',context);
 context.setTestSession({reset:()=>{resets++;},count_tokens:()=>({prompt_tokens:12}),generate:()=>stream});
 await context.onmessage({data:{id:1,cmd:'generate',args:{messages:[],maxTokens:32,resetSession:true}}});
 assert.equal(resets,1);const result=events.find(e=>e.id===1&&e.type==='done').value;
 assert.equal(result.finishReason,'stop');assert.equal(result.usage.cached_tokens,0);
 await context.onmessage({data:{id:2,cmd:'generate',args:{messages:[],maxTokens:32}}});
 assert.equal(resets,1,'ordinary generation keeps the existing session behavior');
});

test('diagnostic non-thinking sampling is explicit and never changes the default greedy profile',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
 const events=[],options=[];
 const context=vm.createContext({fetch:()=>{},postMessage:m=>events.push(m),AbortController,DOMException,performance,console});
 vm.runInContext(source+'\nglobalThis.setTestSession=(s)=>{session=s;model={contextLength:2048};};',context);
 context.setTestSession({reset:()=>{},count_tokens:()=>({prompt_tokens:12}),generate:(_messages,o)=>{options.push(o);return {async *[Symbol.asyncIterator](){yield {type:'text',text:'fixture'};},result:Promise.resolve({finish_reason:'stop'})};}});
 await context.onmessage({data:{id:1,cmd:'generate',args:{messages:[],maxTokens:32,profile:'bonsai-nonthinking',seed:19}}});
 assert.equal(options[0].do_sample,true);assert.equal(options[0].temperature,.7);assert.equal(options[0].top_p,.8);assert.equal(options[0].top_k,20);assert.equal(options[0].seed,19);
 await context.onmessage({data:{id:2,cmd:'generate',args:{messages:[],maxTokens:32}}});assert.equal(options[1].do_sample,false);
 await context.onmessage({data:{id:3,cmd:'generate',args:{messages:[],maxTokens:32,profile:'arbitrary'}}});assert.match(events.at(-1).value,/profile/);
});

test('stopping verification of an existing cached asset cannot open a replacement writer or remove that asset',async()=>{
 const source=(await readFile(new URL('../dist/model-worker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');const {SHA256}=await import('../dist/sha256.js');let writes=0,removed=0,fetches=0,cancelled=0,released=0;const abort=new AbortController(),asset={name:'runtime.js',bytes:3,sha256:'a'.repeat(64),url:'https://invalid.example/never-fetch'};
 const file={size:3,stream:()=>({getReader:()=>({read:async()=>{abort.abort(new DOMException('Stopped','AbortError'));return {done:false,value:new Uint8Array([1,2,3])};},cancel:async()=>{cancelled++;},releaseLock:()=>{released++;}})})};const root={getFileHandle:async()=>({createWritable:async()=>{writes++;throw Error('replacement writer opened');}}),removeEntry:async()=>{removed++;}};
 const context=vm.createContext({SHA256,fetch:()=>{fetches++;throw Error('unexpected fetch');},postMessage:()=>{},AbortController,DOMException,performance,console});vm.runInContext(source+'\nglobalThis.testStore=(asset,f,dir,signal)=>{file=async()=>f;root=dir;controller=signal;return storeAsset(asset,1);};',context);
 await assert.rejects(context.testStore(asset,file,root,abort),/Stopped/);assert.equal(writes,0);assert.equal(removed,0);assert.equal(fetches,0);assert.equal(cancelled,1);assert.equal(released,1);
});
