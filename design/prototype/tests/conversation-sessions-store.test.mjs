import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {appendTurn,emptyDialogue} from '../src/conversation.ts';
import {conversationDialogueEntries} from '../src/conversation-sessions.ts';

async function deleteDatabase(name){await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Test database deletion blocked'));});}

test('conversation sessions preserve messages across create, switch, rename and delete',async()=>{
 const name='conversation-session-test-'+crypto.randomUUID(),store=new KnowledgeStore(name);
 try{
  const now='2026-11-16T00:00:00.000Z';let sessions=await store.ensureConversationSessions(now),dialogue=appendTurn(emptyDialogue(),{id:'legacy-turn',user:'Keep this message',answer:'Keep this answer'});
  await store.setState('dialogue',dialogue);
  let current=await store.createConversation('new-id',now,sessions,dialogue);sessions=current.sessions;dialogue=current.dialogue;
  assert.equal(dialogue.turns.length,0);
  current=await store.switchConversation('legacy',now,sessions,dialogue);sessions=current.sessions;dialogue=current.dialogue;
  assert.equal(dialogue.turns[0].user,'Keep this message');
  sessions=await store.renameConversation('legacy','Research',now,sessions);assert.equal(sessions.sessions[0].name,'Research');
  current=await store.switchConversation('new-id',now,sessions,dialogue);sessions=current.sessions;dialogue=appendTurn(current.dialogue,{id:'discard-turn',user:'Remove with its conversation'});await store.setState('dialogue',dialogue);
  const db=await store.open();await new Promise((resolve,reject)=>{const tx=db.transaction('runs','readwrite');tx.objectStore('runs').put({schema:1,type:'turn-activity-meta',turnId:'discard-turn',count:0},'fixture-activity');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  current=await store.switchConversation('legacy',now,sessions,dialogue);sessions=current.sessions;dialogue=current.dialogue;
  const deleted=await store.deleteConversation('new-id',undefined,sessions,dialogue);sessions=deleted.sessions;
  assert.equal(deleted.dialogue.turns[0].user,'Keep this message');
  assert.deepEqual(sessions.sessions.map(item=>item.id),['legacy']);
  const snapshot=await store.snapshot();assert.equal(snapshot.runs.length,0);assert.equal(conversationDialogueEntries(snapshot.settings).length,1);
  assert.equal(conversationDialogueEntries(snapshot.settings)[0].dialogue.turns[0].answer,'Keep this answer');
  await assert.rejects(store.deleteConversation('legacy',undefined,sessions,deleted.dialogue),/last conversation/i);
 }finally{store.close();await deleteDatabase(name);}
});
