import test from 'node:test';
import assert from 'node:assert/strict';
import {agentToolInfoFromCalls,agentCustomResultsFromCalls,agentClockReadingsFromCalls} from '../src/agent-evidence.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';
import {createNote} from '../../../dist/core.js';

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

test('citation repair retains operation and partial-coverage instructions with optional guidance',async()=>{
 const {createNote}=await import('../../../dist/core.js');
 const note=createNote({body:'集合場所は北口。'}),quote=note.revisions[0].body;
 const ref={noteId:note.id,revision:1,start:0,end:quote.length,quote};
 const seen=[];
 const engine={loaded:'test',manifest:{contextTokens:8192,models:[],runtime:{}},count:async()=>({prompt_tokens:400}),generate:async messages=>{seen.push(structuredClone(messages));return {text:JSON.stringify(seen.length===1?{answer:'集合場所は北口。',citations:[{id:'S1',quote:'not original'}]}:{answer:'集合場所は北口。',sources:['S1']})};}};
 const toolInfo=agentToolInfoFromCalls([{tool:'tools.search',arguments:{query:'guide'},result:[]}]);
 const result=await groundedAnswer({store:{all:async()=>[note],search:async()=>[ref]},engine},{model:'test',question:'集合場所を要約して',mode:'summary',scope:{kind:'knowledge'},userGuidance:'Use plain wording.',toolEvidence:{used:true,refs:[ref],toolInfo,memoryUsed:true,budgetExhausted:true}});
 assert.equal(seen.length,2);assert.equal(result.sources[0].quote,quote);
 assert.deepEqual(seen[1][0],seen[0][0]);assert.deepEqual(seen[1].slice(2),seen[0].slice(2));
 assert.ok(seen[1][1].content.startsWith(seen[0][1].content));
 assert.match(seen[1][1].content,/clearly partial answer/);
 assert.match(seen[1][1].content,/Reading a guide does not execute/);
 assert.match(seen[1][1].content,/Fictional, hypothetical and example/);
});

test('grounded-answer retries a mixed-title quantity conflict before returning cited prose',async()=>{
 const notes=[
  createNote({title:'Alpha reserve',path:'Notes/alpha.md',body:'Alpha reserve contains 17 litres of water.'}),
  createNote({title:'Beta reserve',path:'Notes/beta.md',body:'Beta reserve contains 29 litres of water.'}),
 ];
 const refs=notes.map(note=>{const quote=note.revisions[0].body;return {noteId:note.id,revision:1,start:0,end:quote.length,quote,title:note.revisions[0].title,path:note.revisions[0].path};});
 const wrong='Alpha reserve contains 17 litres. Beta reserve contains 29 litres. Alpha reserve contains 29 litres and Beta reserve contains 17 litres.';
 const corrected='Alpha reserve contains 17 litres and Beta reserve contains 29 litres.';
 const seen=[];
 const engine={loaded:'test',manifest:{contextTokens:8192,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{seen.push(structuredClone(messages));return {text:JSON.stringify({answer:seen.length===1?wrong:corrected,citations:refs.map((ref,index)=>({id:`S${index+1}`,quote:ref.quote}))}),finishReason:'stop'};}};
 const result=await groundedAnswer({store:{all:async()=>notes,search:async()=>refs},engine},{model:'test',question:'Compare the water volumes in the cited reserves.',scope:{kind:'knowledge'}});
 assert.equal(seen.length,2);assert.match(seen[1][0].content,/previous draft failed a deterministic source-consistency check/i);
 assert.equal(result.answer,corrected);assert.equal(result.sources.length,2);assert.deepEqual(result.sources.map(ref=>ref.noteId),notes.map(note=>note.id));
});
