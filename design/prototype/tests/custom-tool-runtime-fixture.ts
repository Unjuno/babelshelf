import {runCustomToolSource} from '../src/custom-tool-runtime';
import {buildActiveToolRegistry} from '../src/active-tool-registry';
import {builtinToolPackages} from '../src/tool-package-records';
import {KnowledgeStore} from '../src/knowledge-store';
import {runReadOnlyAgentLoop} from '../src/agent-loop';

type ToolHost=Parameters<Awaited<ReturnType<typeof buildActiveToolRegistry>>['registry']['run']>[2];
type ToolRecords=Parameters<typeof buildActiveToolRegistry>[0];
declare global{interface Window{customToolFixture:{run:(options:Parameters<typeof runCustomToolSource>[0])=>Promise<unknown>;registered:(records:ToolRecords,input:unknown,host:ToolHost)=>Promise<{result:unknown;allowed:string[]}>;agentRegistered:(records:ToolRecords)=>Promise<{final:unknown;calls:unknown[];planSteps:number}>;cancelDatabaseRead:()=>Promise<{aborted:boolean;error:string}>}}}
window.customToolFixture={run:runCustomToolSource,registered:async(records,input,host)=>{const active=await buildActiveToolRegistry(records,['user.lookup'],builtinToolPackages);return {result:await active.registry.run('user.lookup',input,host),allowed:active.capabilities.map(tool=>tool.id)};},agentRegistered:async(records)=>{
 const active=await buildActiveToolRegistry(records,['user.lookup'],builtinToolPackages),calls:unknown[]=[];let planSteps=0;
 const host:ToolHost={check(){},search:async(query:string)=>[{id:'meeting-1',path:`Notes/${query}.md`,version:2,body:'Monday at 10'}],resolve:async()=>{throw Error('undeclared read called');}};
 const result=await runReadOnlyAgentLoop({allowedTools:active.capabilities,maxToolCalls:3,check:host.check,plan:async(history)=>{planSteps++;return history.length?{kind:'final' as const,value:{evidence:history[0].result}}:{kind:'tool' as const,tool:'user.lookup',arguments:{query:'meeting'}};},execute:async(call)=>{const result=await active.registry.run(call.tool,call.arguments,host);calls.push({tool:call.tool,arguments:call.arguments,result});return result;}});
 return {final:result.final,calls,planSteps};
},cancelDatabaseRead:async()=>{
 const store=new KnowledgeStore('custom-tool-abort-test');let aborted=false;let transaction:any;
 store.open=async()=>({transaction:()=>{transaction={objectStore:()=>({getAll:()=>({})}),addEventListener:()=>{},abort:()=>{aborted=true;transaction.onabort?.();}};return transaction;}} as any);
 const controller=new AbortController(),pending=store.all(controller.signal);await new Promise(resolve=>setTimeout(resolve,0));controller.abort();
 try{await pending;return {aborted,error:'unexpected success'};}catch(error){return {aborted,error:String((error as Error).message)};}
}};
