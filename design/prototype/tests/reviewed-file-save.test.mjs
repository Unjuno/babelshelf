import test from 'node:test';import assert from 'node:assert/strict';
import {createReviewedFileSaver} from '../src/reviewed-file-save.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('reviewed file save excludes duplicate submissions through commit and acknowledgement',async()=>{
 const saver=createReviewedFileSaver(),commit=deferred(),ack=deferred(),entered=deferred();let writes=0,acks=0;
 const first=saver.save(async()=>{writes++;return commit.promise;},async n=>{acks++;assert.equal(n.body,'Exact 日本語\r\nbody');entered.resolve();return ack.promise;});
 assert.equal(saver.busy,true);assert.equal(await saver.save(async()=>{writes++;},async()=>{}),undefined);
 commit.resolve({id:'one',body:'Exact 日本語\r\nbody'});await entered.promise;assert.equal(saver.busy,true);
 assert.equal(await saver.save(async()=>{writes++;},async()=>{}),undefined);ack.resolve();const result=await first;
 assert.equal(result.note.id,'one');assert.equal(writes,1);assert.equal(acks,1);assert.equal(saver.busy,false);
});
test('post-commit acknowledgement failure returns committed identity without retrying creation',async()=>{
 const saver=createReviewedFileSaver();let writes=0;const n={id:'saved',body:'Previously generated exact answer'};
 const result=await saver.save(async()=>{writes++;return n;},async()=>{throw Error('Conversation changed');});
 assert.equal(result.note,n);assert.equal(result.acknowledgementError,'Conversation changed');assert.equal(writes,1);assert.equal(saver.busy,false);
 const empty=await saver.save(async()=>n,async()=>{throw Error('');});assert.equal(empty.acknowledgementError,'');assert.ok(Object.hasOwn(empty,'acknowledgementError'));
});
test('failed commit preserves failure and releases the lock without acknowledging a nonexistent note',async()=>{
 const saver=createReviewedFileSaver();let acks=0;await assert.rejects(saver.save(async()=>{throw Error('Storage conflict');},async()=>{acks++;}),/Storage conflict/);
 assert.equal(acks,0);assert.equal(saver.busy,false);assert.equal((await saver.save(async()=>({id:'later'}),async()=>{})).note.id,'later');
});


test('dialogue capture can correct a model-selected speaker without regenerating or normalizing original bytes',async()=>{
 const {makeDialogueCopyReview,selectDialogueCopy,reviewedDialogueCopy}=await import('../src/dialogue-copy.ts');
 const {emptyDialogue,appendTurn}=await import('../src/conversation.ts');
 const state=appendTurn(appendTurn(emptyDialogue(),{id:'first',user:'First user',answer:'Exact 日本語\r\nanswer 🌳'}),{id:'last',user:'Last user',answer:'Last answer'}),before=structuredClone(state);
 const proposed=makeDialogueCopyReview(state,{target:'history',historyIndex:0,historyPart:'user'});
 const selected=selectDialogueCopy(state,proposed,0,'assistant');
 assert.equal(selected.source.quote,'Exact 日本語\r\nanswer 🌳');assert.equal(proposed.source.speaker,'user');
 const saved=reviewedDialogueCopy(state,selected,selected.source.quote);
 assert.equal(saved.body,selected.source.quote);assert.equal(saved.kind,'generated');assert.equal(saved.dialogueCopy.edited,false);
 assert.deepEqual(saved.dialogueCopy,{schema:1,noteRevision:1,turnId:'first',turnIndex:0,speaker:'assistant',quote:selected.source.quote,refs:[],edited:false});
 const edited=reviewedDialogueCopy(state,selected,'Reviewed edit');assert.equal(edited.dialogueCopy.edited,true);assert.equal(edited.dialogueCopy.quote,selected.source.quote);
 const changed=structuredClone(state);changed.turns[0].answer='Changed elsewhere';assert.throws(()=>reviewedDialogueCopy(changed,selected,selected.source.quote),/source changed/i);
 const appended=appendTurn(state,{id:'new',user:'New user',answer:'New answer'});assert.equal(reviewedDialogueCopy(appended,selected,selected.source.quote).body,selected.source.quote);
 assert.throws(()=>selectDialogueCopy(appended,selected,2,'assistant'),/unavailable/i);
 assert.deepEqual(state,before);
});

