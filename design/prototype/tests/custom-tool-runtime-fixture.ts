import {runCustomToolSource} from '../src/custom-tool-runtime';
import {buildActiveToolRegistry} from '../src/active-tool-registry';
import {builtinToolPackages} from '../src/tool-package-records';
import {KnowledgeStore} from '../src/knowledge-store';
import {runReadOnlyAgentLoop} from '../src/agent-loop';
import {projectAgentActivityResult} from '../src/agent-evidence';
import {recordOperation} from '../src/harness-activity';

type ToolHost=Parameters<Awaited<ReturnType<typeof buildActiveToolRegistry>>['registry']['run']>[2];
type ToolRecords=Parameters<typeof buildActiveToolRegistry>[0];
declare global{interface Window{customToolFixture:{run:(options:Parameters<typeof runCustomToolSource>[0])=>Promise<unknown>;registered:(records:ToolRecords,input:unknown,host:ToolHost)=>Promise<{result:unknown;allowed:string[]}>;agentRegistered:(records:ToolRecords,searchDelayMs?:number)=>Promise<{final:unknown;calls:unknown[];planSteps:number}>;agentRecoversOverflow:(records:ToolRecords)=>Promise<{final:unknown;attempts:unknown[];activityStatuses:{status:string;code?:string}[];planSteps:number;executions:number}>;cancelDatabaseRead:()=>Promise<{aborted:boolean;error:string}>}}}
window.customToolFixture={run:runCustomToolSource,registered:async(records,input,host)=>{const active=await buildActiveToolRegistry(records,['user.lookup'],builtinToolPackages);return {result:await active.registry.run('user.lookup',input,host),allowed:active.capabilities.map(tool=>tool.id)};},agentRegistered:async(records,searchDelayMs=0)=>{
 const active=await buildActiveToolRegistry(records,['user.lookup'],builtinToolPackages),calls:unknown[]=[];let planSteps=0;
 const host:ToolHost={check(){},search:async(query:string)=>{if(searchDelayMs)await new Promise(resolve=>setTimeout(resolve,searchDelayMs));return [{id:'meeting-1',path:`Notes/${query}.md`,version:2,body:'Monday at 10'}];},resolve:async()=>{throw Error('undeclared read called');}};
 const result=await runReadOnlyAgentLoop({allowedTools:active.capabilities,maxToolCalls:3,check:host.check,plan:async(history)=>{planSteps++;return history.length?{kind:'final' as const,value:{evidence:history[0].result}}:{kind:'tool' as const,tool:'user.lookup',arguments:{query:'meeting'}};},execute:async(call)=>{const result=await active.registry.run(call.tool,call.arguments,host);calls.push({tool:call.tool,arguments:call.arguments,result});return result;}});
 return {final:result.final,calls,planSteps};
},agentRecoversOverflow:async(records)=>{
 const active=await buildActiveToolRegistry(records,['user.lookup'],builtinToolPackages),activities=new Map<string,any>();let planSteps=0,executions=0;
 const host:ToolHost={check(){},search:async()=>[],resolve:async()=>[]};
 const result=await runReadOnlyAgentLoop({allowedTools:active.capabilities,check:host.check,plan:async history=>{
  planSteps++;
  if(!history.length)return {kind:'tool' as const,tool:'user.lookup',arguments:{length:9000}};
  if(history[0].error?.code==='result_too_large'&&history.length===1)return {kind:'tool' as const,tool:'user.lookup',arguments:{length:1000}};
  return {kind:'final' as const,value:{bodyLength:(history.at(-1)?.result as {body?:string}|undefined)?.body?.length??0}};
 },execute:call=>recordOperation(call.tool,call.arguments,async()=>{executions++;return active.registry.run(call.tool,call.arguments,host);},async activity=>{activities.set(activity.id,activity);},value=>projectAgentActivityResult(call.tool,value))});
 return {final:result.final,attempts:result.attempts,activityStatuses:[...activities.values()].map(activity=>({status:activity.status,...(activity.error?{code:activity.error.code}:{})})),planSteps,executions};
},cancelDatabaseRead:async()=>{
 const store=new KnowledgeStore('custom-tool-abort-test');let aborted=false;let transaction:any;
 store.open=async()=>({transaction:()=>{transaction={objectStore:()=>({getAll:()=>({})}),addEventListener:()=>{},abort:()=>{aborted=true;transaction.onabort?.();}};return transaction;}} as any);
 const controller=new AbortController(),pending=store.all(controller.signal);await new Promise(resolve=>setTimeout(resolve,0));controller.abort();
 try{await pending;return {aborted,error:'unexpected success'};}catch(error){return {aborted,error:String((error as Error).message)};}
}};
