import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDialogue,appendTurn,completeTurn,dialogueContext,boundedDialogueContext,historyPayload,historyMessages,compactDialogue,parseChatAnswer,planDialogue,readDialogueTurn} from '../src/conversation.ts';
import {groundedAnswer} from '../src/grounded-answer.ts';
import {applyTextTransform,textTransformMessages,transformDialogueText} from '../src/text-transform.ts';
import {createNote,reviseNote} from '../../../dist/core.js';

const engine=(limit=2048)=>({manifest:{contextTokens:limit},count:async m=>({prompt_tokens:Math.ceil(JSON.stringify(m).length/4)}),generate:async()=>({text:'Earlier request: use Japanese. Verification code: AMBER-42.'})});
test('original recall serializes only dialogue excerpt fields while retaining citation receipts',()=>{
 const refs=Array.from({length:12},(_,i)=>({noteId:'source-'+i,revision:1,start:0,end:700,quote:'unvalidated source '.repeat(40)}));
 const state=completeTurn(appendTurn(emptyDialogue(),{id:'answer',user:'question'}),'answer',{answer:'Short original answer',refs});
 const original=readDialogueTurn(state,0,'assistant'),context={summary:'',recent:[],refs:[],recalled:[original]};
 assert.deepEqual(original.refs,refs);
 const payload=JSON.stringify(historyPayload(context)),messages=JSON.stringify(historyMessages(context));
 for(const serialized of [payload,messages]){assert.match(serialized,/Short original answer/);assert.doesNotMatch(serialized,/unvalidated source|source-0|"refs"/);assert.ok(serialized.length<1000);}
});
test('follow-up planning receives the preceding exchange and accepts contextual capture only as a proposal',async()=>{
 let state=appendTurn(emptyDialogue(),{id:'1',user:'合言葉は AMBER-42 です'});
 state=completeTurn(state,'1',{answer:'AMBER-42 をこのやり取りで使います。'});
 state=appendTurn(state,{id:'save-only',user:'Save it',status:'Saved'});assert.equal(dialogueContext(state).lastAnswerIndex,0);
 let received;const e={...engine(),generate:async m=>{received=JSON.stringify(m);return {text:'{"action":"capture","query":"","body":"合言葉は AMBER-42 です"}'};}};
 const plan=await planDialogue(e,'それをメモに保存して',dialogueContext(state));
 assert.match(received,/AMBER-42/);assert.match(received,/それをメモ/);
 assert.equal(plan.body,'合言葉は AMBER-42 です');assert.equal(plan.action,'capture');
 await assert.rejects(()=>planDialogue({...e,generate:async()=>({text:'{"action":"delete","query":"all"}'})},'消して',dialogueContext(state)),/Invalid model action/);
});
test('compaction uses token counts, retains original turns and exact references, and replaces only the active prefix',async()=>{
 let state=emptyDialogue();const ref={noteId:'original',revision:2,start:0,end:4,quote:'原文です'};
 for(let i=0;i<9;i++)state=completeTurn(appendTurn(state,{id:String(i),user:'Long input '+i+' Japanese preference '.repeat(17)}),String(i),{answer:'Answer '+i+' Detail '.repeat(25),refs:i===0?[ref]:[]});
 const original=structuredClone(state.turns);let calls=0;const e={...engine(),generate:async m=>{calls++;assert.ok((await e.count(m)).prompt_tokens+192<=2048);return {text:'Earlier user requested Japanese. Code AMBER-42.'};}};
 const compact=await compactDialogue(state,e,'What was that code?');
 assert.ok(calls>0);assert.deepEqual(compact.turns,original);assert.ok(compact.compaction.through>0);
 assert.ok(dialogueContext(compact).summary.includes('AMBER-42'));
 assert.deepEqual(dialogueContext(compact).refs,[ref]);assert.equal(dialogueContext(compact).recent.at(-1).user,state.turns.at(-1).user);
 assert.ok((await e.count([{role:'user',content:JSON.stringify(dialogueContext(compact))}])).prompt_tokens<=850);
});
test('stopped or failed compaction keeps the existing state intact and never fabricates a summary',async()=>{
 let state=emptyDialogue();for(let i=0;i<8;i++)state=completeTurn(appendTurn(state,{id:String(i),user:'data '.repeat(300)}),String(i),{answer:'prior answer'});
 const before=structuredClone(state);await assert.rejects(()=>compactDialogue(state,{...engine(),generate:async()=>{throw Error('Stopped');}},'next'),/Stopped/);
 assert.deepEqual(state,before);assert.equal(state.compaction,null);
});
test('answers can refer to dialogue without invented citations; invalid citations fail',()=>{
 assert.deepEqual(parseChatAnswer('{"answer":"You said AMBER-42.","citations":[]}',[]),{answer:'You said AMBER-42.',sources:[]});
 assert.throws(()=>parseChatAnswer('{"answer":"made up","citations":[{"id":"S1","quote":"fake"}]}',[]),/Citation/);
 assert.throws(()=>parseChatAnswer('{"answer":"","citations":[]}',[]),/Invalid/);
});
test('interactive reply uses prior turns and validates pinned source bytes after generation',async()=>{
 let note=createNote({path:'Notes/water.md',body:'水は4Lです。'});const ref={noteId:note.id,revision:1,start:0,end:7,quote:note.revisions[0].body};
 const context={summary:'',recent:[{id:'previous',user:'水を確認して',answer:'水は4Lです。',refs:[ref]}],refs:[ref]};
 const store={all:async()=>[note],search:async()=>[]};let seen;
 const e={...engine(),loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},generate:async m=>{seen=JSON.stringify(m);return {text:JSON.stringify({answer:'4Lです。',citations:[{id:'S1',quote:ref.quote}]})};}};
 const reply=await groundedAnswer(store,e,'4B','それは何リットル？','','answer',context);
 assert.match(seen,/水を確認して/);assert.equal(reply.sources[0].noteId,note.id);
 e.generate=async()=>{note=reviseNote(note,{body:'水は5Lです。'},1);return {text:JSON.stringify({answer:'4L',citations:[{id:'S1',quote:ref.quote}]})};};
 await assert.rejects(()=>groundedAnswer(store,e,'4B','何リットル？','','answer',context),/Source changed/);
});
test('Stop during evidence budgeting prevents generation and completion',async()=>{
 let stopped=false,generated=false;const store={all:async()=>[],search:async()=>[]};
 const e={...engine(),loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},count:async()=>{stopped=true;return {prompt_tokens:10};},generate:async()=>{generated=true;return {text:'{"answer":"late answer","citations":[]}'};}};
 await assert.rejects(()=>groundedAnswer(store,e,'4B','hello','','chat',{summary:'',recent:[],refs:[]},()=>{if(stopped)throw Error('Stopped');}),/Stopped/);
 assert.equal(generated,false);
});
test('pinned generated prose cannot reintroduce a changed ancestor as evidence',async()=>{
 const original=createNote({path:'Notes/original.md',body:'Original fact'}),parent={noteId:original.id,revision:1,start:0,end:13,quote:'Original fact'};
 const derived=createNote({path:'Inbox/derived.md',body:'Derived claim',kind:'generated',sources:[parent]}),ref={noteId:derived.id,revision:1,start:0,end:13,quote:'Derived claim'};
 const changed=reviseNote(original,{body:'Corrected fact'},1),store={all:async()=>[changed,derived],search:async()=>[]};
 let received;const e={...engine(),loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},generate:async m=>{received=JSON.stringify(m);return {text:'{"answer":"No current saved source.","citations":[]}'};}};
 await groundedAnswer(store,e,'4B','the current fact?','','answer',{summary:'',recent:[],refs:[ref]});
 assert.equal(received.includes('Derived claim'),false);
});
test('an oversized rejected turn cannot permanently block later short requests',async()=>{
 const long='原文とunique-ID-8382 '.repeat(1000);let state=completeTurn(appendTurn(emptyDialogue(),{id:'oversize',user:long}),'oversize',{status:'Input exceeds context limit'});
 let calls=0;const e={...engine(),generate:async m=>{calls++;assert.ok((await e.count(m)).prompt_tokens+192<=2048);return {text:'Earlier oversized input contained unique-ID-8382; original archived.'};}};
 const compact=await compactDialogue(state,e,'Hello');assert.ok(calls>1);assert.equal(compact.turns[0].user,long);assert.equal(compact.compaction.through,1);assert.match(compact.compaction.summary,/8382/);
});
test('dialogue-only replies do not receive unrelated previous search results as evidence',async()=>{
 const note=createNote({path:'Notes/other-code.md',body:'Other code PINE'}),ref={noteId:note.id,revision:1,start:0,end:15,quote:'Other code PINE'};
 const state=completeTurn(appendTurn(emptyDialogue(),{id:'search',user:'Find other code'}),'search',{results:[ref]});let received;
 const e={...engine(),loaded:'4B',assets:{},manifest:{contextTokens:2048,models:[],runtime:{}},generate:async m=>{received=JSON.stringify(m);return {text:'{"answer":"LILAC","citations":[]}'};}};
 await groundedAnswer({all:async()=>[note],search:async()=>[ref]},e,'4B','What did I say?','','chat',dialogueContext(state));
 assert.equal(received.includes('Other code PINE'),false);
});
test('compacted dialogue can recall original user words rather than trusting a lossy summary',()=>{
 let state=completeTurn(appendTurn(emptyDialogue(),{id:'original',user:'この会話の検証コードは LILAC-7319 です。メモに保存しません。'}),'original',{answer:'Understood'});
 state=appendTurn(state,{id:'recent',user:'different subject'});state.compaction={through:1,summary:'Lossy summary omitted the code.'};
 const context=dialogueContext(state,'会話で伝えた検証コードは何？');
 assert.match(JSON.stringify(context.recalled),/LILAC-7319/);assert.equal(state.turns[0].id,'original');
});
test('archive recall includes nearby corrections, chronology, and matching text beyond the chunk prefix',()=>{
 let s=emptyDialogue();for(const [i,user] of ['Unrelated introduction. '.repeat(20)+'My verification code is OLD-111.','Correction: actually it is NEW-222.','I need the verification code tomorrow.'].entries())s=appendTurn(s,{id:String(i),user});
 s.compaction={through:3,summary:'The user corrected their code to NEW-222.'};const c=dialogueContext(s,'What is my verification code?');
 assert.match(JSON.stringify(c.recalled),/OLD-111/);assert.match(JSON.stringify(c.recalled),/NEW-222/);
 for(const r of c.recalled)assert.equal(s.turns[r.turnIndex].user.slice(r.start,r.end),r.quote);
 assert.doesNotMatch(JSON.stringify(historyMessages(c)),/Prefer these original words over/);
});
test('high-token archived excerpts shrink without blocking a fully compacted conversation',async()=>{
 let s=emptyDialogue();for(let i=0;i<2;i++)s=appendTurn(s,{id:String(i),user:'検証コード 𠮷'.repeat(200)});s.compaction={through:2,summary:'Earlier requests.'};
 const e={...engine(),count:async m=>({prompt_tokens:JSON.stringify(m).length*2}),generate:async()=>{throw Error('No extra compaction needed');}};
 const context=await boundedDialogueContext(s,e,'検証コード');assert.ok((await e.count([{role:'user',content:JSON.stringify(context.recalled)}])).prompt_tokens<=240);
 const compact=await compactDialogue(s,e,'Hi');assert.equal(compact.compaction.through,2);
});
test('archive focus maps normalization back to exact original UTF-16 offsets',()=>{
 for(const prefix of ['e\u0301'.repeat(200),'𝔸'.repeat(200)]){
  const user=prefix+' My verification code is LILAC-7319.';let s=appendTurn(emptyDialogue(),{id:'unicode',user});s.compaction={through:1,summary:'Earlier input'};
  const recalled=dialogueContext(s,'What is my verification code?').recalled[0];
  assert.match(recalled.quote,/LILAC-7319/);assert.equal(user.slice(recalled.start,recalled.end),recalled.quote);
 }
});
test('explicit history read resolves an original turn even when summary and similar questions are misleading',async()=>{
 let s=appendTurn(emptyDialogue(),{id:'first',user:'The original code is LILAC-7319.'});s=appendTurn(s,{id:'second',user:'What was the code?'});s.compaction={through:2,summary:'Wrong assistant claim: PINE.'};
 const context=dialogueContext(s,'Read my first message'),plan=await planDialogue({...engine(),generate:async()=>({text:'{"action":"recall","query":"","historyIndex":0,"historyPart":"user"}'})},'Read my first message',context);
 assert.equal(plan.historyIndex,0);assert.equal(context.turnCount,2);assert.equal(readDialogueTurn(s,plan.historyIndex).quote,s.turns[0].user);
 assert.throws(()=>readDialogueTurn(s,2),/unavailable/);assert.throws(()=>readDialogueTurn(s,-1),/unavailable/);
 await assert.rejects(()=>planDialogue({...engine(),generate:async()=>({text:'{"action":"chat","query":"","historyIndex":-1}'})},'read',context),/Invalid/);
});
test('dialogue replies use an answer-only schema without making file citations',()=>{
 assert.deepEqual(parseChatAnswer('{"answer":"LILAC-7319"}',[],true),{answer:'LILAC-7319',sources:[]});
 assert.throws(()=>parseChatAnswer('{"answer":"LILAC-7319","citations":[{"id":"S1","quote":"invented"}]}',[],true),/Citation/);
 assert.throws(()=>parseChatAnswer('{"answer":"No citation field"}',[]),/Invalid/);
});

