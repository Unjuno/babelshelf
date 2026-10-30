import test from 'node:test';
import assert from 'node:assert/strict';
import {runReadOnlyAgentLoop,AgentContextCapacityError,AgentSourceCapacityError,AgentToolExecutionError,AgentSearchSnapshotChangedError,AgentToolResultTooLargeError} from '../src/agent-loop.ts';
const memoryTools=[{id:'memory.search',effect:'read',network:'none'},{id:'memory.read',effect:'read',network:'none'}];

test('failed revision-checked read removes earlier ranges but preserves a later restarted read',async()=>{
 const plans=[{kind:'tool',tool:'memory.read',arguments:{query:'one',start:0,length:3}},{kind:'tool',tool:'memory.read',arguments:{query:'one',start:3,length:3,expectedRevision:1}},{kind:'tool',tool:'memory.read',arguments:{query:'one',start:0,length:3}},{kind:'final',value:'done'}];let count=0,history;
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async h=>{history=h;return plans.shift();},execute:async()=>{if(++count===2)throw new AgentToolExecutionError('memory.read');return [{noteId:'one',revision:count===1?1:2,excerpt:count===1?'old':'new'}];},check(){}});
 assert.equal(result.attempts.length,3);assert.equal(history[0].result,null);assert.equal(history[0].error.code,'tool_execution');assert.deepEqual(result.calls.map(call=>call.result[0].excerpt),['new']);
});

test('a failed continuation by filename invalidates the earlier range resolved by that filename',async()=>{
 const plans=[{kind:'tool',tool:'memory.read',arguments:{query:'Notes/one.md'}},{kind:'tool',tool:'memory.read',arguments:{query:'one.md',start:3,expectedRevision:1}},{kind:'final',value:'done'}];let count=0,history;
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async h=>{history=h;return plans.shift();},execute:async()=>{if(++count===2)throw new AgentToolExecutionError('memory.read');return [{noteId:'one',path:'Notes/one.md',revision:1,excerpt:'old'}];},check(){}});
 assert.equal(history[0].result,null);assert.equal(result.calls.length,0);
});

test('failed source continuation cannot leave older source metadata in the final answer',async()=>{
 const tools=[{id:'memory.sources',effect:'read',network:'none'}],plans=[{kind:'tool',tool:'memory.sources',arguments:{id:'summary',revision:1}},{kind:'tool',tool:'memory.sources',arguments:{id:'summary',revision:1,offset:12,snapshot:'old'}},{kind:'final',value:'done'}];let count=0,lastHistory;
 const result=await runReadOnlyAgentLoop({allowedTools:tools,plan:async history=>{lastHistory=history;return plans.shift();},execute:async()=>{if(++count===2)throw new AgentToolExecutionError();return {noteId:'summary',revision:1,snapshot:'old',items:[]};},check:()=>{}});
 assert.equal(result.calls.length,0);assert.equal(result.attempts.length,2);assert.equal(lastHistory[0].result,null);
});

test('changed search invalidates older pages in answer evidence while retaining the execution history',async()=>{
 const plans=[{kind:'tool',tool:'memory.search',arguments:{query:'water',offset:0}},{kind:'tool',tool:'memory.search',arguments:{query:'water',offset:12,snapshot:'old'}},{kind:'tool',tool:'memory.search',arguments:{query:'water',offset:0}},{kind:'final',value:'done'}];let count=0,lastHistory;
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async history=>{lastHistory=history;return plans.shift();},execute:async()=>{count++;if(count===2)throw new AgentSearchSnapshotChangedError();return {snapshot:count===1?'old':'new',hits:[{noteId:'n',revision:count===1?1:2,quote:'water'}]};},check:()=>{}});
 assert.equal(result.attempts.length,3);assert.equal(result.attempts[0].result.snapshot,'old');assert.equal(result.attempts[1].error.code,'search_snapshot_changed');
 assert.deepEqual(result.calls.map(call=>call.result.snapshot),['new']);
 assert.equal(lastHistory[0].result,null);assert.equal(lastHistory[0].error.code,'search_snapshot_changed');assert.equal(lastHistory[2].result.snapshot,'new');
});

