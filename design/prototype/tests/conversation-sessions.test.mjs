import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationDialogueEntries,createConversationSession,deleteConversationSession,renameConversationSession,switchConversationSession,validateConversationSessions,CONVERSATION_DIALOGUE_PREFIX,CONVERSATION_SESSIONS_KEY} from '../src/conversation-sessions.ts';

const initial={schema:1,activeId:'legacy',sessions:[{id:'legacy',name:'Conversation 1',createdAt:'2026-11-14T00:00:00.000Z',updatedAt:'2026-11-14T00:00:00.000Z'}]};

test('creating a conversation makes it active and keeps the existing session identity',()=>{
 const next=createConversationSession(initial,'new-session','2026-11-14T01:00:00.000Z');
 assert.equal(next.activeId,'new-session');
 assert.deepEqual(next.sessions,[
  initial.sessions[0],
  {id:'new-session',name:'New conversation',createdAt:'2026-11-14T01:00:00.000Z',updatedAt:'2026-11-14T01:00:00.000Z'},
 ]);
 assert.equal(initial.activeId,'legacy','creating a session must not mutate the previous collection');
});

test('switching and renaming preserve all other session metadata',()=>{
 const created=createConversationSession(initial,'new-session','2026-11-14T01:00:00.000Z');
 const switched=switchConversationSession(created,'legacy');
 const renamed=renameConversationSession(switched,'legacy','  Research notes  ','2026-11-14T02:00:00.000Z');
 assert.equal(renamed.activeId,'legacy');
 assert.deepEqual(renamed.sessions,[
  {id:'legacy',name:'Research notes',createdAt:'2026-11-14T00:00:00.000Z',updatedAt:'2026-11-14T02:00:00.000Z'},
  created.sessions[1],
 ]);
});

test('deleting an active conversation requires an existing replacement and never deletes the last one',()=>{
 const created=createConversationSession(initial,'new-session','2026-11-14T01:00:00.000Z');
 const deleted=deleteConversationSession(created,'new-session','legacy');
 assert.equal(deleted.activeId,'legacy');
 assert.deepEqual(deleted.sessions,initial.sessions);
 assert.throws(()=>deleteConversationSession(initial,'legacy',undefined),/last conversation/i);
 assert.throws(()=>deleteConversationSession(created,'legacy','missing'),/conversation unavailable/i);
});

test('conversation session data rejects duplicate identities and unbounded or blank names',()=>{
 assert.throws(()=>validateConversationSessions({...initial,sessions:[...initial.sessions,initial.sessions[0]]}),/conversation session/i);
 assert.throws(()=>renameConversationSession(initial,'legacy','   ','2026-11-14T01:00:00.000Z'),/name/i);
 assert.throws(()=>renameConversationSession(initial,'legacy','x'.repeat(81),'2026-11-14T01:00:00.000Z'),/name/i);
});

test('backup enumeration rejects missing active data and orphaned conversation records',()=>{
 assert.throws(()=>conversationDialogueEntries([{key:CONVERSATION_SESSIONS_KEY,value:initial}]),/active conversation data unavailable/i);
 assert.throws(()=>conversationDialogueEntries([{key:CONVERSATION_DIALOGUE_PREFIX+'orphan',value:{}}]),/unindexed conversation session data/i);
 assert.equal(conversationDialogueEntries([{key:'ui-v1-dialogue',value:{schema:1,revision:0,turns:[],compaction:null}}])[0].sessionId,null);
});
