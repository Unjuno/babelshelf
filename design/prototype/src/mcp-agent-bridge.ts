import {Client} from '@modelcontextprotocol/client';
import {createLocalMcpServer} from './mcp-local-adapter.ts';
import type {AgentToolCall,AgentToolCapability} from './agent-loop.ts';

/** An in-memory MCP connection for one agent turn. The registered callback is
 * the already-audited host operation, never a tool package's raw entry point. */
export async function createAgentMcpBridge(tools:readonly AgentToolCapability[],signal:AbortSignal){
 signal.throwIfAborted();
 let active:{tool:string;args:string;work:(signal:AbortSignal)=>Promise<unknown>;failure?:unknown}|undefined;
 const server=createLocalMcpServer({tools,invoke:async(id,args,requestSignal)=>{
  const current=active;if(!current||current.tool!==id||current.args!==JSON.stringify(args))throw Error('MCP operation unavailable');
  try{return await current.work(requestSignal);}catch(error){current.failure=error;throw error;}
 }});
 const client=new Client({name:'BabelShelf agent',version:'1.0.0'});
 try{await client.connect(await server.connect());signal.throwIfAborted();}
 catch(error){await client.close().catch(()=>{});await server.close().catch(()=>{});throw error;}
 return Object.freeze({
  async call(call:AgentToolCall,work:(signal:AbortSignal)=>Promise<unknown>){
   signal.throwIfAborted();if(active)throw Error('Concurrent MCP operation unavailable');
   const current={tool:call.tool,args:JSON.stringify(call.arguments),work,failure:undefined as unknown};active=current;
   try{
    const response=await client.callTool({name:call.tool,arguments:call.arguments},{signal});signal.throwIfAborted();
    if(response.isError){if(current.failure!==undefined)throw current.failure;throw Error('MCP tool execution failed');}
    if(!Array.isArray(response.content)||response.content.length!==1||response.content[0]?.type!=='text'||typeof response.content[0].text!=='string')throw Error('Invalid MCP tool result');
    return JSON.parse(response.content[0].text);
   }finally{active=undefined;}
  },
  async close(){try{await client.close();}finally{await server.close();}},
 });
}
