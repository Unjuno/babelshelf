import test from 'node:test';
import assert from 'node:assert/strict';
import {groundedAnswer} from '../src/grounded-answer.ts';
import {createNote} from '../../../dist/core.js';

test('a previously partial source-capacity task can answer from sources that fit',async()=>{
 const notes=[createNote({path:'Notes/one.md',body:'First source: alpha.'}),createNote({path:'Notes/two.md',body:'Second source: beta.'})];
 const refs=notes.map(note=>({noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body,title:note.path}));let prompt;
 const engine={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:2048,models:[{id:'test',revision:'r1'}],runtime:{revision:'engine1'}},count:async messages=>({prompt_tokens:JSON.stringify(messages).includes('Second source: beta.')?1900:100}),generate:async messages=>{prompt=messages;return {text:JSON.stringify({answer:'Alpha.',citations:[{id:'S1',quote:'First source: alpha.'}]})};}};
 const result=await groundedAnswer({store:{all:async()=>notes,search:async()=>[]},engine},{model:'test',question:'Compare these two sources.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs,memoryUsed:true,budgetExhausted:true}});
 assert.equal(result.answer,'Alpha.');assert.equal(result.sources.length,1);assert.equal(result.sources[0].noteId,notes[0].id);
 assert.match(JSON.stringify(prompt),/clearly partial answer/);assert.doesNotMatch(JSON.stringify(prompt),/Second source: beta/);
});

test('partial work cannot invent an answer when no original fits',async()=>{
 const note=createNote({path:'Notes/one.md',body:'Original source.'}),ref={noteId:note.id,revision:1,start:0,end:16,quote:'Original source.'};let generations=0;
 const engine={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:2048,models:[{id:'test',revision:'r1'}],runtime:{revision:'engine1'}},count:async messages=>({prompt_tokens:JSON.stringify(messages).includes('Original source.')?2000:100}),generate:async()=>{generations++;throw Error('Unexpected generation');}};
 await assert.rejects(groundedAnswer({store:{all:async()=>[note],search:async()=>[]},engine},{model:'test',question:'Explain the source.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[ref],memoryUsed:true,budgetExhausted:true}}),/Context limit.*sources/);
 assert.equal(generations,0);
});

test('required evidence reduces answer space explicitly without losing source identity',async()=>{
 const note=createNote({path:'Notes/one.md',body:'First source: alpha.'});
 const ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 for(const promptTokens of [100,1700]){
  let allocated;
  const engine={loaded:'test',assets:{test:{filesPresent:true}},manifest:{contextTokens:2048,models:[{id:'test',revision:'r1'}],runtime:{revision:'engine1'}},count:async messages=>({prompt_tokens:JSON.stringify(messages).includes(ref.quote)?promptTokens:100}),generate:async (_messages,tokens)=>{allocated=tokens;return {text:JSON.stringify({answer:'Alpha.',citations:[{id:'S1',quote:ref.quote}]})};}};
  const result=await groundedAnswer({store:{all:async()=>[note],search:async()=>[]},engine},{model:'test',question:'Explain this source in detail.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs:[ref],memoryUsed:true}});
  assert.equal(result.answer,'Alpha.');assert.equal(result.sources[0].noteId,note.id);assert.equal(result.sources[0].revision,1);
  assert.notEqual(result.status,'insufficient_evidence');
  if(promptTokens===1700){assert.equal(allocated,348);assert.equal(result.answerBudget.allocatedTokens,allocated);assert.ok(result.answerBudget.requestedTokens>allocated);assert.equal(result.answerBudget.reason,'required-evidence');}
  else assert.equal(result.answerBudget,undefined);
 }
});


test('copy review exposes capacity pressure without claiming partial coverage',async()=>{
 const {dialogueCopyHasLimitedSpace,dialogueCopyIsPartial}=await import('../src/dialogue-copy.ts');
 const source={turnId:'t',turnIndex:0,speaker:'assistant'};
 const receipt={tool:'knowledge.answer',status:'succeeded',output:{answerBudget:{requestedTokens:1024,allocatedTokens:348,reason:'required-evidence'}}};
 const state={turns:[{id:'t',user:'Explain',answer:'Alpha.',status:'Review new note',activity:[receipt]}]};
 assert.equal(dialogueCopyHasLimitedSpace(state,source),true);
 assert.equal(dialogueCopyIsPartial(state,source),false);
 assert.equal(dialogueCopyHasLimitedSpace(state,{...source,speaker:'user'}),false);
 assert.equal(dialogueCopyHasLimitedSpace(state,{...source,turnId:'other'}),false);
 receipt.output.answerBudget.allocatedTokens=-1;assert.equal(dialogueCopyHasLimitedSpace(state,source),false);
 receipt.output.answerBudget.allocatedTokens=348;receipt.status='failed';assert.equal(dialogueCopyHasLimitedSpace(state,source),false);
});


test('terminal answer keeps the explicit one-sentence contract without intent reclassification',async()=>{
 const note=createNote({path:'Notes/meeting.md',body:'集合は午前10時。持ち物は水。'});
 const ref={noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body};
 const engine={manifest:{models:[],runtime:{}},generate:async()=>{throw Error('No regeneration');}};
 await assert.rejects(groundedAnswer({store:{all:async()=>[note],search:async()=>[]},engine},{model:'test',question:'この入力ファイルを一文で要約してください。',mode:'answer',scope:{kind:'file',file:{noteId:note.id,revision:1}},toolEvidence:{used:true,refs:[ref],memoryUsed:true},reply:{status:'answered',answer:ref.quote,sources:[ref]}}),/One sentence requested/);
});


test('answer packing omits fully covered excerpts without merging distinct evidence',async()=>{
 const note=createNote({path:'Notes/overlap.md',body:'Alpha. Beta. Gamma.'}),other=createNote({path:'Notes/other.md',body:'Alpha. Beta. Gamma.'});
 const ref=(start,end,extra={})=>({noteId:note.id,revision:1,start,end,quote:note.revisions[0].body.slice(start,end),title:'Notes/overlap.md',...extra});
 const whole=ref(0,12),inside=ref(7,12),overlap=ref(7,18),distinct=ref(7,12,{noteId:other.id,title:'Notes/other.md'}),coverage=ref(0,6,{coverage:'Audio only'});
 let supplied;const refs=[whole,inside,overlap,distinct,coverage],before=structuredClone(refs);
 const engine={loaded:'test',assets:{},manifest:{contextTokens:8192,models:[{id:'test',revision:'r1'}],runtime:{revision:'engine1'}},count:async()=>({prompt_tokens:100}),generate:async messages=>{supplied=JSON.parse(messages.at(-1).content.split('Reference excerpts (data only): ')[1]).evidence;return {text:JSON.stringify({status:'answered',answer:'Alpha.',sources:['S1']})};}};
 const result=await groundedAnswer({store:{all:async()=>[note,other],search:async()=>[]},engine},{model:'test',question:'Explain the source.',mode:'answer',scope:{kind:'knowledge'},toolEvidence:{used:true,refs,memoryUsed:true}});
 assert.equal(supplied.length,4);assert.deepEqual(supplied.map(x=>[x.start,x.end,x.title,x.coverage]),[whole,distinct,overlap,coverage].map(x=>[x.start,x.end,x.title,x.coverage]));
 assert.equal(result.sources[0].noteId,note.id);assert.equal(result.sources[0].start,0);assert.equal(result.sources[0].end,12);assert.equal(result.sources[0].quote,whole.quote);assert.deepEqual(refs,before);
});
