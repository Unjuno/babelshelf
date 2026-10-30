import {expect,test} from '@playwright/test';
test('paged receipts survive backup and restore in isolated browser IndexedDB',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts'),{emptyDialogue,appendTurn}=await import('/src/conversation.ts'),{startActivity,finishActivity}=await import('/src/harness-activity.ts');
  const names=[`qa-activity-${crypto.randomUUID()}`,`qa-activity-${crypto.randomUUID()}`],source=new KnowledgeStore(names[0]),target=new KnowledgeStore(names[1]);
  try{const dialogue=appendTurn(emptyDialogue(),{id:'turn',user:'fixture'});await source.compareState('dialogue',undefined,dialogue);
   for(let i=0;i<20;i++){const start=startActivity('memory.search',{query:`fixture-${i}`});await source.recordTurnActivity('turn',start,dialogue);await source.recordTurnActivity('turn',finishActivity(start,{output:[i]}),dialogue);}
   const text=JSON.stringify(await source.backup()),review=await target.reviewBackup(text);await target.restore(text,review.expected);const entries=await target.turnActivities('turn');return {count:entries.length,last:entries.at(-1)?.output};
  }finally{source.close();target.close();await Promise.all(names.map(name=>new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Temporary database is still open'));})));}
 });
 expect(result).toEqual({count:20,last:[19]});
});
