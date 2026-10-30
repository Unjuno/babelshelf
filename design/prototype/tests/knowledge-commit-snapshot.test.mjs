import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {createNote} from '../../../dist/core.js';
import {appendTurn,emptyDialogue} from '../src/conversation.ts';
import {prepareOriginal,originalRef,readOriginal} from '../src/original-assets.ts';
import {makePdfText} from '../src/pdf-text.ts';
import {makeTranscript} from '../src/speech-transcript.ts';
import {initialPreferenceNotes} from '../src/preference-records.ts';

test('new file save freezes the reviewed body before opening storage',async()=>{
 const store=new KnowledgeStore('save-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([]);const before=await store.views();
  const after=[...before,projectNote(createNote({path:'Inbox/reviewed.md',body:'Reviewed content.'}))];
  const save=store.commit(before,after);after.at(-1).body='Changed after Save.';
  await save;assert.equal((await store.views()).find(note=>note.path==='Inbox/reviewed.md').body,'Reviewed content.');
 }finally{store.close();}
});

test('input transaction retains the original attachment snapshot',async()=>{
 const store=new KnowledgeStore('input-asset-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([]);const asset=await prepareOriginal(new File(['Original bytes'],'source.txt',{type:'text/plain'})),ref=originalRef(asset);
  const next=appendTurn(emptyDialogue(),{id:'turn-one',user:'Read this',attachments:[{id:asset.id,name:asset.name,kind:asset.kind,status:'Not prepared',size:asset.bytes,asset:ref}]});
  const save=store.submitInput(undefined,next,[asset]);asset.name='changed.txt';next.turns[0].attachments[0].name='changed.txt';
  await save;assert.equal((await store.getState('dialogue')).turns[0].attachments[0].name,'source.txt');assert.equal(new TextDecoder().decode(readOriginal(await store.original(ref),ref)),'Original bytes');
 }finally{store.close();}
});

test('input transaction freezes the validated dialogue before opening storage',async()=>{
 const store=new KnowledgeStore('input-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([]);const next=appendTurn(emptyDialogue(),{id:'turn-one',user:'Original message',attachments:[]});
  const save=store.submitInput(undefined,next,[]);next.turns[0].user='Changed after validation';
  await save;assert.equal((await store.getState('dialogue')).turns[0].user,'Original message');
 }finally{store.close();}
});

test('reviewed PDF text is frozen before the original and extraction are saved',async()=>{
 const store=new KnowledgeStore('pdf-review-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([]);const original=await prepareOriginal(new File(['fixture'],'source.pdf',{type:'application/pdf'}));
  const value=makePdfText(original,1,[{page:1,text:'Reviewed text',regions:[]}]);
  const saving=store.savePdfText('reading-one',value,original);value.text='Modified text';value.pages[0].text='Modified text';value.pages[0].end=value.text.length;
  await saving;assert.equal((await store.all()).find(note=>note.id==='reading-one').revisions[0].body,'Reviewed text');
 }finally{store.close();}
});

test('reviewed transcript and original remain the same while saving',async()=>{
 const store=new KnowledgeStore('speech-review-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([]);const original=await prepareOriginal(new File(['audio fixture'],'source.wav',{type:'audio/wav'}));
  const value=makeTranscript(original,1000,{text:'Reviewed words',chunks:[{text:'Reviewed words',timestamp:[0,1]}]});
  const saving=store.saveTranscript('reading-one',value,original);value.text='Changed words';value.segments[0].text='Changed words';original.name='changed.wav';
  await saving;const notes=await store.all();assert.equal(notes.find(note=>note.id==='reading-one').revisions[0].body,'Reviewed words');assert.equal((await store.original(originalRef(original))).name,'source.wav');
 }finally{store.close();}
});

test('grounded dialogue freezes both the answer and its checked source before storage',async()=>{
 const store=new KnowledgeStore('grounded-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'source',path:'Notes/source.md',body:'Source text',version:1,history:[]}]);
  const ref={noteId:'source',revision:1,start:0,end:6,quote:'Source'};
  const next=appendTurn(emptyDialogue(),{id:'turn-one',user:'Question',answer:'Supported answer',refs:[ref]});
  const saving=store.compareGroundedDialogue(undefined,next,[ref]);next.turns[0].answer='Changed answer';next.turns[0].refs[0].quote='Forged';
  await saving;const stored=await store.getState('dialogue');assert.equal(stored.turns[0].answer,'Supported answer');assert.equal(stored.turns[0].refs[0].quote,'Source');
 }finally{store.close();}
});

test('dialogue CAS and settings writes freeze their inputs before storage opens',async()=>{
 const store=new KnowledgeStore('state-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([]);const next=appendTurn(emptyDialogue(),{id:'turn-one',user:'Original'});
  const saving=store.compareState('dialogue',undefined,next);next.turns[0].user='Changed';await saving;
  assert.equal((await store.getState('dialogue')).turns[0].user,'Original');
  const value={enabled:false},set=store.setState('test-setting',value);value.enabled=true;await set;
  assert.equal((await store.getState('test-setting')).enabled,false);
 }finally{store.close();}
});

test('resetting settings cannot replace a stale reviewed snapshot while opening storage',async()=>{
 const store=new KnowledgeStore('reset-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize(initialPreferenceNotes);const current=await store.views(),reviewed=structuredClone(current),stale=reviewed.find(note=>note.id==='settings-models');
  stale.body+='\nChanged elsewhere';const attempt=store.restoreDefaults(reviewed);stale.body=current.find(note=>note.id==='settings-models').body;
  await assert.rejects(attempt,/Settings changed/);assert.deepEqual(await store.views(),current);
  await store.restoreDefaults(current);assert.equal((await store.views()).filter(note=>note.path.startsWith('Settings/')).length,current.filter(note=>note.path.startsWith('Settings/')).length);
 }finally{store.close();}
});

test('trash operation freezes its confirmed target before opening storage',async()=>{
 const store=new KnowledgeStore('trash-target-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'one',path:'Inbox/one.md',body:'One',version:1,history:[]},{id:'two',path:'Inbox/two.md',body:'Two',version:1,history:[]}]);
  const expectedNotes=await store.views(),action={kind:'delete',target:{kind:'file',value:'one'},expectedNotes,id:'batch-one',label:'one.md'};
  const saving=store.recoverMemory(action,undefined,undefined);action.target.value='two';
  await saving;const notes=await store.all();assert.equal(notes.find(note=>note.id==='one').state,'withdrawn');assert.equal(notes.find(note=>note.id==='two').state,'active');
 }finally{store.close();}
});

test('folder create and rename freeze their conflict-check snapshots',async()=>{
 const store=new KnowledgeStore('folder-snapshot-'+crypto.randomUUID());
 try{
  await store.initialize([{id:'one',path:'Inbox/Old/one.md',body:'One',version:1,history:[]}]);await store.setState('folders',['Inbox/Old']);
  const stale=['Inbox/Stale'],creation=store.createFolder('Inbox/New',stale);stale[0]='Inbox/Old';await assert.rejects(creation,/changed/i);
  const notes=await store.views(),folders=await store.getState('folders'),renaming=store.renameFolder('Inbox/Old','New',notes,folders);notes[0].body='Changed';folders.push('Inbox/Other');
  await renaming;assert.equal((await store.views()).find(note=>note.id==='one').path,'Inbox/New/one.md');
 }finally{store.close();}
});