test('literal dialogue tools transform actual original bytes without regex, writes or lost provenance',()=>{
 const original={turnId:'prior',turnIndex:2,speaker:'assistant',quote:'A$&;日本語;🌳',start:0,end:11};const before=structuredClone(original);
 const result=applyTextTransform('{"action":"replace","find":";","with":"\\n"}',original);
 assert.equal(result.answer,'A$&\n日本語\n🌳');assert.equal(result.toolCalls[0].result.matches,2);assert.equal(result.toolCalls[0].target.turnId,'prior');assert.deepEqual(original,before);
 assert.equal(applyTextTransform('{"action":"replace","find":"A$&","with":"$&"}',original).answer,'$&;日本語;🌳');
 const missing=applyTextTransform('{"action":"replace","find":"missing","with":"x"}',original);assert.equal(missing.answer,undefined);assert.match(missing.toolCalls[0].result.error,/not found/);
 assert.throws(()=>applyTextTransform('{"action":"replace","find":"","with":"x"}',original),/Invalid/);
 assert.throws(()=>applyTextTransform('{"action":"delete","answer":"done"}',original),/Invalid/);
 assert.throws(()=>applyTextTransform('{"action":"replace","find":";","with":"x","path":"Settings/models.md"}',original),/Invalid/);
 assert.throws(()=>applyTextTransform('{"action":"reply","answer":"x"}',original),/Cannot resolve/);
 assert.match(applyTextTransform(JSON.stringify({action:'replace',find:'A',with:'x'.repeat(30000)}),original).status,/limit/);
 const unchanged=applyTextTransform('{"action":"replace","find":";","with":";"}',original);assert.equal(unchanged.answer,undefined);assert.match(unchanged.toolCalls[0].result.error,/No change/);
});

