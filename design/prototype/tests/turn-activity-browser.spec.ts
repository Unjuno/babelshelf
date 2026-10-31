import {expect,test} from '@playwright/test';
import {startActivity,finishActivity} from '../src/harness-activity.ts';

test('activity sheet shows observed model and registered-tool work from saved receipts',async({page})=>{
 const plan=finishActivity(startActivity('dialogue.plan',{}),{output:{inference:{promptTokens:120,outputTokens:15,countMs:5.5,generationWallMs:700.2}}});
 const answer=finishActivity(startActivity('knowledge.answer',{}),{output:{model:{id:'fixture'},sourceCount:1,inference:{measuredModelCalls:3,promptTokens:80,outputTokens:10,countMs:2.5,generationWallMs:300.4}}});
 const failed=finishActivity(startActivity('knowledge.answer',{}),{error:Error('Runtime unavailable'),output:{inference:{measuredModelCalls:1,generationWallMs:100}}});
 const search=finishActivity(startActivity('memory.search',{query:'fixture'}),{output:[]});
 await page.goto('/');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
 await page.evaluate(({plan,answer,failed,search})=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({schema:1,revision:1,turns:[{id:'work-summary-turn',user:'Question',answer:'Answer',activity:[plan,answer,failed,search]}],compaction:null},'ui-v1-dialogue');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),{plan,answer,failed,search});
 await page.reload();await page.getByRole('button',{name:'View activity',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Activity',exact:true}),summary=dialog.getByRole('region',{name:'Turn work summary'});
 await expect(summary).toBeVisible();await expect(summary).toContainText(/Agent model calls · recorded\s*5/);await expect(summary).toContainText(/Prompt tokens · observed\s*200/);await expect(summary).toContainText(/Generated tokens · observed\s*25/);await expect(summary).toContainText(/Token counting\s*8 ms/);await expect(summary).toContainText(/Generation\s*1\.1 s/);await expect(summary).toContainText(/Tool calls · receipt time\s*1/);
});

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
