import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import {KnowledgeStore} from '../src/knowledge-store.ts';
import {emptyDialogue} from '../src/conversation.ts';
import {createNote} from '../../../dist/core.js';

const removeDatabase=name=>new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=resolve;request.onerror=()=>reject(request.error);});

test('isolated 25-record schedule/run/notification graph purges with conversation references and keeps unrelated data',async()=>{
 const name='trash-purge-graph-'+crypto.randomUUID(),store=new KnowledgeStore(name),zone=Intl.DateTimeFormat().resolvedOptions().timeZone,unrelated=createNote({path:'Inbox/Keep me.md',body:'Unrelated original · preserve exactly.'});
 try{
  await store.initialize([{id:unrelated.id,path:'Inbox/Keep me.md',body:unrelated.revisions[0].body,version:1,history:[]}]);
  const schedules=[];
  for(let index=0;index<10;index++){
   const task=await store.putTask({repeat:'once',time:'09:00',days:[1],date:'2099-05-01',monthDay:1,interval:1,unit:'days',timezone:zone,enabled:true,notify:index<3,prompt:'say hello briefly'});
   schedules.push(task);
   const attempts=index===0?2:1;
   for(let attempt=0;attempt<attempts;attempt++){
    const owner=`qa-owner-${index}-${attempt}`,claim=await store.claimRun(task.id,owner,{manual:true},new Date('2026-11-20T09:00:00Z'));
    assert.equal(claim.execute,true);
    await store.finishRun(claim.run.id,owner,{status:'succeeded',answer:'Hello!',sources:[],model:{id:'fixture-text',runtime:'fixture-runtime'}},new Date('2026-11-20T09:01:00Z'));
   }
  }
  const active=await store.all(),schedule0=active.find(note=>note.id===schedules[0].id),sourceBody=schedule0.revisions.at(-1).body;
  const dialogue={...emptyDialogue(),revision:1,turns:[{id:'qa-turn',user:'Read the first schedule',answer:'It is saved.',refs:[{noteId:schedule0.id,revision:1,start:0,end:sourceBody.length,quote:sourceBody}],attachments:[{id:schedule0.id,name:'schedule.md',kind:'text',status:'Ready'}]}]};
  await store.setState('dialogue',dialogue);
  const typed=active.filter(note=>['schedule','execution','notification'].includes(note.ui?.recordType));
  assert.equal(typed.filter(note=>note.ui.recordType==='schedule').length,10);
  assert.equal(typed.filter(note=>note.ui.recordType==='execution').length,11);
  assert.equal(typed.filter(note=>note.ui.recordType==='notification').length,4);
  assert.equal(typed.length,25);

  for(const note of typed){
   const expectedNotes=await store.views(),folders=await store.getState('folders'),trash=await store.getState('trash');
   await store.recoverMemory({kind:'delete',target:{kind:'file',value:note.id},expectedNotes,id:`qa-trash-${note.id}`,label:note.path},folders,trash);
  }
  const trash=await store.getState('trash');assert.equal(trash.reduce((sum,batch)=>sum+batch.notes.length,0),25);
  const purged=await store.purgeMemory(trash,trash,{removeConversationLinks:true,removeActivityLinks:true});
  assert.equal(purged.purgedBatchIds.length,25);assert.deepEqual(purged.retainedBatchIds,[]);assert.deepEqual(purged.retainedReferences,[]);
  const remaining=await store.all();assert.deepEqual(remaining.map(note=>note.id),[unrelated.id]);assert.equal(remaining[0].revisions.at(-1).body,'Unrelated original · preserve exactly.');
  assert.deepEqual(await store.getState('trash'),[]);
  const cleanedDialogue=await store.getState('dialogue');assert.deepEqual(cleanedDialogue.turns[0].refs,[]);assert.deepEqual(cleanedDialogue.turns[0].attachments,[]);
  const runNotes=await store.snapshot();assert.equal(runNotes.runs.filter(row=>row.key.startsWith('ui-v1-processing-')).length,0);
 }finally{store.close();await removeDatabase(name);}
});
