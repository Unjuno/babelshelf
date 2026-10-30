import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateAgentTurn} from '../src/agent-coordinator.ts';
import {run as calculate} from '../src/tools/math.calculate/tool.ts';
import {recordOperation} from '../src/harness-activity.ts';
import {run as searchNotes} from '../src/tools/memory.search/tool.ts';
import {run as readNotes} from '../src/tools/memory.read/tool.ts';
import {run as listNotes} from '../src/tools/memory.list/tool.ts';
import {listMemoryEntries} from '../src/tools/tool-host.ts';
import {agentEvidenceFromCalls} from '../src/agent-evidence.ts';
import {AgentToolInputError} from '../src/agent-loop.ts';
import {appendDiagnosticLog} from '../src/diagnostic-logs.ts';
import {captureTurnExecutionSnapshot} from '../src/turn-execution-snapshot.ts';
import * as clock from '../src/tools/time.now/tool.ts';
import {agentClockReadingsFromCalls} from '../src/agent-evidence.ts';
import {PlannerOutputError} from '../src/planner-error.ts';
import * as pagedSearch from '../src/tools/memory.search/tool.ts';
import {searchStoredPageChecked} from '../src/file-discovery.ts';
import {createNote} from '../../../dist/core.js';

test('native planner protocol failure is recorded and retried once without executing malformed output',async()=>{
 const {value,calls}=input([],{question:'Summarize the previous answer.',context:{...context(),recent:[{id:'prior',user:'Hello',answer:'Previous answer'}],turnCount:1}});let generations=0;const prompts=[],receipts=[];
 value.engine.plannerProtocol='native-tool-calls';value.engine.generate=async(messages)=>{prompts.push(messages);if(++generations===1)throw new PlannerOutputError('Invalid native tool calls','UNTRUSTED','native-tool-call');return {text:JSON.stringify({action:'chat',query:''})};};
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 const result=await coordinateAgentTurn(value);assert.equal(result.final.action,'chat');assert.equal(generations,2);assert.deepEqual(calls,[]);assert.equal(receipts.find(r=>r.status==='failed').error.code,'planner_protocol');assert.equal(prompts[1][0].content,prompts[0][0].content);assert.match(prompts[1].at(-1).content,/previous.*rejected/i);assert.doesNotMatch(JSON.stringify(prompts[1]),/UNTRUSTED/);
});

test('an invalid history selector gets one audited replan without guessing an original or executing a tool',async()=>{
 const {value,calls}=input([
  '{"action":"recall","target":"history","query":"その集合の持ち物は何？"}',
  '{"action":"answer","query":"集合 持ち物","target":"knowledge"}',
 ],{question:'その集合の持ち物は何？',context:{...context(),recent:[{id:'prior',user:'集合場所は？',answer:'北口です。',refs:[{noteId:'meeting',revision:3,start:0,end:3,quote:'北口。'}]}],refs:[{noteId:'meeting',revision:3,start:0,end:3,quote:'北口。'}],turnCount:1}});
 const receipts=[],prompts=[],generate=value.engine.generate;
 value.engine.generate=async(...args)=>{prompts.push(args[0]);return generate(...args);};
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>{receipts.push(row);},project);
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(calls,[]);assert.equal(prompts.length,2);
 assert.deepEqual(receipts.filter(r=>r.status!=='running').map(r=>r.status),['failed','succeeded']);
 assert.match(prompts[1][0].content,/invalid history selector.*rejected without execution/i);
 assert.equal(prompts[1].at(-1).content,'その集合の持ち物は何？');
 assert.doesNotMatch(JSON.stringify(prompts[1]),/"raw"/);
});

test('history-selector repair is bounded and Stop never triggers another generation',async()=>{
 const invalid='{"action":"recall","target":"history","query":"meeting"}';
 const withHistory={context:{...context(),recent:[{id:'prior',user:'Meeting details?'}],turnCount:1}};
 const {value}=input([invalid,invalid,JSON.stringify({action:'chat',query:''})],withHistory);let generated=0;
 const generate=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return generate(...args);};
 await assert.rejects(coordinateAgentTurn(value),error=>error.code==='planner_protocol');assert.equal(generated,2);
 let stopped=false;const stoppedInput=input([invalid],{...withHistory,check:()=>{if(stopped)throw Error('Stopped');}}).value;
 stoppedInput.trace=async(_tool,_details,work)=>{try{return await work();}catch(error){stopped=true;throw error;}};
 await assert.rejects(coordinateAgentTurn(stoppedInput),/Stopped/);
 const failedSave=input([invalid],withHistory).value;let saveGenerations=0;const saveGenerate=failedSave.engine.generate;
 failedSave.engine.generate=async(...args)=>{saveGenerations++;return saveGenerate(...args);};
 failedSave.trace=async(_tool,_details,work)=>{try{return await work();}catch{throw Error('Receipt storage unavailable');}};
 await assert.rejects(coordinateAgentTurn(failedSave),/Receipt storage unavailable/);assert.equal(saveGenerations,1);
});