test('budget fallback does not treat invalidated search pages as usable evidence',async()=>{
 const plans=[{kind:'tool',tool:'memory.search',arguments:{query:'water',offset:0}},{kind:'tool',tool:'memory.search',arguments:{query:'water',offset:12,snapshot:'old'}},{kind:'tool',tool:'memory.search',arguments:{query:'water',offset:0}}];let count=0,seen;
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,maxToolCalls:2,plan:async()=>plans.shift(),execute:async()=>{if(++count===2)throw new AgentSearchSnapshotChangedError();return {snapshot:'old',hits:[{noteId:'n',revision:1,quote:'water'}]};},onBudgetExhausted:history=>{seen=history;return 'partial';},check:()=>{}});
 assert.equal(result.calls.length,0);assert.equal(result.attempts.length,2);assert.equal(seen.length,1);assert.equal(seen[0].error.code,'search_snapshot_changed');
});

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

test('native assistant content is carried transiently with its call and tool result',async()=>{
 const seen=[];const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async history=>{seen.push(structuredClone(history));return history.length?{kind:'final',value:'done'}:{kind:'tool',tool:'memory.search',arguments:{query:'meeting'},assistantContent:'The user asked for a saved meeting note.'};},execute:async()=>[{noteId:'n1'}],check:()=>{}});
 assert.equal(result.final,'done');assert.equal(result.attempts[0].assistantContent,'The user asked for a saved meeting note.');assert.equal(seen[1][0].assistantContent,'The user asked for a saved meeting note.');
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async()=>({kind:'tool',tool:'memory.search',arguments:{query:'meeting'},assistantContent:'x'.repeat(32769)}),execute:async()=>[],check:()=>{}}),/call is invalid/);
});

test('agent loop executes an independent native tool batch sequentially and keeps a shared batch identity',async()=>{
 const order=[],plans=[{kind:'tools',calls:[{kind:'tool',tool:'memory.search',arguments:{query:'meeting'}},{kind:'tool',tool:'memory.search',arguments:{query:'schedule'}}]},{kind:'final',value:'done'}],seen=[];
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,plan:async history=>{seen.push(structuredClone(history));return plans.shift();},execute:async call=>{order.push(call.arguments.query);return [{query:call.arguments.query}];},check:()=>{}});
 assert.deepEqual(order,['meeting','schedule']);assert.equal(result.calls.length,2);assert.equal(result.attempts[0].batchId,result.attempts[1].batchId);assert.deepEqual(seen[1].map(item=>item.result),[[{query:'meeting'}],[{query:'schedule'}]]);
});

test('native tool batches are bounded by the live turn budget, not a fixed eight-call ceiling',async()=>{
 const calls=Array.from({length:9},(_,index)=>({kind:'tool',tool:'memory.search',arguments:{query:`query-${index}`}}));let executions=0;
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,maxToolCalls:9,plan:async history=>history.length?{kind:'final',value:'done'}:{kind:'tools',calls},execute:async call=>{executions++;return [{query:call.arguments.query}];},check:()=>{}});
 assert.equal(executions,9);assert.equal(result.calls.length,9);assert.equal(result.attempts.at(-1).arguments.query,'query-8');
});

test('agent loop rejects an over-budget batch before executing any member',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,maxToolCalls:1,plan:async()=>({kind:'tools',calls:[{kind:'tool',tool:'memory.search',arguments:{query:'a'}},{kind:'tool',tool:'memory.search',arguments:{query:'b'}}]}),execute:async()=>{executions++;return [];},onBudgetExhausted:()=>({partial:true}),check:()=>{}});
 assert.equal(result.final.partial,true);assert.equal(result.budgetExhausted,true);assert.equal(result.budgetCause,'tool-limit');assert.equal(executions,0);
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

