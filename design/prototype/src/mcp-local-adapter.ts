import {InMemoryTransport,Server,type Tool} from '@modelcontextprotocol/server';
import {validateToolArguments,type ToolInputSchema} from './tools/tool-input.ts';
import type {AgentToolCapability} from './agent-loop.ts';

function validSchema(value:unknown):value is ToolInputSchema{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const schema=value as Record<string,unknown>,props=schema.properties;
 if(Object.keys(schema).some(k=>!['type','required','additionalProperties','properties'].includes(k))||schema.type!=='object'||schema.additionalProperties!==false||!Array.isArray(schema.required)||!props||typeof props!=='object'||Array.isArray(props))return false;
 const fields=props as Record<string,unknown>,names=Object.keys(fields);
 if(names.length>32||names.some(name=>!/^[a-z][a-zA-Z0-9_]{0,31}$/.test(name))||new Set(schema.required).size!==schema.required.length||schema.required.some(name=>typeof name!=='string'||!Object.hasOwn(fields,name)))return false;
 return Object.values(fields).every(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
  const field=raw as Record<string,unknown>,type=field.type;
  if(!['string','number','integer','boolean'].includes(String(type))||Object.keys(field).some(k=>!['type','description','minLength','maxLength','minimum','maximum'].includes(k)))return false;
  if(field.description!==undefined&&(typeof field.description!=='string'||field.description.length>1000))return false;
  if(type!=='string'&&(field.minLength!==undefined||field.maxLength!==undefined)||type!=='number'&&type!=='integer'&&(field.minimum!==undefined||field.maximum!==undefined))return false;
  if(['minLength','maxLength'].some(k=>field[k]!==undefined&&(!Number.isSafeInteger(field[k])||Number(field[k])<0))||['minimum','maximum'].some(k=>field[k]!==undefined&&(typeof field[k]!=='number'||!Number.isFinite(field[k]))))return false;
  return !(field.minLength!==undefined&&field.maxLength!==undefined&&Number(field.minLength)>Number(field.maxLength)||field.minimum!==undefined&&field.maximum!==undefined&&Number(field.minimum)>Number(field.maximum));
 });
}

/**
 * An in-process protocol adapter. `invoke` is the host's audited execution
 * boundary, not a package's raw run method. This adapter grants no new tools,
 * network access, write authority or approval; callers must supply that host.
 */
export function createLocalMcpServer(options:{
 tools:readonly AgentToolCapability[];
 invoke:(id:string,args:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>;
}){
 const tools=structuredClone(options.tools),invoke=options.invoke;
 if(typeof invoke!=='function'||new Set(tools.map(t=>t?.id)).size!==tools.length||tools.some(t=>!t||typeof t.id!=='string'||!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(t.id)||t.effect!=='read'||t.network!=='none'||!validSchema(t.inputSchema)))throw Error('Local MCP requires registered read-only tools with schemas');
 const byId=new Map(tools.map(tool=>[tool.id,tool]));
 const server=new Server({name:'BabelShelf local tools',version:'1.0.0'},{capabilities:{tools:{}}});
 server.setRequestHandler('tools/list',async()=>({tools:tools.map(tool=>({name:tool.id,description:tool.usage??'',inputSchema:tool.inputSchema as Tool['inputSchema']}))}));
 server.setRequestHandler('tools/call',async(request,context)=>{
  const tool=byId.get(request.params.name);
  if(!tool)return {content:[{type:'text',text:'Tool unavailable'}],isError:true};
  let args:Record<string,unknown>;
  try{args=validateToolArguments(tool.inputSchema as ToolInputSchema,request.params.arguments??{});}catch{return {content:[{type:'text',text:'Invalid tool arguments'}],isError:true};}
  try{
   context.mcpReq.signal.throwIfAborted();
   const value=await invoke(tool.id,args,context.mcpReq.signal);
   context.mcpReq.signal.throwIfAborted();
   const text=JSON.stringify(value);
   if(typeof text!=='string'||text.length>8000)throw Error('Invalid result');
   return {content:[{type:'text',text}]};
  }catch(error){
   if(context.mcpReq.signal.aborted)throw error;
   return {content:[{type:'text',text:'Tool execution failed'}],isError:true};
  }
 });
 return Object.freeze({
  async connect(){const [client,local]=InMemoryTransport.createLinkedPair();await server.connect(local);return client;},
  async close(){await server.close();},
 });
}