const builtinPackages=[{definition:{id:'memory.search',version:1,effect:'read',network:'none',inputSchema:{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string'}}}},entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search local notes.'},{path:'Tools/memory.search/tool.ts',body:'Trusted adapter.'}],run:async(args,host)=>host.search(args.query)}];
const calculatorPackage={definition:{id:'math.calculate',version:1,effect:'read',network:'none',inputSchema:{type:'object',required:['expression'],additionalProperties:false,properties:{expression:{type:'string'}}}},entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate explicit arithmetic.'},{path:'Tools/math.calculate/tool.ts',body:'Trusted pure calculator.'}],run:calculate};
const readPackage={definition:{id:'memory.read',version:3,effect:'read',network:'none',inputSchema:{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string'},start:{type:'integer',minimum:0,maximum:10_000_000},length:{type:'integer',minimum:1,maximum:3_000}}}},entry:'Tools/memory.read/tool.ts',sources:[{path:'Tools/memory.read/SKILL.md',body:'Read exact local record.'},{path:'Tools/memory.read/tool.ts',body:'Trusted exact reader.'}],run:readNotes};
const listPackage={definition:{id:'memory.list',version:1,effect:'read',network:'none',inputSchema:{type:'object',required:[],additionalProperties:false,properties:{path:{type:'string',maxLength:500},offset:{type:'integer',minimum:0,maximum:1_000_000},limit:{type:'integer',minimum:1,maximum:25}}}},entry:'Tools/memory.list/tool.ts',sources:[{path:'Tools/memory.list/SKILL.md',body:'List immediate Memory children.'},{path:'Tools/memory.list/tool.ts',body:'Trusted folder projection.'}],run:listNotes};

function engine(plans){
 const queue=[...plans];
 return {manifest:{contextTokens:4096},count:async messages=>({prompt_tokens:Math.ceil(JSON.stringify(messages).length/4)}),generate:async()=>({text:queue.shift()??'{}'})};
}
function context(currentFile){return {summary:'',recent:[],refs:[],turnCount:0,...(currentFile?{currentFile}:{})};}
function input(plans,overrides={}){
 const operations=[],calls=[];
 const base={engine:engine(plans),model:'local-text',question:'When is the meeting?',context:context(),attachments:[],enabledTools:['memory.search'],builtinPackages,maxToolCalls:3,maxResultChars:8000,readToolSources:async()=>[],search:async query=>{calls.push(['search',query]);return [{noteId:'meeting',revision:2,start:0,end:12,quote:'Monday at 10',title:'Notes/meeting.md'}];},views:async()=>[],ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,trace:async(tool,details,work)=>{operations.push({tool,details});return work();}};
 const value={...base,...overrides};
 value.snapshot=overrides.snapshot??captureTurnExecutionSnapshot({turnId:'turn-test',textModel:value.model,textManifest:{models:[{id:value.model,revision:'model-r1'}],runtime:{revision:'runtime-r1'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test-profile',label:'Test',enabledTools:value.enabledTools,maxToolCalls:value.maxToolCalls,maxResultChars:value.maxResultChars},replyStyle:'balanced',userGuidance:'',attachments:[]});
 return {value,operations,calls};
}

test('agent executes paged search and retains original evidence from later pages',async()=>{
 const notes=Array.from({length:15},(_,i)=>createNote({title:`water ${i}`,body:`water reserve ${i}`,path:`Inbox/water-${i}.md`}));
 const first=searchStoredPageChecked(notes,'water',{offset:0,limit:12});
 const pkg={definition:pagedSearch.definition,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search with pages.'},{path:'Tools/memory.search/tool.ts',body:'Trusted search.'}],run:pagedSearch.run};
 const plans=[{action:'tool',query:'memory.search',body:JSON.stringify({query:'water',offset:0})},{action:'tool',query:'memory.search',body:JSON.stringify({query:'water',offset:12,snapshot:first.snapshot})},{action:'answer',query:'water',target:'knowledge'}].map(JSON.stringify);
 const {value}=input(plans,{question:'Find saved water information.',builtinPackages:[pkg],searchPage:async(query,options)=>searchStoredPageChecked(notes,query,options)});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.calls.length,2);assert.equal(result.calls[1].result.hits.length,3);
 const refs=agentEvidenceFromCalls(result.calls);assert.equal(new Set(refs.map(ref=>ref.noteId)).size,15);
 for(const ref of refs){const note=notes.find(note=>note.id===ref.noteId);assert.equal(note.revisions.at(-1).body.slice(ref.start,ref.end),ref.quote);}
});

test('source capacity returns partial work without executing another tool or losing receipts',async()=>{
 const plans=Array.from({length:6},(_,i)=>JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:`batch-${i}`})}));
 const {value,operations}=input(plans,{question:'Compare the saved records.',maxToolCalls:null,search:async query=>{const batch=Number(query.slice(6));return Array.from({length:11},(_,i)=>({noteId:`note-${batch}-${i}`,revision:1,start:0,end:3,quote:'one',title:`Notes/${batch}-${i}.md`}));}});
 value.engine.plannerProtocol='native-tool-calls';value.engine.manifest.contextTokens=100000;value.engine.count=async()=>({prompt_tokens:1000});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.budgetExhausted,true);assert.equal(result.budgetReason,'source-capacity');assert.equal(result.final.action,'answer');
 assert.equal(result.calls.length,6);assert.equal(operations.filter(item=>item.tool==='memory.search').length,6);
 const {agentAnswerEvidenceFromCalls}=await import('../src/agent-evidence.ts');
 const refs=agentAnswerEvidenceFromCalls(result.calls,[],true);assert.equal(refs.length,64);assert.equal(new Set(refs.map(ref=>ref.noteId)).size,64);
});

test('agent selects the registered device clock and retains its result for answering',async()=>{
 const clockPackage={definition:clock.definition,entry:'Tools/time.now/tool.ts',sources:[{path:'Tools/time.now/SKILL.md',body:'Read the device clock.'},{path:'Tools/time.now/tool.ts',body:'Trusted clock.'}],run:clock.run};
 const {value,operations}=input([JSON.stringify({action:'tool',query:'time.now',body:'{}'}),JSON.stringify({action:'answer',query:'What time is it?',target:'knowledge'})],{question:'What time is it?',enabledTools:['time.now'],builtinPackages:[clockPackage]});
 const result=await coordinateAgentTurn(value);assert.equal(result.final.action,'answer');assert.equal(result.calls.length,1);
 assert.equal(agentClockReadingsFromCalls(result.calls)[0].source,'device-clock');assert.ok(operations.some(item=>item.tool==='time.now'));
});

test('coordinator prepares context against the actually selected tool catalog before planning',async()=>{
 let prepared=0,messages;
 const {value}=input(['{"action":"chat","query":""}'],{prepareContext:async tools=>{prepared++;assert.deepEqual(tools.map(tool=>tool.id),['memory.search']);return {...context(),summary:'Budgeted retained summary'};}});
 const generate=value.engine.generate;value.engine.generate=async current=>{messages=current;return generate(current);};
 await coordinateAgentTurn(value);assert.equal(prepared,1);assert.match(JSON.stringify(messages),/Budgeted retained summary/);
});

test('coordinator derives a transparent tool budget from remaining receipt capacity and returns useful partial evidence',async()=>{
 const {value,operations,calls}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'meeting'})}),
 ],{enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,activityEventCount:122});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(result.budgetExhausted,true);assert.equal(result.budgetReason,'activity-capacity');
 assert.deepEqual(calls,[['search','meeting']]);
 assert.equal(operations.find(row=>row.tool==='dialogue.plan').details.effectiveToolBudget,1);
 assert.equal(operations.some(row=>row.tool==='memory.read'),false,'the action that exceeded available receipts was not executed');
 assert.equal(result.calls.length,1,'previous completed evidence remains available to the answer stage');
});

test('tool-limit provenance distinguishes the profile from tied storage and profile limits',async()=>{
 for(const [activityEventCount,expected] of [[undefined,'profile-limit'],[122,'both-limits']]){
  const {value}=input([
   JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'meeting'})}),
   JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'meeting'})}),
  ],{enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:1,activityEventCount});
  const result=await coordinateAgentTurn(value);assert.equal(result.budgetReason,expected);assert.equal(result.calls.length,1);
 }
});

test('an explicitly named enabled package has its current guide observed before model selection without executing code',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const files=createCustomToolPackageFiles({id:'user.weather',title:'Weather',instructions:'Current guide: read only; required query.',code:'({input})=>input',capabilities:[]});
 let prepared=0,generated=0;const seen=[],receipts=[];
 const {value}=input([],{question:'Explain user.weather only; do not execute it.',enabledTools:['user.weather'],builtinPackages:[],readToolSources:async()=>files,ensureCustomRuntime:async()=>{prepared++;},maxToolCalls:null,context:{...context(),summary:'Earlier guide was different.'}});
 value.engine={plannerProtocol:'native-tool-calls',manifest:{contextTokens:4096},count:async()=>({prompt_tokens:200}),generate:async(messages,_max,format)=>{generated++;seen.push({messages,format});return {text:JSON.stringify({action:'answer',reply:{status:'answered',answer:'It reads only and requires query.',sources:[]}}),finishReason:'stop'};}};
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 const result=await coordinateAgentTurn(value);
 assert.equal(generated,1);assert.equal(prepared,0);assert.equal(result.final.action,'answer');
 assert.deepEqual(result.calls.map(call=>call.tool),['tools.read-skill']);
 assert.match(seen[0].messages.find(m=>m.role==='tool').content,/Current guide/);
 assert.ok(seen[0].format.tools.some(tool=>tool.function.name==='user.weather'));
 assert.ok(receipts.some(row=>row.tool==='tools.read-skill'&&row.status==='succeeded'));
 assert.equal(receipts.find(row=>row.tool==='dialogue.plan'&&row.status==='succeeded').output.inference,undefined,'metadata preparation is not recorded as model inference');
});

