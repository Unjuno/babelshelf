import {expect,test} from '@playwright/test';

test('production IDB pending review survives reopen, refuses races, and resolves atomically with its receipt',async({page})=>{
 await page.goto('/tests/runtime-fixture.html');
 const result=await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');
  const {prepareCorrection}=await import('/src/note-corrections.ts');
  const {PENDING_CORRECTION_STATE}=await import('/src/pending-correction.ts');
  const {parseStateBackup}=await import('/src/backup-state.ts');
  const name='babelshelf-pending-review-test-'+crypto.randomUUID();let store=new KnowledgeStore(name);
  const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
  const refused=async(action:()=>Promise<unknown>)=>{try{await action();return false;}catch{return true;}};
  try{
   await store.initialize([{id:'one',path:'Notes/a.md',body:'red box',version:1,history:[]}]);
   const original=await store.all(),p=prepareCorrection(original[0],'Make it blue',JSON.stringify({action:'replace',find:'red',with:'blue'}));
   const initial=await store.snapshot(),cancelled=new AbortController();cancelled.abort();
   assert(await refused(()=>store.stageCorrection(p,'turn-one',cancelled.signal)),'Already stopped proposal was staged');
   assert(same(await store.snapshot(),initial),'Stopped staging changed data');
   const midCommit=new AbortController(),nativePut=IDBObjectStore.prototype.put;
   IDBObjectStore.prototype.put=function(value,key){const request=nativePut.call(this,value,key);if(this.name==='settings'&&key==='ui-v1-'+PENDING_CORRECTION_STATE)midCommit.abort();return request;};
   try{assert(await refused(()=>store.stageCorrection(p,'turn-one',midCommit.signal)),'Stop during staging committed');}finally{IDBObjectStore.prototype.put=nativePut;}
   assert(same(await store.snapshot(),initial),'Aborted staging retained a partial proposal');
   const pending=await store.stageCorrection(p,'turn-one');
   assert(same(await store.all(),original),'Staging changed original');store.close();store=new KnowledgeStore(name);
   assert(same(await store.getState(PENDING_CORRECTION_STATE),pending),'Reopen lost pending');
   const backup=await store.backup(),parsed=await parseStateBackup(JSON.stringify(backup));
   assert(same(parsed.settings.find(item=>item.key==='ui-v1-'+PENDING_CORRECTION_STATE)?.value,pending),'Backup lost review');
   const before=await store.snapshot();
   const nativeDelete=IDBObjectStore.prototype.delete;
   IDBObjectStore.prototype.delete=function(key){const request=nativeDelete.call(this,key);if(this.name==='settings'&&key==='ui-v1-'+PENDING_CORRECTION_STATE)this.transaction.abort();return request;};
   try{assert(await refused(()=>store.approveCorrection(p,pending)),'Forced abort succeeded');}finally{IDBObjectStore.prototype.delete=nativeDelete;}
   assert(same(await store.snapshot(),before),'Aborted approval changed data or lost review');
   await store.approveCorrection(p,pending);
   const applied=await store.snapshot();assert(applied.notes[0].revisions.length===2&&applied.notes[0].revisions[1].body==='blue box','Approval failed');
   assert(!applied.settings.some(item=>item.key==='ui-v1-'+PENDING_CORRECTION_STATE),'Committed approval kept pending');
   assert(applied.runs.filter(item=>item.value.type==='note-correction').length===1,'Receipt missing');
   assert(await refused(()=>store.approveCorrection(p,pending)),'Duplicate approval accepted');
   assert(same(await store.snapshot(),applied),'Duplicate changed data');
   const p2=prepareCorrection(applied.notes[0],'Make it green',JSON.stringify({action:'replace',find:'blue',with:'green'})),next=await store.stageCorrection(p2);
   const competitor=prepareCorrection(applied.notes[0],'Make it yellow',JSON.stringify({action:'replace',find:'blue',with:'yellow'}));
   assert(await refused(()=>store.stageCorrection(competitor)),'Pending review overwritten');
   assert(await refused(()=>store.discardCorrection(pending)),'Wrong review discarded current');
   const views=await store.views();await store.commit(views,views.map(note=>({...note,body:'concurrent',version:note.version+1,history:[...note.history,note.body]})));
   const concurrent=await store.snapshot();assert(await refused(()=>store.approveCorrection(p2,next)),'Stale approval accepted');
   assert(same(await store.snapshot(),concurrent),'Stale approval wrote data');
   await store.discardCorrection(next);assert(same(await store.all(),concurrent.notes),'Cancel changed original');
   assert(await store.getState(PENDING_CORRECTION_STATE)===undefined,'Discard did not remove review');
   return {ok:true};
  }finally{store.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
 });
 expect(result).toEqual({ok:true});
});
