import test from 'node:test';
import assert from 'node:assert/strict';
import {TextEngineRouter} from '../src/text-engine-router.ts';
import {customLfm3TextModels,describeLfm3Text,lfm3TextModels} from '../src/lfm3-text-manifest.ts';
import {onnxTextManifest,onnxTextModels} from '../src/text-model-manifest.ts';
import {createOnnxTextClient} from '../src/onnx-text-client.ts';
import {Engine} from '../../../dist/engine.js';
import {nativeOutputRequest} from '../src/native-output-format.ts';
import {nativeResponseTools,nativeResponseText} from '../../../dist/native-response.js';
import {planDialogueMessages} from '../src/conversation.ts';
import {scopedHarnessActions} from '../src/harness-actions.ts';
function setup(nativeStructuredOutput=false){const calls=[];let finish;
 const backend=name=>({manifest:{contextTokens:4096,runtime:{revision:'webml-test'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){calls.push(name+':terminate');}},async init(){return{};},async call(cmd){calls.push(name+':'+cmd);return cmd==='status'?{[name]:{filesPresent:true}}:{};},async load(id){calls.push(name+':load');if(name==='onnx')await new Promise(r=>finish=r);this.loaded=id;},async unload(){calls.push(name+':unload');this.loaded=null;},abort(){calls.push(name+':abort');this.loaded=null;}});
 const webml=backend('webml');let onnx;
 const router=new TextEngineRouter(webml,()=>onnx=backend('onnx'),[],undefined,nativeStructuredOutput);
 return {router,calls,webml,get onnx(){return onnx;},finish:()=>finish()};
}
test('a failed resident cannot be unloaded or switched until cleanup is confirmed',async()=>{
 for(const switching of [false,true]){
  const f=setup();await f.router.load('4B');f.webml.loaded=null;f.webml.failed=true;
  f.webml.abort=()=>Promise.reject(Error('cleanup failed'));
  await assert.rejects(switching?f.router.load(onnxTextModels[0].id):f.router.unload(),error=>error.cleanupUnconfirmed===true);
  await assert.rejects(f.router.load('4B'),error=>error.cleanupUnconfirmed===true);
  if(switching)assert.equal(f.calls.includes('onnx:load'),false);
 }
});
test('reloading a failed registered engine does not discard its cleanup barrier',async()=>{
 const f=setup(),manifest={contextTokens:2048,runtime:{revision:'r'},models:[{id:'local',revision:'m'}]},instances=[];
 const router=new TextEngineRouter(f.webml,()=>{throw Error('unused');},[{id:'local-engine',modelIds:['local'],describe:()=>manifest,create:()=>{const backend={manifest,loaded:null,failed:false,worker:{terminate(){}},async init(){},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){return Promise.reject(Error('cleanup failed'));}};instances.push(backend);return backend;}}]);
 await router.load('local');instances[0].loaded=null;instances[0].failed=true;
 await assert.rejects(router.load('local'),error=>error.cleanupUnconfirmed===true);assert.equal(instances.length,1);
});
test('status checks cannot discard a failed resident before its cleanup',async()=>{
 const f=setup(),manifest={contextTokens:2048,runtime:{revision:'r'},models:[{id:'local',revision:'m'}]},instances=[];
 const router=new TextEngineRouter(f.webml,()=>{throw Error('unused');},[{id:'local-engine',modelIds:['local'],describe:()=>manifest,create:()=>{const backend={manifest,loaded:null,failed:false,worker:{terminate(){}},async init(){},async call(){throw Error('worker failed');},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){return Promise.reject(Error('cleanup failed'));}};instances.push(backend);return backend;}}]);
 await router.load('local');instances[0].loaded=null;instances[0].failed=true;
 await router.call('status',{model:'local'});await assert.rejects(router.load('local'),error=>error.cleanupUnconfirmed===true);assert.equal(instances.length,1);
});

test('planner protocol and selected output ceiling follow the active model registration',async()=>{
 const f=setup(),describe=()=>({contextTokens:8192,maxOutputTokens:2048,runtime:{revision:'lfm3-fixed'},models:[{id:'lfm3-test',revision:'sha256:fixture'}]}),lfm3={manifest:describe(),loaded:null,worker:{terminate(){}},async init(){return{};},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){this.loaded=null;}};
 const router=new TextEngineRouter(f.webml,()=>{throw Error('Unused');},[{id:'lfm3-text',modelIds:['lfm3-test'],plannerProtocol:'native-tool-calls',describe,create:()=>lfm3}]);
 assert.equal(router.plannerProtocol,'json');assert.equal(router.protocolForModel('lfm3-test'),'native-tool-calls');assert.equal(router.protocolForModel('4B'),'json');await router.load('lfm3-test');assert.equal(router.plannerProtocol,'native-tool-calls');assert.equal(router.manifest.maxOutputTokens,2048);await router.unload();await router.load('4B');assert.equal(router.plannerProtocol,'json');await router.unload();
});

