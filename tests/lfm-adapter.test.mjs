import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {LfmAdapter,Lfm3Adapter,PreparedGgufAdapter} from '../dist/lfm-adapter.js';
import {createRecentPreparedFileReader} from '../design/prototype/src/prepared-file-snapshot.ts';

test('native transport accepts the configured catalog plus scoped final actions with one shared bound',async()=>{
 const {MAX_NATIVE_TOOL_DEFINITIONS}=await import('../dist/lfm-adapter.js');
 const adapter=new PreparedGgufAdapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[],architecture:'lfm3'}),seen=[];
 adapter.loaded='local';adapter.runtime={countChatTokens:async options=>{seen.push(options.tools);return 23;},createChatCompletion:async options=>{seen.push(options.tools);return (async function*(){yield {choices:[{delta:{tool_calls:[{index:0,id:'one',function:{name:'tool0',arguments:'{}'}}]}}]};})();}};
 const tools=Array.from({length:MAX_NATIVE_TOOL_DEFINITIONS},(_,index)=>({type:'function',function:{name:'tool'+index,description:'Local tool',parameters:{type:'object'}}})),messages=[{role:'user',content:'Find a note'}];
 assert.equal(await adapter.count(messages,{json:false,tools}),23);
 assert.equal((await adapter.generate(messages,{json:false,tools,maxTokens:32})).toolCalls[0].name,'tool0');
 assert.deepEqual(seen,[tools,tools]);
 const excessive=[...tools,{type:'function',function:{name:'extra',parameters:{type:'object'}}}];
 await assert.rejects(adapter.count(messages,{json:false,tools:excessive}),/Invalid native tools/);
 await assert.rejects(adapter.generate(messages,{json:false,tools:excessive,maxTokens:32}),/Invalid native tools/);
 assert.equal(seen.length,2);
});
test('LFM3 handles a nine-call stream and its matching assistant history',async()=>{
 const adapter=new PreparedGgufAdapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[],architecture:'lfm3'});
 const parts=Array.from({length:9},(_,index)=>({index,id:'id-'+index,function:{name:'memory.search',arguments:JSON.stringify({query:'q'+index})}}));
 adapter.loaded='local';adapter.runtime={countChatTokens:async()=>11,createChatCompletion:async()=> (async function*(){yield {choices:[{delta:{tool_calls:parts}}]};})()};
 const tools=[{type:'function',function:{name:'memory.search',parameters:{type:'object'}}}],history=[{role:'assistant',content:'',tool_calls:parts.map(part=>({id:part.id,type:'function',function:{name:part.function.name,arguments:JSON.parse(part.function.arguments)}}))}];
 assert.equal(await adapter.count(history,{json:false,tools}),11);
 assert.equal((await adapter.generate([{role:'user',content:'find'}],{json:false,tools,maxTokens:32})).toolCalls.length,9);
 const excessive=Array.from({length:129},(_,index)=>({id:'id-'+index,type:'function',function:{name:'memory.search',arguments:{query:'q'}}}));
 await assert.rejects(adapter.count([{role:'assistant',content:'',tool_calls:excessive}],{json:false,tools}),/Invalid messages/);
 adapter.runtime.createChatCompletion=async()=> (async function*(){yield {choices:[{delta:{tool_calls:[{index:128,id:'excess',function:{name:'memory.search',arguments:'{}'}}]}}]};})();
 await assert.rejects(adapter.generate([{role:'user',content:'find'}],{json:false,tools,maxTokens:32}),/Invalid native tool-call stream/);
});
// Mock API contract controls only, never inference evidence.
const file=new File(['fixture'],'fixture.gguf'),model={id:'lfm-test',contextTokens:2048,file:{bytes:file.size,sha256:createHash('sha256').update('fixture').digest('hex')}};