test('read-only loop refuses typed review and external effects before planning or execution',async()=>{
 for(const tool of [
  {id:'memory.capture',effect:'review',network:'none'},
  {id:'mcp.search',effect:'external',network:'explicit-online'},
 ]){
  let plans=0,executions=0;
  await assert.rejects(runReadOnlyAgentLoop({allowedTools:[tool],plan:async()=>{plans++;return {kind:'final',value:'done'};},execute:async()=>{executions++;return {};},check:()=>{}}),/Invalid agent tool allowlist/);
  assert.equal(plans,0);assert.equal(executions,0);
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

test('registered tool execution failures return a safe typed result and let the model choose the next step',async()=>{
 const plans=[{kind:'tool',tool:'memory.search',arguments:{query:'first'}},{kind:'final',value:'blocked honestly'}];let replans=0,executions=0;
 const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async history=>{replans++;if(history.length)assert.deepEqual(history[0].error,{code:'tool_execution'});return plans.shift();},execute:async()=>{executions++;throw new AgentToolExecutionError('memory.search',Error('private path'))},check:()=>{}});
 assert.equal(result.final,'blocked honestly');assert.equal(result.calls.length,0);assert.equal(result.attempts.length,1);assert.deepEqual(result.attempts[0].error,{code:'tool_execution'});assert.equal(replans,2);assert.equal(executions,1);assert.doesNotMatch(JSON.stringify(result),/private path/);
});

test('default agent loop has no arbitrary call ceiling while each call adds distinct evidence',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async history=>history.length<12?{kind:'tool',tool:'memory.search',arguments:{query:`part-${history.length}`}}:{kind:'final',value:'done'},execute:async call=>{executions++;return [{query:call.arguments.query}];},check:()=>{}});
 assert.equal(result.final,'done');assert.equal(executions,12);assert.equal(result.calls.length,12);
});

test('context capacity returns partial-work callback with existing evidence instead of retrying',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async history=>{if(history.length===2)throw new AgentContextCapacityError();return {kind:'tool',tool:'memory.search',arguments:{query:`part-${history.length}`}};},execute:async()=>{executions++;return [{quote:'evidence'}];},onBudgetExhausted:history=>({partial:true,evidence:history.length}),check:()=>{}});
 assert.equal(result.final.partial,true);assert.equal(result.final.evidence,2);assert.equal(result.budgetExhausted,true);assert.equal(result.budgetCause,'context');assert.equal(executions,2);
});

test('Stop during a context-capacity failure does not start partial-result generation',async()=>{
 let stopped=false,partialCalls=0;const stop=Error('Stopped');
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async history=>{if(history.length){stopped=true;throw new AgentContextCapacityError();}return {kind:'tool',tool:'memory.search',arguments:{query:'x'}};},execute:async()=>[{quote:'evidence'}],onBudgetExhausted:()=>{partialCalls++;return {partial:true};},check:()=>{if(stopped)throw stop;}}),error=>error===stop);
 assert.equal(partialCalls,0);
});

test('Stop or partial-result failure after source capacity is never hidden or retried',async()=>{
 for(const mode of ['stop','partial-failure']){
  let stopped=false,executions=0,partialCalls=0;const failure=Error(mode==='stop'?'Stopped':'Partial result unavailable');
  await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async history=>{if(history.length){stopped=mode==='stop';throw new AgentSourceCapacityError();}return {kind:'tool',tool:'memory.search',arguments:{query:'x'}};},execute:async()=>{executions++;return [{quote:'evidence'}];},onBudgetExhausted:()=>{partialCalls++;throw failure;},check:()=>{if(stopped)throw failure;}}),error=>error===failure);
  assert.equal(executions,1);assert.equal(partialCalls,mode==='stop'?0:1);
 }
});

test('source capacity during tool execution returns only earlier completed work',async()=>{
 let executions=0;
 const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async history=>({kind:'tool',tool:'memory.search',arguments:{query:`part-${history.length}`}}),execute:async()=>{if(++executions===2)throw new AgentSourceCapacityError();return [{quote:'first'}];},onBudgetExhausted:history=>({partial:true,count:history.length}),check:()=>{}});
 assert.equal(result.budgetCause,'source-capacity');assert.deepEqual(result.final,{partial:true,count:1});assert.equal(executions,2);assert.equal(result.calls.length,1);assert.deepEqual(result.calls[0].result,[{quote:'first'}]);
});

test('source capacity on the first tool cannot manufacture a partial result',async()=>{
 let partial=0;const capacity=new AgentSourceCapacityError();
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],plan:async()=>({kind:'tool',tool:'memory.search',arguments:{query:'x'}}),execute:async()=>{throw capacity;},onBudgetExhausted:()=>{partial++;return {partial:true};},check:()=>{}}),error=>error===capacity);
 assert.equal(partial,0);
});

