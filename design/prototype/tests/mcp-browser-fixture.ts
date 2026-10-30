import {Client} from '@modelcontextprotocol/client';
import {createLocalMcpServer} from '../src/mcp-local-adapter.ts';
import '../src/mcp-agent-bridge.ts';
import {coordinateAgentTurn} from '../src/agent-coordinator.ts';
import {captureTurnExecutionSnapshot} from '../src/turn-execution-snapshot.ts';
import {recordOperation} from '../src/harness-activity.ts';
import * as calculate from '../src/tools/math.calculate/tool.ts';
import * as search from '../src/tools/memory.search/tool.ts';
import * as read from '../src/tools/memory.read/tool.ts';
import * as sourceTool from '../src/tools/memory.sources/tool.ts';
import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {agentEvidenceFromCalls} from '../src/agent-evidence.ts';
// @ts-expect-error Shared canonical store is JavaScript.
import {createNote} from '../../../dist/core.js';

Object.assign(window,{mcpBrowserFixture:async()=>{
 const server=createLocalMcpServer({tools:[{id:'math.calculate',effect:'read',network:'none',inputSchema:{type:'object',required:['value'],additionalProperties:false,properties:{value:{type:'number'}}}}],invoke:async(_id,args)=>({result:Number(args.value)*2})});
 const client=new Client({name:'browser-fixture',version:'1'});
 try{await client.connect(await server.connect());const listed=await client.listTools(),result=await client.callTool({name:'math.calculate',arguments:{value:21}});return {names:listed.tools.map(tool=>tool.name),result};}
 finally{await client.close();await server.close();}
}});
Object.assign(window,{mcpAgentFixture:async()=>{
 const plans=[JSON.stringify({action:'tool',query:'math.calculate',body:JSON.stringify({expression:'6*7'})}),JSON.stringify({action:'answer',query:'Calculate 6*7',target:'knowledge'})],activities:any[]=[];
 const pkg={...calculate,entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate.'},{path:'Tools/math.calculate/tool.ts',body:'Bundled calculator.'}]};
 const snapshot=captureTurnExecutionSnapshot({turnId:'mcp-browser',textModel:'test',textManifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test',label:'Test',enabledTools:['math.calculate'],maxToolCalls:3,maxResultChars:8000},replyStyle:'balanced',userGuidance:'',attachments:[]});
 const result=await coordinateAgentTurn({snapshot,model:'test',question:'Calculate 6*7',context:{summary:'',recent:[],refs:[],turnCount:0},attachments:[],builtinPackages:[pkg],readToolSources:async()=>[],search:async()=>[],views:async()=>[],ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,engine:{manifest:{contextTokens:4096},count:async()=>({prompt_tokens:50}),generate:async()=>({text:plans.shift()??'{}'})},trace:(tool,input,work,project)=>recordOperation(tool,input,work,async event=>{activities.push(event);},project)});
 return {calls:result.calls,activities:activities.filter(event=>event.tool==='math.calculate').map(event=>event.status)};
}});
Object.assign(window,{mcpMemoryFixture:async()=>{
 const name='mcp-memory-qa-'+crypto.randomUUID(),store=new KnowledgeStore(name),activities:any[]=[];
 try{
  await store.initialize([{id:'mcp-source',path:'Inbox/water.md',body:'Water reserve: 17 liters.',version:1,history:[]}]);
  const plans=[JSON.stringify({action:'tool',query:'memory.search',body:JSON.stringify({query:'water'})}),JSON.stringify({action:'answer',query:'water',target:'knowledge'})];
  const pkg={...search,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search.'},{path:'Tools/memory.search/tool.ts',body:'Bundled search.'}]};
  const snapshot=captureTurnExecutionSnapshot({turnId:'mcp-memory',textModel:'test',textManifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test',label:'Test',enabledTools:['memory.search'],maxToolCalls:3,maxResultChars:8000},replyStyle:'balanced',userGuidance:'',attachments:[]});
  const result=await coordinateAgentTurn({snapshot,model:'test',question:'Find water',context:{summary:'',recent:[],refs:[],turnCount:0},attachments:[],builtinPackages:[pkg],readToolSources:async()=>[],search:(query,signal)=>store.search(query,true,signal),views:signal=>store.views(signal),ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,engine:{manifest:{contextTokens:4096},count:async()=>({prompt_tokens:50}),generate:async()=>({text:plans.shift()??'{}'})},trace:(tool,input,work,project)=>recordOperation(tool,input,work,async event=>{activities.push(event);},project)});
  return {calls:result.calls,activities:activities.filter(event=>event.tool==='memory.search').map(event=>event.status)};
 }finally{store.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Temporary test database is blocked'));});}
}});
Object.assign(window,{mcpSourcesFixture:async()=>{
 const name='mcp-sources-qa-'+crypto.randomUUID(),store=new KnowledgeStore(name),activities:any[]=[];
 try{
  const body='Water reserve: 17 liters.';await store.initialize([{id:'source',path:'Inbox/source.md',body,version:1,history:[]}]);
  const before=await store.views(),ref={noteId:'source',revision:1,start:0,end:body.length,quote:body},summary=projectNote(createNote({path:'Inbox/summary.md',body:'Summary',kind:'generated',sources:[ref]}));
  await store.commit(before,[...before,summary]);
  const action=(tool:string,args:unknown)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)}),plans=[action('memory.sources',{id:summary.id,revision:1}),action('memory.read',{query:'source'}),JSON.stringify({action:'answer',query:'original',target:'knowledge'})];
  const pkg=(tool:any)=>({...tool,entry:`Tools/${tool.definition.id}/tool.ts`,sources:[{path:`Tools/${tool.definition.id}/SKILL.md`,body:'Local tool.'},{path:`Tools/${tool.definition.id}/tool.ts`,body:'Bundled implementation.'}]});
  const snapshot=captureTurnExecutionSnapshot({turnId:'mcp-sources',textModel:'test',textManifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test',label:'Test',enabledTools:['memory.sources','memory.read'],maxToolCalls:3,maxResultChars:8000},replyStyle:'balanced',userGuidance:'',attachments:[]});
  const result=await coordinateAgentTurn({snapshot,model:'test',question:'Find the original source.',context:{summary:'',recent:[],refs:[],turnCount:0},attachments:[],builtinPackages:[pkg(sourceTool),pkg(read)],readToolSources:async()=>[],search:(query,signal)=>store.search(query,true,signal),views:signal=>store.views(signal),records:signal=>store.all(signal),ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,engine:{manifest:{contextTokens:4096},count:async()=>({prompt_tokens:50}),generate:async()=>({text:plans.shift()??'{}'})},trace:(tool,input,work,project)=>recordOperation(tool,input,work,async event=>{activities.push(event);},project)});
  return {calls:result.calls,refs:agentEvidenceFromCalls(result.calls),completed:activities.filter(event=>event.status==='succeeded').map(event=>event.tool)};
 }finally{store.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Temporary test database is blocked'));});}
}});
Object.assign(window,{mcpComparisonFixture:async()=>{
 const name='mcp-comparison-qa-'+crypto.randomUUID(),store=new KnowledgeStore(name),activities:any[]=[];
 const bodies=['Water reserve: 17 liters.','Water reserve: 9 liters.','Water reserve: 24 liters.'];
 try{
  await store.initialize(bodies.map((body,i)=>({id:`source-${i}`,path:`Inbox/source-${i}.md`,body,version:1,history:[]})));
  const action=(tool:string,args:unknown)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)});
  const plans=[action('memory.search',{query:'water'}),...bodies.map((_,i)=>action('memory.read',{query:`source-${i}`})),JSON.stringify({action:'answer',query:'Compare water records',target:'knowledge'})];
  const pkg=(tool:any)=>({...tool,entry:`Tools/${tool.definition.id}/tool.ts`,sources:[{path:`Tools/${tool.definition.id}/SKILL.md`,body:'Local tool.'},{path:`Tools/${tool.definition.id}/tool.ts`,body:'Bundled implementation.'}]});
  const snapshot=captureTurnExecutionSnapshot({turnId:'mcp-comparison',textModel:'test',textManifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test',label:'Test',enabledTools:['memory.search','memory.read'],maxToolCalls:null,maxResultChars:8000},replyStyle:'balanced',userGuidance:'',attachments:[]});
  const result=await coordinateAgentTurn({snapshot,model:'test',question:'Compare my water records.',context:{summary:'',recent:[],refs:[],turnCount:0},attachments:[],builtinPackages:[pkg(search),pkg(read)],readToolSources:async()=>[],search:(query,signal)=>store.search(query,true,signal),views:signal=>store.views(signal),ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,engine:{manifest:{contextTokens:4096},count:async()=>({prompt_tokens:50}),generate:async()=>({text:plans.shift()??'{}'})},trace:(tool,input,work,project)=>recordOperation(tool,input,work,async event=>{activities.push(event);},project)});
  const sources=agentEvidenceFromCalls(result.calls.filter(call=>call.tool==='memory.read'));
  const answer='The water records list 17, 9 and 24 liters.';const before=await store.views(),draft=projectNote(createNote({path:'Inbox/comparison.md',body:answer,kind:'generated',sources}));
  // Test-controlled approval: persist exactly the proposed body and source pins.
  await store.commit(before,[...before,draft]);const saved=(await store.all()).find(note=>note.id===draft.id);
  return {calls:result.calls.map(call=>call.tool),sources,answer,savedBody:saved.revisions[0].body,savedSources:saved.sources,completed:activities.filter(event=>event.status==='succeeded'&&['memory.search','memory.read'].includes(event.tool)).map(event=>event.tool)};
 }finally{store.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Temporary test database is blocked'));});}
}});
Object.assign(window,{mcpCustomFixture:async()=>{
 const name='mcp-custom-qa-'+crypto.randomUUID(),store=new KnowledgeStore(name),activities:any[]=[];
 try{
  await store.initialize([{id:'custom-source',path:'Inbox/water.md',body:'Water reserve: 17 liters.',version:1,history:[]}]);
  const skill='---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch local notes.\n';
  const files=[{path:'Tools/user.lookup/SKILL.md',body:skill},{path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>capabilities.memorySearch(input.query)'}];
  const plans=[JSON.stringify({action:'tool',query:'user.lookup',body:JSON.stringify({query:'water'})}),JSON.stringify({action:'answer',query:'water',target:'knowledge'})];
  const snapshot=captureTurnExecutionSnapshot({turnId:'mcp-custom',textModel:'test',textManifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test',label:'Test',enabledTools:['user.lookup'],maxToolCalls:4,maxResultChars:8000},replyStyle:'balanced',userGuidance:'',attachments:[]});
  const result=await coordinateAgentTurn({snapshot,model:'test',question:'Use user.lookup to find water.',context:{summary:'',recent:[],refs:[],turnCount:0},attachments:[],builtinPackages:[],readToolSources:async()=>files,search:(query,signal)=>store.search(query,true,signal),views:signal=>store.views(signal),ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,engine:{manifest:{contextTokens:4096},count:async()=>({prompt_tokens:50}),generate:async()=>({text:plans.shift()??'{}'})},trace:(tool,input,work,project)=>recordOperation(tool,input,work,async event=>{activities.push(event);},project)});
  return {calls:result.calls.map(call=>call.tool),source:result.customEvidence.find(ref=>ref.noteId==='custom-source'),completed:activities.filter(event=>event.status==='succeeded'&&['tools.read-skill','user.lookup'].includes(event.tool)).map(event=>event.tool)};
 }finally{store.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Temporary test database is blocked'));});}
}});
Object.assign(window,{mcpCustomOverflowFixture:async()=>{
 const activities:any[]=[],skill='---\n{"id":"user.lookup","version":1,"title":"Lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\nSearch local notes.\n';
 const files=[{path:'Tools/user.lookup/SKILL.md',body:skill},{path:'Tools/user.lookup/tool.js',body:'({input,capabilities})=>{for(let i=0;i<6;i++)capabilities.memorySearch("batch-"+i);return {ok:true}}'}];
 const action=(tool:string,args:unknown)=>JSON.stringify({action:'tool',query:tool,body:JSON.stringify(args)}),plans=[action('memory.search',{query:'base'}),action('user.lookup',{query:'all'})];
 const pkg={...search,entry:'Tools/memory.search/tool.ts',sources:[{path:'Tools/memory.search/SKILL.md',body:'Search.'},{path:'Tools/memory.search/tool.ts',body:'Bundled search.'}]};
 const snapshot=captureTurnExecutionSnapshot({turnId:'mcp-custom-overflow',textModel:'test',textManifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},decisionModel:'',decisionIdentity:{model:'',revision:''},speechModel:'',ocrModel:'',visionModel:'',profile:{id:'test',label:'Test',enabledTools:['memory.search','user.lookup'],maxToolCalls:6,maxResultChars:8000},replyStyle:'balanced',userGuidance:'',attachments:[]});
 const result=await coordinateAgentTurn({snapshot,model:'test',question:'Use user.lookup for saved records.',context:{summary:'',recent:[],refs:[],turnCount:0},attachments:[],builtinPackages:[pkg],readToolSources:async()=>files,search:async query=>{const count=query==='base'?1:11;return Array.from({length:count},(_,i)=>({noteId:`${query}-${i}`,revision:1,start:0,end:3,quote:'one',title:`Notes/${query}-${i}.md`}));},views:async()=>[],ensureCustomRuntime:async()=>{},check:()=>{},signal:new AbortController().signal,engine:{manifest:{contextTokens:32000},count:async()=>({prompt_tokens:100}),generate:async()=>({text:plans.shift()??'{}'})},trace:(tool,input,work,project)=>recordOperation(tool,input,work,async event=>{activities.push(event);},project)});
 return {reason:result.budgetReason,partial:result.budgetExhausted,calls:result.calls.map(call=>call.tool),customEvidence:result.customEvidence,customStatus:activities.filter(event=>event.tool==='user.lookup').map(event=>event.status)};
}});
document.querySelector('#root')!.textContent='ready';