test('LFM3 discovers and reads a custom skill using only executable string-content native messages',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const files=createCustomToolPackageFiles({id:'user.weather',title:'Weather note lookup',instructions:'Look up weather details already stored in Memory.',code:'({ input }) => ({ value: input.query })',capabilities:['memory.search']});
 const plans=[
  JSON.stringify({action:'tool',query:'tools.search',body:JSON.stringify({query:'weather'})}),
  JSON.stringify({action:'tool',query:'tools.read-skill',body:JSON.stringify({id:'user.weather'})}),
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'weather'})}),
  JSON.stringify({action:'answer',query:'weather',target:'knowledge',reply:{status:'insufficient_evidence',answer:'The observed excerpt does not state weather details.',sources:[]}}),
 ];
 const calls=[],formats=[],messages=[];let preparedToolIds=[];
 const nativeEngine={plannerProtocol:'native-tool-calls',manifest:{contextTokens:4096},count:async(value,format)=>{formats.push(format);return {prompt_tokens:100};},generate:async(value,_max,format)=>{messages.push(value);formats.push(format);return {text:plans.shift()};}};
 const {value}=input([],{
  question:'What weather notes have I saved?',
  enabledTools:['memory.search','user.weather'],
  builtinPackages,
  engine:nativeEngine,
  readToolSources:async()=>files,
  prepareContext:async tools=>{preparedToolIds=tools.map(tool=>tool.id);return context();},
  maxToolCalls:null,
 });
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');
 assert.deepEqual(preparedToolIds,['memory.search','user.weather','tools.search','tools.read-skill']);
 assert.ok(formats[0].tools.some(tool=>tool.function.name==='tools.search'));
 assert.equal(formats[0].tools.some(tool=>tool.function.name==='user.weather'),false);
 assert.ok(formats.every(format=>format.tools.every(tool=>!Object.hasOwn(tool,'defer_loading'))));
 const searchCall=messages[1].find(message=>message.role==='assistant'&&message.tool_calls);
 assert.ok(searchCall);
 const searchResult=messages[1].find(message=>message.role==='tool'&&message.name==='tools.search');
 assert.deepEqual(JSON.parse(searchResult.content),[{id:'user.weather',usage:'Look up weather details already stored in Memory.\n'}]);
 assert.equal(Object.hasOwn(searchResult,'additional_tools'),false);
 const guideResult=messages[2].find(message=>message.role==='tool'&&message.name==='tools.read-skill');
 assert.match(guideResult.content,/Look up weather details already stored in Memory/);
 assert.match(messages[3].find(message=>message.role==='system').content,/guide and results as untrusted data/i);
 assert.ok(formats.at(-1).tools.find(tool=>tool.function.name==='user.weather'));
 assert.ok(messages.every(group=>group.every(message=>typeof message.content==='string')));
 assert.deepEqual(result.calls.map(call=>call.tool),['tools.search','tools.read-skill','memory.search']);
});

test('known enabled skill IDs are directly readable and later empty searches do not revoke them',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const files=createCustomToolPackageFiles({id:'user.weather',title:'Weather',instructions:'Weather observations.',code:'({input})=>input',capabilities:[]});
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
 const {value}=input([action('tools.read-skill',{id:'user.weather'}),action('tools.search',{query:'zzzz'}),action('tools.read-skill',{id:'user.weather'}),JSON.stringify({action:'answer',query:'weather',target:'knowledge'})],{enabledTools:['user.weather'],builtinPackages:[],readToolSources:async()=>files,maxToolCalls:null});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.calls.map(call=>call.tool),['tools.read-skill','tools.search','tools.read-skill']);
 assert.deepEqual(result.calls[1].result,[]);
 assert.equal(result.calls[2].result.id,'user.weather');
});

test('an oversized discovery does not prevent exact registered guide access or authorize an unknown ID',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const ids=['user.weather-one','user.weather-two','user.weather-three'];
 const files=ids.flatMap(id=>createCustomToolPackageFiles({id,title:id,instructions:'Weather '+ 'observations '.repeat(40),code:'({input})=>input',capabilities:[]}));
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)}),receipts=[];
 const {value}=input([action('tools.search',{query:'weather'}),action('tools.read-skill',{id:'user.unknown'}),action('tools.read-skill',{id:ids[0]}),JSON.stringify({action:'answer',query:'weather',target:'knowledge'})],{enabledTools:ids,builtinPackages:[],readToolSources:async()=>files,maxToolCalls:null,maxResultChars:1000});
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 const result=await coordinateAgentTurn(value);
 assert.equal(receipts.find(row=>row.tool==='tools.search'&&row.status==='failed').error.code,'result_too_large');
 assert.equal(receipts.find(row=>row.tool==='tools.read-skill'&&row.status==='failed').error.code,'invalid_tool_input');
 assert.deepEqual(result.calls.filter(call=>call.tool==='tools.read-skill').map(call=>call.result.id),[ids[0]]);
});

test('an oversized guide cannot reveal its execution schema',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const files=createCustomToolPackageFiles({id:'user.weather',title:'Weather',instructions:'Observation '.repeat(200),code:'({input})=>input',capabilities:[]});
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)}),receipts=[],formats=[];
 const {value}=input([action('tools.read-skill',{id:'user.weather'}),JSON.stringify({action:'answer',reply:{status:'insufficient_evidence',answer:'The guide could not fit.',sources:[]}})],{enabledTools:['user.weather'],builtinPackages:[],readToolSources:async()=>files,maxToolCalls:null,maxResultChars:1000});
 value.engine.plannerProtocol='native-tool-calls';const generate=value.engine.generate;
 value.engine.generate=async(messages,budget,format)=>{formats.push(format);return generate(messages,budget,format);};
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 await coordinateAgentTurn(value);
 assert.equal(receipts.find(row=>row.tool==='tools.read-skill'&&row.status==='failed').error.code,'result_too_large');
 assert.ok(formats.every(format=>!format.tools.some(tool=>tool.function.name==='user.weather')));
});

test('a full configured catalog retains discovery and guide access instead of making custom tools unreachable',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const ids=Array.from({length:64},(_,index)=>'user.lookup'+index),files=ids.flatMap(id=>createCustomToolPackageFiles({id,title:id,instructions:'Read local notes.',code:'({input})=>({value:input.query})',capabilities:['memory.search']}));
 let active,format;
 const {value}=input([],{enabledTools:ids,builtinPackages:[],readToolSources:async()=>files,prepareContext:async tools=>{active=tools.map(tool=>tool.id);return context();},engine:{plannerProtocol:'native-tool-calls',manifest:{contextTokens:8192},count:async()=>({prompt_tokens:300}),generate:async(_messages,_budget,current)=>{format=current;return {text:'{"action":"chat","query":""}'};}},maxToolCalls:null});
 assert.equal((await coordinateAgentTurn(value)).final.action,'chat');
 assert.equal(active.length,66);assert.deepEqual(active.slice(-2),['tools.search','tools.read-skill']);
 assert.ok(format.tools.some(tool=>tool.function.name==='tools.search'));assert.ok(format.tools.some(tool=>tool.function.name==='tools.read-skill'));
 assert.equal(format.tools.some(tool=>tool.function.name.startsWith('user.')),false);
});

test('JSON planners discover enabled custom tools and receive their schema only after reading the skill',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const files=createCustomToolPackageFiles({id:'user.weather',title:'Weather note lookup',instructions:'Look up weather details already stored in Memory.',code:'({ input }) => ({ value: input.query })',capabilities:['memory.search']});
 const plans=[
  JSON.stringify({action:'tool',query:'tools.search',body:JSON.stringify({query:'weather'})}),
  JSON.stringify({action:'tool',query:'tools.read-skill',body:JSON.stringify({id:'user.weather'})}),
  JSON.stringify({action:'answer',query:'weather',target:'knowledge'}),
 ];
 const messages=[];const jsonEngine={manifest:{contextTokens:4096},count:async value=>({prompt_tokens:Math.ceil(JSON.stringify(value).length/4)}),generate:async value=>{messages.push(value);return {text:plans.shift()};}};
 const {value}=input([],{question:'Use my custom weather tool to look up saved weather details.',enabledTools:['memory.search','user.weather'],engine:jsonEngine,readToolSources:async()=>files,maxToolCalls:null});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');
 assert.deepEqual(result.calls.map(call=>call.tool),['tools.search','tools.read-skill']);
 assert.match(messages[0][0].content,/Enabled custom tool IDs: \["user\.weather"\]/);
 assert.doesNotMatch(messages[0][0].content,/"id":"user\.weather","usage":/,'a name is discoverable before its execution schema is offered');
 assert.match(messages[0][0].content,/tools\.search/);
 assert.match(JSON.stringify(messages[1]),/user\.weather/); // the search result is data, not an offered schema
 assert.doesNotMatch(messages[1][0].content,/"id":"user\.weather","usage":/);
 assert.match(messages[2][0].content,/user\.weather.*inputSchema/s);
 assert.match(messages[2][0].content,/Look up weather details already stored in Memory/);
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
 assert.equal(timing.promptTokens,123);assert.equal(timing.outputTokens,8);assert.equal(timing.maxOutputTokens,2048);
 assert.equal(timing.visibleTextTtftMs,700);assert.equal(timing.generationMs,1000);
 assert.equal(timing.runtimePrefillMs,650);assert.equal(timing.runtimePromptTokens,120);assert.equal(timing.runtimeCachedTokens,0);assert.equal(timing.requestedThreads,4);assert.equal(timing.runtimeThreads,undefined);
 assert.ok(Number.isFinite(timing.countMs));assert.ok(Number.isFinite(timing.generationWallMs));
 assert.equal(timing.private,undefined);assert.equal(timing.runtimeDecodeMs,undefined);
});

