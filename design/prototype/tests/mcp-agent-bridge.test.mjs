import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgentMcpBridge} from '../src/mcp-agent-bridge.ts';

const tools=[{id:'memory.search',effect:'read',network:'none',usage:'Search local records',inputSchema:{type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:80}}}}];
test('agent calls pass through MCP to the supplied audited operation once',async()=>{
 const signal=new AbortController().signal,bridge=await createAgentMcpBridge(tools,signal);let calls=0;
 try{const result=await bridge.call({kind:'tool',tool:'memory.search',arguments:{query:'water'}},async()=>{calls++;return [{noteId:'one',revision:1,quote:'water'}];});
  assert.deepEqual(result,[{noteId:'one',revision:1,quote:'water'}]);assert.equal(calls,1);
 }finally{await bridge.close();}
});
test('host failures retain their local category without exposing them through MCP',async()=>{
 const bridge=await createAgentMcpBridge(tools,new AbortController().signal),failure=new Error('host failure');
 try{await assert.rejects(bridge.call({kind:'tool',tool:'memory.search',arguments:{query:'water'}},async()=>{throw failure;}),error=>error===failure);}
 finally{await bridge.close();}
});
test('cancellation stops the MCP request and rejects a late host result',async()=>{
 const controller=new AbortController(),bridge=await createAgentMcpBridge(tools,controller.signal);let release,started;
 const entered=new Promise(resolve=>{started=resolve;});const gate=new Promise(resolve=>{release=resolve;});
 try{const pending=bridge.call({kind:'tool',tool:'memory.search',arguments:{query:'water'}},async()=>{started();await gate;return 'late';});await entered;controller.abort();release();await assert.rejects(pending);}
 finally{await bridge.close();}
});
