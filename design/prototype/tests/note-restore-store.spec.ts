import {expect,test} from '@playwright/test';

test('generated answer recovery uses real IDB CAS and atomically retains source history and its receipt',async({page})=>{
 await page.goto('/tests/runtime-fixture.html');
 const result=await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');
  const {makeStateBackup,parseStateBackup}=await import('/src/backup-state.ts');
  const name='babelshelf-note-recovery-test-'+crypto.randomUUID();let store=new KnowledgeStore(name);
  const assert=(value:unknown,message:string)=>{if(!value)throw Error(message);};
  const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
  const refused=async(work:()=>Promise<unknown>)=>{try{await work();return false;}catch{return true;}};
  try{
   const at=new Date().toISOString(),parent={id:'parent',kind:'original',state:'active',createdAt:at,aliases:[],sources:[],revisions:[{version:1,title:'Source',body:'Source fact',path:'Notes/source.md',at}]};
   const sources=[{noteId:'parent',revision:1,start:0,end:11,quote:'Source fact'}],generated={id:'generated',kind:'generated',state:'active',createdAt:at,aliases:[],sources,revisions:[{version:1,title:'Answer',body:'Saved answer',path:'Inbox/answer.md',at}]};
   const text=JSON.stringify(await makeStateBackup({notes:[parent,generated],settings:[],runs:[]})),initial=await store.reviewBackup(text);
   await store.restore(text,initial.expected);
   const views=await store.views();await store.commit(views,views.map(n=>n.id==='generated'?{...n,body:'Local edit',version:2,history:[n.body]}:n));
   const review=await store.reviewBackup(text);assert(review.noteRecovery.some(n=>n.noteId==='generated'),'Generated recovery missing');
   const before=await store.snapshot(),nativeAdd=IDBObjectStore.prototype.add;
   IDBObjectStore.prototype.add=function(value,key){const request=nativeAdd.call(this,value,key);if(this.name==='runs'&&String(key).startsWith('ui-v1-note-restore-'))this.transaction.abort();return request;};
   try{assert(await refused(()=>store.restoreNote(text,review.expected,'generated')),'Forced abort succeeded');}finally{IDBObjectStore.prototype.add=nativeAdd;}
   assert(same(await store.snapshot(),before),'Aborted recovery left a revision or receipt');
   await store.compareState('test-race',undefined,'changed');const raced=await store.snapshot();
   assert(await refused(()=>store.restoreNote(text,review.expected,'generated')),'Stale review wrote data');assert(same(await store.snapshot(),raced),'Rejected review changed data');
   const fresh=await store.reviewBackup(text);await store.restoreNote(text,fresh.expected,'generated');
   store.close();store=new KnowledgeStore(name);const restored=await store.snapshot(),answer=restored.notes.find(n=>n.id==='generated');
   assert(same(answer.revisions.map((r:any)=>r.body),['Saved answer','Local edit','Saved answer']),'History lost');
   assert(same(answer.sources,sources),'Provenance changed');assert(restored.runs.filter(r=>r.value.type==='note-restore').length===1,'Receipt missing/duplicated');
   await parseStateBackup(JSON.stringify(await store.backup()));return {passed:true};
  }finally{store.close();await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});}
 });
 expect(result).toEqual({passed:true});
});