test('native intermediate content is replayed in the live tool turn but not persisted in activity',async()=>{
 for(const batch of [false,true]){
  const receipts=[],prompts=[],intermediate='TRANSIENT NATIVE CONTENT',query={query:'meeting'};
  const plans=[batch?{action:'tool_batch',calls:[{tool:'memory.search',arguments:query},{tool:'memory.search',arguments:{query:'agenda'}}]}:{action:'tool',query:'memory.search',body:JSON.stringify(query)},
   {action:'answer',query:'meeting',target:'knowledge',reply:{status:'answered',answer:'Monday at 10',sources:['S1']}}];
  const {value}=input([],{engine:{plannerProtocol:'native-tool-calls',manifest:{contextTokens:8192},count:async()=>({prompt_tokens:200}),generate:async messages=>{prompts.push(messages);return {text:JSON.stringify(plans.shift()),...(prompts.length===1?{assistantContent:intermediate}:{}),outputTokens:20};}},
   trace:(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project)});
  const result=await coordinateAgentTurn(value);
  assert.equal(result.final.reply.answer,'Monday at 10');
  assert.ok(prompts[1].some(message=>message.role==='assistant'&&message.content===intermediate&&message.tool_calls.length===(batch?2:1)));
  assert.ok(result.calls.every(call=>call.assistantContent===intermediate),'the live protocol remains intact');
  assert.doesNotMatch(JSON.stringify(receipts),/TRANSIENT NATIVE CONTENT/);
  const plan=receipts.find(row=>row.tool==='dialogue.plan'&&row.status==='succeeded').output;
  assert.equal(plan.action,batch?'tool_batch':'tool');assert.equal(plan.inference.outputTokens,20);
 }
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
 assert.equal(result.snapshot,value.snapshot);assert.equal(operations[0].details.execution.turnId,value.snapshot.turnId);assert.equal(operations[1].details.execution.textRevision,'model-r1');assert.equal(operations[1].details.execution.harnessProfileId,'test-profile');
 assert.deepEqual(result.customEvidence,[]);
});

test('coordinator uses the frozen send-time tools even if the caller changes its live profile object',async()=>{
 const {value,calls}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"answer","query":"meeting","target":"knowledge"}',
 ]);
 value.enabledTools=[];value.maxToolCalls=0;value.maxResultChars=1;value.userGuidance='mutated after send';
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(result.calls.length,1);assert.deepEqual(calls,[['search','meeting']]);
});

test('coordinator lets the read tool resolve an exact name without requiring prior discovery',async()=>{
 const note={id:'note-7f2',path:'Notes/meeting',version:1,body:'Monday at 10'};let views=0;
 const {value,calls}=input([
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'meeting'})}),
  JSON.stringify({action:'answer',query:'meeting notes',target:'knowledge'}),
 ],{enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],views:async()=>{views++;return [note];}});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(calls,[]);assert.equal(views,1);assert.equal(result.calls.length,1);assert.equal(result.calls[0].tool,'memory.read');
 assert.equal(result.calls[0].result[0].noteId,note.id);
});

test('an unmatched direct read adds no evidence and can be followed by search',async()=>{
 const note={id:'reserve-1',path:'Notes/water.md',version:1,body:'Reserve: 7 litres.'};
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'reserve'})}),
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'reserve'})}),
  JSON.stringify({action:'answer',query:'reserve',target:'knowledge'}),
 ],{question:'Find the reserve.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],views:async()=>[note],search:async()=>[{noteId:note.id,revision:1,start:0,end:note.body.length,quote:note.body,title:note.path}]});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.read','memory.search']);
 assert.deepEqual(result.calls[0].result,[]);assert.equal(result.calls[1].result[0].noteId,note.id);
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
test('read calls recover an omitted extension only for a filename explicitly named by the user',async()=>{
 const notes=[{id:'one',path:'Inbox/alpha.md',version:1,body:'First.'}];
 const plans=[JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'alpha.md'})}),JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'alpha'})}),JSON.stringify({action:'tool',query:'math.calculate',body:JSON.stringify({expression:'1+1'})}),JSON.stringify({action:'answer',query:'alpha and 1 + 1',target:'knowledge'})];
 const {value}=input(plans,{question:'Find alpha.md, read it, and calculate 1 + 1.',enabledTools:['memory.search','memory.read','math.calculate'],builtinPackages:[...builtinPackages,readPackage,calculatorPackage],maxToolCalls:8,views:async()=>notes,search:async query=>notes.filter(n=>n.path.endsWith(query)).map(n=>({noteId:n.id,revision:1,start:0,end:n.body.length,quote:n.body,title:n.path}))});
 let generations=0;const generate=value.engine.generate;value.engine.generate=async(...args)=>{generations++;return generate(...args);};
 const result=await coordinateAgentTurn(value);assert.deepEqual(result.calls.filter(c=>c.tool==='memory.read').map(c=>c.arguments.query),['alpha.md']);assert.equal(result.calls.filter(c=>c.tool==='memory.read').length,1);assert.equal(result.final.action,'answer');assert.equal(generations,4);
});

test('folder navigation binds listed files to exact IDs before a read',async()=>{
 const note={id:'note-from-folder',path:'Notes/projects/plan.md',version:5,body:'Keep the original and append revisions.'};let reads=0;const receipts=[];
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.list',body:JSON.stringify({path:'Notes/projects'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.id})}),
  JSON.stringify({action:'answer',query:'Summarize the note.',target:'knowledge'}),
 ],{question:'Open the file in Notes/projects and summarize it.',enabledTools:['memory.list','memory.read'],builtinPackages:[...builtinPackages,listPackage,readPackage],views:async()=>{reads++;return [note];},listFolders:async()=>['Notes','Notes/projects'],trace:(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project)});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(result.calls.map(call=>call.tool),['memory.list','memory.read']);assert.equal(result.calls[1].arguments.query,note.id);assert.equal(reads,2);assert.ok(receipts.some(row=>row.tool==='memory.list'&&row.status==='succeeded'));
});

test('explicit search-read-answer binds a single search hit when the model passes its quote as the read selector',async()=>{
 const note={id:'note-water-42',path:'Notes/emergency/water.md',version:3,body:'Emergency reserve: 24 litres. Record ID: water-42.'};
 const receipts=[];
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'emergency water reserve'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.body})}),
 ],{
  question:'Search local Memory for my saved emergency water reserve note, read the exact file, then tell me its exact amount and identifier.',
  enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],
  search:async()=>[{noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path}],
  views:async()=>[note],
  trace:async(tool,details,work,project)=>{const result=await work();receipts.push({tool,details,result:project?project(result):result});return result;},
 });

 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read']);
 assert.equal(result.calls[1].arguments.query,note.id);assert.equal(result.calls[1].result[0].noteId,note.id);
 assert.equal(result.calls[1].result[0].revision,note.version);assert.equal(result.calls[1].result[0].excerpt,note.body);
 assert.equal(receipts.find(row=>row.tool==='memory.read').details.query,note.id);
  assert.equal(result.final.action,'answer');
 });

test('an unrelated read selector is not silently replaced by the only search hit',async()=>{
 const note={id:'note-water-42',path:'Notes/water.md',version:1,body:'Reserve: 24 litres.'},prompts=[];
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'water'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'unrelated-selector'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.id})}),
 ],{question:'Search local Memory for water, read the file, then tell me the amount.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],search:async()=>[{noteId:note.id,revision:1,start:0,end:note.body.length,quote:note.body,title:note.path}],views:async()=>[note]});
 const generate=value.engine.generate;value.engine.generate=async(...args)=>{prompts.push(args[0]);return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read']);
 assert.equal(result.calls[1].arguments.query,note.id);
 assert.ok(prompts.some(messages=>JSON.stringify(messages).includes('invalid_tool_input')),'the invalid selector is reported before the corrected read');
});

