import assert from 'node:assert/strict';
import test from 'node:test';
import {createNote} from '../../../dist/core.js';
import {groundedAnswer} from '../src/grounded-answer.ts';

test('grounded answer prompt keeps source labels in citation metadata, not visible prose',async()=>{
 const notes=[
  createNote({path:'Inbox/meeting.md',body:'集合場所は北口です。'}),
  createNote({path:'Inbox/water.md',body:'飲料水は17リットルです。'}),
 ];
 const refs=notes.map(note=>({noteId:note.id,revision:1,start:0,end:note.revisions[0].body.length,quote:note.revisions[0].body,title:note.revisions[0].path}));
 let system='';
 const engine={
  loaded:'test',
  manifest:{contextTokens:4096,models:[{id:'test',revision:'fixture'}],runtime:{revision:'fixture'}},
  count:async()=>({prompt_tokens:100}),
  generate:async(messages)=>{
   system=messages[0].content;
   return {text:JSON.stringify({answer:'集合場所は北口で、飲料水は17リットルです。',sources:['S1','S2']})};
  },
 };
 const store={all:async()=>notes,search:async()=>refs};
 const result=await groundedAnswer({store,engine},{model:'test',question:'集合場所と水の量は？',scope:{kind:'knowledge'}});
 assert.match(system,/Do not print citation labels such as S1\/S2 in answer prose/);
 assert.equal(result.answer,'集合場所は北口で、飲料水は17リットルです。');
 assert.equal(result.sources.length,2);
});