test('line splitting is a typed delimiter operation, not model-authored replacement prose',()=>{
 const original={turnId:'original',turnIndex:0,speaker:'assistant',quote:'north;south;east',start:0,end:16};
 const result=applyTextTransform('{"action":"split_lines","delimiter":";"}',original);
 assert.equal(result.answer,'north\nsouth\neast');assert.equal(result.toolCalls[0].name,'text.split_lines');
 assert.deepEqual(result.toolCalls[0].arguments,{delimiter:';'});assert.equal(result.toolCalls[0].result.matches,2);
 assert.throws(()=>applyTextTransform('{"action":"split_lines","delimiter":";","with":"invented"}',original),/Invalid/);
 assert.throws(()=>applyTextTransform('{"action":"split_lines","delimiter":""}',original),/Invalid/);
 assert.match(applyTextTransform('{"action":"split_lines","delimiter":"|"}',original).status,/not found/);
 assert.equal(applyTextTransform('{"action":"split_lines","delimiter":"🌳"}',{...original,quote:'山🌳川'}).answer,'山\n川');
});

test('literal-operation planning carries only selected original/current request and enforces cancellation before accepting output',async()=>{
 const original={turnId:'first',turnIndex:0,speaker:'user',quote:'My code is CEDAR-4826.',start:0,end:22};
 const messages=textTransformMessages('What code?',original);assert.equal(messages.length,2);assert.match(messages[1].content,/CEDAR/);assert.match(messages[1].content,/What code/);
 const result=await transformDialogueText({...engine(),generate:async()=>({text:'{"action":"replace","find":"-","with":"/"}'})},'replace dash with slash',original);assert.equal(result.answer,'My code is CEDAR/4826.');
 await assert.rejects(()=>transformDialogueText({...engine(),generate:async()=>({text:'{"action":"reply","answer":"partial"}',stopped:true})},'code?',original),/Stopped/);
 let generated=false;await assert.rejects(()=>transformDialogueText({...engine(),generate:async()=>{generated=true;return {text:''};}},'code?',original,()=>{throw Error('Stopped');}),/Stopped/);assert.equal(generated,false);
});