test('an incomplete explicit read continues reading ranges before grounded answer generation',async()=>{
 const note={id:'long-water',path:'Notes/emergency/water.md',version:3,body:'x'.repeat(4_000)};
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'emergency water reserve'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.path,start:0,length:3_000})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.id,start:3_000,length:1_000})}),
 ],{
  question:'Search local Memory for my saved emergency water reserve note, read the complete file, then tell me what it records.',
  enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],
  search:async()=>[{noteId:note.id,revision:note.version,start:0,end:'emergency water reserve'.length,quote:'emergency water reserve',title:note.path}],
  views:async()=>[note],
 });
 let generated=0;const plan=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return plan(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read','memory.read']);
 assert.deepEqual(result.calls.slice(1).map(call=>call.arguments.start??0),[0,3_000]);
 assert.equal(generated,3,'the planner continues after an incomplete read, then skips only the redundant final plan');
});

test('compound search reads each explicitly named unique file through registered tools before asking the model to compare',async()=>{
 const question='Find the saved notes QA Alpine water plan and QA Birch water plan. Compare their exact emergency water amounts, calculate the combined total, and cite both files.';
 const notes=[
  {id:'alpine-id',path:'Notes/QA Alpine water plan.md',version:1,body:'Alpine emergency water reserve: exactly 17 litres.'},
  {id:'birch-id',path:'Notes/QA Birch water plan.md',version:2,body:'Birch emergency water reserve: exactly 29 litres.'},
 ];
 const {value,calls,operations}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'QA Alpine water plan QA Birch water plan'})}),
  JSON.stringify({action:'tool',query:'math.calculate',body:JSON.stringify({expression:'17+29'})}),
  JSON.stringify({action:'answer',query:'Compare both exact amounts, total them, and cite both files.',target:'knowledge'}),
 ],{
  question,enabledTools:['memory.search','memory.read','math.calculate'],builtinPackages:[...builtinPackages,readPackage,calculatorPackage],maxToolCalls:null,
  search:async query=>{calls.push(['search',query]);return notes.map(note=>({noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path}));},
  views:async()=>notes,
 });
 let generated=0;const plan=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return plan(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read','memory.read','math.calculate']);
 assert.deepEqual(result.calls.slice(1,3).map(call=>call.arguments.query),['alpine-id','birch-id']);
 assert.deepEqual(operations.map(item=>item.tool).filter(tool=>tool!=='dialogue.plan'),['memory.search','memory.read','memory.read','math.calculate']);
 assert.equal(generated,3,'the exact read batch is selected after search without another planner inference');
 assert.deepEqual(agentEvidenceFromCalls(result.calls).map(ref=>ref.noteId),['alpine-id','birch-id']);
});

test('Japanese comparison batches exact file reads after separate successful searches',async()=>{
 const question='保存した Test-reserve.md と Test-reserve-second.md を探して読み、集合場所と飲料水の量を比較してください。';
 const notes=[
  {id:'reserve-a',path:'Notes/Test-reserve.md',version:1,body:'Meeting point: North gate. Water: 17 litres.'},
  {id:'reserve-b',path:'Notes/Test-reserve-second.md',version:2,body:'Meeting point: East shelter. Water: 29 litres.'},
 ];
 const {value,calls,operations}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'Test-reserve.md'})}),
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'Test-reserve-second.md'})}),
 ],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
  search:async query=>{calls.push(['search',query]);const note=notes.find(value=>value.path.endsWith(query));return note?[{noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path.split('/').at(-1).replace(/\.md$/,''),path:note.path}]:[];},
  views:async()=>notes,
 });
 let generated=0;const generate=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.search','memory.read','memory.read']);
 assert.deepEqual(result.calls.slice(2).map(call=>call.arguments.query),['reserve-a','reserve-b']);
 assert.deepEqual(agentEvidenceFromCalls(result.calls).map(ref=>ref.noteId),['reserve-a','reserve-b']);
 assert.equal(generated,2,'the host combines successful named-file search results and skips the redundant planner inference');
});

test('separate searches do not make a multi-file answer complete when a named source is missing',async()=>{
 const question='Find alpha.md, beta.md and gamma.md. Compare all three and cite them.';
 const notes=[{id:'alpha-id',path:'Notes/alpha.md',version:1,body:'Alpha.'},{id:'beta-id',path:'Notes/beta.md',version:1,body:'Beta.'}];
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'alpha.md'})}),
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'beta.md'})}),
  JSON.stringify({action:'answer',query:question,target:'knowledge'}),
 ],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
  search:async query=>{const note=notes.find(value=>value.path.endsWith(query));return note?[{noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path}]:[];},views:async()=>notes});
  let generated=0;const generate=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.search','memory.read','memory.read']);
 assert.equal(generated,3,'the model gets another planning step because gamma.md was not found or read');
});

test('compound comparison selects grounded answer after every explicitly named source is fully read',async()=>{
 const question='Find the saved notes QA Alpine water plan and QA Birch water plan. Compare their approaches and cite both files.';
 const notes=[
  {id:'alpine-id',path:'Notes/QA Alpine water plan.md',version:1,body:'Alpine plan: store sealed water at the north shelter.'},
  {id:'birch-id',path:'Notes/QA Birch water plan.md',version:2,body:'Birch plan: rotate water stores at the east shelter.'},
 ];
 const {value,calls}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'QA Alpine water plan QA Birch water plan'})}),
 ],{
  question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
  search:async query=>{calls.push(['search',query]);return notes.map(note=>({noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path}));},
  views:async()=>notes,
 });
 let generated=0;const plan=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return plan(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(result.final.target,'knowledge');
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read','memory.read']);
 assert.deepEqual(result.calls.slice(1).map(call=>call.arguments.query),['alpine-id','birch-id']);
 assert.deepEqual(agentEvidenceFromCalls(result.calls).map(ref=>ref.noteId),['alpine-id','birch-id']);
 assert.equal(generated,1,'the model selects the search; the host skips only the redundant post-read planner call');
});

test('compound comparison returns to model planning if a named file is absent from search results',async()=>{
 const question='Find alpha.md, beta.md and gamma.md. Compare them and cite all three files.';
 const notes=[{id:'alpha-id',path:'Notes/alpha.md',version:1,body:'Alpha.'},{id:'beta-id',path:'Notes/beta.md',version:1,body:'Beta.'}];
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'alpha beta gamma'})}),
  JSON.stringify({action:'answer',query:question,target:'knowledge'}),
 ],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
  search:async()=>notes.map(note=>({noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path})),views:async()=>notes});
 let generated=0;const generate=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read','memory.read']);
 assert.equal(generated,2,'missing gamma requires another model planning step');
});

test('comparison with a save request keeps the full task with the planner in either clause order',async()=>{
 for(const question of ['Find alpha.md and beta.md. Compare them. Save the result as a new note.','Find alpha.md and beta.md. Save a new note in which you compare them.','alpha.md と beta.md を比較し、結果を新しいノートに保存して。','alpha.md と beta.md から新しいノートを作成して、違いを説明して。']){
  const notes=[{id:'alpha-id',path:'Notes/alpha.md',version:1,body:'Alpha.'},{id:'beta-id',path:'Notes/beta.md',version:1,body:'Beta.'}];
  const {value}=input([
   JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'alpha beta'})}),
   JSON.stringify({action:'capture',query:question,body:'Comparison draft'}),
  ],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
   search:async()=>notes.map(note=>({noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path})),views:async()=>notes});
  let generated=0;const generate=value.engine.generate;value.engine.generate=async(...args)=>{generated++;return generate(...args);};
  const result=await coordinateAgentTurn(value);
  assert.equal(result.final.action,'capture',question);assert.equal(generated,2,question);
 }
});

test('a completed search and read cannot skip a requested save',async()=>{
 const note={id:'workshop-id',path:'Notes/workshop.md',version:1,body:'The workshop starts at 10:00.'};
 for(const question of ['Search Memory, read the workshop note, tell me the start time and save it as a new note.','Search Memory and save a new note after you read the workshop note and tell me the start time.','メモリーを検索して、メモを読んで開始時刻を教えて、ノートに保存して。']){
  const {value}=input([
   JSON.stringify({action:'tool',query:'memory.search',body:'{"query":"workshop"}'}),
   JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.id})}),
   JSON.stringify({action:'capture',query:'workshop',body:'Workshop start time'}),
  ],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
   search:async()=>[{noteId:note.id,revision:1,start:0,end:note.body.length,quote:note.body,title:note.path}],views:async()=>[note]});
  const result=await coordinateAgentTurn(value);
  assert.equal(result.final.action,'capture',question);assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read']);
 }
});

