import test from 'node:test';import assert from 'node:assert/strict';
import {createLfmTextRuntime} from '../src/lfm-text-runtime.ts';
import {lfmTextModels,describeLfmText} from '../src/lfm-text-manifest.ts';
import {PreparedGgufAdapter} from '../../../dist/lfm-adapter.js';
// Controlled adapter/asset contract checks, not inference evidence.
test('a full configured tool catalog and scoped final actions cross the runtime bridge together',async()=>{
 const {nativeFinalPlanTools}=await import('../src/native-output-format.ts');
 const {MAX_CONFIGURED_AGENT_TOOLS}=await import('../src/agent-limits.ts');
 const {MAX_NATIVE_TOOL_DEFINITIONS}=await import('../../../dist/lfm-adapter.js');
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');
 const entry=index=>({type:'function',function:{name:'user.tool'+index,description:'Registered local tool',parameters:{type:'object'}}});
 const tools=[...Array.from({length:MAX_CONFIGURED_AGENT_TOOLS},(_,index)=>entry(index)),...nativeFinalPlanTools({inputs:false,file:true,current:true,historyCount:1,assistantIndices:[0]})];
 assert.ok(tools.length>65);assert.ok(tools.length<=MAX_NATIVE_TOOL_DEFINITIONS);
 const seen=[];f.adapter.count=async(_messages,options)=>{seen.push(options.tools);return 21;};f.adapter.generate=async(_messages,options)=>{seen.push(options.tools);return {text:'',toolCalls:[{name:'finish_capturetext',arguments:{reply:{status:'answered',answer:'A new note.',sources:[]}}}]};};
 const format={type:'native-tool-plan',tools};
 assert.equal((await f.runtime.count([],format)).prompt_tokens,21);
 assert.equal(JSON.parse((await f.runtime.generate([],128,format)).text).reply.answer,'A new note.');
 assert.deepEqual(seen,[tools,tools]);
 assert.equal(tools.some(tool=>tool.function.name==='finish_calculate'),false,'native operations must not escape through a second terminal calculator');
 assert.match(tools.find(tool=>tool.function.name==='finish_answer').function.description,/final answer.*results of successful tools/);
 assert.equal(tools.find(tool=>tool.function.name==='finish_answer').function.parameters.properties.reply.properties.sources.maxItems,0,'operations cannot invent an original source label');
 for(const labels of [['S0'],['S65'],['S1','S1']])assert.throws(()=>nativeFinalPlanTools({inputs:false,file:false,current:false,historyCount:0},labels),/Invalid native source labels/);
 const excessive={type:'native-tool-plan',tools:Array.from({length:MAX_NATIVE_TOOL_DEFINITIONS+1},(_,index)=>entry(index))};
 await assert.rejects(f.runtime.count([],excessive),/Invalid native tool plan/);
 await assert.rejects(f.runtime.generate([],128,excessive),/Invalid native tool plan/);
 assert.equal(seen.length,2);await f.runtime.unload();
});
test('direct native final actions preserve scoped capture selectors and cannot mix writes with read calls',async()=>{
 const {nativeFinalPlanTools}=await import('../src/native-output-format.ts');
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');
 const tools=nativeFinalPlanTools({inputs:false,file:false,current:true,historyCount:1,assistantIndices:[0]});
 const read={type:'function',function:{name:'memory.read',description:'Read',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}};
 const format={type:'native-tool-plan',tools:[read,...tools]};
 assert.equal(tools.some(tool=>['finish_read','finish_search'].includes(tool.function.name)),false,'screen navigation must not masquerade as an agent read/search operation');
 assert.match(tools.find(tool=>tool.function.name==='finish_open_file').function.description,/open.*Memory screen/i);
 assert.match(tools.find(tool=>tool.function.name==='finish_show_search_results').function.description,/show.*matching files/i);
 for(const [name,args,expected] of [
  ['finish_open_file',{query:'Notes/meeting.md',target:'path'},{action:'read',query:'Notes/meeting.md',target:'path'}],
  ['finish_show_search_results',{query:'meeting',target:'knowledge'},{action:'search',query:'meeting',target:'knowledge'}],
  ['finish_capturetext',{reply:{status:'answered',answer:'A new sourced comparison.',sources:['S1']}},{action:'capture',query:'',reply:{status:'answered',answer:'A new sourced comparison.',sources:['S1']}}],
  ['finish_capturecurrent',{},{action:'capture',query:'',target:'current'}],
  ['finish_captureassistant',{historyIndex:0},{action:'capture',query:'',target:'history',historyPart:'assistant',historyIndex:0}],
  ['finish_answer',{query:'Explain the difference.',target:'knowledge'},{action:'answer',query:'Explain the difference.',target:'knowledge'}]
 ]){
  f.adapter.generate=async()=>({text:'',toolCalls:[{name,arguments:args}]});
  assert.deepEqual(JSON.parse((await f.runtime.generate([],128,format)).text),expected);
 }
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'finish_capturecurrent',arguments:{target:'history'}}]});
 await assert.rejects(f.runtime.generate([],128,format),/override its bound selectors/);
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'finish_capturetext',arguments:{body:'x'}},{name:'memory.read',arguments:{query:'x'}}]});
 await assert.rejects(f.runtime.generate([],128,format),error=>error.diagnostic.reason==='native-final-mixed'&&error.diagnostic.raw===JSON.stringify({calls:['finish_capturetext','memory.read']}));
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'finish_delete',arguments:{query:'x'}}]});
 await assert.rejects(f.runtime.generate([],128,format),/Unknown or malformed native tool call/);
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'finish_read',arguments:{query:'x',target:'path'}}]});
 await assert.rejects(f.runtime.generate([],128,format),/Unknown or malformed native tool call/);
 const reply={status:'answered',answer:'Complete note content.',sources:['S1']};
 const sourcedFormat={type:'native-tool-plan',tools:nativeFinalPlanTools({inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]})};
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'finish_capturetext',arguments:{reply}}]});
 assert.deepEqual(JSON.parse((await f.runtime.generate([],128,sourcedFormat)).text),{action:'capture',query:'',reply});
 await f.runtime.unload();
});
test('LFM3 fresh-install manifest uses a useful context larger than the legacy 2K ceiling',async()=>{
 const {lfm3TextModels,describeLfm3Text}=await import('../src/lfm3-text-manifest.ts');
 assert.equal(lfm3TextModels[0].contextTokens,8192);
 assert.equal(lfm3TextModels[1].id,'lfm3-1.7b-q8-0');
 assert.equal(lfm3TextModels[1].file.bytes,1846238496);
 assert.equal(lfm3TextModels[1].file.sha256,'8f6b24182258205e9e01e21f1f24a1f208c1e8115578825d202ce39976af20b6');
 assert.equal(lfm3TextModels[1].contextTokens,8192);
 assert.equal(describeLfm3Text().contextTokens,8192);
 assert.deepEqual(describeLfm3Text().models.map(model=>model.id),['lfm3-1.7b-qad-q4-0','lfm3-1.7b-q8-0']);
});
test('the shipped LFM3 manifest and adapter output ceiling initialize together',async()=>{
 const {describeLfm3Text}=await import('../src/lfm3-text-manifest.ts');const manifest=describeLfm3Text();
 const adapter={supportsExactCount:true,maxReplyTokens:manifest.maxOutputTokens};
 const runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>new Blob(),readAssets:()=>({})});
 assert.equal(runtime.manifest.maxOutputTokens,3072);
});
test('pinned LFM3 context is explicitly selectable while custom model context stays tied to inspection',async()=>{
 const {describeLfm3Text}=await import('../src/lfm3-text-manifest.ts'),sha='a'.repeat(64),custom={id:'local-'+sha,label:'Local LFM3',role:'text',engine:'wllama-lfm3',revision:'sha256:'+sha,file:{bytes:1000,sha256:sha},contextTokens:4096,inspection:{format:'GGUF',version:3,bytes:1000,name:'Local LFM3',architecture:'lfm3',contextLength:8192,tokenizer:'gpt2',chatTemplate:true,tokenCount:128000,tensorCount:1,tensorTypes:[0],tensorExtentsChecked:true,dataOffset:512}};
 assert.equal(describeLfm3Text([], 'lfm3-1.7b-qad-q4-0', 16384).contextTokens,16384);
 assert.equal(describeLfm3Text([], 'lfm3-1.7b-q8-0', 32768).contextTokens,32768);
 assert.equal(describeLfm3Text([], 'lfm3-1.7b-q8-0', 262144).contextTokens,262144);
 assert.equal(describeLfm3Text([custom],custom.id,32768).contextTokens,4096);
 assert.throws(()=>describeLfm3Text([], '', 524288),/context window/);
});
test('LFM2.5 230M and 350M are distinct pinned text choices on the same local runtime',()=>{
 const ids=lfmTextModels.map(m=>m.id);assert.deepEqual(ids,['lfm25-350m-qad-q4-0','lfm25-230m-qad-q4-0']);
 const models=describeLfmText().models;const smaller=models[1],larger=models[0];
 assert.equal(smaller.engine,'wllama-cpu-count');assert.equal(smaller.runtime.revision,larger.runtime.revision);
 assert.equal(smaller.revision,'03502067c64ce32ac4fe87b0cec0310a1a13d3e9');assert.equal(smaller.file.bytes,149081056);
 assert.equal(smaller.file.sha256,'e75f83268de11b2a1bcfab5f3b5c5c0c97569ddbbc0990aad88437e45b8ba292');
 assert.equal(smaller.contextTokens,2048);assert.equal(smaller.files[0].path,smaller.file.name);
});
test('a validated custom LFM2 record becomes a hash-pinned local-only model on the fixed runtime',()=>{
 const sha='c'.repeat(64),custom={id:'local-'+sha,label:'My LFM2 fine tune',role:'text',engine:'wllama-lfm2',revision:'sha256:'+sha,file:{bytes:149081056,sha256:sha},contextTokens:4096,inspection:{format:'GGUF',version:3,bytes:149081056,name:'My model',architecture:'lfm2',contextLength:32768,tokenizer:'gpt2',chatTemplate:true,tokenCount:65536,tensorCount:3,tensorTypes:[0,2,14],tensorExtentsChecked:true,dataOffset:2387936}};
 const m=describeLfmText([custom],custom.id).models.at(-1);assert.equal(m.id,custom.id);assert.equal(m.file.sha256,sha);assert.equal(m.engine,'wllama-cpu-count');assert.equal(m.contextTokens,4096);assert.equal(m.runtime.revision,describeLfmText().runtime.revision);assert.equal(m.url,undefined);
});
function fixture(){const calls=[],file=new Blob(['weights']),adapter={loaded:null,supportsExactCount:true,maxReplyTokens:768,async load(_f,id,{backend}){calls.push(['load',backend]);this.loaded=id;},async unload(){calls.push(['unload']);this.loaded=null;},abort(){calls.push(['stop']);},async count(){calls.push(['count']);return 20;},async generate(_m,o){calls.push(['generate',o]);return {text:o.jsonSchema?'{ "action" : "chat" , "query" : "" }':'{"answer":"valid"}'};}};const manifest={contextTokens:2048,runtime:{revision:'fixed-count-runtime'},models:[{id:'local',revision:'weights-sha',contextTokens:2048,file:{name:'local.gguf',bytes:file.size}}]},runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>file,readAssets:()=>({local:{filesPresent:true}})});return {runtime,adapter,calls,manifest};}

