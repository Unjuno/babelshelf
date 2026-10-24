import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateAgentTurn} from '../src/agent-coordinator.ts';
import {run as calculate} from '../src/tools/math.calculate/tool.ts';
import {recordOperation} from '../src/harness-activity.ts';
import {run as searchNotes} from '../src/tools/memory.search/tool.ts';
import {run as readNotes} from '../src/tools/memory.read/tool.ts';
import {AgentToolInputError} from '../src/agent-loop.ts';
import {appendDiagnosticLog} from '../src/diagnostic-logs.ts';

const builtinPackages=[{definition:{id:'memory.search',version:1,readOnly:true,network:'none',inputSchema:{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string'}}}},entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local notes.'},{path:'Tools/memory.search/tool.ts',body:'Trusted adapter.'}],run:async(args,host)=>host.search(args.query)}];
const calculatorPackage={definition:{id:'math.calculate',version:1,readOnly:true,network:'none',inputSchema:{type:'object',required:['expression'],additionalProperties:false,properties:{expression:{type:'string'}}}},entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate explicit arithmetic.'},{path:'Tools/math.calculate/tool.ts',body:'Trusted pure calculator.'}],run:calculate};
const readPackage={definition:{id:'memory.read',version:2,readOnly:true,network:'none',inputSchema:{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string'}}}},entry:'Tools/memory.read/tool.ts',sources:[{path:'Tools/memory.read/SKILL.md',body:'Read exact local record.'},{path:'Tools/memory.read/tool.ts',body:'Trusted exact reader.'}],run:readNotes};

function engine(plans){
 const queue=[...plans];
 return {manifest:{contextTokens:4096},count:async messages=>({prompt_tokens:Math.ceil(JSON.stringify(messages).length/4)}),generate:async()=>({text:queue.shift()??'{}'})};
}
function context(currentFile){return {summary:'',recent:[],refs:[],turnCount:0,...(currentFile?{currentFile}:{})};}
function input(plans,overrides={}){
 const operations=[],calls=[];
 const base={engine:engine(plans),model:'local-text',question:'When is the meeting?',context:context(),attachments:[],enabledTools:['memory.search'],builtinPackages,maxToolCalls:3,maxResultChars:8000,scopedAwayFromCustomTools:false,readToolSources:async()=>[],search:async query=>{calls.push(['search',query]);return [{noteId:'meeting',revision:2,start:0,end:12,quote:'Monday at 10',title:'Notes/meeting.md'}];},views:async()=>[],ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,trace:async(tool,details,work)=>{operations.push({tool,details});return work();}};
 return {value:{...base,...overrides},operations,calls};
}

test('coordinator prepares context against the actually selected tool catalog before planning',async()=>{
 let prepared=0,messages;
 const {value}=input(['{"action":"chat","query":""}'],{prepareContext:async tools=>{prepared++;assert.deepEqual(tools.map(tool=>tool.id),['memory.search']);return {...context(),summary:'Budgeted retained summary'};}});
 const generate=value.engine.generate;value.engine.generate=async current=>{messages=current;return generate(current);};
 await coordinateAgentTurn(value);assert.equal(prepared,1);assert.match(JSON.stringify(messages),/Budgeted retained summary/);
});

test('planner receipt includes bounded token/timing evidence without changing the action',async()=>{
 const receipts=[];
 const {value}=input([],{
  engine:{manifest:{contextTokens:32000},count:async()=>({prompt_tokens:123}),generate:async()=>({text:'{"action":"chat","query":""}',outputTokens:8,metrics:{visibleTextTtftMs:700,generationMs:1000,runtimePrefillMs:650,runtimePromptTokens:120,runtimeCachedTokens:0,requestedThreads:4,runtimeThreads:1.5,private:'not receipt data',runtimeDecodeMs:NaN}})},
  trace:async(tool,details,work,project)=>{const result=await work();receipts.push({tool,result:project?project(result):result});return result;}
 });
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.final,{action:'chat',query:''});
 const timing=receipts[0].result.inference;
 assert.equal(timing.promptTokens,123);assert.equal(timing.outputTokens,8);assert.equal(timing.maxOutputTokens,160);
 assert.equal(timing.visibleTextTtftMs,700);assert.equal(timing.generationMs,1000);
 assert.equal(timing.runtimePrefillMs,650);assert.equal(timing.runtimePromptTokens,120);assert.equal(timing.runtimeCachedTokens,0);assert.equal(timing.requestedThreads,4);assert.equal(timing.runtimeThreads,undefined);
 assert.ok(Number.isFinite(timing.countMs));assert.ok(Number.isFinite(timing.generationWallMs));
 assert.equal(timing.private,undefined);assert.equal(timing.runtimeDecodeMs,undefined);
});

test('coordinator executes only the profile-selected registered tool and records its package identity',async()=>{
 const {value,operations,calls}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"answer","query":"meeting","target":"knowledge"}',
 ]);
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(result.calls.length,1);
 assert.deepEqual(calls,[['search','meeting']]);
 assert.deepEqual(operations.map(item=>item.tool),['dialogue.plan','memory.search','dialogue.plan']);
 assert.equal(operations[1].details.package,'memory.search');assert.ok(operations[1].details.packageSha256);
 assert.deepEqual(result.customEvidence,[]);
});