test('dialogue copy creation validates its original in the commit input, preserves metadata and exports it',async()=>{
 const {makeDialogueCopyReview,reviewedDialogueCopy}=await import('../src/dialogue-copy.ts');
 const {emptyDialogue,appendTurn}=await import('../src/conversation.ts');
 const {applyKnowledgeChanges,projectNote}=await import('../src/knowledge-store.ts');
 const {exportMarkdownRevision}=await import('../src/markdown-export.ts');
 const state=appendTurn(emptyDialogue(),{id:'first',user:'Original question',answer:'Original answer'});
 const data=reviewedDialogueCopy(state,makeDialogueCopyReview(state,{target:'history',historyIndex:0,historyPart:'assistant'}),'Original answer');
 const view={id:'saved',path:'Inbox/copy.md',version:1,history:[],...data};
 assert.throws(()=>applyKnowledgeChanges([],[],[view]),/source changed/i);
 const [note]=applyKnowledgeChanges([],[],[view],state);assert.deepEqual(projectNote(note).dialogueCopy,data.dialogueCopy);
 assert.match(exportMarkdownRevision(note,1).text,/dialogueCopy/);
 const changed=structuredClone(state);changed.turns[0].answer='Changed';assert.throws(()=>applyKnowledgeChanges([],[],[view],changed),/source changed/i);
 const prior=projectNote(note),forged={...prior,version:2,history:[prior.body],dialogueCopy:{...prior.dialogueCopy,speaker:'user'}};
 assert.throws(()=>applyKnowledgeChanges([note],[prior],[forged],state),/copy origin/i);
});


test('copy metadata survives a full local backup and refuses a forged original-copy label',async()=>{
 const {makeAnswerCopyReview,reviewedDialogueCopy}=await import('../src/dialogue-copy.ts');
 const {emptyDialogue,appendTurn}=await import('../src/conversation.ts');
 const {applyKnowledgeChanges}=await import('../src/knowledge-store.ts');
 const {makeStateBackup,parseStateBackup,stateHash}=await import('../src/backup-state.ts');
 const state=appendTurn(emptyDialogue(),{id:'first',user:'Question',answer:'Original answer'});
 assert.throws(()=>makeAnswerCopyReview(state,'first','Old rendered answer'),/source changed/i);
 const copy=reviewedDialogueCopy(state,makeAnswerCopyReview(state,'first','Original answer'),'Reviewed edit');
 const [note]=applyKnowledgeChanges([],[],[{id:'saved',path:'Inbox/copy.md',version:1,history:[],...copy}],state);
 const pack=await makeStateBackup({notes:[note],settings:[{key:'ui-v1-dialogue',value:state}],runs:[]});
 const restored=await parseStateBackup(JSON.stringify(pack));assert.deepEqual(restored.notes[0].dialogueCopy,note.dialogueCopy);
 const forged=structuredClone(pack);forged.payload.notes[0].dialogueCopy.edited=false;forged.sha256=stateHash(forged.payload);
 await assert.rejects(parseStateBackup(JSON.stringify(forged)),/copy origin/i);
});


test('assistant-copy citations retain exact source revisions and refuse changed dialogue refs or withdrawn evidence',async()=>{
 const {makeAnswerCopyReview,reviewedDialogueCopy}=await import('../src/dialogue-copy.ts');
 const {emptyDialogue,appendTurn}=await import('../src/conversation.ts');
 const {applyKnowledgeChanges}=await import('../src/knowledge-store.ts');
 const {createNote,withdrawNote}=await import('../../../dist/core.js');
 const source=createNote({path:'Notes/source.md',body:'Exact evidence'}),ref={noteId:source.id,revision:1,start:0,end:14,quote:'Exact evidence'};
 const state=appendTurn(emptyDialogue(),{id:'answer',user:'Question',answer:'Answer from evidence',refs:[ref]}),review=makeAnswerCopyReview(state,'answer','Answer from evidence'),data=reviewedDialogueCopy(state,review,review.source.quote);
 const view={id:'copy',path:'Inbox/citation.md',version:1,history:[],...data};
 const created=applyKnowledgeChanges([source],[],[view],state).find(n=>n.id==='copy');assert.deepEqual(created.sources,[ref]);assert.deepEqual(created.dialogueCopy.refs,[ref]);
 const changed=structuredClone(state);changed.turns[0].refs=[];assert.throws(()=>applyKnowledgeChanges([source],[],[view],changed),/source changed/i);
 assert.throws(()=>applyKnowledgeChanges([withdrawNote(source,1)],[],[view],state),/source changed/i);
 data.sources[0].quote='Mutated draft';assert.equal(review.source.refs[0].quote,'Exact evidence');assert.equal(state.turns[0].refs[0].quote,'Exact evidence');
});