test('LFM3 load returns bounded stage timings from the adapter without runtime metadata',async()=>{
 const f=fixture();f.adapter.load=async(_file,id)=>{f.adapter.loaded=id;return {verificationMs:121,runtimeLoadMs:38219,loadMs:38340,template:'PRIVATE-TEMPLATE',context:{private:'metadata'}};};
 const metrics=await f.runtime.load('local');
 assert.equal(metrics?.verificationMs,121);assert.equal(metrics?.runtimeLoadMs,38219);assert.ok(Number.isFinite(metrics?.totalLoadMs)&&metrics.totalLoadMs>=0);
});
test('prepared adapter timing reaches the shared inference result without raw runtime payloads',async()=>{
 const f=fixture();await f.runtime.load('local');
 f.adapter.generate=async()=>({text:'hello',outputTokens:2,firstContentMs:900,totalMs:1000,tokensPerSecond:2,usage:{private:'must not escape'},timings:{private:'must not escape'}});
 const result=await f.runtime.generate([],16,'prose');
 assert.deepEqual(result.metrics,{visibleTextTtftMs:900,generationMs:1000,generationTokensPerSecond:2});
 assert.equal(result.outputTokens,2);assert.equal(result.usage,undefined);assert.equal(result.timings,undefined);
 f.adapter.generate=async()=>({text:'hello',firstContentMs:null,totalMs:NaN,tokensPerSecond:-1});
 assert.equal((await f.runtime.generate([],16,'prose')).metrics,undefined);
});
test('prepared runtime separates native prompt/decode timing and reported threads without exposing metadata',async()=>{
 const f=fixture();await f.runtime.load('local');
 f.adapter.info={requestedThreads:4,activeThreads:1,actualGpuLayers:24,totalModelLayers:28,gpuLayerEvidence:'runtime-offload-log',context:{private:'hidden'},template:'hidden'};
 f.adapter.generate=async()=>({text:'hello',timings:{prompt_ms:900,predicted_ms:80,predicted_per_second:25,prompt_n:120,cache_n:0,private:'hidden'}});
 assert.deepEqual((await f.runtime.generate([],16,'prose')).metrics,{runtimePrefillMs:900,runtimeDecodeMs:80,runtimeDecodeTokensPerSecond:25,runtimePromptTokens:120,runtimeCachedTokens:0,requestedThreads:4,runtimeThreads:1,runtimeObservedGpuLayers:24,runtimeObservedGpuTotalLayers:28});
 f.adapter.info={requestedThreads:0,activeThreads:2.5};
 f.adapter.generate=async()=>({text:'hello',timings:{prompt_ms:-1,predicted_ms:NaN,predicted_per_second:Infinity,prompt_n:1.5,cache_n:-1}});
 assert.equal((await f.runtime.generate([],16,'prose')).metrics,undefined);
});