test('registry sync unload policy preserves a warm backend when only another registration changes',async()=>{
 const f=setup(),backend=(id,revision)=>({manifest:{contextTokens:8192,runtime:{revision},models:[{id,revision:'sha256:fixture'}]},loaded:null,worker:{terminate(){}},async init(){return{};},async call(){return{};},async load(model){this.loaded=model;},async unload(){this.loaded=null;},abort(){this.loaded=null;}}),lfm3=backend('lfm3-test','lfm3-fixed'),qwen=backend('qwen-test','qwen-fixed');
 const describe=(id,revision)=>()=>({contextTokens:8192,runtime:{revision},models:[{id,revision:'sha256:fixture'}]}),lfm3Registration={id:'lfm3-text',modelIds:['lfm3-test'],plannerProtocol:'native-tool-calls',describe:describe('lfm3-test','lfm3-fixed'),create:()=>lfm3},qwenRegistration={id:'qwen3-text',modelIds:['qwen-test'],describe:describe('qwen-test','qwen-fixed'),create:()=>qwen};
 const router=new TextEngineRouter(f.webml,()=>{throw Error('Unused');},[lfm3Registration,qwenRegistration]);await router.load('lfm3-test');
 assert.equal(router.mustUnloadForRegistryUpdate(false,['qwen3-text']),false);
 router.replaceRegistration('qwen3-text',{...qwenRegistration,describe:describe('qwen-test','qwen-next')});
 assert.equal(router.loaded,'lfm3-test');
 assert.equal(router.mustUnloadForRegistryUpdate(true,[]),false);
 assert.equal(router.mustUnloadForRegistryUpdate(false,['lfm3-text']),true);
 await router.unload();await router.load('4B');
 assert.equal(router.mustUnloadForRegistryUpdate(false,['lfm3-text']),false);
 assert.equal(router.mustUnloadForRegistryUpdate(true,[]),true);
});

test('a custom-only installed engine stays idle with zero models and accepts/removes a validated registry later',async()=>{
 const f=setup(),calls=[];let ids=[];const describe=()=>({contextTokens:2048,runtime:{revision:'cpu-fixed'},models:ids.map(id=>({id,revision:'sha256:fixture'}))});
 const registration=()=>({id:'qwen3-text',modelIds:[...ids],describe,create:()=>{calls.push('create');return {manifest:describe(),loaded:null,worker:{terminate(){calls.push('terminate');}},abort(){calls.push('abort');},async init(){return{};},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;}};}});
 const router=new TextEngineRouter(f.webml,()=>{throw Error('Unrelated optional worker');},[registration()]);await router.init();await router.call('status');assert.deepEqual(calls,[]);assert.equal(router.manifest.models.some(m=>m.id==='local-qwen3'),false);
 ids=['local-qwen3'];router.replaceRegistration('qwen3-text',registration());assert.equal(router.manifest.models.find(m=>m.id==='local-qwen3').revision,'sha256:fixture');await router.load('local-qwen3');assert.equal(router.loaded,'local-qwen3');assert.deepEqual(calls,['create']);await router.unload();ids=[];router.replaceRegistration('qwen3-text',registration());assert.equal(router.manifest.models.some(m=>m.id==='local-qwen3'),false);assert.deepEqual(calls,['create','abort','terminate']);
 assert.throws(()=>new TextEngineRouter(f.webml,()=>null,[{...registration(),describe:()=>({...describe(),models:[{id:'hidden',revision:'x'}]})}]),/Invalid text engine manifest/);
});
test('WebML count and generate share the exact native tool/schema/prompt while prose stays plain',async()=>{
 const f=setup(true),seen=[];f.webml.call=async(cmd,args)=>{seen.push({cmd,args});return{};};await f.router.load('4B');
 const messages=[{role:'system',content:'Return the required JSON.'},{role:'user',content:'A question'}],before=structuredClone(messages);
 await f.router.call('count',{messages,format:'dialogue-answer'});await f.router.generate(messages,undefined,32,'dialogue-answer');
 assert.deepEqual(seen[0].args.responseTool,seen[1].args.responseTool);assert.equal(seen[0].args.responseTool.name,'babelshelf_answer');assert.deepEqual(seen[0].args.messages,seen[1].args.messages);assert.notDeepEqual(seen[0].args.messages,messages);assert.deepEqual(messages,before);
 await f.router.generate(messages,undefined,32,'prose');assert.equal(seen[2].args.responseTool,undefined);assert.deepEqual(seen[2].args.messages,messages);
});

test('WebML transports source-bound calculation proposals as a separate constrained function schema',async()=>{
 const f=setup(true);let captured;f.webml.call=async(command,args)=>{if(command==='generate')captured=args;return command==='generate'?{text:'{"operation":"divide","sourceOperandIndex":0,"sourceIndex":0,"sourceQuote":"七リットル","sourceUnit":"リットル","requestQuote":"3"}'}:{prompt_tokens:12};};await f.router.load('4B');
 const format={type:'sourced-calculation',sourceCount:1},messages=[{role:'system',content:'Candidate instructions'},{role:'user',content:'Calculate from cited value'}];await f.router.call('count',{messages,format});await f.router.generate(messages,undefined,256,format);
 assert.equal(captured.responseTool.name,'babelshelf_calculation');assert.deepEqual(captured.responseTool.parameters.required,['operation','sourceOperandIndex','sourceIndex','sourceQuote','sourceUnit','requestQuote']);assert.deepEqual(captured.responseTool.parameters.properties.sourceIndex,{type:'integer',minimum:0,maximum:0});
});