test('planner can select a read-only transformation only with an explicit original-turn target',async()=>{
 const state=completeTurn(appendTurn(emptyDialogue(),{id:'first',user:'code'}),'first',{answer:'CEDAR-4826'}),context=dialogueContext(state);
 const e={...engine(),generate:async()=>({text:'{"action":"transform","query":"","historyIndex":0,"historyPart":"assistant"}'})};
 assert.equal((await planDialogue(e,'Split the preceding answer',context)).action,'transform');
 await assert.rejects(()=>planDialogue({...e,generate:async()=>({text:'{"action":"transform","query":""}'})},'split',context),/Invalid/);
 await assert.rejects(()=>planDialogue({...e,generate:async()=>({text:'{"action":"transform","query":"","historyIndex":0}'})},'split',context),/Invalid/);
 const ref={noteId:'assistant-source',revision:1,start:0,end:5,quote:'other'};state.turns[0].refs=[ref];
 assert.deepEqual(readDialogueTurn(state,0,'user').refs,[]);assert.deepEqual(readDialogueTurn(state,0,'assistant').refs,[ref]);
});


test('existing-note edits route to a target proposal rather than capture or direct execution',async()=>{
 const context={summary:'',recent:[],refs:[],turnCount:0};
 const e={...engine(),generate:async()=>({text:'{"action":"edit","query":"Notes/water.md","historyIndex":null}'})};
 assert.equal((await planDialogue(e,'In Notes/water.md replace 3L with 4L',context)).action,'edit');
 await assert.rejects(()=>planDialogue({...e,generate:async()=>({text:'{"action":"edit","query":""}'})},'fix it',context),/Invalid/);
});