test('budget exhaustion returns completed tool evidence without executing the refused next action',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],maxToolCalls:2,plan:async history=>history.length<2?{kind:'tool',tool:'memory.search',arguments:{query:`part-${history.length}`}}:{kind:'tool',tool:'memory.search',arguments:{query:'unrun-part'}},execute:async call=>{executions++;return [{noteId:`n${executions}`,revision:1,quote:'evidence'}];},onBudgetExhausted:history=>({action:'answer',evidenceCount:history.filter(item=>!item.error).length}),check:()=>{}});
 assert.equal(result.budgetExhausted,true);assert.deepEqual(result.final,{action:'answer',evidenceCount:2});assert.equal(result.calls.length,2);assert.equal(executions,2);assert.equal(result.attempts.length,2);
});

test('an identical failed call is not rerun and gets one model recovery step',async()=>{
 let plans=0,executions=0;const seen=[];
 const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],
  plan:async history=>{plans++;seen.push(structuredClone(history));if(!history.length)return {kind:'tool',tool:'memory.search',arguments:{query:'meeting',limit:3}};if(history.length===1)return {kind:'tool',tool:'memory.search',arguments:{limit:3,query:'meeting'}};if(history.length===2){assert.deepEqual(history[1].error,{code:'no_progress_loop'});return {kind:'tool',tool:'memory.search',arguments:{query:'schedule',limit:3}};}return {kind:'final',value:'recovered'};},
  execute:async call=>{executions++;if(call.arguments.query==='meeting')throw new AgentToolExecutionError('memory.search',Error('private diagnostic'));return [{noteId:'n1'}];},check:()=>{}
 });
 assert.equal(result.final,'recovered');assert.equal(plans,4);assert.equal(executions,2);assert.equal(result.calls.length,1);assert.deepEqual(seen[1][0].error,{code:'tool_execution'});assert.deepEqual(seen[2][1].error,{code:'no_progress_loop'});
});

test('the planner cannot repeat the same failed call after the recovery signal',async()=>{
 let plans=0,executions=0;
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],
  plan:async()=>{plans++;return {kind:'tool',tool:'memory.search',arguments:{query:'meeting',limit:3}};},
  execute:async()=>{executions++;throw new AgentToolExecutionError('memory.search',Error('private diagnostic'));},check:()=>{}
 }),/same failed tool call/);
 assert.equal(plans,3);assert.equal(executions,1);
});

test('a changed retry after a typed failure remains available to the model',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],
  plan:async history=>!history.length?{kind:'tool',tool:'memory.search',arguments:{query:'meeting'}}:history.length===1?{kind:'tool',tool:'memory.search',arguments:{query:'schedule'}}:{kind:'final',value:'done'},
  execute:async call=>{executions++;if(call.arguments.query==='meeting')throw new AgentToolExecutionError('memory.search',Error('private diagnostic'));return [{id:'n1'}];},check:()=>{}
 });
 assert.equal(result.final,'done');assert.equal(executions,2);assert.equal(result.calls.length,1);assert.equal(result.attempts[0].error.code,'tool_execution');
});

test('an editable profile can choose a lower call limit and the refused action stays unexecuted',async()=>{
 let executions=0,plans=0;await assert.rejects(runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],maxToolCalls:1,plan:async()=>{plans++;return {kind:'tool',tool:'memory.search',arguments:{query:'x'}};},execute:async()=>{executions++;return [];},check:()=>{}}),/limit/);
 assert.equal(plans,2);assert.equal(executions,1);
});

test('an editable profile can lower the result budget before tool output enters context',async()=>{
 let plans=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[1]],maxResultChars:300,plan:async history=>{plans++;if(history.length){assert.deepEqual(history[0].error,{code:'result_too_large'});assert.equal(history[0].result,null);return {kind:'final',value:'ask to narrow the read'};}return {kind:'tool',tool:'memory.read',arguments:{query:'large.md'}};},execute:async()=>({body:'x'.repeat(400)}),check:()=>{}});
 assert.equal(result.final,'ask to narrow the read');assert.equal(plans,2);assert.equal(result.calls.length,0);
});