test('compact native planner schema omits unavailable scopes without becoming execution authority',()=>{
 const r=nativeOutputRequest([],{type:'dialogue-plan',scope:{inputs:true,file:false,current:false,historyCount:0,assistantIndices:[]}}),p=r.responseTool.parameters;
 assert.equal(r.responseTool.name,'babelshelf_plan');assert.ok(!p.properties.action.enum.includes('calculate'));assert.ok(!p.properties.action.enum.includes('tool'));assert.equal(p.properties.historyIndex,undefined);assert.ok(!p.properties.target.enum.includes('history'));assert.ok(!p.properties.target.enum.includes('file'));assert.equal(p.additionalProperties,false);
 assert.deepEqual(r.responseTool.actions.read.properties.target.enum,['path']);
 assert.deepEqual(r.responseTool.actions.search.properties.target.enum,['knowledge']);
 assert.equal(r.responseTool.actions.read.properties.action,undefined);
 assert.equal(r.responseTool.actions.recall,undefined);
});

test('native capture separates a new body from current/history originals and cannot mix their selectors',()=>{
 const format={type:'dialogue-plan',scope:{inputs:false,file:false,current:true,historyCount:2,assistantIndices:[0,1]}},s=nativeOutputRequest([],format).responseTool;
 assert.equal(s.actions.capture,undefined);
 assert.deepEqual(Object.keys(s.actions.capturetext.properties),['body']);
 assert.deepEqual(Object.keys(s.actions.capturecurrent.properties),[]);
 assert.deepEqual(Object.keys(s.actions.captureassistant.properties),['historyIndex']);
 assert.deepEqual(s.actions.captureassistant.properties.historyIndex.enum,[0,1]);
 assert.ok(nativeResponseTools(s).some(tool=>tool.function.name==='captureassistant'));
 const result=(name,args)=>{const call={type:'function',function:{name,arguments:args}};return nativeResponseText({finish_reason:'tool_calls',message:{role:'assistant',content:'',tool_calls:[call]}},s,[call]);};
 assert.deepEqual(JSON.parse(result('captureassistant',{historyIndex:0})),{action:'capture',query:'',target:'history',historyPart:'assistant',historyIndex:0});
 assert.deepEqual(JSON.parse(result('capturecurrent',{})),{action:'capture',query:'',target:'current'});
 assert.deepEqual(JSON.parse(result('captureuser',{historyIndex:1})),{action:'capture',query:'',target:'history',historyPart:'user',historyIndex:1});
 assert.deepEqual(JSON.parse(result('capturetext',{body:'新しい本文。'})),{action:'capture',query:'',body:'新しい本文。'});
 assert.throws(()=>result('captureassistant',{historyIndex:2}),e=>e.diagnostic?.reason==='native:value');
 for(const [name,args]of [['captureassistant',{historyIndex:0,body:'regenerated'}],['captureassistant',{historyIndex:0,historyPart:'user'}],['capturecurrent',{historyIndex:0}],['capturetext',{body:'new',target:'history'}]])assert.throws(()=>result(name,args),e=>e.diagnostic?.reason==='native:fields');
 const restricted=nativeOutputRequest([],{type:'dialogue-plan',scope:{inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]}}).responseTool;
 for(const name of ['capturecurrent','captureassistant','captureuser','captureinputs'])assert.equal(restricted.actions[name],undefined);
 const forged=structuredClone(restricted);forged.actions.capturecurrent={type:'object',properties:{},required:[],additionalProperties:false};
 assert.throws(()=>nativeResponseTools(forged),/Invalid native response format/,'a supplied alias cannot introduce a target absent from the global scoped schema');
});

test('native planner omits duplicate catalog syntax but retains purposes and every following scope rule',()=>{
 const scope={inputs:false,file:false,current:false,historyCount:2,assistantIndices:[0,1]},format={type:'dialogue-plan',scope};
 const messages=planDialogueMessages('Save your FIRST answer as a new note.',{summary:'',refs:[],recent:[{id:'a',user:'one',answer:'A'},{id:'b',user:'two',answer:'B'}],turnCount:2,historyAssistantIndices:[0,1]}),before=structuredClone(messages);
 const r=nativeOutputRequest(messages,format),system=r.messages[0].content;
 assert.ok(!system.includes('"purpose":'));
 for(const action of scopedHarnessActions(scope))assert.ok(system.includes(action.purpose),action.id);
 const tail=messages[0].content.slice(messages[0].content.indexOf('. To answer or summarize')+1);
 assert.ok(system.includes(tail));
 assert.ok(system.length<messages[0].content.length);
 assert.deepEqual(messages,before);assert.deepEqual(r.messages.slice(1),messages.slice(1));
 const custom=[{role:'system',content:'Custom policy '+messages[0].content},{role:'user',content:messages[0].content}];
 assert.ok(nativeOutputRequest(custom,format).messages[0].content.startsWith(custom[0].content));
 assert.deepEqual(nativeOutputRequest(custom,format).messages[1],custom[1]);
 assert.deepEqual(nativeOutputRequest(messages,'prose').messages,messages);
});

