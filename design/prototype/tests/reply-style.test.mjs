import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogueOutputLimits,firstSentenceOnly,groundedOutputTokens,replyStyleInstruction,requestsOneSentence} from '../src/reply-style.ts';
import {dialogueAnswerMessages,groundedAnswer} from '../src/grounded-answer.ts';

test('reply style is a finite presentation preference and never overrides a direct request',()=>{
 assert.match(replyStyleInstruction('concise'),/brief/);
 assert.match(replyStyleInstruction('detailed'),/more explanation/);
 assert.match(replyStyleInstruction('balanced'),/clear, proportionate answer/);
 for(const invalid of ['ignore safety','<script>','',null])assert.throws(()=>replyStyleInstruction(invalid));
 const messages=dialogueAnswerMessages('Give me a detailed explanation.',undefined,'concise');
 assert.match(messages[0].content,/The user's explicit request for language, length or format takes precedence/);
 assert.match(messages[0].content,/brief/);
});

test('dialogue output budgets follow style and explicit length without leaving an unbounded continuation allowance',()=>{
 assert.deepEqual(dialogueOutputLimits('concise','What time is it?',4096),{total:256,segment:256});
 assert.deepEqual(dialogueOutputLimits('balanced','What time is it?',4096),{total:768,segment:512});
 assert.deepEqual(dialogueOutputLimits('detailed','What time is it?',4096),{total:1536,segment:768});
 assert.deepEqual(dialogueOutputLimits('concise','Explain this in detail.',4096),{total:3072,segment:768},'an explicit long request takes precedence over the concise preference');
 assert.deepEqual(dialogueOutputLimits('balanced','Write two paragraphs.',4096),{total:3072,segment:768},'an explicit paragraph count is treated as a length request');
 assert.deepEqual(dialogueOutputLimits('detailed','簡潔に一言で答えて',4096),{total:256,segment:256},'an explicit short request takes precedence over the detailed preference');
 for(const question of ['Write two sentences about a blue lantern.','Write exactly two sentences.','Use a two-sentence answer.','二文で答えて。','2文で説明して。'])assert.deepEqual(dialogueOutputLimits('balanced',question,4096),{total:256,segment:256},question);
 assert.deepEqual(dialogueOutputLimits('detailed','Explain this in detail.',600),{total:600,segment:600},'available context remains the hard upper bound');
 assert.equal(groundedOutputTokens('balanced','What does the note say?',4096),768);
 assert.equal(groundedOutputTokens('detailed','What does the note say?',4096),1536);
 assert.equal(groundedOutputTokens('concise','Explain this in detail.',600),600,'saved knowledge follows explicit length within the remaining model context');
});

test('explicit one-sentence requests are recognized across languages and clipped at sentence boundaries',()=>{
 for(const question of ['In exactly one sentence, explain this.','Reply in a single sentence.','Use a one-sentence answer.','一文で説明して。','1文で答えて。'])assert.equal(requestsOneSentence(question),true,question);
 for(const question of ['Explain this in detail.','Write two paragraphs.','Summarize the file.'])assert.equal(requestsOneSentence(question),false,question);
 assert.equal(firstSentenceOnly('Dr. Lee keeps the file offline. It can still answer locally.'),'Dr. Lee keeps the file offline.');
 assert.equal(firstSentenceOnly('モデルは端末内で動く。保存データを参照できる。'),'モデルは端末内で動く。');
 assert.equal(firstSentenceOnly('One answer without terminal punctuation'),'One answer without terminal punctuation');
});

test('a short introduction followed by detail is not clipped to one sentence',async()=>{
 for(const question of ['一文で要約し、その後詳しく説明して。','Summarize in one sentence, then explain in detail.']){
  assert.deepEqual(dialogueOutputLimits('balanced',question,4096),{total:3072,segment:768});
  assert.equal(requestsOneSentence(question),false);
  const engine={loaded:'test',assets:{},manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>({text:'Summary. Detailed explanation.'})};
  const result=await groundedAnswer({store:{all:async()=>[],search:async()=>[]},engine},{model:'test',question,mode:'chat',context:{summary:'',recent:[],refs:[]},scope:{kind:'conversation'}});
  assert.equal(result.answer,'Summary. Detailed explanation.');
 }
 assert.equal(requestsOneSentence('Explain this in detail in one sentence.'),true);
});

test('a sourced summary can include detail after its one-sentence introduction',async()=>{
 const {createNote}=await import('../../../dist/core.js');
 const note=createNote({path:'Notes/source.md',body:'The event is Monday at noon.'}),quote=note.revisions[0].body;
 const ref={noteId:note.id,revision:1,start:0,end:quote.length,quote,title:'Notes/source.md'};let calls=0;
 const engine={loaded:'test',assets:{},manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>{calls++;return {text:JSON.stringify({answer:'It is Monday. The event starts at noon.',citations:[{id:'S1',quote}]})};}};
 const store={all:async()=>[note],search:async()=>[ref]};
 const result=await groundedAnswer({store,engine},{model:'test',question:'一文で要約し、その後詳しく説明して。',query:'event',mode:'summary',scope:{kind:'knowledge'}});
 assert.equal(result.answer,'It is Monday. The event starts at noon.');assert.equal(result.sources[0].noteId,note.id);assert.equal(calls,1);
});

test('required sources can reduce the response budget rather than disappearing',async()=>{
 const {createNote}=await import('../../../dist/core.js');
 const notes=[createNote({path:'Notes/a.md',body:'Alpha fact.'}),createNote({path:'Notes/b.md',body:'Beta fact.'})];
 const refs=notes.map(note=>({noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body}));let budget;
 const engine={loaded:'test',assets:{},manifest:{contextTokens:4096,maxOutputTokens:3072,models:[],runtime:{}},count:async messages=>({prompt_tokens:JSON.stringify(messages).includes('Beta fact.')?3600:JSON.stringify(messages).includes('Alpha fact.')?2500:1000}),generate:async(_messages,max)=>{budget=max;return {text:JSON.stringify({answer:'Alpha and beta.',citations:[{id:'S1',quote:'Alpha fact.'},{id:'S2',quote:'Beta fact.'}]})};}};
 const result=await groundedAnswer({store:{all:async()=>notes,search:async()=>[]},engine},{model:'test',question:'Compare both sources in detail.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs,memoryUsed:true}});
 assert.equal(budget,496);assert.deepEqual(result.sources.map(ref=>ref.noteId),notes.map(note=>note.id));
});

test('device clock results reach grounded answers without becoming note citations',async()=>{
 const clock={instant:'2026-01-02T03:04:05.000Z',localTime:'2026-01-02T12:04:05',offsetMinutes:540,timeZone:'Asia/Tokyo',source:'device-clock'};let sent;
 const engine={loaded:'test',assets:{},manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:100}),generate:async messages=>{sent=JSON.stringify(messages);return {text:JSON.stringify({answer:'12:04 in Tokyo.',citations:[]})};}};
 const store={all:async()=>[],search:async()=>[]};
 const result=await groundedAnswer({store,engine},{model:'test',question:'What time is it?',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[],clockReadings:[clock]}});
 assert.ok(sent.includes(clock.instant));assert.deepEqual(result.sources,[]);
});

