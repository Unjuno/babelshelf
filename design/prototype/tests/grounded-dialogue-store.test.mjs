import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {emptyDialogue,appendTurn,completeTurn} from '../src/conversation.ts';
import {createDialogueWriter} from '../src/dialogue-writer.ts';
import {noteSourceMetadata,distinctSourceMetadataGuards} from '../src/note-provenance.ts';
import {stateHash} from '../src/backup-hash.ts';
import {makeAnswerCopyReview,reviewedDialogueCopy} from '../src/dialogue-copy.ts';
import {createNewNoteView} from '../src/note-creation.ts';

test('source pages share a guard without hiding distinct source states',()=>{
 const first={noteId:'note',revision:1,snapshot:'a'.repeat(64)},changed={...first,snapshot:'b'.repeat(64)},other={...first,noteId:'other'};
 assert.deepEqual(distinctSourceMetadataGuards([...Array(70).fill(first),changed,other]),[first,changed,other]);
});

test('saving an answer rechecks its retained source metadata after review',async()=>{
 const store=new KnowledgeStore('metadata-copy-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'source',path:'Inbox/source.md',body:'Water 17',version:1,history:[]}]);
  let views=await store.views();const ref={noteId:'source',revision:1,start:0,end:8,quote:'Water 17'},summary={id:'summary',path:'Inbox/summary.md',body:'Summary',version:1,history:[],kind:'generated',sources:[ref]};
  await store.commit(views,[...views,summary]);views=await store.views();
  const guard={noteId:'summary',revision:1,snapshot:stateHash(noteSourceMetadata(await store.all(),'summary',1))};
  const before=appendTurn(emptyDialogue(),{id:'turn',user:'Source?'}),answer=completeTurn(before,'turn',{answer:'The source is current.',sourceMetadataGuards:[guard]});
  await store.compareState('dialogue',undefined,before);await store.compareGroundedDialogue(before,answer,[],[guard]);
  const copy=reviewedDialogueCopy(answer,makeAnswerCopyReview(answer,'turn','The source is current.'),'The source is current.');
  const note=createNewNoteView({id:'copy',path:'Inbox/copy.md',...copy});
  const source=views.find(item=>item.id==='source'),changed=views.map(item=>item.id==='source'?{...source,body:'Water 9',version:2,history:[...source.history,source.body]}:item);
  await assert.rejects(store.commit(views,[...changed,note]),/Source changed/);assert.deepEqual(await store.views(),views);
  await store.commit(views,changed);
  views=await store.views();await assert.rejects(store.commit(views,[...views,note]),/Source changed/);
  assert.equal((await store.views()).some(item=>item.id==='copy'),false);
 }finally{store.close();}
});

test('source metadata is rechecked in the same transaction as the final answer',async()=>{
 const store=new KnowledgeStore('metadata-guard-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'source',path:'Inbox/source.md',body:'Water 17',version:1,history:[]}]);
  const base=await store.views(),ref={noteId:'source',revision:1,start:0,end:8,quote:'Water 17'},summary={id:'summary',path:'Inbox/summary.md',body:'Summary',version:1,history:[],kind:'generated',sources:[ref]};
  await store.commit(base,[...base,summary]);const records=await store.all(),guard={noteId:'summary',revision:1,snapshot:stateHash(noteSourceMetadata(records,'summary',1))};
  const before=appendTurn(emptyDialogue(),{id:'turn',user:'Source?'}),next=completeTurn(before,'turn',{answer:'The source is current.'});await store.compareState('dialogue',undefined,before);
  await store.compareGroundedDialogue(before,next,[],[guard]);assert.deepEqual(await store.getState('dialogue'),next);await store.compareState('dialogue',next,before);
  const views=await store.views(),source=views.find(item=>item.id==='source');await store.commit(views,views.map(item=>item.id==='source'?{...source,body:'Water 9',version:2,history:[...source.history,source.body]}:item));
  let current=before;const writer=createDialogueWriter(()=>current,async(value,refs,metadata)=>{await store.compareGroundedDialogue(current,value,refs??[],metadata);current=value;});
  await assert.rejects(writer.update(()=>next,undefined,[guard]),/source changed/i);assert.deepEqual(await store.getState('dialogue'),before);assert.deepEqual(current,before);
  const changedSnapshot=stateHash(noteSourceMetadata(await store.all(),'summary',1)),mutableGuard={...guard};
  const staleSave=store.compareGroundedDialogue(before,next,[],[mutableGuard]);mutableGuard.snapshot=changedSnapshot;
  await assert.rejects(staleSave,/source changed/i);assert.deepEqual(await store.getState('dialogue'),before);
 }finally{store.close();}
});

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