test('native purposes advertise exactly the functions offered, including source-specific capture names',()=>{
 const scope={inputs:false,file:false,current:true,historyCount:2,assistantIndices:[0,1]},format={type:'dialogue-plan',scope};
 const context={summary:'',refs:[],recent:[{id:'a',user:'one',answer:'A'},{id:'b',user:'two',answer:'B'}],turnCount:2,historyAssistantIndices:[0,1],currentResult:{turnId:'b'}};
 const request=nativeOutputRequest(planDialogueMessages('Save your FIRST answer as a new note.',context),format);
 const advertised=[...request.messages[0].content.matchAll(/^([a-z]+): /gm)].map(match=>match[1]);
 assert.deepEqual(advertised,Object.keys(request.responseTool.actions).map(name=>name==='tool-create'?'toolcreate':name));
 assert.ok(!advertised.includes('capture'));
 assert.match(request.messages[0].content,/captureassistant: .*ONE.*assistant.*historyIndex/);
 assert.match(request.messages[0].content,/capturetext: .*new.*never.*dialogue/i);
 assert.match(request.messages[0].content,/toolcreate: .*reviewable draft form/i);
 const empty={inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]};
 const r=nativeOutputRequest(planDialogueMessages('hello',{summary:'',refs:[],recent:[],turnCount:0}),{type:'dialogue-plan',scope:empty});
 assert.ok(!r.messages[0].content.includes('captureassistant'));
 assert.ok(r.messages[0].content.includes('toolcreate:'));
});

test('base Engine transports bounded native failure evidence as PlannerOutputError, never as an answer',async()=>{
 const worker={postMessage(m){this.sent=m;},terminate(){}},manifest={contextTokens:2048,runtime:{revision:'r'},models:[{id:'4B',revision:'v'}]},base=new Engine(manifest,()=>{},worker);
 const router=new TextEngineRouter(base,()=>{throw Error('unused');},[],undefined,true),loading=router.load('4B');worker.onmessage({data:{id:worker.sent.id,type:'done',value:true}});await loading;
 const pending=router.generate([],undefined,32,'dialogue-answer');worker.onmessage({data:{id:worker.sent.id,type:'error',value:'Invalid model tool response',diagnostic:{raw:'x'.repeat(9000),reason:'native:shape',truncated:false}}});
 await assert.rejects(pending,error=>error.name==='PlannerOutputError'&&error.diagnostic.raw.length===8192&&error.diagnostic.truncated&&error.diagnostic.reason==='native:shape');
});

test('explicit base worker recovery initializes a fresh owner without replaying inference or acquisition',async()=>{
 const calls=[],manifest={contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]};
 const backend=(name,failed)=>({manifest,failed,loaded:null,worker:{terminate(){calls.push(name+':terminate');}},abort(){calls.push(name+':abort');},async init(){calls.push(name+':init');return{};},async call(cmd){calls.push(name+':'+cmd);return{};},async load(id){calls.push(name+':load');this.loaded=id;},async unload(){this.loaded=null;}});
 const old=backend('old',true),fresh=backend('fresh',false),router=new TextEngineRouter(old,()=>{throw Error('Optional engine must stay idle');},[],()=>fresh);
 assert.equal(await router.recover(),true);assert.deepEqual(calls,['old:abort','old:terminate','fresh:init']);assert.equal(router.loaded,null);
 assert.equal(await router.recover(),false);assert.deepEqual(calls,['old:abort','old:terminate','fresh:init']);
 await router.call('configure',{models:[],statusModel:'4B'});await router.load('4B');assert.equal(router.loaded,'4B');assert.deepEqual(calls.slice(3),['fresh:configure','fresh:load']);
});

test('actual Engine crash status recovers through the router and requires explicit registry and Load',async()=>{
 const transports=[],states=[],manifest={contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]};
 const create=()=>{const w={sent:[],postMessage(m){this.sent.push(m);},terminate(){this.terminated=true;},emit(m){this.onmessage({data:m});}};transports.push(w);return new Engine(manifest,s=>states.push(s),w);};
 const old=create(),router=new TextEngineRouter(old,()=>{throw Error('Optional engine must stay idle');},[],create);
 old.worker.onerror({message:'controlled worker failure'});assert.equal(old.failed,true);assert.equal(states.at(-1),'Model worker stopped');assert.equal(transports.length,1,'failure itself does not restart or replay');
 const recovering=router.recover(),fresh=transports[1];assert.equal(old.worker.terminated,true);assert.deepEqual(fresh.sent.map(m=>m.cmd),['init']);fresh.emit({id:fresh.sent[0].id,type:'done',value:{}});assert.equal(await recovering,true);assert.equal(router.loaded,null);
 const configuration=router.call('configure',{models:[],statusModel:'4B'});fresh.emit({id:fresh.sent.at(-1).id,type:'done',value:{}});await configuration;
 const loading=router.load('4B');fresh.emit({id:fresh.sent.at(-1).id,type:'done',value:true});await loading;assert.equal(router.loaded,'4B');assert.deepEqual(fresh.sent.map(m=>m.cmd),['init','configure','load']);
});