test('oversized tool output is omitted and the agent can recover with a narrower call',async()=>{
 let plans=0,readLengths=[];const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[1]],maxResultChars:2500,plan:async history=>{plans++;if(!history.length)return {kind:'tool',tool:'memory.read',arguments:{query:'large.md',length:3000}};if(history.length===1){assert.deepEqual(history[0].error,{code:'result_too_large'});return {kind:'tool',tool:'memory.read',arguments:{query:'large.md',start:0,length:1000}};}assert.equal(history[1].result.body,'x'.repeat(1000));return {kind:'final',value:'read bounded range'};},execute:async call=>{readLengths.push(call.arguments.length);return {body:'x'.repeat(call.arguments.length)};},check:()=>{}});
 assert.equal(result.final,'read bounded range');assert.deepEqual(readLengths,[3000,1000]);assert.equal(result.calls.length,1);assert.equal(result.attempts[0].error.code,'result_too_large');assert.equal(plans,3);assert.doesNotMatch(JSON.stringify(result),/x{3000}/);
});

test('repeated identical empty searches get one recovery turn without a global call ceiling',async()=>{
 let executions=0,plans=0;const seen=[];
 const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],
  plan:async history=>{
   plans++;seen.push(structuredClone(history));
   if(history.length<3)return {kind:'tool',tool:'memory.search',arguments:{query:'same query'}};
   if(history.length===3){assert.deepEqual(history.at(-1).error,{code:'no_progress_loop'});return {kind:'tool',tool:'memory.search',arguments:{query:'changed'}};}
   return {kind:'final',value:'used the existing evidence'};
  },
  execute:async call=>{executions++;return call.arguments.query==='changed'?[{noteId:'new-note',revision:1,quote:'New evidence.'}]:[];},check:()=>{}
 });
 assert.equal(result.final,'used the existing evidence');assert.equal(executions,4);assert.equal(plans,5);
 assert.equal(result.attempts.length,4);assert.equal(result.calls.length,3);
 assert.deepEqual(result.attempts[2].error,{code:'no_progress_loop'});
 assert.equal(result.attempts[2].result,null);
 assert.equal(result.attempts[3].result[0].noteId,'new-note');
});

test('distinct searches can continue after several unrelated empty results',async()=>{
 const queries=['apples','bicycles','camping','dinner'];
 const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],check:()=>{},
  plan:async history=>history.length<queries.length?{kind:'tool',tool:'memory.search',arguments:{query:queries[history.length]}}:{kind:'final',value:'done'},
  execute:async call=>call.arguments.query==='dinner'?[{noteId:'dinner-note'}]:[],
 });
 assert.equal(result.final,'done');
 assert.deepEqual(result.attempts.map(item=>item.error?.code??'success'),['success','success','success','success']);
 assert.equal(result.calls.at(-1).result[0].noteId,'dinner-note');
});

test('same tool and arguments count as progress when their bounded result changes',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[0]],
  plan:async history=>history.length<3?{kind:'tool',tool:'memory.search',arguments:{query:'changing'}}:{kind:'final',value:'done'},
  execute:async()=>({generation:++executions}),check:()=>{}
 });
 assert.equal(result.final,'done');assert.equal(result.calls.length,3);assert.equal(result.attempts.some(item=>item.error?.code==='no_progress_loop'),false);
});

test('the repeat window detects a search-read cycle even when another tool separates identical calls',async()=>{
 const calls=[];const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,
  plan:async history=>{
   const successful=history.filter(item=>!item.error);
   if(history.at(-1)?.error?.code==='no_progress_loop')return {kind:'final',value:'cycle stopped; prior evidence retained'};
   if(successful.length===0||successful.at(-1).tool==='memory.read')return {kind:'tool',tool:'memory.search',arguments:{query:'same topic'}};
   return {kind:'tool',tool:'memory.read',arguments:{query:'Notes/topic.md'}};
  },
  execute:async call=>{calls.push(call.tool);return call.tool==='memory.search'?[{noteId:'n1',revision:1,path:'Notes/topic.md'}]:[{noteId:'n1',revision:1,body:'same content'}];},
  check:()=>{}
 });
 assert.equal(result.final,'cycle stopped; prior evidence retained');
 assert.deepEqual(calls,['memory.search','memory.read','memory.search','memory.read','memory.search']);
 assert.equal(result.calls.length,4);assert.equal(result.attempts.length,5);
 assert.deepEqual(result.attempts.at(-1).error,{code:'no_progress_loop'});
});

