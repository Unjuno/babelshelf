import test from 'node:test';
import assert from 'node:assert/strict';
import {agentToolInfoFromCalls,agentCustomResultsFromCalls,agentClockReadingsFromCalls} from '../src/agent-evidence.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';

test('many operation results remain validated and a native answer is not regenerated',async()=>{
 const calls=Array.from({length:65},(_,i)=>({tool:'tools.search',arguments:{query:`term-${i}`},result:[]}));
 const toolInfo=agentToolInfoFromCalls(calls);
 assert.equal(toolInfo.length,65);assert.deepEqual(toolInfo.map(row=>row.arguments.query),calls.map(row=>row.arguments.query));
 const custom=Array.from({length:65},(_,i)=>({tool:'user.counter',arguments:{n:i},result:{value:i}}));
 assert.equal(agentCustomResultsFromCalls(custom).length,65);
 const engine={manifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},load:async()=>{throw Error('Unexpected load');},count:async()=>{throw Error('Unexpected count');},generate:async()=>{throw Error('Unexpected generation');}};
 const store={all:async()=>[],search:async()=>{throw Error('Unexpected search');}};
 const request={model:'test',question:'Summarize tool discovery.',query:'tool discovery',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],toolInfo,memoryUsed:false},reply:{answer:'No matching tools were found.',sources:[]}};
 const result=await groundedAnswer({store,engine},request);assert.equal(result.answer,request.reply.answer);assert.deepEqual(result.sources,[]);
 const bad=[...calls,{tool:'tools.read-skill',arguments:{id:'user.first'},result:{id:'user.other',title:'Other',instructions:'Read.'}}];
 assert.throws(()=>agentToolInfoFromCalls(bad),/identity changed/);
});

test('operation data that cannot fit the final context is not silently dropped and gets an actionable error',async()=>{
 const toolInfo=agentToolInfoFromCalls(Array.from({length:65},(_,i)=>({tool:'tools.search',arguments:{query:`term-${i}`},result:[]})));
 const engine={loaded:'test',manifest:{contextTokens:1024,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:1000}),generate:async()=>{throw Error('Unexpected generation');}};
 const store={all:async()=>[],search:async()=>{throw Error('Unexpected search');}};
 await assert.rejects(groundedAnswer({store,engine},{model:'test',question:'Summarize tool discovery.',query:'tool discovery',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],toolInfo,memoryUsed:false}}),/Answer with tool results exceeds context · narrow the request and retry/);
 await assert.rejects(groundedAnswer({store,engine},{model:'test',question:'Summarize tool discovery.',query:'tool discovery',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],toolInfo:toolInfo.slice(0,1),memoryUsed:false}}),/Answer with tool results exceeds context · narrow the request and retry/);
});

test('Stop after final-input token counting wins over context exhaustion',async()=>{
 const stop=Error('Stopped'),engine={loaded:'test',manifest:{contextTokens:1024,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:1000}),generate:async()=>{throw Error('Unexpected generation');}};
 const store={all:async()=>[],search:async()=>{throw Error('Unexpected search');}};
 await assert.rejects(groundedAnswer({store,engine},{model:'test',question:'Summarize tool discovery.',query:'tool discovery',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],toolInfo:[{tool:'tools.search',arguments:{query:'x'},result:[]}],memoryUsed:false},check:()=>{throw stop;}}),error=>error===stop);
});

test('many clock readings remain independently validated for a native terminal answer',async()=>{
 const clock={instant:'2026-10-30T00:00:00.000Z',localTime:'2026-10-30T09:00:00',offsetMinutes:540,timeZone:'Asia/Tokyo',source:'device-clock'};
 const calls=Array.from({length:65},()=>({tool:'time.now',arguments:{},result:clock}));
 const clockReadings=agentClockReadingsFromCalls(calls);assert.equal(clockReadings.length,65);
 assert.throws(()=>agentClockReadingsFromCalls([...calls,{...calls[0],result:{...clock,localTime:'wrong'}}]),/Invalid device clock reading/);
 const engine={manifest:{models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},load:async()=>{throw Error('Unexpected load');},count:async()=>{throw Error('Unexpected count');},generate:async()=>{throw Error('Unexpected generation');}};
 const store={all:async()=>[],search:async()=>{throw Error('Unexpected search');}};
 const request={model:'test',question:'What time is it?',query:'time',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],clockReadings,memoryUsed:false},reply:{answer:'The device clock says 09:00.',sources:[]}};
 const result=await groundedAnswer({store,engine},request);assert.equal(result.answer,request.reply.answer);assert.deepEqual(result.sources,[]);
});
