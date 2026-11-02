import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {makePendingNoteReview,validatePendingNoteReview,PENDING_NOTE_REVIEW_STATE} from '../src/pending-note-review.ts';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {makeStateBackup,parseStateBackup} from '../src/backup-state.ts';
import {restoreConflictLabel} from '../src/backup-conflicts.ts';

function draft(overrides={}){return makePendingNoteReview({id:'capture-1',path:'Inbox/meeting.md',body:'Move it to Monday',kind:'generated',sources:[],...overrides},'turn-1','2026-11-03T00:00:00.000Z');}

test('pending note review is bounded inert editor data with exact source ranges',()=>{
 const row=draft();assert.equal(validatePendingNoteReview(row).note.body,'Move it to Monday');
 for(const bad of [
  {...row,unexpected:true},
  {...row,turnId:''},
  {...row,note:{...row.note,unexpected:'code'}},
  {...row,note:{...row.note,sources:[{noteId:'source',revision:1,start:0,end:4,quote:'x'}]}},
  {...row,note:{...row.note,body:'x'.repeat(2_000_000)}},
 ])assert.throws(()=>validatePendingNoteReview(bad));
});

test('note review stage, edit, discard and approval compare the exact pending snapshot',async()=>{
 const store=new KnowledgeStore('pending-note-review-'+crypto.randomUUID());
 try{
  await store.initialize([]);const first=draft();const staged=await store.stageNoteReview(first);assert.deepEqual(await store.getState(PENDING_NOTE_REVIEW_STATE),staged);
  const next=makePendingNoteReview({...staged.note,body:'Move it to Tuesday'},staged.turnId,staged.createdAt);
  await assert.rejects(store.updateNoteReview({...staged,note:{...staged.note,body:'stale'}},next),/changed/);
  const updated=await store.updateNoteReview(staged,next);assert.equal(updated.note.body,'Move it to Tuesday');
  const note=await store.saveReviewedNote(updated,updated);assert.equal(note.body,'Move it to Tuesday');assert.equal(note.version,1);
  assert.equal((await store.all()).length,1);assert.equal(await store.getState(PENDING_NOTE_REVIEW_STATE),undefined);
  await assert.rejects(store.discardNoteReview(updated),/changed/);
 }finally{store.close();}
});

test('competing note proposals cannot replace an existing review; cancel retains notes',async()=>{
 const store=new KnowledgeStore('pending-note-review-conflict-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'existing',path:'Inbox/existing.md',body:'keep me',version:1,history:[]}]);
  const first=await store.stageNoteReview(draft());await assert.rejects(store.stageNoteReview(draft({body:'different'})),/Review pending note first/);
  await store.discardNoteReview(first);assert.equal(await store.getState(PENDING_NOTE_REVIEW_STATE),undefined);
  assert.equal((await store.all()).find(note=>note.id==='existing').revisions.at(-1).body,'keep me');
 }finally{store.close();}
});

test('pending note review survives backup restore and has a clear conflict label',async()=>{
 const row=draft(),pack=await makeStateBackup({notes:[],settings:[{key:'ui-v1-'+PENDING_NOTE_REVIEW_STATE,value:row}],runs:[]});
 const restored=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(restored.settings[0].value,row);
 assert.equal(restoreConflictLabel({store:'settings',key:'ui-v1-'+PENDING_NOTE_REVIEW_STATE,label:'ui-v1-'+PENDING_NOTE_REVIEW_STATE}),'Pending note');
});
