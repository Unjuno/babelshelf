import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {createNote} from '../../../dist/core.js';
import {appendTurn,emptyDialogue} from '../src/conversation.ts';
import {prepareOriginal,originalRef,readOriginal} from '../src/original-assets.ts';

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