test('coordinator refuses a topic term used as a memory.read query even when it appears in the request',async()=>{
 const {value,calls}=input([
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'meeting'})}),
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})}),
  JSON.stringify({action:'answer',query:'meeting notes',target:'knowledge'}),
 ],{enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],views:async()=>{throw Error('Invented read must not open a Memory snapshot');}});
 const prompts=[],generate=value.engine.generate;value.engine.generate=async(...args)=>{prompts.push(args[0]);return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(calls,[['search','meeting']]);assert.equal(result.calls.length,1);assert.equal(result.calls[0].tool,'memory.search');
 assert.match(JSON.stringify(prompts[1]),/invalid_tool_input/);
 assert.match(JSON.stringify(prompts[1]),/last memory\.read did not execute.*memory\.search first/i);
});

test('coordinator allows exact user-named records and identifiers returned by local search',async()=>{
 const note={id:'note-7f2',path:'Notes/meeting.md',version:2,body:'Monday at 10'};let views=0;const searches=[];
 const fromSearch=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.path})}),
  JSON.stringify({action:'answer',query:'meeting notes',target:'knowledge'}),
 ],{enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],search:async query=>{searches.push(query);return [{noteId:note.id,revision:note.version,start:0,end:12,quote:note.body,title:note.path}];},views:async()=>{views++;return [note];}});
 const searched=await coordinateAgentTurn(fromSearch.value);assert.deepEqual(searches,['meeting']);assert.equal(searched.calls.length,2);assert.equal(views,1);
 const exact=input([
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.path})}),
  JSON.stringify({action:'answer',query:'meeting notes',target:'knowledge'}),
 ],{question:'Read Notes/meeting.md exactly.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],views:async()=>{views++;return [note];}});
 const directlyRead=await coordinateAgentTurn(exact.value);assert.equal(directlyRead.calls.length,1);assert.equal(directlyRead.calls[0].tool,'memory.read');assert.equal(views,2);
});

test('an attachment scope permits only the enabled pure calculator without reading custom or memory tools',async()=>{
 let sourceReads=0,runtimePreparations=0;
 const packages=[...builtinPackages,calculatorPackage];
 const {value,calls,operations}=input([
  '{"action":"tool","query":"math.calculate","body":"{\\"expression\\":\\"(1200 + 800) / 4\\"}"}',
  '{"action":"answer","query":"the checked total","target":"inputs"}',
 ],{scopedAwayFromCustomTools:true,enabledTools:['math.calculate','memory.search','user.private'],builtinPackages:packages,attachments:[{name:'budget.pdf',kind:'pdf',status:'Read'}],readToolSources:async()=>{sourceReads++;throw Error('custom source must not be read');},ensureCustomRuntime:async()=>{runtimePreparations++;throw Error('custom runtime must not be prepared');},search:async()=>{throw Error('memory search must not run');},views:async()=>{throw Error('memory read must not run');}});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.final,{action:'answer',query:'the checked total',target:'inputs'});
 assert.deepEqual(result.calls.map(call=>call.tool),['math.calculate']);
 assert.deepEqual(calls,[]);assert.equal(sourceReads,0);assert.equal(runtimePreparations,0);
 assert.deepEqual(operations.map(item=>item.tool),['dialogue.plan','math.calculate','dialogue.plan']);
});

test('an attachment scope still rejects memory tools even when the profile enables them',async()=>{
 const {value,calls}=input(['{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}'],{scopedAwayFromCustomTools:true,enabledTools:['memory.search'],context:context({id:'file-1',revision:1,path:'Notes/meeting.md'})});
 await assert.rejects(coordinateAgentTurn(value),/Invalid model action/);
 assert.deepEqual(calls,[]);
});

