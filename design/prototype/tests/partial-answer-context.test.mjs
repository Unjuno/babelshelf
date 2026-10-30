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
