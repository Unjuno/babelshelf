import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {emptyDialogue,appendTurn,completeTurn} from '../src/conversation.ts';
import {createDialogueWriter} from '../src/dialogue-writer.ts';

test('grounded dialogue commit checks source and conversation in the same transaction',async()=>{
 const store=new KnowledgeStore('grounded-'+crypto.randomUUID()),db=await store.open();
 const note=createNote({path:'Inbox/water.md',body:'水は七リットル。'}),ref={noteId:note.id,revision:1,start:2,end:7,quote:'七リットル'};
 const before=appendTurn(emptyDialogue(),{id:'turn',user:'何リットル？'}),next=completeTurn(before,'turn',{answer:'七リットル',refs:[ref]});
 const put=async(name,key,value)=>new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');const s=tx.objectStore(name);key===undefined?s.put(value):s.put(value,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 await put('notes',undefined,note);await put('settings','ui-v1-dialogue',before);
 await store.compareGroundedDialogue(before,next,[ref]);assert.deepEqual(await store.getState('dialogue'),next);
 await put('settings','ui-v1-dialogue',before);await put('notes',undefined,reviseNote(note,{body:'水は八リットル。'},1));
 await assert.rejects(store.compareGroundedDialogue(before,next,[ref]),/Source changed/);assert.deepEqual(await store.getState('dialogue'),before);
 await put('notes',undefined,withdrawNote(note,1));await assert.rejects(store.compareGroundedDialogue(before,next,[ref]),/Source changed/);
 await put('notes',undefined,note);await put('settings','ui-v1-dialogue',next);await assert.rejects(store.compareGroundedDialogue(before,next,[ref]),/Conversation changed/);assert.deepEqual(await store.getState('dialogue'),next);
 db.close();
});

test('grounded commit also validates the references actually added to the answer',async()=>{
 const store=new KnowledgeStore('grounded-actual-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'source',path:'Notes/source.md',body:'Source text',version:1,history:[]}]);
  const checked={noteId:'source',revision:1,start:0,end:6,quote:'Source'},forged={...checked,quote:'Forged'};
  const next=appendTurn(emptyDialogue(),{id:'turn',user:'Question',answer:'Answer',refs:[forged]});
  await assert.rejects(store.compareGroundedDialogue(undefined,next,[checked]),/Source changed/);
  assert.equal(await store.getState('dialogue'),undefined);
 }finally{store.close();}
});

test('grounded commit retains unchanged historical references even when their source is unavailable',async()=>{
 const store=new KnowledgeStore('grounded-history-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'source',path:'Notes/source.md',body:'Source text',version:1,history:[]}]);
  const oldRef={noteId:'unavailable',revision:1,start:0,end:3,quote:'Old'},ref={noteId:'source',revision:1,start:0,end:6,quote:'Source'};
  const before=appendTurn(emptyDialogue(),{id:'old',user:'Earlier',answer:'Old answer',refs:[oldRef]});await store.compareState('dialogue',undefined,before);
  const next=appendTurn(before,{id:'new',user:'Question',answer:'Answer',refs:[ref]});await store.compareGroundedDialogue(before,next,[ref]);
  assert.deepEqual(await store.getState('dialogue'),next);
 }finally{store.close();}
});

test('a rejected stale source leaves the dialogue writer usable for an error and retry',async()=>{
 const store=new KnowledgeStore('grounded-recovery-'+crypto.randomUUID()),db=await store.open();
 const note=createNote({path:'Inbox/water.md',body:'水は七リットル。'}),ref={noteId:note.id,revision:1,start:2,end:7,quote:'七リットル'};
 const initial=appendTurn(emptyDialogue(),{id:'turn',user:'何リットル？'});let state=initial,stored=initial;
 const put=(name,key,value)=>new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite'),s=tx.objectStore(name);key===undefined?s.put(value):s.put(value,key);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
 await put('settings','ui-v1-dialogue',initial);await put('notes',undefined,reviseNote(note,{body:'水は八リットル。'},1));
 const writer=createDialogueWriter(()=>state,async(next,refs)=>{if(refs)await store.compareGroundedDialogue(stored,next,refs);else await store.compareState('dialogue',stored,next);state=stored=next;});
 await assert.rejects(writer.update(current=>completeTurn(current,'turn',{answer:'七リットル',refs:[ref]}),[ref]),/Source changed/);
 await writer.update(current=>completeTurn(current,'turn',{status:'Source changed · retry'}));
 assert.equal(state.turns[0].answer,undefined);assert.equal(state.turns[0].status,'Source changed · retry');assert.deepEqual(await store.getState('dialogue'),state);
 await writer.update(current=>appendTurn(current,{id:'retry',user:'もう一度'}));assert.equal(state.turns.at(-1).id,'retry');db.close();
});