test('a registered adapter failure is distinguishable from a planner protocol failure',async()=>{
 const pkg={...builtinPackages[0],run:async()=>{throw Error('local storage quota unavailable');}};
 const {value}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
 ],{builtinPackages:[pkg]});
 await assert.rejects(coordinateAgentTurn(value),error=>error.code==='tool_execution'&&!/local storage quota unavailable/.test(error.message));
});

test('invalid arguments are returned to the planner without running the adapter, then a corrected call succeeds',async()=>{
 const {value,calls}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"search\\":\\"meeting\\"}"}',
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"answer","query":"meeting","target":"knowledge"}',
 ]);
 const prompts=[],receipts=[],generate=value.engine.generate;
 value.builtinPackages=[{...builtinPackages[0],run:searchNotes}];
 value.engine.generate=async(...args)=>{prompts.push(args[0]);return generate(...args);};
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>{receipts.push(row);},project);
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(calls,[['search','meeting']]);
 assert.equal(result.calls.length,1);
 assert.equal(result.calls[0].result[0].quote,'Monday at 10');
 assert.match(JSON.stringify(prompts[1]),/invalid_tool_input/);
 assert.equal(receipts.filter(row=>row.tool==='memory.search'&&row.status==='failed')[0].error.code,'invalid_tool_input');
 assert.equal(receipts.filter(row=>row.tool==='memory.search'&&row.status==='succeeded').length,1);
 const diagnostic=appendDiagnosticLog({getItem:()=>null,setItem:()=>{}},{tool:'memory.search',status:'failed',code:'invalid_tool_input',message:'private-argument-text'});
 assert.equal(diagnostic.code,'invalid_tool_input');assert.doesNotMatch(diagnostic.message,/private-argument-text/);
});

test('invalid attempts consume the existing call budget without invoking any adapter',async()=>{
 const {value,calls}=input(Array(4).fill('{"action":"tool","query":"memory.search","body":"{}"}'));
 await assert.rejects(coordinateAgentTurn(value),/call limit/);
 assert.deepEqual(calls,[]);
});

test('custom argument rejection does not prepare a runtime or expose raw failure text to planning',async()=>{
 let prepared=0;const prompts=[];
 const {value}=input([
  '{"action":"tool","query":"user.lookup","body":"{}"}',
  '{"action":"answer","query":"meeting","target":"knowledge"}',
 ],{enabledTools:['user.lookup'],ensureCustomRuntime:async()=>{prepared++;throw Error('private-runtime-path');},readToolSources:async()=>[
  {path:'Tools/user.lookup/SKILL.md',body:'---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch local notes.'},
  {path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>capabilities.memorySearch(input.query)'},
 ]});
 const generate=value.engine.generate;value.engine.generate=async(...args)=>{prompts.push(args[0]);return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(prepared,0);assert.deepEqual(result.calls,[]);assert.deepEqual(result.customEvidence,[]);
 assert.match(JSON.stringify(prompts[1]),/invalid_tool_input/);assert.doesNotMatch(JSON.stringify(prompts),/private-runtime-path/);
});

test('receipt persistence failure and cancellation remain terminal during input recovery',async()=>{
 for(const mode of ['persist','stop']){
  let generations=0;const controller=new AbortController();
  const {value,calls}=input(['{"action":"tool","query":"memory.search","body":"{}"}'],{
   signal:controller.signal,check:()=>{if(controller.signal.aborted)throw Error('Stopped');},
   trace:(tool,details,work,project)=>recordOperation(tool,details,work,async row=>{
    if(row.tool==='memory.search'&&row.status==='failed'){
     if(mode==='persist')throw Error('private-storage-path');
     controller.abort();
    }
   },project),
  });
  const generate=value.engine.generate;value.engine.generate=async(...args)=>{generations++;return generate(...args);};
  await assert.rejects(coordinateAgentTurn(value),error=>mode==='persist'?error.code==='persistence_failure':error.message==='Stopped');
  assert.equal(generations,1);assert.deepEqual(calls,[]);
 }
});

test('adapter-thrown input errors are execution failures, never preflight recovery',async()=>{
 let generations=0;
 const {value}=input(['{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}'],{
  builtinPackages:[{...builtinPackages[0],run:async()=>{throw new AgentToolInputError();}}],
 });
 const generate=value.engine.generate;value.engine.generate=async(...args)=>{generations++;return generate(...args);};
 await assert.rejects(coordinateAgentTurn(value),error=>error.code==='tool_execution');
 assert.equal(generations,1);
});