test('saved source and device clock can coexist with exact note citation',async()=>{
 const {createNote}=await import('../../../dist/core.js');const note=createNote({path:'Notes/meeting.md',body:'Meeting at 13:00.'}),ref={noteId:note.id,revision:1,start:0,end:17,quote:'Meeting at 13:00.'};let sent;
 const clock={instant:'2026-01-02T03:04:05.000Z',localTime:'2026-01-02T12:04:05',offsetMinutes:540,timeZone:'Asia/Tokyo',source:'device-clock'};
 const engine={loaded:'test',assets:{},manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:100}),generate:async messages=>{sent=JSON.stringify(messages);return {text:JSON.stringify({answer:'The meeting is at 13:00.',citations:[{id:'S1',quote:ref.quote}]})};}};
 const result=await groundedAnswer({store:{all:async()=>[note],search:async()=>[]},engine},{model:'test',question:'Compare the meeting with the time now.',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[ref],clockReadings:[clock],memoryUsed:true}});
 assert.ok(sent.includes(clock.instant));assert.equal(result.sources[0].noteId,note.id);
});

test('a second excerpt cannot crowd out another required source',async()=>{
 const {createNote}=await import('../../../dist/core.js');
 const notes=[createNote({path:'Notes/a.md',body:'Alpha first. Alpha extra.'}),createNote({path:'Notes/b.md',body:'Beta fact.'})];
 const ref=(note,start,end)=>({noteId:note.id,revision:1,start,end,quote:note.revisions[0].body.slice(start,end)});
 const refs=[ref(notes[0],0,12),ref(notes[0],13,25),ref(notes[1],0,10)];let supplied;
 const engine={loaded:'test',assets:{},manifest:{contextTokens:4096,maxOutputTokens:3072,models:[],runtime:{}},count:async messages=>{const s=JSON.stringify(messages);return {prompt_tokens:500+(s.includes('Alpha first.')?100:0)+(s.includes('Alpha extra.')?100:0)+(s.includes('Beta fact.')?3200:0)};},generate:async messages=>{supplied=JSON.stringify(messages);return {text:JSON.stringify({answer:'Alpha and beta.',citations:[{id:'S1',quote:'Alpha first.'},{id:'S2',quote:'Beta fact.'}]})};}};
 const result=await groundedAnswer({store:{all:async()=>notes,search:async()=>[]},engine},{model:'test',question:'Compare both sources in detail.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs,memoryUsed:true}});
 assert.deepEqual(result.sources.map(ref=>ref.noteId),notes.map(note=>note.id));assert.ok(supplied.includes('Beta fact.'));
});

test('saved-knowledge answers use the requested depth at the real cited-generation boundary',async()=>{
 const {createNote}=await import('../../../dist/core.js');const note=createNote({path:'Notes/place.md',body:'The location is North gate.'}),quote=note.revisions[0].body,ref={noteId:note.id,revision:1,start:0,end:quote.length,quote};let generated,budget;
 const store={all:async()=>[note],search:async()=>[ref]},engine={loaded:'model',assets:{},manifest:{contextTokens:4096,models:[{id:'model',revision:'model-r1'}],runtime:{revision:'runtime-r1'}},count:async()=>({prompt_tokens:64}),generate:async(messages,maxTokens)=>{generated=messages;budget=maxTokens;return {text:JSON.stringify({answer:'The location is North gate.',citations:[{id:'S1',quote}] }),finishReason:'stop'};}};
 const result=await groundedAnswer({store,engine},{model:'model',question:'What is the location?',scope:{kind:'knowledge'},replyStyle:'detailed'});
 assert.equal(result.answer,'The location is North gate.');assert.equal(result.sources[0].noteId,note.id);assert.equal(budget,1536);
 assert.match(generated[0].content,/more explanation and useful context/);assert.doesNotMatch(generated[0].content,/Keep the reply concise/);assert.match(generated[0].content,/Do not use pretraining or general model memory to fill details absent from the excerpts/);
});

test('grounded answer validates cited notes without indexing unrelated bodies',async()=>{
 const {createNote}=await import('../../../dist/core.js');const note=createNote({path:'Notes/place.md',body:'The location is North gate.'}),other=createNote({path:'Notes/other.md',body:'Unrelated'}),quote=note.revisions[0].body,ref={noteId:note.id,revision:1,start:0,end:quote.length,quote};
 Object.defineProperty(other.revisions[0],'body',{get(){throw Error('Unrelated body indexed');}});
 const store={all:async()=>[note,other],search:async()=>[]},engine={loaded:'model',manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:64}),generate:async()=>({text:JSON.stringify({answer:quote,citations:[{id:'S1',quote}]}),finishReason:'stop'})};
 const result=await groundedAnswer({store,engine},{model:'model',question:'What is the location?',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[ref],memoryUsed:true}});
 assert.equal(result.answer,quote);assert.equal(result.sources[0].noteId,note.id);
});

