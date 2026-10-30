import test from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {createLocalMcpServer} from '../src/mcp-local-adapter.ts';
import {createToolRegistry} from '../src/tools/tool-registry.ts';
import * as calculator from '../src/tools/math.calculate/tool.ts';
import {recordOperation} from '../src/harness-activity.ts';

const schema={type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:80}}};
const tools=[{id:'memory.search',effect:'read',network:'none',usage:'Search local notes',inputSchema:schema}];
async function connected(invoke){
 const server=createLocalMcpServer({tools,invoke});
 const client=new Client({name:'test-client',version:'1'});
 const clientTransport=await server.connect();await client.connect(clientTransport);
 return {server,client,close:async()=>{await client.close();await server.close();}};
}
test('MCP client discovers and invokes only the supplied read-only tool contract',async()=>{
 const seen=[];const c=await connected(async(id,args,signal)=>{seen.push({id,args,aborted:signal.aborted});return [{id:'one',revision:2}];});
 try{const listed=await c.client.listTools();assert.deepEqual(listed.tools.map(t=>t.name),['memory.search']);assert.deepEqual(listed.tools[0].inputSchema,schema);
  const response=await c.client.callTool({name:'memory.search',arguments:{query:'meeting'}});
  assert.equal(response.isError,undefined);assert.deepEqual(JSON.parse(response.content[0].text),[{id:'one',revision:2}]);assert.deepEqual(seen,[{id:'memory.search',args:{query:'meeting'},aborted:false}]);
 }finally{await c.close();}
});
test('invalid, unknown or non-read-only calls do not reach the host',async()=>{
 let calls=0;const c=await connected(async()=>{calls++;return null;});
 try{const bad=await c.client.callTool({name:'memory.search',arguments:{query:4}});assert.equal(bad.isError,true);
  const unknown=await c.client.callTool({name:'memory.delete',arguments:{}});assert.equal(unknown.isError,true);assert.equal(calls,0);
 }finally{await c.close();}
 assert.throws(()=>createLocalMcpServer({tools:[{...tools[0],effect:'review'}],invoke:async()=>null}),/read-only/);
 assert.throws(()=>createLocalMcpServer({tools:[{...tools[0],inputSchema:{...schema,properties:{query:{type:'invented'}}}}],invoke:async()=>null}),/schemas/);
});
test('host failures do not expose private error text to the MCP client',async()=>{
 const c=await connected(async()=>{throw Error('PRIVATE FILE CONTENT');});
 try{const result=await c.client.callTool({name:'memory.search',arguments:{query:'meeting'}});assert.equal(result.isError,true);assert.doesNotMatch(JSON.stringify(result),/PRIVATE FILE CONTENT/);}finally{await c.close();}
});
test('MCP cancellation reaches the host and cannot return a late result',async()=>{
 let entered;const started=new Promise(resolve=>{entered=resolve});let stopped;const observed=new Promise(resolve=>{stopped=resolve});
 const c=await connected(async(_id,_args,signal)=>{entered();await new Promise(resolve=>signal.addEventListener('abort',()=>{stopped();resolve();},{once:true}));return 'late';});
 try{const abort=new AbortController();const pending=c.client.callTool({name:'memory.search',arguments:{query:'meeting'}},{signal:abort.signal});await started;abort.abort();await assert.rejects(pending);await observed;}finally{await c.close();}
});
test('a real registered calculator executes through the caller-owned activity boundary',async()=>{
 const registry=createToolRegistry([{...calculator,entry:'Tools/math.calculate/tool.ts',sources:[{path:'Tools/math.calculate/SKILL.md',body:'Calculate.'},{path:'Tools/math.calculate/tool.ts',body:'bundled'}]}]);
 const activities=[],host={check(){},search:async()=>[],resolve:async()=>[]};
 const server=createLocalMcpServer({tools:registry.capabilities(),invoke:async(id,args,signal)=>recordOperation(id,args,()=>registry.run(id,args,{...host,signal}),async entry=>activities.push(entry))});
 const client=new Client({name:'real-tool-test',version:'1'});
 try{await client.connect(await server.connect());const result=await client.callTool({name:'math.calculate',arguments:{expression:'6*7'}});
  assert.equal(JSON.parse(result.content[0].text)[0].result,'42');assert.deepEqual(activities.map(a=>a.status),['running','succeeded']);
 }finally{await client.close();await server.close();}
});