test('pathological streamed repetition aborts the runtime and invalidates prompt reuse before the output cap',async()=>{
 for(const channel of ['content','reasoning_content','arguments']){
  let options,cleanupAborted,chunks=0;const adapter=new Lfm3Adapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[],reusePrompt:true});
  adapter.loaded='local';adapter.promptCacheReady=true;
  adapter.runtime={createChatCompletion:async value=>{options=value;return (async function*(){try{for(let i=0;i<20;i++){chunks++;yield {choices:[{delta:channel==='arguments'?{tool_calls:[{index:0,function:{...(i===0?{name:'memory.search'}:{}),arguments:'于'.repeat(80)}}]}:{[channel]:'于'.repeat(80)}}]};}}finally{cleanupAborted=options.abortSignal.aborted;}})();}};
  await assert.rejects(adapter.generate([{role:'user',content:'Read the guide.'}],{json:false,maxTokens:256}),/repeated text/i);
  assert.ok(chunks<20);assert.equal(cleanupAborted,true,'abort is sent before asynchronous stream cleanup');assert.equal(options.abortSignal.aborted,true);assert.equal(adapter.busy,false);assert.equal(adapter.promptCacheReady,false);
 }
 const adapter=new Lfm3Adapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[]}),literal='x'.repeat(300);
 adapter.loaded='local';adapter.runtime={createChatCompletion:async()=> (async function*(){yield {choices:[{delta:{content:literal}}]};})()};
 assert.equal((await adapter.generate([{role:'user',content:literal}],{json:false,maxTokens:256})).text,literal,'an exact supplied literal can be copied');
});
test('LFM3 adapter uses the explicit WebGPU route and matching supported nonthinking template for count and generation',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js');const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),seen=[],lfm3Model={...model,contextTokens:8192};let gpuRequests=0;
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){gpuRequests++;return {};}}}});class Runtime{static getLibllamaVersion(){return 'lfm3-fixture'}setCompat(){}async loadModel(_files,p){seen.push({load:p});}getChatTemplate(){return 'lfm3-template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm3'},n_ctx:lfm3Model.contextTokens}}getWorkerResources(){return {compat:true,wasmPath:'/lfm3.wasm'}}async countChatTokens(options){seen.push({count:options});return 9;}async createChatCompletion(options){seen.push({generate:options});return (async function*(){yield {choices:[{delta:{content:'local answer'}}],usage:{prompt_tokens:9,completion_tokens:2}};})();}async exit(){}}
  const adapter=new Lfm3Adapter({Wllama:Runtime,paths:{default:'/lfm3.wasm'},compat:{wasm:'/lfm3-compat.wasm',worker:{code:'local'}},models:[lfm3Model],maxReplyTokens:768});await adapter.load(file,lfm3Model.id,{backend:'webgpu'});const messages=[{role:'user',content:'Use my saved notes'}];assert.equal(gpuRequests,1);assert.equal(seen[0].load.n_ctx,8192);assert.equal(seen[0].load.n_ctx_checkpoints,8);assert.equal(seen[0].load.n_cache_reuse,0);assert.equal(seen[0].load.n_gpu_layers,99999);assert.equal(await adapter.count(messages,{json:false}),9);const result=await adapter.generate(messages,{json:false,maxTokens:120});assert.equal(result.text,'local answer');assert.deepEqual(seen[1].count.chat_template_kwargs,{enable_thinking:false,preserve_thinking:false});assert.deepEqual(seen[2].generate.chat_template_kwargs,seen[1].count.chat_template_kwargs);assert.deepEqual(seen[2].generate.messages,messages);assert.equal(seen[2].generate.max_tokens,120);assert.equal(seen[2].generate.cache_prompt,false);assert.deepEqual({temperature:seen[2].generate.temperature,top_k:seen[2].generate.top_k,repeat_penalty:seen[2].generate.repeat_penalty},{temperature:0.1,top_k:50,repeat_penalty:1.1});await adapter.unload();
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('LFM3 selected context reaches Wllama n_ctx at 16K and 32K without implying runtime-fit evidence',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js'),descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){return {};}}}});
  for(const contextTokens of [16384,32768,65536,131072,262144]){const seen=[],lfm3Model={...model,id:'lfm3-test',engine:'wllama-lfm3',contextTokens};class Runtime{static getLibllamaVersion(){return 'lfm3-fixture'}setCompat(){}async loadModel(_files,parameters){seen.push(parameters)}getChatTemplate(){return 'lfm3-template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm3'},n_ctx:contextTokens}}getWorkerResources(){return {compat:true,wasmPath:'/lfm3.wasm'}}async exit(){}}
   const adapter=new Lfm3Adapter({Wllama:Runtime,paths:{default:'/lfm3.wasm'},compat:{wasm:'/lfm3-compat.wasm',worker:{code:'local'}},models:[lfm3Model]});const info=await adapter.load(file,lfm3Model.id,{backend:'webgpu'});assert.equal(seen[0].n_ctx,contextTokens);assert.equal(info.context.n_ctx,contextTokens);assert.equal(info.actualGpuLayers,null);assert.equal(info.gpuLayerEvidence,'unobserved');await adapter.unload();
  }
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('LFM3 native tool calls stream multiple calls and use the same tool schema for exact count and generation',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js');const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),seen=[],lfm3Model={...model,contextTokens:8192};
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){return {};}}}});class Runtime{static getLibllamaVersion(){return 'lfm3-fixture'}setCompat(){}async loadModel(){}getChatTemplate(){return 'template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm3'},n_ctx:8192}}getWorkerResources(){return {compat:true,wasmPath:'/lfm3.wasm'}}async countChatTokens(options){seen.push(['count',options]);return 23;}async createChatCompletion(options){seen.push(['generate',options]);return (async function*(){yield {choices:[{delta:{reasoning_content:'Private planning context.'}}]};yield {choices:[{delta:{tool_calls:[{index:0,id:'call-1',type:'function',function:{name:'memory.',arguments:'{"query"'}},{index:1,id:'call-2',type:'function',function:{name:'memory.search',arguments:'{"query":"calendar"}'}}]}}]};yield {choices:[{delta:{tool_calls:[{index:0,function:{name:'search',arguments:':"shelf"}'}}]}}]};})();}async exit(){}}
  const adapter=new Lfm3Adapter({Wllama:Runtime,paths:{default:'/lfm3.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[lfm3Model]});await adapter.load(file,lfm3Model.id,{backend:'webgpu'});
  const tools=[{type:'function',function:{name:'memory.search',description:'Search local saved notes.',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}}],messages=[{role:'user',content:'Find the note'}];
  assert.equal(adapter.nativeToolCalls,true);assert.equal(await adapter.count(messages,{json:false,tools}),23);const result=await adapter.generate(messages,{json:false,maxTokens:100,tools});
  assert.equal(result.assistantContent,'<think>Private planning context.</think>');assert.equal(seen[0][1].chat_template_kwargs.enable_thinking,true);assert.deepEqual(seen[1][1].chat_template_kwargs,seen[0][1].chat_template_kwargs);assert.equal(result.text,'');assert.deepEqual(result.toolCalls,[{id:'call-1',name:'memory.search',arguments:{query:'shelf'}},{id:'call-2',name:'memory.search',arguments:{query:'calendar'}}]);assert.deepEqual(seen[0][1].tools,tools);assert.deepEqual(seen[1][1].tools,tools);assert.equal(seen[0][1].tool_choice,'required');assert.equal(seen[1][1].tool_choice,'required');assert.deepEqual({temperature:seen[1][1].temperature,top_k:seen[1][1].top_k,repeat_penalty:seen[1][1].repeat_penalty},{temperature:0.1,top_k:50,repeat_penalty:1.1});assert.equal('parallel_tool_calls' in seen[0][1],false);assert.equal('parallel_tool_calls' in seen[1][1],false);assert.equal('response_format' in seen[0][1],false);assert.equal('response_format' in seen[1][1],false);await adapter.unload();
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('LFM3 native tools reject malformed schemas, incompatible JSON mode and malformed streamed arguments',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js');const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator'),lfm3Model={...model,contextTokens:8192};
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){return {};}}}});class Runtime{static getLibllamaVersion(){return 'lfm3-fixture'}setCompat(){}async loadModel(){}getChatTemplate(){return 'template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm3'},n_ctx:8192}}getWorkerResources(){return {compat:true,wasmPath:'/lfm3.wasm'}}async countChatTokens(){return 1}async createChatCompletion(){return (async function*(){yield {choices:[{delta:{tool_calls:[{index:0,id:'bad',function:{name:'memory.search',arguments:'[]'}}]}}]};})();}async exit(){}}
  const adapter=new Lfm3Adapter({Wllama:Runtime,paths:{default:'/lfm3.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[lfm3Model]});await adapter.load(file,lfm3Model.id,{backend:'webgpu'});const messages=[{role:'user',content:'Find'}],tools=[{type:'function',function:{name:'memory.search',description:'Search',parameters:{type:'object',properties:{}}}}];
  await assert.rejects(adapter.count(messages,{tools}),/constrained JSON mode/);await assert.rejects(adapter.generate(messages,{tools,maxTokens:20}),/constrained JSON mode/);await assert.rejects(adapter.count(messages,{json:false,tools:[{type:'function',function:{name:'bad name',parameters:[]}}]}),/Invalid native tools/);await assert.rejects(adapter.generate(messages,{json:false,tools,maxTokens:20}),/must be an object/);await adapter.unload();
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('WebGPU layer evidence is reported only from the selected runtime offload log',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js');const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');let runtimeLogger;
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){return {};}}}});class Runtime{static getLibllamaVersion(){return 'lfm3-fixture'}constructor(_paths,config){runtimeLogger=config.logger;}setCompat(){}async loadModel(){runtimeLogger.debug('load_tensors: offloaded 24/28 layers to GPU');}getChatTemplate(){return 'template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm3'},n_ctx:8192}}getWorkerResources(){return {compat:true,wasmPath:'/lfm3.wasm'}}async exit(){}}
  const lfm3Model={...model,contextTokens:8192},adapter=new Lfm3Adapter({Wllama:Runtime,paths:{default:'/lfm3.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[lfm3Model],logger:{debug(){}}});const info=await adapter.load(file,lfm3Model.id,{backend:'webgpu'});assert.equal(info.actualGpuLayers,24);assert.equal(info.totalModelLayers,28);assert.equal(info.gpuLayerEvidence,'runtime-offload-log');await adapter.unload();
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('WebGPU adapter availability and configured offload request are not reported as observed GPU layers',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js');const descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 try{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{async requestAdapter(){return {};}}}});class Runtime{static getLibllamaVersion(){return 'lfm3-fixture'}setCompat(){}async loadModel(){}getChatTemplate(){return 'template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm3'},n_ctx:8192}}getWorkerResources(){return {compat:true,wasmPath:'/lfm3.wasm'}}async exit(){}}
  const lfm3Model={...model,contextTokens:8192},adapter=new Lfm3Adapter({Wllama:Runtime,paths:{default:'/lfm3.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[lfm3Model]});const info=await adapter.load(file,lfm3Model.id,{backend:'webgpu'});assert.equal(info.actualGpuLayers,null);assert.equal(info.totalModelLayers,null);assert.equal(info.gpuLayerEvidence,'unobserved');await adapter.unload();
 }finally{if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator;}
});
test('Qwen3 uses a separate fixed architecture and identical nonthinking count/generation options',async()=>{
 const {Qwen3Adapter}=await import('../dist/qwen3-adapter.js');const seen=[];let exited=0;
 class Runtime{static getLibllamaVersion(){return 'fixture'}setCompat(){}async loadModel(_files,p){seen.push({load:p});}getChatTemplate(){return 'fixture'}getLoadedContextInfo(){return {metadata:{'general.architecture':'qwen3'},n_ctx:model.contextTokens}}getWorkerResources(){return {compat:true,wasmPath:'/compat.wasm'}}async countChatTokens(options){seen.push({count:options});return 12;}async createChatCompletion(options){seen.push({generate:options});return (async function*(){yield {choices:[{delta:{content:'fixture'}}],usage:{prompt_tokens:12,completion_tokens:1}};})();}async exit(){exited++;}}
 const adapter=new Qwen3Adapter({Wllama:Runtime,paths:{default:'/local.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[model]});
 await adapter.load(file,model.id,{backend:'cpu'});const messages=[{role:'user',content:'Actual original'}];assert.equal(await adapter.count(messages,{json:false}),12);await adapter.generate(messages,{json:false,maxTokens:8});
 assert.equal(seen[0].load.n_gpu_layers,0);assert.equal(seen[0].load.reasoning,false);assert.equal(seen[0].load.cache_type_k,'q8_0');assert.equal(seen[0].load.cache_type_v,'q8_0');assert.deepEqual(seen[1].count.chat_template_kwargs,{enable_thinking:false});assert.deepEqual(seen[2].generate.chat_template_kwargs,seen[1].count.chat_template_kwargs);assert.deepEqual(seen[2].generate.messages,messages);
 await adapter.unload();assert.equal(exited,1);assert.equal(adapter.loaded,null);await assert.rejects(adapter.load(file,model.id,{backend:'webgpu'}),/CPU only/);
});
test('Qwen3 adapter refuses a different loaded architecture and cleans up the rejected runtime',async()=>{
 const {Qwen3Adapter}=await import('../dist/qwen3-adapter.js');let exits=0;
 class Runtime{setCompat(){}async loadModel(){}getChatTemplate(){return 'template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm2'}}}async exit(){exits++;}}
 const adapter=new Qwen3Adapter({Wllama:Runtime,paths:{default:'/local.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[model],architecture:'lfm2'});
 await assert.rejects(adapter.load(file,model.id,{backend:'cpu'}),/Unexpected GGUF architecture/);assert.equal(exits,1);assert.equal(adapter.loaded,null);assert.equal(adapter.runtime,null);assert.equal(adapter.busy,false);
});
function setup(maxReplyTokens=256,modelRecord=model,preparedFile=file){let params,exits=0;class Runtime{static getLibllamaVersion(){return 'fixture-runtime'}setCompat(c){this.compat=c}async loadModel(files,p){assert.equal(files[0],preparedFile);params=p;this.nbThreads=p.n_threads;this.useMultiThread=p.n_threads>1}getChatTemplate(){return 'fixture-template'}getLoadedContextInfo(){return {metadata:{'general.architecture':'lfm2'},n_ctx:params?.n_ctx??2048}}getWorkerResources(){return {compat:false,wasmPath:'/local.wasm'}}async createChatCompletion(options){this.options=options;return (async function*(){yield {choices:[{delta:{content:'fixture'}}]};yield {choices:[],usage:{prompt_tokens:10,completion_tokens:1}}})()}async exit(){exits++}}
 let now=0;const adapter=new LfmAdapter({Wllama:Runtime,paths:{default:'/local.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'bundled'}},models:[modelRecord],maxReplyTokens,clock:()=>++now});return {adapter,Runtime,get params(){return params},get exits(){return exits}};}
for(const [architecture,Adapter] of [['lfm2',LfmAdapter],['lfm3',Lfm3Adapter]])test(architecture+' opted-in prompt reuse follows only completed work and is invalidated by failure, Stop and reload',async()=>{
 const s=setup();class Runtime extends s.Runtime{getLoadedContextInfo(){return {...super.getLoadedContextInfo(),metadata:{'general.architecture':architecture}}}}
 const adapter=new Adapter({Wllama:Runtime,paths:{default:'/local.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'bundled'}},models:[model],reusePrompt:true});
 await adapter.load(file,model.id,{backend:'cpu'});if(architecture==='lfm3'){assert.equal(s.params.swa_full,true);assert.equal(s.params.n_ctx_checkpoints,8);assert.equal(s.params.n_cache_reuse,0);}const input=[{role:'user',content:'first'}];
 await adapter.generate(input,{json:false});assert.equal(adapter.runtime.options.cache_prompt,false);
 const changed=[{role:'user',content:'different'}];await adapter.generate(changed,{json:false});assert.equal(adapter.runtime.options.cache_prompt,true);assert.deepEqual(adapter.runtime.options.messages,changed);
 const original=adapter.runtime.createChatCompletion;adapter.runtime.createChatCompletion=async()=>{throw Error('native failure');};
 await assert.rejects(adapter.generate(input),/native failure/);adapter.runtime.createChatCompletion=original;
 await adapter.generate(input);assert.equal(adapter.runtime.options.cache_prompt,false);
 adapter.runtime.createChatCompletion=async()=> (async function*(){yield {usage:{get prompt_tokens(){throw Error('invalid native usage');}}};})();
 await assert.rejects(adapter.generate(input),/invalid native usage/);adapter.runtime.createChatCompletion=original;
 await adapter.generate(input);assert.equal(adapter.runtime.options.cache_prompt,false);
 adapter.abort();await adapter.generate(input);assert.equal(adapter.runtime.options.cache_prompt,false);
 await adapter.unload();await adapter.load(file,model.id,{backend:'cpu'});await adapter.generate(input);assert.equal(adapter.runtime.options.cache_prompt,false);await adapter.unload();
});

test('prepared custom model uses only the selected bounded context and rejects values above inspected capacity',async()=>{const custom={...model,contextTokens:4096,localModel:{inspection:{contextLength:8192}}};const chosen=setup(256,custom);await chosen.adapter.load(file,custom.id,{backend:'cpu'});assert.equal(chosen.params.n_ctx,4096);assert.equal(chosen.adapter.info.context.n_ctx,4096);await chosen.adapter.unload();const oversized={...custom,contextTokens:8192,localModel:{inspection:{contextLength:4096}}};const rejected=setup(256,oversized);await assert.rejects(rejected.adapter.load(file,oversized.id,{backend:'cpu'}),/context window/);assert.equal(rejected.adapter.runtime,null);});
test('prepared LFM2 keeps safe threading fallback/local compat and F16-default KV policy while counting actual stream chunks',async()=>{const s=setup();const info=await s.adapter.load(file,model.id,{backend:'cpu'});assert.equal(s.params.n_ctx,2048);assert.equal(s.params.n_threads,1);assert.equal(info.activeThreads,1);assert.equal(s.params.n_gpu_layers,0);assert.equal(info.actualGpuLayers,null);assert.equal(info.gpuLayerEvidence,'cpu-route-requested');assert.equal(s.params.n_parallel,1);assert.equal(s.params.n_batch,128);assert.equal('cache_type_k' in s.params,false);assert.equal('cache_type_v' in s.params,false);const result=await s.adapter.generate([{role:'user',content:'fixture'}]);assert.equal(result.text,'fixture');assert.equal(result.outputTokens,1);assert.ok(result.firstContentMs>0);assert.ok(result.totalMs>=result.firstContentMs);assert.equal(s.adapter.runtime.options.cache_prompt,false);assert.equal(s.adapter.runtime.options.temperature,0);await s.adapter.unload();assert.equal(s.exits,1);assert.equal(s.adapter.loaded,null)});
test('prepared adapter forwards capped thread count when page isolation and shared memory are available',async()=>{const descriptors={isolated:Object.getOwnPropertyDescriptor(globalThis,'crossOriginIsolated'),navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator')};try{Object.defineProperty(globalThis,'crossOriginIsolated',{configurable:true,value:true});Object.defineProperty(globalThis,'navigator',{configurable:true,value:{hardwareConcurrency:6}});const s=setup();const info=await s.adapter.load(file,model.id,{backend:'cpu'});assert.equal(s.params.n_threads,3);assert.equal(info.requestedThreads,3);assert.equal(info.activeThreads,3);await s.adapter.unload();}finally{for(const [key,descriptor] of [['crossOriginIsolated',descriptors.isolated],['navigator',descriptors.navigator]]){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}});
test('native timing fallback counts both processed and cached input tokens',async()=>{const s=setup();await s.adapter.load(file,model.id,{backend:'cpu'});s.adapter.runtime.createChatCompletion=async()=> (async function*(){yield {choices:[{delta:{content:'answer'}}],timings:{prompt_n:20,cache_n:80,predicted_n:1}};})();const result=await s.adapter.generate([{role:'user',content:'fixture'}]);assert.equal(result.inputTokens,100);assert.equal(result.outputTokens,1);await s.adapter.unload();});
test('stream completion reason survives even when runtime token usage underreports a length stop',async()=>{const s=setup();await s.adapter.load(file,model.id,{backend:'cpu'});s.adapter.runtime.createChatCompletion=async()=> (async function*(){yield {choices:[{delta:{content:'partial answer'}}]};yield {choices:[{delta:{},finish_reason:'length'}],usage:{completion_tokens:0}};})();const result=await s.adapter.generate([{role:'user',content:'fixture'}]);assert.equal(result.finishReason,'length');assert.equal(result.outputTokens,0);await s.adapter.unload();});
test('LFM forwards only the app-generated JSON schema alongside JSON mode to pinned llama.cpp',async()=>{const s=setup();await s.adapter.load(file,model.id,{backend:'cpu'});const jsonSchema={type:'object',properties:{action:{type:'string',enum:['chat']}},required:['action'],additionalProperties:false};await s.adapter.generate([{role:'user',content:'fixture'}],{json:true,jsonSchema});assert.deepEqual(s.adapter.runtime.options.response_format,{type:'json_object'});assert.deepEqual(s.adapter.runtime.options.json_schema,jsonSchema);await s.adapter.unload();});
test('unknown model/backend, forged bytes and cancelled load never construct a ready runtime',async()=>{const s=setup();await assert.rejects(s.adapter.load(file,model.id),/explicit backend/);await assert.rejects(s.adapter.load(file,'unknown',{backend:'cpu'}),/Unknown/);await assert.rejects(s.adapter.load(new Blob(['forgery']),model.id,{backend:'cpu'}),/integrity/);const signal=AbortSignal.abort();await assert.rejects(s.adapter.load(file,model.id,{backend:'cpu',signal}));assert.equal(s.adapter.runtime,null)});
test('Stop discards late stream content, clears busy and permits explicit unload/reload',async()=>{const s=setup();await s.adapter.load(file,model.id,{backend:'cpu'});let release;const waiting=new Promise(r=>release=r);s.adapter.runtime.createChatCompletion=async()=> (async function*(){await waiting;yield {choices:[{delta:{content:'late'}}]}})();const result=s.adapter.generate([{role:'user',content:'fixture'}]);s.adapter.abort();release();await assert.rejects(result,/Stopped/);assert.equal(s.adapter.busy,false);await s.adapter.unload();await s.adapter.load(file,model.id,{backend:'cpu'});await s.adapter.unload()});

import {parseAnswer} from '../dist/core.js';
test('explicit insufficiency is accepted without citations but cannot masquerade as a grounded answer',()=>{assert.deepEqual(parseAnswer('{"status":"insufficient_evidence","answer":"Not in notes","citations":[]}',[]),{status:'insufficient_evidence',answer:'Not in notes',refs:[]});for(const value of [{status:'answered',answer:'x',citations:[]},{status:'invented',answer:'x',citations:[]},{status:'insufficient_evidence',answer:'x',citations:[{id:'S1',quote:'x'}]}])assert.throws(()=>parseAnswer(JSON.stringify(value),[]));assert.throws(()=>parseAnswer('{"status":"answered","answer":"x","citations":[{"id":"wrong","quote":"x"}]}',[]),/Citation/)});

import {freezeCase} from '../dist/bench/runner.js';import {scoreAnswer,qualitySummary,pairedBootstrap} from '../dist/bench/scorer.js';
test('benchmark strict status and canonical citation checks cannot be replaced by fact matching or missing human grades',()=>{
 const fixture={id:'control',question:'Code?',notes:[{id:'note',title:'Code',versions:['old','NEW'],state:'active'}],oracle:[{noteId:'note',revision:2}],expected:{status:'answered',facts:['NEW']}},f=freezeCase(fixture);
 const good=JSON.stringify({status:'answered',answer:'NEW',citations:[{id:'S1',quote:'NEW'}]});assert.equal(scoreAnswer(good,f.evidence,f.records,f.expected).taskPass,null);assert.equal(scoreAnswer(good,f.evidence,f.records,f.expected,{answerCorrect:true,safetyPass:true}).taskPass,true);
 const forged=JSON.stringify({status:'answered',answer:'NEW',citations:[{id:'S1',quote:'old'}]});assert.equal(scoreAnswer(forged,f.evidence,f.records,f.expected,{answerCorrect:true,safetyPass:true}).taskPass,false);assert.equal(qualitySummary([{caseId:'control',score:scoreAnswer(good,f.evidence,f.records,f.expected)}],1).taskAchievement,null);assert.throws(()=>pairedBootstrap([{small:null,large:true}]),/Complete/);
});

import {parseChatAnswer} from '../design/prototype/src/conversation.ts';
test('product dialogue parser withholds explicit insufficiency instead of returning saveable ungrounded prose',()=>{assert.throws(()=>parseChatAnswer('{"status":"insufficient_evidence","answer":"No evidence","citations":[]}',[],false),/Insufficient evidence/);assert.deepEqual(parseChatAnswer('{"answer":"ordinary dialogue"}',[],true),{answer:'ordinary dialogue',sources:[]})});

test('fixed A/B evidence excludes withdrawn records and never accepts a historical revision as current',()=>{const fixture={id:'revision',question:'code',notes:[{id:'active',title:'Code',versions:['old code','new code'],state:'active'},{id:'withdrawn',title:'Code old',versions:['old code'],state:'withdrawn'}],oracle:[{noteId:'active',revision:2}],expected:{status:'answered',facts:['new code']}},a=freezeCase(fixture,'A'),b=freezeCase(fixture,'B');assert.ok(b.evidence.every(r=>r.noteId!=='withdrawn'));const old={...a.evidence[0],revision:1,quote:'old code',end:8};const text=JSON.stringify({status:'answered',answer:'old code',citations:[{id:'S1',quote:'old code'}]});assert.equal(scoreAnswer(text,[old],a.records,a.expected,{answerCorrect:true,safetyPass:true}).citationsValid,false)});
test('noninferiority calculation keeps paired outcomes and incomplete quality never becomes zero or adoption',()=>{const pairs=Array.from({length:100},(_,i)=>({small:i<90,large:i<90})),ci=pairedBootstrap(pairs,{samples:1000,seed:17});assert.equal(ci.difference,0);assert.equal(ci.lower95,0);assert.equal(ci.nonInferior,true);assert.equal(qualitySummary([],100).taskAchievement,null);assert.match(qualitySummary([],100).adoption,/UNCERTAIN/);assert.throws(()=>qualitySummary([{caseId:'same'},{caseId:'same'}]),/Duplicate/)});

test('zero output budget is not accepted as a token-counting substitute',async()=>{
 const s=setup();await s.adapter.load(file,model.id,{backend:'cpu'});let calls=0;s.adapter.runtime.createChatCompletion=async()=>{calls++;throw Error('Runtime must not run');};await assert.rejects(s.adapter.generate([{role:'user',content:'Count only'}],{maxTokens:0}),/Output budget/);assert.equal(calls,0);assert.equal(s.adapter.busy,false);await s.adapter.unload();
});


test('optional exact count never falls back to generation and discards cancelled late results',async()=>{
 const s=setup();await s.adapter.load(file,model.id,{backend:'cpu'});let generation=0;s.adapter.runtime.createChatCompletion=async()=>{generation++;throw Error('Must not generate');};
 await assert.rejects(s.adapter.count([{role:'user',content:'text'}]),/Exact pre-generation/);assert.equal(generation,0);
 let options;s.adapter.runtime.countChatTokens=async value=>{options=value;return 17;};assert.equal(await s.adapter.count([{role:'user',content:'text'}]),17);assert.deepEqual(options.response_format,{type:'json_object'});
 s.adapter.runtime.countChatTokens=async()=>NaN;await assert.rejects(s.adapter.count([{role:'user',content:'text'}]),/Invalid prompt/);assert.equal(s.adapter.busy,false);
 let release;s.adapter.runtime.countChatTokens=()=>new Promise(resolve=>release=resolve);const pending=s.adapter.count([{role:'user',content:'text'}]);s.adapter.abort();release(18);await assert.rejects(pending,/Stopped/);assert.equal(s.adapter.busy,false);assert.equal(generation,0);await s.adapter.unload();
});


test('normal output budgets are explicit while diagnostic default remains bounded',async()=>{
 const old=setup();await old.adapter.load(file,model.id,{backend:'cpu'});await assert.rejects(old.adapter.generate([{role:'user',content:'fixture'}],{maxTokens:384}),/Output budget/);await old.adapter.unload();
 const normal=setup(768);await normal.adapter.load(file,model.id,{backend:'cpu'});await normal.adapter.generate([{role:'user',content:'fixture'}],{maxTokens:768});assert.equal(normal.adapter.runtime.options.max_tokens,768);assert.throws(()=>setup(769),/output budget/);await normal.adapter.unload();
});
test('LFM3 accepts its declared 3072-token output budget while LFM2/Qwen remain capped at 768',async()=>{
 const {Lfm3Adapter}=await import('../dist/lfm-adapter.js');
 const make=(architecture,maxReplyTokens)=>()=>new PreparedGgufAdapter({Wllama:class{},paths:{default:'/local.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[model],architecture,maxReplyTokens});
 assert.doesNotThrow(make('lfm3',3072));assert.throws(make('lfm3',3073),/output budget/);assert.throws(make('lfm2',769),/output budget/);assert.throws(make('qwen3',769),/output budget/);
 let options;const adapter=new Lfm3Adapter({Wllama:class{},paths:{default:'/local.wasm'},compat:{wasm:'/compat.wasm',worker:{code:'local'}},models:[model],maxReplyTokens:3072});
 adapter.loaded='local';adapter.runtime={createChatCompletion:async value=>{options=value;return (async function*(){yield {choices:[{delta:{content:'fixture'}}]};})();}};
 await adapter.generate([{role:'user',content:'detail'}],{maxTokens:3072});assert.equal(options.max_tokens,3072);
});

test('a verified immutable File snapshot is hashed once per adapter while a new snapshot is still verified',async()=>{
 const s=setup(),progress=[];s.adapter.onProgress=value=>progress.push(value);const verified=file;
 await s.adapter.load(verified,model.id,{backend:'cpu'});await s.adapter.unload();
 const firstVerificationProgress=progress.filter(value=>value==='Verifying model · 100%').length;
 await s.adapter.load(verified,model.id,{backend:'cpu'});
 assert.equal(firstVerificationProgress,1);assert.equal(progress.filter(value=>value==='Verifying model · 100%').length,1);
 await s.adapter.unload();const changed=new File(['xxxxxxx'],'model.gguf');
 await assert.rejects(s.adapter.load(changed,model.id,{backend:'cpu'}),/integrity mismatch/);assert.equal(s.adapter.runtime,null);
});
test('a same-size corrupt prepared snapshot is rejected before the runtime loads',async()=>{
 const corrupt=new File(['xxxxxxx'],model.file.sha256),read=createRecentPreparedFileReader(async()=>corrupt,()=>model.file.sha256,()=>model.file.bytes);
 const adapter=setup(256,model,corrupt).adapter;
 await assert.rejects(adapter.load(await read(model.id),model.id,{backend:'cpu'}),/integrity mismatch/);assert.equal(adapter.runtime,null);
});


test('LFM3 compiled notice verification rejects missing and altered pins without changing source files',async()=>{
 const {spawnSync}=await import('node:child_process');
 const checker=new URL('../scripts/check-lfm3-runtime.mjs',import.meta.url).href;
 const workdir=new URL('../',import.meta.url);
 for(const mode of ['missing','mismatch']){
  const script=`import fs from 'node:fs';import path from 'node:path';import {syncBuiltinESMExports} from 'node:module';
  const original=fs.promises.readFile;fs.promises.readFile=async function(file,...args){const data=await original.call(this,file,...args);if(path.basename(String(file))==='manifest.json'&&path.basename(path.dirname(String(file)))==='wllama-lfm3'){const m=JSON.parse(data);if(${JSON.stringify(mode)}==='missing')m.compiledNotices.pop();else m.compiledNotices[0].sha256='0'.repeat(64);return JSON.stringify(m);}return data;};syncBuiltinESMExports();
  try{await import(${JSON.stringify(checker)});throw Error('incorrectly accepted');}catch(error){const wanted=${JSON.stringify(mode)}==='missing'?'compiled notice inventory incomplete':'compiled notice pin mismatch';if(!String(error.message).includes(wanted))throw error;}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:workdir,encoding:'utf8',timeout:10000});
  assert.equal(child.status,0,child.stderr||child.stdout);
 }
});

test('LFM3 runtime verification rejects a mismatched llama.cpp patch pin',async()=>{
 const {spawnSync}=await import('node:child_process');
 const checker=new URL('../scripts/check-lfm3-runtime.mjs',import.meta.url).href;
 const script=`import fs from 'node:fs';import path from 'node:path';import {syncBuiltinESMExports} from 'node:module';
 const original=fs.promises.readFile;fs.promises.readFile=async function(file,...args){const data=await original.call(this,file,...args);if(path.basename(String(file))==='manifest.json'&&path.basename(path.dirname(String(file)))==='wllama-lfm3'){const m=JSON.parse(data);m.llamaCpp.patchSha256='0'.repeat(64);return JSON.stringify(m);}return data;};syncBuiltinESMExports();
 try{await import(${JSON.stringify(checker)});throw Error('incorrectly accepted native patch');}catch(error){if(!String(error.message).includes('LFM3 llama.cpp source patch pin mismatch'))throw error;}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:10000});
 assert.equal(child.status,0,child.stderr||child.stdout);
});

test('native final arguments are previewed before the stream completes, without reasoning or tool JSON',async()=>{
 const adapter=new Lfm3Adapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[]}),seen=[];
 adapter.loaded='local';adapter.runtime={createChatCompletion:async()=> (async function*(){
  yield {choices:[{delta:{reasoning_content:'private reasoning'}}]};
  yield {choices:[{delta:{reasoning_content:'more reasoning'}}]};
  assert.deepEqual(seen,[],'non-answer tokens must not trigger view updates');
  yield {choices:[{delta:{tool_calls:[{index:0,function:{name:'finish_answer',arguments:'{"reply":{"answer":"日'}}]}}]};
  assert.equal(seen.at(-1),'日');
  yield {choices:[{delta:{tool_calls:[{index:0,function:{arguments:'本語","sources":[],"status":"answered"}}'}}]}}]};
 })()};
 const result=await adapter.generate([{role:'user',content:'test'}],{json:false,tools:[{type:'function',function:{name:'finish_answer',parameters:{type:'object'}}}],maxTokens:32,onAnswerPreview:text=>seen.push(text)});
 assert.equal(result.toolCalls[0].arguments.reply.answer,'日本語');assert.deepEqual(seen,['日','日本語']);
});
