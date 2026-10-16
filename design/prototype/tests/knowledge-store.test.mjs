import test from 'node:test';
import assert from 'node:assert/strict';
import {createNote,reviseNote,latest} from '../../../dist/core.js';
import {projectNote,applyKnowledgeChanges} from '../src/knowledge-store.ts';

test('legacy projection and unchanged save preserve all bytes, IDs, sources and paths',()=>{
 const original=createNote({title:'旧資料',body:'日本語原文 🌳'});original.importedFrom={name:'old.txt'};
 const view=projectNote(original),result=applyKnowledgeChanges([original],[view],[view]);
 assert.deepEqual(result,[original]);assert.equal(view.id,original.id);assert.match(view.path,/^inbox\//);
});
test('edits append one revision; stale concurrent edits cannot overwrite',()=>{
 const original=createNote({title:'Notes',path:'Notes/a.md',body:'v1'}),before=projectNote(original);
 const changed={...before,body:'v2',version:2,history:['v1']};
 const saved=applyKnowledgeChanges([original],[before],[changed]);
 assert.equal(latest(saved[0]).body,'v2');assert.equal(saved[0].revisions[0].body,'v1');
 assert.throws(()=>applyKnowledgeChanges(saved,[before],[{...changed,body:'stale'}]),/conflict/i);
});
test('delete and restore retain every revision and sources; path conflicts reject all changes',()=>{
 const original=createNote({path:'Notes/a.md',body:'original'}),view=projectNote(original);
 const deleted=applyKnowledgeChanges([original],[view],[]);
 assert.equal(deleted[0].state,'withdrawn');assert.equal(deleted[0].revisions.length,2);
 const restored=applyKnowledgeChanges(deleted,[],[view]);
 assert.equal(restored[0].state,'active');assert.equal(restored[0].revisions.length,3);
 assert.throws(()=>applyKnowledgeChanges([original],[view],[view,{...view,id:'other'}]),/conflict/i);
 assert.equal(original.revisions.length,1);
});
test('transaction validation rejects protected edits, invalid preferences and revision loss',()=>{
 const original=createNote({path:'Settings/README.md',body:'Protected'});original.ui={protected:true};
 const before=projectNote(original);
 assert.throws(()=>applyKnowledgeChanges([original],[before],[{...before,body:'changed'}]),/protected/i);
 const user=createNote({path:'Notes/b.md',body:'v1'}),projected=projectNote(user);
 assert.throws(()=>applyKnowledgeChanges([user],[projected],[{...projected,body:'bad'}]),/revision/i);
});

test('saving an existing generated result preserves exact content and rejects stale sources',()=>{
 const source=createNote({path:'Notes/source.md',body:'Exact source'}),ref={noteId:source.id,revision:1,start:0,end:12,quote:'Exact source'};
 const before=[projectNote(source)],answer={id:'answer',path:'Inbox/answer.md',body:'Already generated content',version:1,history:[],kind:'generated',sources:[ref]};
 const saved=applyKnowledgeChanges([source],before,[...before,answer]);
 assert.equal(saved.find(n=>n.id==='answer').revisions[0].body,answer.body);assert.deepEqual(saved.find(n=>n.id==='answer').sources,[ref]);
 const changed=reviseNote(source,{body:'Changed source'},1);
 assert.throws(()=>applyKnowledgeChanges([changed],[projectNote(changed)],[projectNote(changed),answer]),/Source changed/);
});