test('Stop during replacement initialization rejects recovery and never publishes the replacement',async()=>{
 const calls=[];let finish;const manifest={contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},old={manifest,failed:true,worker:{terminate(){}},abort(){},async init(){},async call(){throw Error('Original worker stopped');},async load(){},async unload(){}},fresh={manifest,failed:false,worker:{terminate(){calls.push('terminate');}},abort(){calls.push('abort');},init(){return new Promise(resolve=>finish=resolve);},async call(){},async load(){calls.push('load');},async unload(){}};
 const router=new TextEngineRouter(old,()=>{throw Error('unused');},[],()=>fresh),pending=router.recover();router.abort();finish({});await assert.rejects(pending,/Stopped/);assert.ok(calls.includes('terminate'));assert.ok(!calls.includes('load'));assert.equal(router.loaded,null);await assert.rejects(router.call('status',{model:'4B'}),/Original worker stopped/);
});
test('cross-engine load releases previous engine and pins active runtime identity',async()=>{
 const f=setup();await f.router.load('4B');assert.equal(f.router.manifest.runtime.revision,'webml-test');
 const pending=f.router.load(onnxTextManifest.id);for(let i=0;i<20&&!f.calls.includes('onnx:load');i++)await Promise.resolve();assert.ok(f.calls.includes('onnx:load'));f.finish();await pending;
 assert.ok(f.calls.indexOf('webml:unload')<f.calls.indexOf('onnx:load'));
 assert.equal(f.router.loaded,onnxTextManifest.id);assert.equal(f.router.manifest.runtime.revision,onnxTextManifest.runtime.revision);
 await f.router.unload();assert.equal(f.router.loaded,null);
});

test('reloading the same healthy pinned model preserves its resident session, while changed identity reloads',async()=>{
 const f=setup();await f.router.load('4B');await f.router.load('4B');
 assert.equal(f.calls.filter(c=>c==='webml:load').length,1);assert.equal(f.calls.filter(c=>c==='webml:unload').length,0);
 f.router.manifest={...f.router.manifest,models:f.router.manifest.models.filter(m=>m.id==='4B'),runtime:{revision:'new-runtime'}};await f.router.load('4B');
 assert.equal(f.calls.filter(c=>c==='webml:load').length,2);assert.equal(f.calls.filter(c=>c==='webml:unload').length,1);
});

test('same revision labels cannot reuse a session after model or runtime asset pins change',async()=>{
 for(const changed of ['model','runtime']){
  const f=setup(),manifest={contextTokens:4096,runtime:{revision:'same-runtime',file:{sha256:'a'.repeat(64),bytes:100}},models:[{id:'4B',revision:'same-model',file:{sha256:'b'.repeat(64),bytes:200}}]};
  f.router.manifest=manifest;await f.router.load('4B');
  const next=structuredClone(manifest);if(changed==='model')next.models[0].file.sha256='c'.repeat(64);else next.runtime.file.sha256='d'.repeat(64);
  f.router.manifest=next;await f.router.load('4B');
  assert.equal(f.calls.filter(c=>c==='webml:load').length,2,changed+' asset requires load');assert.equal(f.calls.filter(c=>c==='webml:unload').length,1);
  await f.router.load('4B');assert.equal(f.calls.filter(c=>c==='webml:load').length,2,'unchanged new identity stays resident');
 }
});
test('Stop during ONNX load discards worker and rejects late completion without replay',async()=>{
 const f=setup(),pending=f.router.load(onnxTextManifest.id);f.router.abort();f.finish();await assert.rejects(pending,/Stopped/);
 assert.equal(f.router.loaded,null);assert.ok(f.calls.includes('onnx:terminate'));assert.equal(f.calls.filter(x=>x==='onnx:load').length,1);
});
test('ONNX client Stop rejects pending work, ignores late result and requires a new client',async()=>{
 const sent=[],worker={postMessage(m){sent.push(m);},terminate(){this.terminated=true;}};
 const client=createOnnxTextClient(worker),pending=client.load(onnxTextManifest.id);client.abort();worker.onmessage({data:{id:sent[0].id,type:'done',value:true}});
 await assert.rejects(pending,/Stopped/);assert.equal(client.loaded,null);assert.equal(worker.terminated,true);await assert.rejects(client.call('status'),/Stopped/);assert.equal(sent.length,1);
});

test('Stop during optional status permits a fresh explicit configure and load',async()=>{
 const workers=[];
 const webml={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){return{};},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const router=new TextEngineRouter(webml,()=>{const worker={postMessage(message){this.message=message;},terminate(){}};workers.push(worker);return createOnnxTextClient(worker);});
 await router.init();assert.equal(workers.length,0);
 const first=router.call('configure',{models:[]});await Promise.resolve();await Promise.resolve();assert.equal(workers.length,1);router.abort();await assert.rejects(first,/Stopped/);
 const next=router.call('configure',{models:[]});await Promise.resolve();await Promise.resolve();assert.equal(workers.length,2);
 workers[1].onmessage({data:{id:workers[1].message.id,type:'done',value:{}}});await next;await router.load('4B');assert.equal(router.loaded,'4B');
});