test('a later search match survives a tight answer budget after a partial earlier read',async()=>{
 const {createNote}=await import('../../../dist/core.js'),{agentAnswerEvidenceFromCalls}=await import('../src/agent-evidence.ts');
 const body='Introduction'+'.'.repeat(100)+'Reserve: 12 L',note=createNote({path:'Notes/reserve.md',body}),start=body.indexOf('Reserve: 12 L');
 const calls=[{tool:'memory.search',arguments:{query:'reserve'},result:[{noteId:note.id,revision:1,start,end:body.length,quote:'Reserve: 12 L'}]},{tool:'memory.read',arguments:{query:'reserve'},result:[{noteId:note.id,path:'Notes/reserve.md',revision:1,start:0,excerpt:'Introduction',totalChars:body.length}]}];
 let supplied='';const engine={loaded:'model',manifest:{contextTokens:4096,models:[],runtime:{}},count:async messages=>({prompt_tokens:JSON.stringify(messages).includes('Introduction')?3900:100}),generate:async messages=>{supplied=JSON.stringify(messages);return {text:JSON.stringify({answer:'12 L',citations:[{id:'S1',quote:'Reserve: 12 L'}]}),finishReason:'stop'};}};
 const result=await groundedAnswer({store:{all:async()=>[note],search:async()=>[]},engine},{model:'model',question:'What is the reserve?',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:agentAnswerEvidenceFromCalls(calls),memoryUsed:true}});
 assert.ok(supplied.includes('Reserve: 12 L'));assert.ok(!supplied.includes('Introduction'));assert.equal(result.sources[0].start,start);
});