test('a successful read exposes its canonical path for a later ranged read',async()=>{
 const note={id:'workshop-id',path:'Inbox/workshop.md',version:1,body:'A'.repeat(120)+'The workshop starts at 10:00.'};
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:'{"query":"workshop"}'}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.id,start:0,length:120})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.path,start:120,length:120})}),
  JSON.stringify({action:'capture',query:'workshop',body:'Workshop start time'}),
 ],{question:'Search Memory and save a summary of the workshop.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
  search:async()=>[{noteId:note.id,revision:1,start:120,end:note.body.length,quote:note.body.slice(120),title:'Workshop'}],views:async()=>[note]});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read','memory.read']);
 assert.equal(result.calls[2].arguments.query,note.path);assert.equal(result.calls[2].result[0].excerpt,note.body.slice(120));assert.equal(result.final.action,'capture');
});

test('explicit search-read-answer does not guess between multiple search hits',async()=>{
 const rows=[{noteId:'water-a',revision:1,start:0,end:5,quote:'first',title:'Notes/water-a.md'},{noteId:'water-b',revision:2,start:0,end:6,quote:'second',title:'Notes/water-b.md'}];
 let resolves=0;
 const {value,calls}=input([
  JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'water reserve'})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:'first'})}),
  JSON.stringify({action:'answer',query:'water amount',target:'knowledge'}),
 ],{question:'Search local Memory for my water reserve note, read the exact file, then tell me its amount.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],search:async query=>{calls.push(['search',query]);return rows;},views:async()=>{resolves++;return [];}});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(calls,[['search','water reserve']]);assert.equal(resolves,0,'an unverified quote was not passed to memory.read');assert.equal(result.calls.length,1);
});

test('search and tell-me requests read the unique source before answering',async()=>{
 const note={id:'maple-id',path:'Inbox/Harness QA 29 Oct.md',version:1,body:'Test marker: MAPLE-6204. Meeting place is the north entrance.'};
 for(const question of [
  'Search Memory for test marker MAPLE-6204 and tell me where the meeting place is.',
  'Find my saved file Harness QA 29 Oct and tell me its exact test marker.',
  'Busca en la memoria el lugar de la reunión y dime dónde está.',
  'Cherche dans la mémoire le lieu de réunion et dis-moi où il est.',
  '在记忆中搜索会议地点并告诉我。',
 ]){
  const {value,calls}=input([
   JSON.stringify({action:'search',query:'test marker MAPLE-6204'}),
   JSON.stringify({action:'answer',query:'The meeting place is the north entrance.',target:'knowledge'}),
  ],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,
   search:async query=>{calls.push(['search',query]);return [{noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path}];},
   views:async()=>[note],
  });
  const result=await coordinateAgentTurn(value);
  assert.equal(result.final.action,'answer',question);assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.read'],question);assert.equal(result.final.query,question,'the normal grounded answer stage receives the original user request');
  assert.deepEqual(result.calls[1].arguments,{query:'maple-id'});
  assert.deepEqual(agentEvidenceFromCalls(result.calls).map(ref=>[ref.noteId,ref.revision]),[['maple-id',1]]);
 }
});

test('agent can continue reading a long file in exact cited ranges',async()=>{
 const note={id:'long-4',path:'Notes/long.md',version:7,body:'x'.repeat(5_000)};
 const {value}=input([
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.path,start:0,length:3_000})}),
  JSON.stringify({action:'tool',query:'memory.read',body:JSON.stringify({query:note.path,start:3_000,length:3_000})}),
  JSON.stringify({action:'answer',query:'report what the full record says',target:'knowledge'}),
 ],{question:'Read Notes/long.md and inspect all of it.',enabledTools:['memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,views:async()=>[note]});
 const result=await coordinateAgentTurn(value),refs=agentEvidenceFromCalls(result.calls);
 assert.equal(result.calls.length,2);assert.deepEqual(refs.map(ref=>[ref.noteId,ref.revision,ref.start,ref.end]),[['long-4',7,0,3_000],['long-4',7,3_000,5_000]]);
});

test('an attachment scope retains profile-selected local tools for model choice',async()=>{
 let sourceReads=0,runtimePreparations=0;
 const packages=[...builtinPackages,calculatorPackage];
 const {value,calls,operations}=input([
  '{"action":"tool","query":"math.calculate","body":"{\\"expression\\":\\"(1200 + 800) / 4\\"}"}',
  '{"action":"answer","query":"the checked total","target":"inputs"}',
 ],{enabledTools:['math.calculate','memory.search'],builtinPackages:packages,attachments:[{name:'budget.pdf',kind:'pdf',status:'Read'}],readToolSources:async()=>{sourceReads++;return [];},ensureCustomRuntime:async()=>{runtimePreparations++;}});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.final,{action:'answer',query:'the checked total',target:'inputs'});
 assert.deepEqual(result.calls.map(call=>call.tool),['math.calculate']);
 assert.deepEqual(calls,[]);assert.equal(sourceReads,1);assert.equal(runtimePreparations,0);
 assert.deepEqual(operations.map(item=>item.tool),['dialogue.plan','math.calculate','dialogue.plan']);
 assert.deepEqual(operations[0].details.activeToolIds,['memory.search','math.calculate']);
});

test('a request with an open file can use configured Memory search before answering',async()=>{
 const {value,calls}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"answer","query":"compare both","target":"file"}',
 ],{enabledTools:['memory.search'],context:context({id:'file-1',revision:1,path:'Notes/meeting.md'})});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(result.calls.map(call=>call.tool),['memory.search']);
 assert.deepEqual(calls,[['search','meeting']]);
});

test('a registered adapter failure becomes safe planner feedback and the model may recover with another call',async()=>{
 let operations=0;
 const pkg={...builtinPackages[0],run:async(args,host)=>{operations++;if(operations===1)throw Error('private path: local storage quota unavailable');return host.search(args.query);}};
 const {value,calls}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting elsewhere\\"}"}',
  '{"action":"answer","query":"meeting","target":"knowledge"}',
 ],{builtinPackages:[pkg],maxToolCalls:4});
 const prompts=[],receipts=[],generate=value.engine.generate;
 value.engine.generate=async(...args)=>{prompts.push(args[0]);return generate(...args);};
 value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>{receipts.push(row);},project);
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(operations,2);
 assert.deepEqual(calls,[['search','meeting elsewhere']]);assert.equal(result.calls.length,1);
 assert.match(JSON.stringify(prompts[1]),/tool_execution/);
 assert.doesNotMatch(JSON.stringify(prompts),/private path|quota unavailable/);
 assert.equal(receipts.filter(row=>row.tool==='memory.search'&&row.status==='failed')[0].error.code,'tool_execution');
 assert.equal(receipts.filter(row=>row.tool==='memory.search'&&row.status==='succeeded').length,1);
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
 const {value,calls}=input(['a','b','c','d'].map(key=>JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({[key]:true})})));
 await assert.rejects(coordinateAgentTurn(value),/optional call limit/i);
 assert.deepEqual(calls,[]);
});

test('an over-budget read is refused while completed source evidence returns as a partial answer plan',async()=>{
 const {value,calls}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"second source\\"}"}',
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"must not execute\\"}"}',
 ],{maxToolCalls:2});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(result.budgetExhausted,true);assert.equal(result.calls.length,2);
 assert.deepEqual(calls,[['search','meeting'],['search','second source']]);
});

test('an over-budget filename-only result cannot be promoted to a grounded partial answer',async()=>{
 const plans=Array(2).fill('{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}');
 const {value,calls}=input(plans,{maxToolCalls:1,search:async query=>{calls.push(['search',query]);return [{kind:'file',noteId:'meeting',revision:1,path:'Notes/meeting.md'}];}});
 await assert.rejects(coordinateAgentTurn(value),/useful evidence/i);
 assert.deepEqual(calls,[['search','meeting']]);
});