test('worker failure permits a fresh explicit load; old worker results cannot resurrect identity',async()=>{
 const workers=[];
 const webml={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const router=new TextEngineRouter(webml,()=>{const worker={postMessage(message){this.message=message;},terminate(){}};workers.push(worker);return createOnnxTextClient(worker);});
 const first=router.load(onnxTextManifest.id);workers[0].onmessage({data:{id:1,type:'done',value:true}});await first;workers[0].onerror();assert.equal(router.loaded,null);
 const second=router.load(onnxTextManifest.id);for(let i=0;i<20&&workers.length<2;i++)await Promise.resolve();assert.equal(workers.length,2);workers[0].onmessage({data:{id:1,type:'done',value:true}});assert.equal(router.loaded,null);
 workers[1].onmessage({data:{id:1,type:'done',value:true}});await second;assert.equal(router.loaded,onnxTextManifest.id);workers[1].onerror();await router.load('4B');assert.equal(router.loaded,'4B');
});

import {validateOnnxTextBudget} from '../src/text-model-manifest.ts';
test('adapter accepts harness task and rewrite output budgets and rejects actual context overflow',()=>{
 validateOnnxTextBudget(1000,384);validateOnnxTextBudget(1000,768);
 assert.throws(()=>validateOnnxTextBudget(1500,768),/budget/);assert.throws(()=>validateOnnxTextBudget(0,769),/budget/);
});

test('structured worker failures retain bounded untrusted diagnostics without returning a result',async()=>{
 const sent=[],worker={postMessage(m){sent.push(m);},terminate(){}};const client=createOnnxTextClient(worker),pending=client.call('generate');
 worker.onmessage({data:{id:sent[0].id,type:'error',value:'Invalid model JSON · incomplete structured output',diagnostic:{raw:'{"action":"chat","query":"unfinished',reason:'structured:budget',truncated:false}}});
 await assert.rejects(pending,error=>error.name==='PlannerOutputError'&&error.diagnostic.reason==='structured:budget'&&error.diagnostic.raw.endsWith('unfinished'));
});

test('switching between fixed ONNX models reuses adapter but unloads old identity',async()=>{
 const f=setup(),first=f.router.load(onnxTextManifest.id);f.finish();await first;
 const second=f.router.load('qwen25-05b-instruct');for(let i=0;i<20&&f.calls.filter(x=>x==='onnx:load').length<2;i++)await Promise.resolve();assert.equal(f.calls.filter(x=>x==='onnx:load').length,2);f.finish();await second;
 assert.equal(f.router.loaded,'qwen25-05b-instruct');assert.equal(f.calls.filter(x=>x==='onnx:unload').length,1);assert.equal(f.router.manifest.models.find(m=>m.id===f.router.loaded).revision,'22942cb7d7ba4cc81bb4673549ca4d4614469b5e');
});

test('trusted third engine routes only declared models and keeps separate runtime/context identity',async()=>{
 const calls=[],base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,async init(){},async call(cmd){calls.push('base:'+cmd);return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;calls.push('base:unload');},abort(){},worker:{terminate(){}}};let created=0;
 const models=[{id:'third-a',revision:'a'},{id:'third-b',revision:'b'}],registration={id:'third-engine',modelIds:models.map(m=>m.id),describe:()=>({contextTokens:1024,runtime:{revision:'third-runtime'},models}),create:()=>{created++;return {manifest:{},loaded:null,async init(){},async call(cmd){calls.push('third:'+cmd);return cmd==='count'?{prompt_tokens:17}:{};},async load(id){this.loaded=id;calls.push('third:load');},async unload(){this.loaded=null;calls.push('third:unload');},abort(){calls.push('third:abort');},worker:{terminate(){calls.push('third:terminate');}}};}};
 const router=new TextEngineRouter(base,()=>{throw Error('unused ONNX factory');},[registration]);assert.equal(created,0);await router.load('4B');await router.load('third-a');assert.equal(router.loaded,'third-a');assert.equal(router.manifest.contextTokens,1024);assert.equal(router.manifest.runtime.revision,'third-runtime');assert.deepEqual(await router.call('count',{messages:[]}),{prompt_tokens:17});assert.ok(calls.indexOf('base:unload')<calls.indexOf('third:load'));
 router.abort();assert.equal(router.loaded,null);assert.ok(calls.includes('third:terminate'));await router.load('third-b');assert.equal(created,2);assert.equal(router.loaded,'third-b');await assert.rejects(router.load('undeclared'),/Unknown/);assert.equal(router.loaded,'third-b');
});
test('idle trusted registration can add validated local models and replaces its stale backend instance',async()=>{
 const calls=[],base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,async init(){},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){},worker:{terminate(){}}};let created=0;
 const make=(ids)=>({id:'local-lfm',modelIds:ids,describe:()=>({contextTokens:2048,runtime:{revision:'wllama-fixed'},models:ids.map(id=>({id,revision:'sha:'+id}))}),create:()=>{created++;const instance=created;return {loaded:null,async init(){},async call(){return{};},async load(id){this.loaded=id;calls.push('load:'+instance+':'+id);},async unload(){this.loaded=null;},abort(){calls.push('abort:'+instance);},worker:{terminate(){calls.push('terminate:'+instance);}}};}});
 const router=new TextEngineRouter(base,()=>{throw Error('unused');},[make(['fixed'])]);await router.load('fixed');await router.unload();router.replaceRegistration('local-lfm',make(['fixed','local-custom']));assert.ok(calls.includes('terminate:1'));assert.equal(router.manifest.models.find(m=>m.id==='local-custom').revision,'sha:local-custom');await router.load('local-custom');assert.equal(created,2);assert.equal(router.loaded,'local-custom');assert.ok(calls.includes('load:2:local-custom'));
});
test('uninstantiated inactive registration can be replaced before first status check',()=>{
 const base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,async init(){},async call(){return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){},worker:{terminate(){}}};
 const make=(ids)=>({id:'local-lfm',modelIds:ids,describe:()=>({contextTokens:2048,runtime:{revision:'wllama-fixed'},models:ids.map(id=>({id,revision:'sha:'+id}))}),create(){throw Error('must stay lazy');}});
 const router=new TextEngineRouter(base,()=>{throw Error('unused');},[make(['fixed'])]);
 assert.doesNotThrow(()=>router.replaceRegistration('local-lfm',make(['fixed','local-custom'])));
 assert.equal(router.manifest.models.some(model=>model.id==='local-custom'),true);
});
test('duplicate model/engine identities and missing revision contracts fail before any factory starts',()=>{
 const base={manifest:{models:[{id:'4B',revision:'four'}]}};let starts=0;
 const r={id:'third-engine',modelIds:['new'],describe:()=>({contextTokens:1024,runtime:{revision:'r'},models:[{id:'new',revision:'v'}]}),create(){starts++;}};
 for(const extra of [[{...r,modelIds:['4B']}],[r,r],[{...r,describe:()=>({contextTokens:0,runtime:{revision:'r'},models:[{id:'new',revision:'v'}]})}],[{...r,describe:()=>({contextTokens:1024,runtime:{revision:'r'},models:[{id:'new',revision:''}]})}]])assert.throws(()=>new TextEngineRouter(base,()=>{},extra),/Invalid/);
 assert.equal(starts,0);
});

