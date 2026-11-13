import test from 'node:test';import assert from 'node:assert/strict';
import {executeScheduledAnswer} from '../src/scheduled-answer.ts';
import {makeDecimalReceipt} from '../src/tools/math.calculate/decimal-receipt.ts';
import {createNote} from '../../../dist/core.js';
import {isSourceFreeConversationRequest} from '../src/dialogue-planner.ts';
const run=()=>{let calls=0;return {get calls(){return calls;},dependencies:{store:{},models:{text:async()=>{calls++;throw Error('Controlled acquisition refusal');}}}};};
test('short source-free greeting schedules use one prose answer and never inspect Memory',async()=>{
 let generations=0,loads=0,counts=0;
 const engine={loaded:'selected',manifest:{contextTokens:8192,maxOutputTokens:512,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>{counts++;return {prompt_tokens:64};},generate:async(messages,budget,format)=>{generations++;assert.equal(format,'prose');assert.ok(budget>0);assert.match(messages.at(-1).content,/say hello briefly/i);return {text:'Hello!',finishReason:'stop',outputTokens:2};}};
 const store={all:async()=>{throw Error('A source-free schedule must not read Memory');},search:async()=>{throw Error('A source-free schedule must not search Memory');}};
 const result=await executeScheduledAnswer({store,models:{text:async()=>{loads++;return engine;}}},{prompt:'say hello briefly',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''});
 assert.equal(result.answer,'Hello!');assert.deepEqual(result.sources,[]);assert.equal(loads,1);assert.equal(generations,1);assert.equal(counts,1);
 assert.equal(isSourceFreeConversationRequest('What time does the workshop start?'),false,'general factual questions may still need saved knowledge');
});
test('scheduled capture is refused before any model acquisition',async()=>{const f=run();await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'note: Change the memory',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/read-only/);assert.equal(f.calls,0);});
test('scheduled Stop prevents runtime acquisition',async()=>{const f=run(),c=new AbortController();c.abort();await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'Summarize my notes',model:'selected',signal:c.signal,replyStyle:'balanced',userGuidance:''}),/Stopped/);assert.equal(f.calls,0);});
test('scheduled work propagates the shared acquisition failure without another engine or retry',async()=>{const f=run();await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'Summarize my notes',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/Controlled acquisition refusal/);assert.equal(f.calls,1);});
test('scheduled calculation uses a verified local receipt without loading a model',async()=>{const f=run(),input={prompt:'Calculate 12 + 10',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''};f.dependencies.calculate=async expression=>makeDecimalReceipt(expression);const output=await executeScheduledAnswer(f.dependencies,input);assert.equal(output.answer,'12 + 10 = 22');assert.equal(output.calculation.result,'22');assert.deepEqual(output.sources,[]);assert.equal(f.calls,0);f.dependencies.calculate=async expression=>({...makeDecimalReceipt(expression),result:'23'});await assert.rejects(executeScheduledAnswer(f.dependencies,input),/Invalid decimal receipt/);});
test('mixed requests are not silently reduced to calculation',async()=>{const f=run();let calculated=false;f.dependencies.calculate=async()=>{calculated=true;};await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'Calculate 12 + 10 and delete notes',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/Controlled acquisition refusal/);assert.equal(calculated,false);});

test('a scheduled question with missing evidence is not recorded as a successful answer or retried',async()=>{
 const note=createNote({path:'Notes/workshop.md',body:'The workshop takes place in Cedar Hall.'}),body=note.revisions[0].body;
 const ref={noteId:note.id,revision:1,start:0,end:body.length,quote:body};let generations=0,loads=0;
 const runtime={loaded:'selected',assets:{selected:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generations++;return {text:JSON.stringify({status:'insufficient_evidence',answer:'The supplied excerpts do not give a start time.',sources:[]}),finishReason:'stop'};}};
 await assert.rejects(executeScheduledAnswer({store:{all:async()=>[note],search:async()=>[ref]},models:{text:async()=>{loads++;return runtime;}}},{prompt:'What time does the workshop start?',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/Not enough evidence/);
 assert.equal(generations,1);assert.equal(loads,1);assert.equal(note.revisions.length,1);
});