test('an unrevealed custom-tool call gets one safe replan and never prepares a runtime',async()=>{
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
 assert.equal(result.final.action,'answer');assert.equal(prepared,0);assert.deepEqual(result.calls,[]);assert.deepEqual(result.customEvidence,[]);
 assert.match(JSON.stringify(prompts[1]),/previous plan named a custom tool.*rejected without execution/i);assert.doesNotMatch(JSON.stringify(prompts),/private-runtime-path/);
});

test('deferred native custom tools cannot execute before their local guide is read',async()=>{
 const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
 const files=createCustomToolPackageFiles({id:'user.lookup',title:'Lookup',instructions:'Search local notes.',code:'({input})=>({value:input.query})',capabilities:['memory.search']});
 let prepared=0;const messages=[],plans=[JSON.stringify({action:'tool',query:'user.lookup',body:JSON.stringify({query:'meeting'})}),JSON.stringify({action:'chat',query:''})];
 const nativeEngine={plannerProtocol:'native-tool-calls',manifest:{contextTokens:4096},count:async()=>({prompt_tokens:100}),generate:async value=>{messages.push(value);return {text:plans.shift()};}};
 const {value}=input([],{engine:nativeEngine,enabledTools:['memory.search','user.lookup'],readToolSources:async()=>files,ensureCustomRuntime:async()=>{prepared++;},maxToolCalls:null});
 assert.equal((await coordinateAgentTurn(value)).final.action,'chat');
 assert.equal(prepared,0);
 assert.match(JSON.stringify(messages[1]),/custom tool whose schema was not offered/);
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

test('adapter-thrown input errors are execution failures, never preflight argument correction',async()=>{
 let generations=0;
 const {value}=input([
  '{"action":"tool","query":"memory.search","body":"{\\"query\\":\\"meeting\\"}"}',
  '{"action":"answer","query":"meeting","target":"knowledge"}',
 ],{
  builtinPackages:[{...builtinPackages[0],run:async()=>{throw new AgentToolInputError();}}],
 });
 const prompts=[],generate=value.engine.generate;value.engine.generate=async(...args)=>{generations++;prompts.push(args[0]);return generate(...args);};
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.equal(generations,2);
 assert.match(JSON.stringify(prompts[1]),/tool_execution/);assert.doesNotMatch(JSON.stringify(prompts[1]),/invalid_tool_input/);
});

test('compound comparison reads three explicitly named sources before synthesis',async()=>{
 const question='Find notes QA Alpine water plan, QA Birch water plan, and QA Cedar water plan. Compare them and cite all three files.';
 const notes=['Alpine','Birch','Cedar'].map((name,i)=>({id:'note-'+i,path:`Notes/QA ${name} water plan.md`,version:1,body:`${name} water storage plan.`}));
 const {value}=input([JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'water plan'})})],{question,enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,search:async()=>notes.map(n=>({noteId:n.id,revision:n.version,start:0,end:n.body.length,quote:n.body,title:n.path})),views:async()=>notes});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.final.action,'answer');assert.deepEqual(result.calls.map(c=>c.tool),['memory.search','memory.read','memory.read','memory.read']);
 assert.deepEqual(agentEvidenceFromCalls(result.calls).map(ref=>ref.noteId),notes.map(n=>n.id));
});