test('runtime manifest adopts the loaded model context for counting and generation budgets',async()=>{
 const f=fixture(),wide={id:'wide',revision:'wide-sha',contextTokens:4096,file:{name:'wide.gguf',bytes:7}},manifest={...f.manifest,models:[...f.manifest.models,wide]},runtime=createLfmTextRuntime({adapter:f.adapter,manifest,readFile:async()=>new Blob(['weights']),readAssets:()=>({wide:{filesPresent:true}})});
 await runtime.load('wide');assert.equal(runtime.manifest.contextTokens,4096);await runtime.unload();assert.equal(runtime.manifest.contextTokens,2048);
});
test('runtime accepts a larger LFM3 base context for the built-in model',()=>{
 const f=fixture(),manifest={...f.manifest,contextTokens:8192,models:[{...f.manifest.models[0],contextTokens:8192}]};
 const runtime=createLfmTextRuntime({adapter:f.adapter,manifest,readFile:async()=>f.file,readAssets:()=>({local:{filesPresent:true}})});
 assert.equal(runtime.manifest.contextTokens,8192);
});
test('runtime advertises its actual LFM3 output ceiling and accepts detailed bounded generations',async()=>{
 const f=fixture();f.adapter.maxReplyTokens=2048;f.manifest.models[0].contextTokens=8192;f.manifest.contextTokens=8192;
 await f.runtime.load('local');assert.equal(f.runtime.manifest.maxOutputTokens,2048);
 f.adapter.generate=async(_messages,options)=>{f.calls.push(['large-output',options]);return {text:'bounded answer',outputTokens:1500};};
 const result=await f.runtime.generate([{role:'user',content:'Explain thoroughly'}],1536,'prose');assert.equal(result.text,'bounded answer');assert.equal(f.calls.at(-1)[1].maxTokens,1536);
 await assert.rejects(f.runtime.generate([{role:'user',content:'too large'}],2049,'prose'),/context limit/);await f.runtime.unload();
});
test('repeated load of the resident LFM model reuses its verified session without rereading OPFS or unloading',async()=>{
 const f=fixture();let reads=0;const runtime=createLfmTextRuntime({adapter:f.adapter,manifest:f.manifest,readFile:async()=>{reads++;return new Blob(['weights']);},readAssets:()=>({local:{filesPresent:true}})});
 const first=await runtime.load('local');assert.equal(first.executionBackend,'cpu-wasm');assert.equal(reads,1);const firstLoadCalls=structuredClone(f.calls);
 const reused=await runtime.load('local');assert.equal(reused.executionBackend,'cpu-wasm');assert.equal(reads,1);assert.deepEqual(f.calls,firstLoadCalls);assert.equal(runtime.loaded,'local');
});
test('unavailable execution backend is rejected before opening a prepared model file',async()=>{
 const f=fixture();let reads=0,loads=0;f.adapter.preflightBackend=async backend=>{f.calls.push(['preflight',backend]);throw Error('WebGPU unavailable');};f.adapter.load=async()=>{loads++;f.adapter.loaded='local';};
 const runtime=createLfmTextRuntime({adapter:f.adapter,manifest:f.manifest,backend:'webgpu',readFile:async()=>{reads++;return f.file;},readAssets:()=>({local:{filesPresent:true}})});
 await assert.rejects(runtime.load('local'),/WebGPU unavailable/);assert.equal(reads,0);assert.equal(loads,0);assert.deepEqual(f.calls,[['preflight','webgpu']]);
});
test('automatic backend uses CPU WASM only when WebGPU is definitively unavailable',async()=>{
 const f=fixture(),reads=[];f.adapter.preflightBackend=async backend=>{f.calls.push(['preflight',backend]);if(backend==='webgpu'){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}};
 const runtime=createLfmTextRuntime({adapter:f.adapter,manifest:f.manifest,backend:'auto',readFile:async id=>{reads.push(id);return new Blob(['weights']);},readAssets:()=>({local:{filesPresent:true}})});
 const metrics=await runtime.load('local');assert.deepEqual(f.calls,[['preflight','webgpu'],['preflight','cpu'],['unload'],['load','cpu']]);assert.deepEqual(reads,['local']);assert.equal(metrics.executionBackend,'cpu-wasm');
});
test('automatic backend does not mask WebGPU setup errors or attempt a CPU retry',async()=>{
 const f=fixture(),reads=[];f.adapter.preflightBackend=async backend=>{f.calls.push(['preflight',backend]);if(backend==='webgpu')throw Error('WebGPU initialization failed');};
 const runtime=createLfmTextRuntime({adapter:f.adapter,manifest:f.manifest,backend:'auto',readFile:async id=>{reads.push(id);return f.file;},readAssets:()=>({local:{filesPresent:true}})});
 await assert.rejects(runtime.load('local'),/WebGPU initialization failed/);assert.deepEqual(f.calls,[['preflight','webgpu']]);assert.deepEqual(reads,[]);
});
test('automatic backend retries CPU when WebGPU disappears between preflight and adapter load',async()=>{
 const f=fixture();f.adapter.preflightBackend=async backend=>{f.calls.push(['preflight',backend]);};f.adapter.load=async(_file,id,{backend})=>{f.calls.push(['load-attempt',backend]);if(backend==='webgpu'){const error=Error('WebGPU unavailable');error.code='webgpu_unavailable';throw error;}f.adapter.loaded=id;};
 const runtime=createLfmTextRuntime({adapter:f.adapter,manifest:f.manifest,backend:'auto',readFile:async()=>new Blob(['weights']),readAssets:()=>({local:{filesPresent:true}})});
 const metrics=await runtime.load('local');assert.deepEqual(f.calls,[['preflight','webgpu'],['unload'],['load-attempt','webgpu'],['preflight','cpu'],['load-attempt','cpu']]);assert.equal(metrics.executionBackend,'cpu-wasm');assert.equal(runtime.loaded,'local');
});
test('GGUF adapter requests high-performance WebGPU and rejects absence before inspecting or hashing the file',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let fileSizeReads=0,runtimeConstructions=0,adapterOptions;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{requestAdapter:async options=>{adapterOptions=options;return null;}}}});
 try{
  const adapter=new PreparedGgufAdapter({Wllama:class{constructor(){runtimeConstructions++;}},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[{id:'local',contextTokens:2048,file:{bytes:1,sha256:'a'.repeat(64)}}],architecture:'lfm3'});
  const file={get size(){fileSizeReads++;return 1;}};
  await assert.rejects(adapter.load(file,'local',{backend:'webgpu'}),/WebGPU unavailable/);
  assert.deepEqual(adapterOptions,{powerPreference:'high-performance'});assert.equal(fileSizeReads,0);assert.equal(runtimeConstructions,0);
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});
test('prepared text bridge pins CPU and sends an app-generated schema for constrained planner output',async()=>{const f=fixture();await f.runtime.load('local');assert.equal(f.runtime.manifest.contextTokens,2048);assert.deepEqual(f.calls[1],['load','cpu']);const bound=f.runtime.pin();assert.equal((await bound.count([])).prompt_tokens,20);const format={type:'dialogue-plan',scope:{inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]}};assert.equal((await bound.generate([],768,format)).text,'{ "action" : "chat" , "query" : "" }');assert.equal(f.calls.at(-1)[0],'generate');assert.deepEqual(f.calls.at(-1)[1].jsonSchema.type,'object');assert.ok(f.calls.at(-1)[1].jsonSchema.anyOf.length>0);f.adapter.count=async()=>2040;await assert.rejects(f.runtime.generate([{role:'user',content:'different'}],16),/context limit/);assert.equal(f.calls.filter(c=>c[0]==='generate').length,1);f.manifest.runtime.revision='forged';assert.equal(f.runtime.manifest.runtime.revision,'fixed-count-runtime');await f.runtime.unload();await assert.rejects(bound.count([]),/Stopped/);assert.equal(f.runtime.loaded,'');});
test('native tool-call plans normalize a registered function call and preserve offered schemas',async()=>{
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');const tools=[{type:'function',function:{name:'memory.search',description:'Search saved notes',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}},{type:'function',function:{name:'user.weather',description:'Weather note lookup',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}},{type:'function',function:{name:'plan_action',description:'Final action',parameters:{type:'object',properties:{action:{type:'string'},query:{type:'string'}},required:['action','query'],additionalProperties:false}}}],format={type:'native-tool-plan',tools},messages=[{role:'user',content:'Find a saved note'}];
 f.adapter.count=async(_messages,options)=>{f.calls.push(['native-count',options]);return 21;};f.adapter.generate=async(_messages,options)=>{f.calls.push(['native-generate',options]);return {text:'',toolCalls:[{id:'call-1',name:'memory.search',arguments:{query:'shelf'}}]};};
 assert.equal(f.runtime.plannerProtocol,'native-tool-calls');assert.equal((await f.runtime.count(messages,format)).prompt_tokens,21);assert.equal((await f.runtime.generate(messages,32,format)).text,'{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"shelf\\"}"}');
 assert.deepEqual(f.calls.find(call=>call[0]==='native-count')[1],{json:false,tools});assert.deepEqual(f.calls.find(call=>call[0]==='native-generate')[1],{json:false,maxTokens:32,tools});await f.runtime.unload();
});