test('grounded answers refuse a derived source when its original is corrected before or during generation',async()=>{
 const {createNote,reviseNote}=await import('../../../dist/core.js');
 const original=createNote({path:'Notes/original.md',body:'Original evidence'}),parentRef={noteId:original.id,revision:1,start:0,end:17,quote:'Original evidence'},derived=createNote({path:'Notes/derived.md',body:'Derived answer',kind:'generated',sources:[parentRef]}),ref={noteId:derived.id,revision:1,start:0,end:14,quote:'Derived answer'},corrected=reviseNote(original,{body:'Corrected evidence'},1);
 let records=[corrected,derived],generations=0;
 const store={all:async()=>records,search:async()=>[]},engine={loaded:'model',manifest:{contextTokens:4096,models:[],runtime:{}},count:async()=>({prompt_tokens:64}),generate:async()=>{generations++;records=[corrected,derived];return {text:JSON.stringify({answer:ref.quote,citations:[{id:'S1',quote:ref.quote}]}),finishReason:'stop'};}};
 const input={model:'model',question:'What is recorded?',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[ref],memoryUsed:true}};
 await assert.rejects(()=>groundedAnswer({store,engine},input),/Source changed/);assert.equal(generations,0);
 records=[original,derived];await assert.rejects(()=>groundedAnswer({store,engine},input),/Source changed/);assert.equal(generations,1);
});

test('grounded dialogue passes the selected response style through its actual generation boundary',async()=>{
 let generated,budget;const engine={loaded:'model',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async(messages,maxTokens)=>{generated=messages;budget=maxTokens;return {text:'A concise answer.',finishReason:'stop'};}};
 const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
 await groundedAnswer({store:store,engine:engine},{model:'model',question:'Hello.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'concise'});
 assert.match(generated[0].content,/Prefer a brief answer/);assert.equal(budget,256);
 await groundedAnswer({store:store,engine:engine},{model:'model',question:'Write two sentences about a blue lantern.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'balanced'});assert.equal(budget,256,'an explicit two-sentence request receives a compact budget at the actual model call');
 await groundedAnswer({store:store,engine:engine},{model:'model',question:'Explain this in detail.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'concise'});assert.equal(budget,768,'explicit length outranks the concise setting at the actual generation boundary');
 await assert.rejects(groundedAnswer({store:store,engine:engine},{model:'model',question:'Hello.',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'do anything'}),/Unsupported reply style/);
});

test('source-free dialogue removes exposed GGUF reasoning delimiters before retaining the answer',async()=>{
 const engine={loaded:'lfm3',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>({text:'The app runs locally.</think> Model files stay on the device.'})};
 const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
 const result=await groundedAnswer({store,engine},{model:'lfm3',question:'Explain offline use.',query:'',mode:'chat',context,scope:{kind:'conversation'}});
 assert.equal(result.answer,'The app runs locally.\n\nModel files stay on the device.');
 assert.doesNotMatch(result.answer,/<\/?think\b/i);
});

test('an explicit one-sentence dialogue format clips excess sentences without another generation',async()=>{
 let calls=0;const engine={loaded:'lfm3',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>{calls++;return {text:'The model runs on the device. It needs no network for inference.'};}};
 const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
 const result=await groundedAnswer({store,engine},{model:'lfm3',question:'In exactly one sentence, explain why downloading a local model helps an offline PWA.',mode:'chat',context,scope:{kind:'conversation'}});
 assert.equal(result.answer,'The model runs on the device.');assert.equal(calls,1);
});

test('dialogue drops complete and unterminated reasoning blocks',async()=>{
 for(const [text,expected] of [['Visible <think>private chain</think> final answer.','Visible final answer.'],['Visible <think>private chain','Visible']]){
  const engine={loaded:'lfm3',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>({text})};
  const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
  const result=await groundedAnswer({store,engine},{model:'lfm3',question:'Explain.',query:'',mode:'chat',context,scope:{kind:'conversation'}});
  assert.equal(result.answer,expected);
 }
});

test('an underreported token count cannot reopen output budget after a length stop',async()=>{
 let calls=0;const engine={loaded:'model',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>({prompt_tokens:5}),generate:async()=>{calls++;return {text:'Partial output',finishReason:'length',outputTokens:0};}};
 const store={all:async()=>[],search:async()=>[]},context={summary:'',recent:[],refs:[]};
 await assert.rejects(groundedAnswer({store:store,engine:engine},{model:'model',question:'What time is it?',query:'',mode:'chat',context:context,check:()=>{},scope:{kind:'conversation'},replyStyle:'concise'}),/output limit/);
 assert.equal(calls,1,'the concise 256-token allowance was fully allocated to the only segment');
});