test('separate searches keep earlier discovered files readable during one comparison',async()=>{
 const notes=[{id:'first-id',path:'Notes/first.md',version:1,body:'First source.'},{id:'second-id',path:'Notes/second.md',version:1,body:'Second source.'}];
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
 const {value}=input([action('memory.search',{query:'first topic'}),action('memory.search',{query:'second topic'}),action('memory.read',{query:'first-id'}),action('memory.read',{query:'second-id'}),JSON.stringify({action:'answer',query:'Compare the sources',target:'knowledge'})],{question:'Compare information on the two topics.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,search:async query=>{const note=notes[query==='first topic'?0:1];return [{noteId:note.id,revision:note.version,start:0,end:note.body.length,quote:note.body,title:note.path}];},views:async()=>notes});
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search','memory.search','memory.read','memory.read']);
 assert.deepEqual(result.calls.slice(2).map(call=>call.arguments.query),['first-id','second-id']);
});

test('planner can read a sixth search match using its returned identity',async()=>{
 const notes=Array.from({length:6},(_,i)=>({id:`note-${i}`,path:`Notes/${i}.md`,version:1,body:`Source ${i}.`}));
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
 const {value}=input([action('memory.search',{query:'source'}),action('memory.read',{query:'note-5'}),JSON.stringify({action:'answer',query:'Summarize',target:'knowledge'})],{question:'Find information in the saved sources.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,search:async()=>notes.map(n=>({noteId:n.id,revision:n.version,start:0,end:n.body.length,quote:n.body,title:n.path})),views:async()=>notes});
 const result=await coordinateAgentTurn(value);
 assert.equal(result.calls[0].result.length,6);
 assert.equal(result.calls[1].arguments.query,'note-5');
 assert.deepEqual(agentEvidenceFromCalls(result.calls).filter(ref=>ref.noteId==='note-5').map(ref=>ref.quote),['Source 5.']);
});

test('search keeps six identities inside a small budget and allows the sixth exact read',async()=>{
 const notes=Array.from({length:6},(_,i)=>({id:`note-${i}`,path:`Notes/${i}.md`,version:1,body:'x'.repeat(400)}));
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
 const {value}=input([action('memory.search',{query:'topic'}),action('memory.read',{query:'note-5',length:40}),JSON.stringify({action:'answer',query:'topic',target:'knowledge'})],{question:'Find information in the saved sources.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,maxResultChars:1000,search:async()=>notes.map(n=>({noteId:n.id,revision:1,start:0,end:n.body.length,quote:n.body,title:n.path})),views:async()=>notes});
 const receipts=[];value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 const result=await coordinateAgentTurn(value);
 assert.equal(result.calls[0].result.length,6);assert.ok(JSON.stringify(result.calls[0].result).length<=1000);
 assert.equal(result.calls[1].arguments.query,'note-5');assert.equal(receipts.find(row=>row.tool==='memory.search'&&row.status==='succeeded').output.length,6);
});

test('oversized read is recorded as failed before planner retries a narrower source',async()=>{
 const notes=Array.from({length:4},(_,i)=>({id:`id-${i}`,path:`Notes/${i}/same.md`,version:1,body:'x'.repeat(400)}));
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
 const {value}=input([action('memory.read',{query:'same.md'}),action('memory.read',{query:'Notes/0/same.md',length:100}),JSON.stringify({action:'answer',query:'Summarize',target:'knowledge'})],{question:'Read same.md, then Notes/0/same.md.',enabledTools:['memory.read'],builtinPackages:[readPackage],maxToolCalls:null,maxResultChars:1000,views:async()=>notes});
 const receipts=[];value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 const result=await coordinateAgentTurn(value);const reads=receipts.filter(row=>row.tool==='memory.read'&&row.status!=='running');
 assert.deepEqual(reads.map(row=>row.status),['failed','succeeded']);assert.equal(reads[0].error.code,'result_too_large');
 assert.deepEqual(result.calls.map(call=>call.arguments.query),['Notes/0/same.md']);
});

test('an omitted oversized search does not authorize reading its hidden matches',async()=>{
 const notes=Array.from({length:4},(_,i)=>({id:`hidden-${i}`,path:`Notes/${i}.md`,version:1,body:'x'.repeat(400)}));
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});let views=0;
 const {value}=input([action('memory.search',{query:'topic'}),action('memory.read',{query:'hidden-0'}),JSON.stringify({action:'answer',query:'topic',target:'knowledge'})],{question:'Find information about the topic.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],maxToolCalls:null,maxResultChars:1000,search:async()=>notes.map(n=>({noteId:n.id,revision:1,start:0,end:n.body.length,quote:n.body,title:'x'.repeat(240)})),views:async()=>{views++;return notes;}});
 const receipts=[];value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
 await coordinateAgentTurn(value);
 assert.equal(receipts.find(row=>row.tool==='memory.search'&&row.status==='failed').error.code,'result_too_large');
 assert.equal(views,0);
});

test('real QuickJS custom tool failure discards observed evidence and a changed retry succeeds',async()=>{
 const {Worker:NodeWorker}=await import('node:worker_threads');
 const prior=globalThis.Worker;
 class BrowserWorkerShim {
  constructor(url){
   const code=`import {parentPort} from 'node:worker_threads';const queue=[];globalThis.postMessage=value=>parentPort.postMessage(value);parentPort.on('message',value=>globalThis.onmessage?globalThis.onmessage({data:value}):queue.push(value));await import(${JSON.stringify(String(url))});for(const value of queue)globalThis.onmessage({data:value});`;
   this.worker=new NodeWorker(new URL('data:text/javascript,'+encodeURIComponent(code)),{type:'module'});
   this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',error=>this.onerror?.({message:error.message,preventDefault(){}}));
  }
  postMessage(value){this.worker.postMessage(value);}terminate(){void this.worker.terminate();}
 }
 globalThis.Worker=BrowserWorkerShim;
 try{
  const {createCustomToolPackageFiles}=await import('../src/custom-tool-package.ts');
  const files=createCustomToolPackageFiles({id:'user.lookup',title:'Lookup',instructions:'Look up a local record.',capabilities:['memory.read'],code:'({input,capabilities})=>{const value=capabilities.memoryRead(input.query==="fail"?"note-fail":"note-ok")[0].body;if(input.query==="fail")throw Error("controlled");return {value};}'});
  const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
  const {value}=input([action('tools.search',{query:'lookup'}),action('tools.read-skill',{id:'user.lookup'}),action('user.lookup',{query:'fail'}),action('user.lookup',{query:'ok'}),JSON.stringify({action:'answer',query:'notes',target:'knowledge'})],{question:'Look up the saved record.',enabledTools:['user.lookup'],builtinPackages:[],readToolSources:async()=>files,maxToolCalls:null,views:async()=>[{id:'note-fail',path:'Notes/fail.md',version:1,body:'Failed observation.'},{id:'note-ok',path:'Notes/source.md',version:1,body:'Verified original.'}]});
  const receipts=[];value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>receipts.push(row),project);
  const result=await coordinateAgentTurn(value);
  assert.deepEqual(receipts.filter(row=>row.tool==='user.lookup'&&row.status!=='running').map(row=>row.status),['failed','succeeded']);
  assert.deepEqual(result.customEvidence.map(ref=>({noteId:ref.noteId,quote:ref.quote})),[{noteId:'note-ok',quote:'Verified original.'}]);
  assert.deepEqual(result.calls.filter(call=>call.tool==='user.lookup').map(call=>call.arguments.query),['ok']);
  const oversizedFiles=createCustomToolPackageFiles({id:'user.lookup',title:'Lookup',instructions:'Look up a local record.',capabilities:['memory.read'],code:'({input,capabilities})=>{const value=capabilities.memoryRead(input.query==="large"?"note-fail":"note-ok")[0].body;return {value:input.query==="large"?"x".repeat(1500):value};}'});
  const second=input([action('tools.search',{query:'lookup'}),action('tools.read-skill',{id:'user.lookup'}),action('user.lookup',{query:'large'}),action('user.lookup',{query:'ok'}),JSON.stringify({action:'answer',query:'notes',target:'knowledge'})],{question:'Look up the saved record.',enabledTools:['user.lookup'],builtinPackages:[],readToolSources:async()=>oversizedFiles,maxToolCalls:null,maxResultChars:1000,views:async()=>[{id:'note-fail',path:'Notes/fail.md',version:1,body:'Oversized observation.'},{id:'note-ok',path:'Notes/source.md',version:1,body:'Verified original.'}]});
  const secondReceipts=[];second.value.trace=(tool,details,work,project)=>recordOperation(tool,details,work,async row=>secondReceipts.push(row),project);
  const secondResult=await coordinateAgentTurn(second.value);
  const attempts=secondReceipts.filter(row=>row.tool==='user.lookup'&&row.status!=='running');
  assert.deepEqual(attempts.map(row=>row.status),['failed','succeeded']);assert.equal(attempts[0].error.code,'result_too_large');
  assert.deepEqual(secondResult.customEvidence.map(ref=>({noteId:ref.noteId,quote:ref.quote})),[{noteId:'note-ok',quote:'Verified original.'}]);
  // The native planner must receive the same successful host observation,
  // bound to its actual attempt after a failed call, rather than raw custom IDs.
  // ChatEngine receives the runtime-normalized action/query/body envelope.
  const native=input([action('tools.search',{query:'lookup'}),action('tools.read-skill',{id:'user.lookup'}),action('user.lookup',{query:'fail'}),action('user.lookup',{query:'ok'}),JSON.stringify({action:'answer',reply:{status:'answered',answer:'Verified original.',sources:['S1']}})],{question:'Look up the saved record.',enabledTools:['user.lookup'],builtinPackages:[],readToolSources:async()=>files,maxToolCalls:null,views:async()=>[{id:'note-fail',path:'Notes/fail.md',version:1,body:'Failed observation.'},{id:'note-ok',path:'Notes/source.md',version:1,body:'Verified original.'}]});
  native.value.engine.plannerProtocol='native-tool-calls';
  const nativeGenerate=native.value.engine.generate,seen=[];
  native.value.engine.generate=async(messages,budget,format)=>{seen.push({messages,format});return nativeGenerate(messages,budget,format);};
  const nativeResult=await coordinateAgentTurn(native.value);
  assert.deepEqual(nativeResult.final.reply,{answer:'Verified original.',sources:[{noteId:'note-ok',revision:1,start:0,end:18,quote:'Verified original.',title:'Notes/source.md'}]});
  const finalPrompt=seen.at(-1),observation=JSON.parse(finalPrompt.messages.filter(m=>m.role==='tool'&&m.name==='user.lookup').at(-1).content);
  assert.deepEqual(observation.result,{value:'Verified original.'});
  assert.deepEqual(observation.originals.map(ref=>({noteId:ref.noteId,source:ref.source})),[{noteId:'note-ok',source:'S1'}]);
  assert.doesNotMatch(JSON.stringify(finalPrompt.messages),/Failed observation/);
  assert.deepEqual(finalPrompt.format.tools.find(tool=>tool.function.name==='finish_answer').function.parameters.properties.reply.properties.sources.items.enum,['S1']);
 }finally{if(prior===undefined)delete globalThis.Worker;else globalThis.Worker=prior;}
});


test('mixed native finish calls receive one precise host-authored repair without executing their payload',async()=>{
 const {value,calls}=input([],{question:'Find the meeting note.'});let generations=0;
 value.engine.plannerProtocol='native-tool-calls';value.engine.generate=async messages=>{
  if(++generations===1)throw new PlannerOutputError('Final plan cannot be mixed with tool calls','UNTRUSTED MODEL PAYLOAD','native-final-mixed');
  assert.match(messages.at(-1).content,/nothing was executed/);assert.match(messages.at(-1).content,/only those read tools now/);assert.doesNotMatch(JSON.stringify(messages),/UNTRUSTED MODEL PAYLOAD/);
  throw new PlannerOutputError('Final plan cannot be mixed with tool calls','UNTRUSTED MODEL PAYLOAD','native-final-mixed');
 };
 await assert.rejects(coordinateAgentTurn(value),/Final plan cannot be mixed/);assert.equal(generations,2);assert.deepEqual(calls,[]);
});

test('native agents choose their next operation after search instead of legacy automatic reads',async()=>{
 const action=(tool,args)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
 const {value,calls}=input([action('memory.search',{query:'meeting'}),JSON.stringify({action:'answer',reply:{status:'answered',answer:'Meet Monday.',sources:['S1']}})],{question:'Search Memory and tell me when the meeting is.',enabledTools:['memory.search','memory.read'],builtinPackages:[...builtinPackages,readPackage],search:async()=>[{noteId:'note-a',revision:1,path:'Notes/meeting.md',quote:'Meet Monday.',start:0,end:12}]});
 value.engine.plannerProtocol='native-tool-calls';
 const result=await coordinateAgentTurn(value);
 assert.deepEqual(result.calls.map(call=>call.tool),['memory.search']);
 assert.equal(result.final.reply.answer,'Meet Monday.');
 assert.equal(calls.some(call=>call[0]==='read'),false);
});