test('verification routes to the owning engine without loading or preparation',async()=>{const f=setup();await f.router.call('verify',{model:'4B'});await f.router.call('verify',{model:onnxTextManifest.id});assert.deepEqual(f.calls,['webml:verify','onnx:verify']);assert.equal(f.router.loaded,null);await assert.rejects(f.router.call('verify',{model:'unknown'}),/Unknown/);});

test('one optional engine status failure does not block a healthy text engine',async()=>{
 let optionalBroken=true;
 const base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){return{};},async call(cmd){return cmd==='status'||cmd==='configure'?{'4B':{filesPresent:true}}:{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const optional={loaded:null,worker:{terminate(){}},async init(){},async call(cmd){if(cmd==='status'&&optionalBroken)throw Error('Optional asset store unavailable');return Object.fromEntries(onnxTextModels.map(model=>[model.id,{filesPresent:true}]));},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const router=new TextEngineRouter(base,()=>optional);
 const first=await router.call('configure',{models:[]});
 assert.equal(first['4B'].filesPresent,true);
 for(const model of onnxTextModels)assert.deepEqual(first[model.id],{filesPresent:false,presenceOnly:true,statusError:true});
 await router.load('4B');assert.equal(router.loaded,'4B');
 optionalBroken=false;
 const recovered=await router.call('status');
 assert.equal(recovered['4B'].filesPresent,true);
 for(const model of onnxTextModels)assert.equal(recovered[model.id].filesPresent,true);
});

test('selected base model checks do not start optional text workers',async()=>{
 const calls=[];let onnxStarts=0,lfmStarts=0;
 const base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){},async call(cmd){calls.push('base:'+cmd);return {'4B':{filesPresent:true}};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const lfm={id:'lfm-text',modelIds:['lfm'],describe:()=>({contextTokens:1024,runtime:{revision:'lfm-runtime'},models:[{id:'lfm',revision:'lfm-model'}]}),create(){lfmStarts++;return {loaded:null,worker:{terminate(){}},async init(){},async call(){return {lfm:{filesPresent:true}};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};}};
 const router=new TextEngineRouter(base,()=>{onnxStarts++;return {loaded:null,worker:{terminate(){}},async init(){},async call(){return {[onnxTextManifest.id]:{filesPresent:true}};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};},[lfm]);
 assert.deepEqual(await router.call('configure',{models:[],statusModel:'4B'}),{'4B':{filesPresent:true}});
 assert.deepEqual(await router.call('status',{model:'4B'}),{'4B':{filesPresent:true}});
 await router.call('configure',{models:[],statusModel:''});
 assert.equal(onnxStarts,0);assert.equal(lfmStarts,0);
 const selected=await router.call('status',{model:'lfm'});
 assert.equal(selected.lfm.filesPresent,true);assert.equal(lfmStarts,1);assert.equal(onnxStarts,0);
 assert.deepEqual(calls,['base:configure','base:status','base:configure','base:status']);
 await assert.rejects(router.call('status',{model:'missing'}),/Unknown text model/);
 assert.equal(onnxStarts,0);
});
test('new custom base model can be selected during its first registry configuration',async()=>{
 let optionalStarts=0;
 const base={manifest:{contextTokens:4096,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},loaded:null,worker:{terminate(){}},async init(){},async call(cmd,args){if(cmd==='configure')return Object.fromEntries(args.models.map(model=>[model.id,{filesPresent:true}]));return{};},async load(id){this.loaded=id;},async unload(){this.loaded=null;},abort(){}};
 const router=new TextEngineRouter(base,()=>{optionalStarts++;throw Error('unexpected optional worker');});
 const assets=await router.call('configure',{models:[{id:'local-custom'}],statusModel:'local-custom'});
 assert.equal(assets['local-custom'].filesPresent,true);
 assert.equal(optionalStarts,0);
});
test('switching away releases an idle optional worker and reselecting starts a fresh one',async()=>{
 const f=setup();await f.router.call('status',{model:onnxTextManifest.id});
 const first=f.onnx;assert.ok(first);
 f.router.releaseInactive('4B');assert.ok(f.calls.includes('onnx:terminate'));
 await f.router.call('status',{model:onnxTextManifest.id});assert.notEqual(f.onnx,first);
});

test('native structured transport is opt-in until full harness quality is verified',async()=>{const f=setup(),seen=[];f.webml.call=async(cmd,args)=>{seen.push(args);return{};};await f.router.load('4B');const messages=[{role:'user',content:'Question'}];await f.router.call('count',{messages,format:'dialogue-answer'});await f.router.generate(messages,undefined,32,'dialogue-answer');for(const args of seen){assert.equal(args.responseTool,undefined);assert.deepEqual(args.messages,messages);}});

test('same model and runtime identity reuse the resident backend; a changed context reloads it',async()=>{
 const f=setup(),calls=[];let context=8192;
 const backend={manifest:{},loaded:null,worker:{terminate(){}},async init(){return{};},async call(){return{};},async load(id){calls.push('load');this.loaded=id;},async unload(){calls.push('unload');this.loaded=null;},abort(){this.loaded=null;}};
 const describe=()=>({contextTokens:context,runtime:{revision:'runtime'},models:[{id:'lfm3-fixture',revision:'model'}]});
 const router=new TextEngineRouter(f.webml,()=>{throw Error('unused');},[{id:'lfm3',modelIds:['lfm3-fixture'],describe,create:()=>backend}]);
 await router.load('lfm3-fixture');assert.deepEqual(await router.load('lfm3-fixture'),{model:'lfm3-fixture',reused:true});assert.deepEqual(calls,['load']);
 context=16384;await router.load('lfm3-fixture');assert.deepEqual(calls,['load','unload','load']);
});

test('LFM3 custom registration accepts the inspector default context and keeps its engine identity',()=>{
 const f=setup(),digest='a'.repeat(64),model={id:'local-'+digest,label:'LFM3 local',role:'text',engine:'wllama-lfm3',revision:'sha256:'+digest,file:{bytes:1049615680,sha256:digest},contextTokens:8192,inspection:{format:'GGUF',version:3,bytes:1049615680,name:'LFM3 1.7B QAD',architecture:'lfm3',contextLength:262144,tokenizer:'gpt2',chatTemplate:true,tokenCount:128000,tensorCount:287,tensorTypes:[0,2,14],tensorExtentsChecked:true,dataOffset:8247360}};
 const registration={id:'lfm3-text',plannerProtocol:'native-tool-calls',modelIds:[...lfm3TextModels.map(item=>item.id),...customLfm3TextModels([model]).map(item=>item.id)],describe:id=>describeLfm3Text([model],id,8192),create:()=>{throw Error('Registration must stay lazy');}};
 const router=new TextEngineRouter(f.webml,()=>{throw Error('Unused');},[{...registration,modelIds:lfm3TextModels.map(item=>item.id),describe:id=>describeLfm3Text([],id,8192)}]);
 router.replaceRegistration('lfm3-text',registration);
 assert.equal(router.manifest.models.find(item=>item.id===model.id).revision,model.revision);
 assert.equal(router.manifest.models.find(item=>item.id===model.id).runtime.revision,registration.describe(model.id).runtime.revision);
});

test('router Stop waits for base worker disposal and propagates disposal failure',async()=>{
 let finish;const base={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},worker:{terminate(){}},async init(){},async call(){},async load(){},async unload(){},abort(){return new Promise((_,reject)=>{finish=reject;});}};
 const router=new TextEngineRouter(base,()=>{throw Error('unused');});let settled=false;
 const stopped=router.abort().finally(()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
 finish(Error('disposal failed'));await assert.rejects(stopped,/disposal failed/);
});
test('registered model manifest retains its own runtime identity before loading',()=>{
 const base={manifest:{contextTokens:2048,runtime:{revision:'base'},models:[{id:'4B',revision:'four'}]},worker:{terminate(){}},abort(){},async init(){},async call(){},async load(){},async unload(){}};
 const registration={id:'example',modelIds:['other'],describe:()=>({contextTokens:2048,runtime:{revision:'other-runtime'},models:[{id:'other',revision:'other-model'}]}),create(){throw Error('must stay lazy');}};
 const router=new TextEngineRouter(base,()=>{throw Error('unused');},[registration]);assert.equal(router.manifest.models.find(model=>model.id==='other').runtime.revision,'other-runtime');
});
