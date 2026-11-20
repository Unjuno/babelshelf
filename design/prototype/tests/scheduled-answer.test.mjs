import test from 'node:test';import assert from 'node:assert/strict';
import {executeScheduledAnswer,ScheduleAnswerError} from '../src/scheduled-answer.ts';
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
test('unambiguous public capital questions use source-free prose while personal questions stay grounded',()=>{
 assert.equal(isSourceFreeConversationRequest('What is the capital of France?'),true);
 assert.equal(isSourceFreeConversationRequest('フランスの首都は？'),true);
 for(const prompt of ['What time does the workshop start?','What is the capital in my saved note?','What did we decide earlier about France?'])assert.equal(isSourceFreeConversationRequest(prompt),false,prompt);
});
test('a schedule prompt echo gets one bounded prose repair and keeps the generated answer',async()=>{
 let generations=0;const engine={loaded:'selected',manifest:{contextTokens:8192,maxOutputTokens:512,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:64}),generate:async(messages,_budget,format)=>{generations++;assert.equal(format,'prose');if(generations===2)assert.match(messages[0].content,/Do not quote, restate, or explain/);return {text:generations===1?'say hello briefly':'Hello! How can I help?',finishReason:'stop',outputTokens:4};}};
 const result=await executeScheduledAnswer({store:{all:async()=>{throw Error('Echo repair must not read Memory');},search:async()=>{throw Error('Echo repair must not search Memory');}},models:{text:async()=>engine}},{prompt:'say hello briefly',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''});
 assert.equal(result.answer,'Hello! How can I help?');assert.equal(generations,2);
});
test('numbered run-test greeting labels are metadata, so schedule output is generated as prose',async()=>{
 let generations=0,loads=0;
 const engine={loaded:'selected',manifest:{contextTokens:8192,maxOutputTokens:512,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:64}),generate:async(messages,_budget,format)=>{generations++;assert.equal(format,'prose');assert.match(messages.at(-1).content,/say hello briefly/i);assert.doesNotMatch(messages.at(-1).content,/R11 run test 1/i);return {text:'Hello!',finishReason:'stop',outputTokens:2};}};
 const store={all:async()=>{throw Error('Run label greeting must not read Memory');},search:async()=>{throw Error('Run label greeting must not search Memory');}};
 const prompt='R11 run test 1 — say hello briefly';
 const result=await executeScheduledAnswer({store,models:{text:async()=>{loads++;return engine;}}},{prompt,model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''});
 assert.equal(result.answer,'Hello!');assert.deepEqual(result.sources,[]);assert.equal(generations,1);assert.equal(loads,1);assert.equal(isSourceFreeConversationRequest(prompt),true);
});
test('lettered audit run labels are stripped before classifying and answering a greeting',async()=>{
 for(const prompt of ['Run A — say hello briefly','R12 Run A: say hello briefly']){
  let generations=0;
  const engine={loaded:'selected',manifest:{contextTokens:8192,maxOutputTokens:512,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:64}),generate:async(messages,_budget,format)=>{generations++;assert.equal(format,'prose');assert.match(messages.at(-1).content,/say hello briefly/i);assert.doesNotMatch(messages.at(-1).content,/Run A/i);return {text:'Hello!',finishReason:'stop',outputTokens:2};}};
  const store={all:async()=>{throw Error('A labelled source-free schedule must not read Memory');},search:async()=>{throw Error('A labelled source-free schedule must not search Memory');}};
  const result=await executeScheduledAnswer({store,models:{text:async()=>engine}},{prompt,model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''});
  assert.equal(result.answer,'Hello!');assert.deepEqual(result.sources,[]);assert.equal(generations,1);
 }
});
test('run labels do not hide knowledge requests or arbitrary prefixed instructions',()=>{
 assert.equal(isSourceFreeConversationRequest('R11 run test 1 — What time does the workshop start?'),false);
 assert.equal(isSourceFreeConversationRequest('R11 — summarize my saved notes'),false);
 assert.equal(isSourceFreeConversationRequest('Please, for this run, say hello briefly'),false);
});
test('standalone source-free schedule questions use prose conversation answering',async()=>{
 for(const prompt of ['海について一文','海について一文を書いてください']){
  let calls=0;
  const engine={loaded:'selected',manifest:{contextTokens:8192,maxOutputTokens:512,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:64}),generate:async(messages,_budget,format)=>{calls++;assert.equal(format,'prose');assert.equal(messages.at(-1).content,prompt);return {text:prompt==='海について一文'?'海は地球上で最も広大な水域です。波や潮があり、多様な生物がいます。':'A verified generated sentence.',finishReason:'stop',outputTokens:12};}};
  const store={all:async()=>{throw Error('A standalone source-free schedule must not read Memory');},search:async()=>{throw Error('A standalone source-free schedule must not search Memory');}};
  const result=await executeScheduledAnswer({store,models:{text:async()=>engine}},{prompt,model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''});
  assert.equal(result.answer,prompt==='海について一文'?'海は地球上で最も広大な水域です。':'A verified generated sentence.');assert.deepEqual(result.sources,[]);assert.equal(calls,1);assert.equal(isSourceFreeConversationRequest(prompt),true);
 }
});
test('schedule questions about saved sources keep the evidence-aware path',()=>{
 for(const prompt of ['What does my saved note say about the sea?','What did we decide earlier about the sea?','Describe the attached image of the sea.'])assert.equal(isSourceFreeConversationRequest(prompt),false,prompt);
});
test('scheduled capture is refused before any model acquisition',async()=>{const f=run();await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'note: Change the memory',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/read-only/);assert.equal(f.calls,0);});
test('scheduled Stop prevents runtime acquisition',async()=>{const f=run(),c=new AbortController();c.abort();await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'Summarize my notes',model:'selected',signal:c.signal,replyStyle:'balanced',userGuidance:''}),/Stopped/);assert.equal(f.calls,0);});
test('scheduled work propagates the shared acquisition failure without another engine or retry',async()=>{const f=run();await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'Summarize my notes',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/Controlled acquisition refusal/);assert.equal(f.calls,1);});
test('scheduled calculation uses a verified local receipt without loading a model',async()=>{const f=run(),input={prompt:'Calculate 12 + 10',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''};f.dependencies.calculate=async expression=>makeDecimalReceipt(expression);const output=await executeScheduledAnswer(f.dependencies,input);assert.equal(output.answer,'12 + 10 = 22');assert.equal(output.calculation.result,'22');assert.deepEqual(output.sources,[]);assert.equal(f.calls,0);f.dependencies.calculate=async expression=>({...makeDecimalReceipt(expression),result:'23'});await assert.rejects(executeScheduledAnswer(f.dependencies,input),/Invalid decimal receipt/);});
test('mixed requests are not silently reduced to calculation',async()=>{const f=run();let calculated=false;f.dependencies.calculate=async()=>{calculated=true;};await assert.rejects(executeScheduledAnswer(f.dependencies,{prompt:'Calculate 12 + 10 and delete notes',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),/Controlled acquisition refusal/);assert.equal(calculated,false);});

test('a scheduled question with missing evidence is not recorded as a successful answer or retried',async()=>{
 const note=createNote({path:'Notes/workshop.md',body:'The workshop takes place in Cedar Hall.'}),body=note.revisions[0].body;
 const ref={noteId:note.id,revision:1,start:0,end:body.length,quote:body};let generations=0,loads=0;
 const runtime={loaded:'selected',assets:{selected:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:100}),generate:async()=>{generations++;return {text:JSON.stringify({status:'insufficient_evidence',answer:'The supplied excerpts do not give a start time.',sources:[]}),finishReason:'stop',outputTokens:18};}};
 await assert.rejects(executeScheduledAnswer({store:{all:async()=>[note],search:async()=>[ref]},models:{text:async()=>{loads++;return runtime;}}},{prompt:'What time does the workshop start?',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),error=>error instanceof ScheduleAnswerError&&/Not enough evidence/.test(error.message)&&error.diagnostic.stage==='answer-validation'&&error.diagnostic.candidate==='The supplied excerpts do not give a start time.'&&error.diagnostic.inference?.outputTokens===18);
 assert.equal(generations,1);assert.equal(loads,1);assert.equal(note.revisions.length,1);
});

test('a scheduled malformed prose answer cannot fall back to a successful copied source excerpt',async()=>{
 const body='The documented process includes preparation, validation, comparison, review, and preservation of the original records. '.repeat(6).trim(),note=createNote({path:'Notes/process.md',body});
 const ref={noteId:note.id,revision:1,start:0,end:body.length,quote:body};let calls=0;
 const runtime={loaded:'selected',assets:{selected:{filesPresent:true}},manifest:{contextTokens:8192,models:[{id:'selected',revision:'fixture'}],runtime:{revision:'fixture'}},count:async()=>({prompt_tokens:80}),generate:async()=>{calls++;return {text:JSON.stringify(calls===1?{answer:body,citations:[{id:'S0',quote:'invalid'}]}:{answer:body}),finishReason:'stop'};}};
 await assert.rejects(executeScheduledAnswer({store:{all:async()=>[note],search:async()=>[ref]},models:{text:async()=>runtime}},{prompt:'Quote the complete documented process.',model:'selected',signal:new AbortController().signal,replyStyle:'balanced',userGuidance:''}),error=>error instanceof ScheduleAnswerError&&/Could not verify a schedule answer/.test(error.message)&&error.diagnostic.stage==='answer-validation'&&typeof error.diagnostic.reason==='string'&&error.diagnostic.candidate===body&&error.diagnostic.inference?.measuredModelCalls===2);
 assert.equal(calls,2);
});