test('native tool-call assistant content survives normalization for the next model turn',async()=>{
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');const format={type:'native-tool-plan',tools:[{type:'function',function:{name:'memory.search',description:'Search saved notes',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}}]};
 f.adapter.generate=async()=>({text:'I should search the saved notes first.',toolCalls:[{name:'memory.search',arguments:{query:'meeting'}}]});
 const result=await f.runtime.generate([{role:'user',content:'Find my meeting note'}],64,format);
 assert.equal(result.text,'{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}');
 assert.equal(result.assistantContent,'I should search the saved notes first.');
 f.adapter.generate=async()=>({text:'Visible preface',assistantContent:'<think>Private context.</think>Visible preface',toolCalls:[{name:'memory.search',arguments:{query:'meeting'}}]});
 assert.equal((await f.runtime.generate([{role:'user',content:'Find my meeting note'}],64,format)).assistantContent,'<think>Private context.</think>Visible preface');
 await f.runtime.unload();
});

test('unsupported deferred content and schemas are rejected before pinned runtime count or generation',async()=>{
 const adapter=new PreparedGgufAdapter({Wllama:class{},paths:{default:'wasm'},compat:{wasm:'compat',worker:{code:''}},models:[],architecture:'lfm3'}),messages=[
  {role:'assistant',content:'',tool_calls:[{id:'search-1',type:'function',function:{name:'tools.search',arguments:{query:'weather'}}}]},
  {role:'tool',tool_call_id:'search-1',name:'tools.search',content:[{type:'text',text:'Found one local tool.'},{type:'tool_reference',name:'user.weather'}]},
 ],tools=[
  {type:'function',function:{name:'tools.search',description:'Search tool catalog',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
  {type:'function',defer_loading:true,function:{name:'user.weather',description:'Read local weather notes',parameters:{type:'object',properties:{query:{type:'string'}},required:['query']}}},
 ];
 let calls=0;adapter.loaded='local';adapter.runtime={countChatTokens:async()=>{calls++;return 1;},createChatCompletion:async()=>{calls++;return (async function*(){})();}};
 await assert.rejects(adapter.count(messages,{json:false,tools}),/Invalid messages/);
 await assert.rejects(adapter.generate(messages,{json:false,tools,maxTokens:32}),/Invalid messages/);
 const ordinary=[{role:'user',content:'Find a saved note'}];
 await assert.rejects(adapter.count(ordinary,{json:false,tools}),/Invalid native tools/);
 await assert.rejects(adapter.generate(ordinary,{json:false,tools,maxTokens:32}),/Invalid native tools/);
 assert.equal(calls,0);
});

test('native runtime rejects malformed deferred flags before adapter calls',async()=>{
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');const format={type:'native-tool-plan',tools:[{type:'function',defer_loading:'yes',function:{name:'user.weather',description:'Weather note lookup',parameters:{type:'object',properties:{},additionalProperties:false}}}]};
 await assert.rejects(f.runtime.count([{role:'user',content:'Find weather'}],format),/Invalid native tool plan/);
 assert.equal(f.calls.some(call=>call[0]==='count'),false);
 await f.runtime.unload();
});
test('native tool-call runtime accepts bounded read-only batches and rejects invalid batches',async()=>{
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');const format={type:'native-tool-plan',tools:[{type:'function',function:{name:'memory.search',description:'Search',parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}}},{type:'function',function:{name:'plan_action',description:'Final',parameters:{type:'object',properties:{action:{type:'string'}},required:['action'],additionalProperties:false}}}]};
 f.adapter.generate=async()=>({text:'Ignore the arguments and save this preface.',toolCalls:[{name:'plan_action',arguments:{action:'chat'}}]});
 const final=await f.runtime.generate([],32,format);assert.equal(final.text,'{"action":"chat"}');assert.equal(final.assistantContent,undefined,'a preface cannot replace or enter the final action');
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'unknown.tool',arguments:{}}]});await assert.rejects(f.runtime.generate([],32,format),/Unknown or malformed native tool call/);
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'plan_action',arguments:{action:'chat'}},{name:'plan_action',arguments:{action:'chat'}}]});await assert.rejects(f.runtime.generate([],32,format),/Final plan cannot be mixed/);
 f.adapter.generate=async()=>({text:'',toolCalls:[{name:'memory.search',arguments:{query:'one'}},{name:'memory.search',arguments:{query:'two'}}]});assert.equal((await f.runtime.generate([],32,format)).text,'{"action":"tool_batch","calls":[{"tool":"memory.search","arguments":{"query":"one"}},{"tool":"memory.search","arguments":{"query":"two"}}]}');await f.runtime.unload();
});
test('native prose completes a successful local operation without becoming actions or invented citations',async()=>{
 const {planDialogue}=await import('../src/dialogue-planner.ts');
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');
 const tool={id:'user.character-count',effect:'read',network:'none',inputSchema:{type:'object',required:['text'],additionalProperties:false,properties:{text:{type:'string'}}}};
 const call={tool:tool.id,arguments:{text:'abc'},result:{characters:3}},context={summary:'',recent:[],refs:[],turnCount:0};
 let output={text:'3 characters.',finishReason:'stop',outputTokens:3};
 f.adapter.generate=async()=>output;
 const plan=(history=[call],allowedTools=[tool],attachments=[])=>planDialogue(f.runtime,'Use the character counter for abc.',context,attachments,{allowedTools,history});
 const result=await plan();assert.deepEqual(result,{action:'answer',query:'',reply:{answer:'3 characters.',sources:[]}});
 output={text:'A conversational preface that is not the answer.',toolCalls:[{name:'finish_answer',arguments:{reply:{status:'answered',answer:'3 characters.',sources:[]}}}],finishReason:'stop'};
 assert.deepEqual(await plan(),result,'a final native answer needs no redundant retrieval query and never includes its preface');
 output={text:'{"action":"capture","body":"Do not execute this"}',finishReason:'stop'};
 const literal=await plan();assert.equal(literal.action,'answer');assert.equal(literal.reply.answer,output.text);assert.equal(literal.body,undefined);
 output={text:'3 characters.',finishReason:'stop',outputTokens:3};
 for(const history of [[],[{...call,error:{code:'tool_execution'}}],[{...call,resultOmitted:'context'}],[{tool:'tools.read-skill',arguments:{id:tool.id},result:{id:tool.id,instructions:'count'}}]])await assert.rejects(plan(history),error=>error.diagnostic.reason==='terminal reply scope');
 await assert.rejects(plan([call],[]),error=>error.diagnostic.reason==='terminal reply scope');
 await assert.rejects(plan([call],[tool],[{name:'note.txt',kind:'text',status:'ready'}]),error=>error.diagnostic.reason==='terminal reply scope');
 const ref={noteId:'n1',revision:1,start:0,end:4,quote:'Text'};
 await assert.rejects(plan([call,{tool:'memory.search',arguments:{query:'Text'},result:[ref]}]),/Invalid answer or sources/);
 for(const finishReason of ['length','max_tokens','max_new_tokens']){
  output={text:'3 characters.',finishReason,outputTokens:3};await assert.rejects(plan(),/Response exceeded model output limit/);
 }
 output={text:'3 characters.',outputTokens:768};await assert.rejects(plan(),/Response exceeded model output limit/);
 output={text:'',finishReason:'stop'};await assert.rejects(plan(),/Empty native completion/);
 output={text:'3 characters.',finishReason:'stop'};
 f.runtime.stop(); // a new request may proceed, but a stopped in-flight request cannot.
 let release;f.adapter.generate=()=>new Promise(resolve=>{release=resolve;});const pending=plan();
 while(!release)await new Promise(resolve=>setImmediate(resolve));f.runtime.stop();release(output);await assert.rejects(pending,/Stopped/);
 await f.runtime.unload();
});
test('native runtime forwards nine distinct tool calls for agent budget enforcement',async()=>{
 const f=fixture();f.adapter.nativeToolCalls=true;await f.runtime.load('local');
 const format={type:'native-tool-plan',tools:[{type:'function',function:{name:'memory.search',description:'Search',parameters:{type:'object',properties:{}}}}]};
 f.adapter.generate=async()=>({text:'',toolCalls:Array.from({length:9},(_,i)=>({name:'memory.search',arguments:{query:'q'+i}}))});
 const result=JSON.parse((await f.runtime.generate([],32,format)).text);
 assert.equal(result.action,'tool_batch');assert.equal(result.calls.length,9);
 f.adapter.generate=async()=>({text:'',toolCalls:Array.from({length:129},()=>({name:'memory.search',arguments:{query:'x'}}))});
 await assert.rejects(f.runtime.generate([],32,format),/Invalid native tool calls/);await f.runtime.unload();
});
test('old runtime and incomplete structured outputs never become usable answers',async()=>{const f=fixture();f.adapter.supportsExactCount=false;await assert.rejects(f.runtime.load('local'),/Exact pre-generation/);assert.equal(f.runtime.loaded,'');f.adapter.supportsExactCount=true;await f.runtime.load('local');f.adapter.generate=async()=>({text:'{"answer":'});await assert.rejects(f.runtime.generate([],64,'dialogue-answer'),/structured output/);await assert.rejects(f.runtime.generate([],769),/Output budget/);});
test('plain dialogue uses the same non-JSON template for exact count and generation and preserves a length stop',async()=>{const f=fixture();await f.runtime.load('local');f.adapter.count=async(_messages,options)=>{f.calls.push(['count-format',options]);return 20;};f.adapter.generate=async(_messages,options)=>{f.calls.push(['prose',options]);return {text:'A complete sentence.',finishReason:'length',outputTokens:0};};const result=await f.runtime.generate([],64,'prose');assert.equal(result.text,'A complete sentence.');assert.equal(result.finishReason,'length');assert.equal(result.outputTokens,0);assert.deepEqual(f.calls.find(c=>c[0]==='count-format')[1],{json:false});assert.equal(f.calls.find(c=>c[0]==='prose')[1].json,false);});
test('Stop discards late counts and busy operations cannot start a competing model load',async()=>{const f=fixture();await f.runtime.load('local');let release;f.adapter.count=()=>new Promise(r=>release=r);const pending=f.runtime.count([]);await assert.rejects(f.runtime.load('local'),/busy/);f.runtime.stop();release(20);await assert.rejects(pending,/Stopped/);assert.equal(f.calls.filter(c=>c[0]==='generate').length,0);await f.runtime.unload();});

