import test from 'node:test';
import assert from 'node:assert/strict';
import {runReadOnlyAgentLoop,MAX_AGENT_TOOL_CALLS} from '../src/agent-loop.ts';
const memoryTools=[{id:'memory.search',readOnly:true,network:'none'},{id:'memory.read',readOnly:true,network:'none'}];

test('agent loop carries each typed tool result into the next planner step and returns the final request',async()=>{
 const plans=[
  {kind:'tool',tool:'memory.search',arguments:{query:'meeting'}},
  {kind:'tool',tool:'memory.read',arguments:{query:'Notes/meeting.md'}},
  {kind:'final',value:{action:'answer',query:'When is the meeting?'}},
 ],seen=[],executed=[];
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async history=>{seen.push(structuredClone(history));return plans.shift();},execute:async call=>{executed.push(call);return call.tool==='memory.search'?[{noteId:'n1',revision:3,quote:'Monday at 10'}]:[{id:'n1',path:'Notes/meeting.md',version:3,body:'# Meeting\nMonday at 10'}];},check:()=>{}});
 assert.equal(result.final.action,'answer');assert.equal(result.calls.length,2);assert.deepEqual(executed.map(c=>c.tool),['memory.search','memory.read']);
 assert.deepEqual(seen[1],[{tool:'memory.search',arguments:{query:'meeting'},result:[{noteId:'n1',revision:3,quote:'Monday at 10'}]}]);
 assert.equal(seen[2][1].result[0].body,'# Meeting\nMonday at 10');
});

test('a final plan exits without invoking a tool',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async()=>({kind:'final',value:'done'}),execute:async()=>{executions++;return [];},check:()=>{}});
 assert.equal(result.final,'done');assert.equal(result.calls.length,0);assert.equal(executions,0);
});

test('unknown tools and malformed plans fail before execution',async()=>{
 for(const plan of [
  {kind:'tool',tool:'filesystem.delete',arguments:{path:'x'}},
  {kind:'tool',tool:'memory.search',arguments:{query:'x'},extra:true},
  {kind:'tool',tool:'memory.search',arguments:undefined},
  {kind:'other',value:'x'},
 ]){
  let executions=0;await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async()=>plan,execute:async()=>{executions++;return [];},check:()=>{}}));assert.equal(executions,0);
 }
});

test('Stop and tool failures propagate without replanning or automatic retry',async()=>{
 const stopped=Error('Stopped');let plans=0,executions=0,checks=0;
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async()=>{plans++;return {kind:'tool',tool:'memory.search',arguments:{query:'x'}};},execute:async()=>{executions++;return [];},check:()=>{if(++checks===2)throw stopped;}}),e=>e===stopped);
 assert.equal(plans,1);assert.equal(executions,0);
 const failure=Error('Local index unavailable');plans=0;executions=0;
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async()=>{plans++;return {kind:'tool',tool:'memory.search',arguments:{query:'x'}};},execute:async()=>{executions++;throw failure;},check:()=>{}}),e=>e===failure);
 assert.equal(plans,1);assert.equal(executions,1);
});

test('the application-owned call limit stops before an extra tool executes',async()=>{
 let executions=0;await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async()=>({kind:'tool',tool:'memory.search',arguments:{query:'x'}}),execute:async()=>{executions++;return [];},check:()=>{}}),/limit/);
 assert.equal(MAX_AGENT_TOOL_CALLS,3);assert.equal(executions,MAX_AGENT_TOOL_CALLS);
});

test('an editable profile can lower the call limit but cannot permit a fourth call',async()=>{
 let executions=0,plans=0;await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],maxToolCalls:1,plan:async()=>{plans++;return {kind:'tool',tool:'memory.search',arguments:{query:'x'}};},execute:async()=>{executions++;return [];},check:()=>{}}),/limit/);
 assert.equal(plans,2);assert.equal(executions,1);
});

test('an editable profile can lower the result budget before tool output enters context',async()=>{
 let plans=0;await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[1]],maxResultChars:300,plan:async()=>{plans++;return {kind:'tool',tool:'memory.read',arguments:{query:'large.md'}};},execute:async()=>({body:'x'.repeat(400)}),check:()=>{}}),/too large/);
 assert.equal(plans,1);
});

test('oversized tool output fails before being fed back to the model',async()=>{
 let plans=0;await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[1]],plan:async()=>{plans++;return {kind:'tool',tool:'memory.read',arguments:{query:'large.md'}};},execute:async()=>({body:'x'.repeat(9000)}),check:()=>{}}),/too large/);
 assert.equal(plans,1);
});

test('tool evidence and arguments are stable after a handler or planner mutates its objects',async()=>{
 const argumentsFromPlan={query:'Notes/meeting.md'},source={noteId:'n1',revision:1,quote:'Monday at 10'};
 let observed;
 const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[1]],check:()=>{},
  plan:async history=>{
   if(!history.length)return {kind:'tool',tool:'memory.read',arguments:argumentsFromPlan};
   observed=structuredClone(history);
   history[0].result[0].quote='changed by planner';
   history[0].arguments.query='changed by planner';
   return {kind:'final',value:{action:'answer'}};
  },
  execute:async call=>{call.tool='memory.search';call.arguments.query='changed by handler';return [source];},
 });
 source.quote='changed after execution';
 assert.deepEqual(observed,[{tool:'memory.read',arguments:{query:'Notes/meeting.md'},result:[{noteId:'n1',revision:1,quote:'Monday at 10'}]}]);
 assert.deepEqual(result.calls,observed);
 assert.equal(argumentsFromPlan.query,'Notes/meeting.md');
});