test('a loop guard records every unexecuted member of a model-proposed batch',async()=>{
 const seen=[];let executions=0;
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,
  plan:async history=>{seen.push(structuredClone(history));return history.length?{kind:'final',value:'replanned from the completed evidence'}:{kind:'tools',calls:[
   {kind:'tool',tool:'memory.search',arguments:{query:'topic one'}},
   {kind:'tool',tool:'memory.search',arguments:{query:'topic one'}},
   {kind:'tool',tool:'memory.search',arguments:{query:'topic one'}},
   {kind:'tool',tool:'memory.read',arguments:{query:'n1'}},
  ]};},
  execute:async call=>{executions++;return call.tool==='memory.search'?[]:[{body:'should not execute'}];},check:()=>{}
 });
 assert.equal(result.final,'replanned from the completed evidence');assert.equal(executions,3);
 assert.deepEqual(result.attempts.map(item=>item.error?.code??'success'),['success','success','no_progress_loop','batch_not_executed']);
 assert.deepEqual(result.attempts.map(item=>item.batchId),['batch-1','batch-1','batch-1','batch-1']);
 assert.equal(result.attempts[3].tool,'memory.read');assert.equal(result.attempts[3].result,null);
 assert.equal(seen[1].length,4);assert.deepEqual(seen[1][3].error,{code:'batch_not_executed'});
});

test('the agent can run a previously skipped batch member on its next planning step',async()=>{
 const search={kind:'tool',tool:'memory.search',arguments:{query:'topic'}},read={kind:'tool',tool:'memory.read',arguments:{query:'n1'}};
 const plans=[{kind:'tools',calls:[search,search,search,read]},read,{kind:'final',value:'answered from the recovered read'}],executed=[],seen=[];
 const result=await runReadOnlyAgentLoop({allowedTools:memoryTools,check:()=>{},
  plan:async history=>{seen.push(structuredClone(history));return plans.shift();},
  execute:async call=>{executed.push(call.tool);return call.tool==='memory.read'?[{noteId:'n1',revision:1,body:'Meeting at 10'}]:[];},
 });
 assert.equal(result.final,'answered from the recovered read');
 assert.deepEqual(executed,['memory.search','memory.search','memory.search','memory.read']);
 assert.deepEqual(seen[1].at(-1).error,{code:'batch_not_executed'});
 assert.deepEqual(result.attempts.map(item=>item.error?.code??'success'),['success','success','no_progress_loop','batch_not_executed','success']);
 assert.equal(result.calls.at(-1).result[0].body,'Meeting at 10');
 assert.equal(result.attempts[3].batchId,'batch-1');
 assert.equal(result.attempts[4].batchId,undefined);
});

test('skipped batch placeholders do not hide a preceding no-progress signal for the same call',async()=>{
 const search={kind:'tool',tool:'memory.search',arguments:{query:'topic'}};
 const plans=[{kind:'tools',calls:[search,search,search,search]},search,{kind:'final',value:'must not bypass the guard'}];let executions=0;
 await assert.rejects(runReadOnlyAgentLoop({allowedTools:memoryTools,check:()=>{},
  plan:async()=>plans.shift(),execute:async()=>{executions++;return [];},
 }),/same failed tool call/);
 assert.equal(executions,3);
});

test('a typed result-projection overflow is returned to the agent for a narrower retry',async()=>{
 let executions=0;const result=await runReadOnlyAgentLoop({allowedTools:[memoryTools[1]],plan:async history=>{if(!history.length)return {kind:'tool',tool:'memory.read',arguments:{query:'large.md',start:0,length:3000}};assert.deepEqual(history[0].error,{code:'result_too_large'});return history.length===1?{kind:'tool',tool:'memory.read',arguments:{query:'large.md',start:0,length:1000}}:{kind:'final',value:'bounded read completed'};},execute:async call=>{executions++;if(executions===1)throw new AgentToolResultTooLargeError();return {body:'x'.repeat(call.arguments.length)};},check:()=>{}});
 assert.equal(result.final,'bounded read completed');assert.equal(result.attempts.length,2);assert.equal(result.calls.length,1);assert.equal(result.calls[0].result.body.length,1000);
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