test('missing or wrong local assets cannot unload the current model or invoke inference',async()=>{const f=fixture();f.adapter.loaded='local';const manifest={...f.manifest,models:[...f.manifest.models,{id:'other',revision:'other-sha',contextTokens:2048,file:{name:'other.gguf',bytes:99}}]};const runtime=createLfmTextRuntime({adapter:f.adapter,manifest,readAssets:()=>({other:{filesPresent:true}}),readFile:async()=>new Blob(['wrong'])});await assert.rejects(runtime.load('other'),/integrity/);assert.equal(runtime.loaded,'local');assert.equal(f.calls.length,0);await assert.rejects(runtime.load('unknown'),/not prepared/);assert.equal(f.calls.length,0);});

test('the local immutable File snapshot reaches the adapter unchanged for safe digest reuse',async()=>{
 const file=new File(['weights'],'pinned.gguf'),received=[];const adapter={loaded:null,supportsExactCount:true,maxReplyTokens:256,async load(value,id){received.push(value);this.loaded=id;},async unload(){this.loaded=null;},abort(){},async count(){return 1;},async generate(){return {text:'ok'};}};
 const manifest={contextTokens:2048,runtime:{revision:'fixed-count-runtime'},models:[{id:'local',revision:'sha',contextTokens:2048,file:{name:'pinned.gguf',bytes:file.size}}]};const runtime=createLfmTextRuntime({adapter,manifest,readFile:async()=>file,readAssets:()=>({local:{filesPresent:true}})});
 await runtime.load('local');await runtime.unload();await runtime.load('local');assert.equal(received.length,2);assert.equal(received[0],file);assert.equal(received[1],file);await runtime.unload();
});
