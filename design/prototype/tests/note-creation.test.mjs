import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewNoteView} from '../src/note-creation.ts';

test('all new notes start at revision one and copy source lineage without aliasing',()=>{
 const sources=[{noteId:'source',revision:3,start:4,end:9,quote:'proof'}];
 const note=createNewNoteView({id:'new-note',path:'Inbox/result.md',body:'derived',kind:'generated',sources});
 assert.deepEqual(note,{id:'new-note',path:'Inbox/result.md',body:'derived',version:1,history:[],kind:'generated',sources});
 assert.notEqual(note.sources,sources);assert.notEqual(note.sources[0],sources[0]);
 sources[0].quote='changed';assert.equal(note.sources[0].quote,'proof');
});

test('a reviewed generated note cannot be saved against a changed source',async()=>{
 const {createNote,reviseNote}=await import('../../../dist/core.js');
 const {applyKnowledgeChanges,projectNote}=await import('../src/knowledge-store.ts');
 const source=createNote({path:'Inbox/source.md',body:'Original fact'});
 const ref={noteId:source.id,revision:1,start:0,end:13,quote:'Original fact'};
 const generated=createNewNoteView({id:'generated',path:'Inbox/result.md',body:'Answer',kind:'generated',sources:[ref]});
 const before=[projectNote(source)],after=[...before,generated];
 assert.equal(applyKnowledgeChanges([source],before,after).length,2);
 const changed=reviseNote(source,{body:'New fact'},1),records=[changed],snapshot=structuredClone(records);
 assert.throws(()=>applyKnowledgeChanges(records,[projectNote(changed)],[projectNote(changed),generated]),/Source changed/);
 assert.deepEqual(records,snapshot);
});

test('dialogue-copy metadata is retained as a detached origin snapshot',()=>{
 const dialogueCopy={schema:1,noteRevision:1,turnId:'turn',turnIndex:0,speaker:'assistant',quote:'answer',refs:[],edited:false};
 const note=createNewNoteView({id:'copy',path:'Inbox/answer.md',body:'answer',kind:'generated',sources:[],dialogueCopy});
 assert.deepEqual(note.dialogueCopy,dialogueCopy);assert.notEqual(note.dialogueCopy,dialogueCopy);assert.notEqual(note.dialogueCopy.refs,dialogueCopy.refs);
});

test('invalid creation payloads fail before a record can enter a save path',()=>{
 for(const input of [
  {id:'',path:'Inbox/a.md',body:'x',kind:'original',sources:[]},
  {id:'x',path:'',body:'x',kind:'original',sources:[]},
  {id:'x',path:'Inbox/a.md',body:'x',kind:'unknown',sources:[]},
  {id:'x',path:'Inbox/a.md',body:'x',kind:'original',sources:{}},
 ])assert.throws(()=>createNewNoteView(input));
});

test('discard affects only the matching pending note review',async()=>{
 const {discardPendingNoteReview}=await import('../src/note-creation.ts');
 const original={schema:1,turns:[{id:'a',user:'x',status:'Review new note',refs:[{noteId:'n'}]},{id:'b',user:'y',status:'Review new note'}]};
 const changed=discardPendingNoteReview(original,'a');assert.equal(changed.turns[0].status,'Draft discarded');assert.deepEqual(changed.turns[0].refs,original.turns[0].refs);assert.deepEqual(changed.turns[1],original.turns[1]);
 for(const status of ['Saved · Inbox/a.md','Draft discarded','Stopped']){const settled={...original,turns:[{...original.turns[0],status}]};assert.equal(discardPendingNoteReview(settled,'a'),settled);}
});

test('new-note citation avoids splitting an emoji at the length limit',async()=>{
 const {newNoteSourceRef}=await import('../src/note-creation.ts');const body='あ'.repeat(699)+'😀'+'終';
 const ref=newNoteSourceRef({id:'n',path:'Inbox/n.md',body});assert.equal(ref.quote,'あ'.repeat(699));assert.equal(ref.end,699);
});

test('new-note citation remains valid against the canonical original',async()=>{
 const {newNoteSourceRef}=await import('../src/note-creation.ts');const {createNote,validateGroundingRefs}=await import('../../../dist/core.js');
 const body='あ'.repeat(699)+'😀終',note=createNote({path:'Inbox/emoji.md',body});
 const ref=newNoteSourceRef({id:note.id,path:'Inbox/emoji.md',body});assert.equal(validateGroundingRefs([note],[ref]).ok,true);
});

test('queued discard preserves an earlier saved outcome',async()=>{
 const {discardPendingNoteReview}=await import('../src/note-creation.ts');const {createDialogueWriter}=await import('../src/dialogue-writer.ts');const {emptyDialogue,completeTurn}=await import('../src/conversation.ts');
 let state={...emptyDialogue(),turns:[{id:'a',user:'x',status:'Review new note'}]};let writes=0;
 const writer=createDialogueWriter(()=>state,async next=>{state=next;writes++;});
 const save=writer.update(current=>completeTurn(current,'a',{status:'Saved · Inbox/a.md'}));
 const discard=writer.update(current=>discardPendingNoteReview(current,'a'));await Promise.all([save,discard]);
 assert.equal(state.turns[0].status,'Saved · Inbox/a.md');assert.equal(writes,1);
});
