import {expect,test} from '@playwright/test';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination,exact:true}).click();
}

test('a schedule edited in Memory updates the Schedule view and notification delivery is clearly in-app',async({page})=>{
 await page.goto('/');
 await navigate(page,'Schedule');
 await expect(page.getByText('Runs while visible',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'New schedule'}).click();
 await page.getByRole('textbox',{name:'Schedule prompt'}).fill('Check the emergency kit');
 const tomorrow=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()+1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});
 await page.getByRole('textbox',{name:'Schedule date'}).fill(tomorrow);
 await page.getByRole('textbox',{name:'Schedule time'}).fill('09:00');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('button.schedule-detail',{hasText:'Check the emergency kit'})).toBeVisible();

 await navigate(page,'Memory');
 await page.getByRole('navigation',{name:'Memory path'}).getByRole('button',{name:'Memory',exact:true}).click();
 await page.getByRole('button',{name:'Open Schedule',exact:true}).click();
 await page.locator('.file-row').first().click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'});
 const original=await editor.inputValue();
 expect(original).toContain('## Prompt\nCheck the emergency kit');
 await editor.fill(original.replace(/## Prompt\n[\s\S]*$/,'## Prompt\nUpdated emergency kit reminder'));
 await page.getByRole('button',{name:'Save',exact:true}).click();

 await navigate(page,'Schedule');
 await expect(page.locator('button.schedule-detail',{hasText:'Updated emergency kit reminder'})).toBeVisible();
 await navigate(page,'Notifications');
 await expect(page.getByText('In-app only',{exact:true})).toBeVisible();
});

test.describe('custom schedule across daylight-saving change',()=>{
 test.use({timezoneId:'America/New_York'});
 test('the next day returns to the chosen local time and remains paused',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-03-08T08:00:00Z'));await page.goto('/');await navigate(page,'Schedule');
  await page.getByRole('button',{name:'New schedule'}).click();await page.getByRole('textbox',{name:'Schedule prompt'}).fill('Check supplies');
  await page.getByRole('button',{name:'Repeat',exact:true}).click();await page.getByRole('button',{name:'Custom',exact:true}).click();
  await page.getByRole('textbox',{name:'Schedule date'}).fill('2026-03-08');await page.getByRole('textbox',{name:'Repeat interval'}).fill('1');await page.getByRole('textbox',{name:'Schedule time'}).fill('02:30');
  await expect(page.locator('.next-occurrence')).toContainText('3/9/2026, 2:30:00 AM');await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.locator('button.schedule-detail',{hasText:'Check supplies'})).toContainText('Paused');
 });
});

import {createNote} from '../../../dist/core.js';
import {formatTask,taskDefinition} from '../src/task-records';
test('skipping a schedule from another timezone leaves the occurrence and history intact',async({page})=>{
 const current=Intl.DateTimeFormat().resolvedOptions().timeZone,other=current==='Asia/Tokyo'?'America/New_York':'Asia/Tokyo';
 const task={repeat:'daily',time:'09:00',days:[],date:'2026-10-20',monthDay:1,interval:1,unit:'days',timezone:other,enabled:false,notify:true,prompt:'Timezone skip fixture'};
 const note=createNote({path:'Schedule/zone-fixture.md',body:formatTask(task)});note.ui={recordType:'schedule'};note.taskCursor={definition:taskDefinition(task),nextAt:'2099-01-01T00:00:00.000Z'};
 await page.goto('/');await navigate(page,'Memory');await page.evaluate(async record=>{await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('mlb-memory-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('notes','readwrite');tx.objectStore('notes').put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},note);
 await page.reload();await navigate(page,'Schedule');await expect(page.locator('button.schedule-detail',{hasText:'Timezone skip fixture'})).toContainText('Timezone changed');
 await page.getByRole('button',{name:'Schedule actions for Timezone skip fixture'}).click();await page.getByRole('button',{name:'Skip occurrence'}).click();await expect(page.getByText('Timezone changed · review schedule',{exact:true})).toBeVisible();
 const result=await page.evaluate(async id=>new Promise<any[]>((resolve,reject)=>{const req=indexedDB.open('mlb-memory-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('notes','readonly'),q=tx.objectStore('notes').getAll();q.onsuccess=()=>resolve(q.result.filter((n:any)=>n.id===id||n.ui?.recordType==='execution'||n.ui?.recordType==='notification'));tx.oncomplete=()=>db.close();};}),note.id);
 expect(result).toEqual([note]);
});

test('a due schedule in another timezone does not block local due work',async({page})=>{
 const local=Intl.DateTimeFormat().resolvedOptions().timeZone,other=local==='Asia/Tokyo'?'America/New_York':'Asia/Tokyo';
 const base={repeat:'daily',time:'09:00',days:[],date:'2026-10-20',monthDay:1,interval:1,unit:'days',enabled:true,notify:false};
 const foreign={...base,timezone:other,prompt:'Foreign timezone fixture'},matching={...base,timezone:local,prompt:'Local overdue fixture'};
 const due=new Date(Date.now()-600000).toISOString();
 const make=(task:any,id:string,path:string)=>{const note=createNote({path,body:formatTask(task)});note.id=id;note.ui={recordType:'schedule'};note.taskCursor={definition:taskDefinition(task),nextAt:due};return note;};
 const a=make(foreign,'00000000-0000-4000-8000-000000000001','Schedule/foreign-fixture.md'),b=make(matching,'ffffffff-ffff-4fff-8fff-ffffffffffff','Schedule/local-fixture.md');
 await page.goto('/');await navigate(page,'Memory');await page.evaluate(async records=>{await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('mlb-memory-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('notes','readwrite');for(const record of records)tx.objectStore('notes').put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},[a,b]);
 await page.reload();await navigate(page,'Schedule');await expect(page.locator('button.schedule-detail',{hasText:'Foreign timezone fixture'})).toContainText('Timezone changed');await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('button.schedule-detail',{hasText:'Local overdue fixture'})).toContainText('Missed',{timeout:10000});
 const result=await page.evaluate(async()=>new Promise<any[]>((resolve,reject)=>{const req=indexedDB.open('mlb-memory-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('notes','readonly'),q=tx.objectStore('notes').getAll();q.onsuccess=()=>resolve(q.result.filter((n:any)=>n.ui?.recordType==='execution'));tx.oncomplete=()=>db.close();};}));
 expect(result).toHaveLength(1);expect(result[0].revisions.at(-1).body).toContain(b.id);expect(result[0].revisions.at(-1).body).toContain('"status": "missed"');
});

import {claimTaskRun} from '../src/task-records';
test('a run owned by another tab does not block another local due schedule',async({page})=>{
 const local=Intl.DateTimeFormat().resolvedOptions().timeZone,base={repeat:'daily',time:'09:00',days:[],date:'2026-10-20',monthDay:1,interval:1,unit:'days',enabled:true,notify:false,timezone:local};
 const first={...base,prompt:'Other tab running fixture'},second={...base,prompt:'Second local overdue fixture'},due=new Date(Date.now()-600000).toISOString(),now=new Date();
 const make=(task:any,id:string,path:string)=>{const note=createNote({path,body:formatTask(task)});note.id=id;note.ui={recordType:'schedule'};note.taskCursor={definition:taskDefinition(task),nextAt:due};return note;};
 const a=make(first,'00000000-0000-4000-8000-000000000001','Schedule/other-tab.md'),b=make(second,'ffffffff-ffff-4fff-8fff-ffffffffffff','Schedule/second-local.md'),run=claimTaskRun([a],a.id,'other-tab',now,{manual:true}).run;
 await page.goto('/');await navigate(page,'Memory');await page.evaluate(async records=>{await new Promise<void>((resolve,reject)=>{const req=indexedDB.open('mlb-memory-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('notes','readwrite');for(const record of records)tx.objectStore('notes').put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},[a,b,run]);
 await page.reload();await navigate(page,'Schedule');await expect(page.locator('button.schedule-detail',{hasText:'Other tab running fixture'})).toContainText('Running');await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await expect(page.locator('button.schedule-detail',{hasText:'Second local overdue fixture'})).toContainText('Missed',{timeout:10000});
 const result=await page.evaluate(async()=>new Promise<any[]>((resolve,reject)=>{const req=indexedDB.open('mlb-memory-v1');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,tx=db.transaction('notes','readonly'),q=tx.objectStore('notes').getAll();q.onsuccess=()=>resolve(q.result.filter((n:any)=>n.ui?.recordType==='execution'));tx.oncomplete=()=>db.close();};}));
 expect(result).toHaveLength(2);expect(result.find(n=>n.id===run.id)).toEqual(run);expect(result.find(n=>n.id!==run.id).revisions.at(-1).body).toContain(b.id);
});

test('correcting a schedule field clears its stale save error while retaining the draft',async({page})=>{
 await page.goto('/');await navigate(page,'Schedule');await page.getByRole('button',{name:'New schedule'}).click();
 await page.getByRole('textbox',{name:'Schedule prompt'}).fill('Check supplies');
 await page.getByRole('button',{name:'Repeat',exact:true}).click();await page.getByRole('button',{name:'Every month',exact:true}).click();
 await page.getByRole('textbox',{name:'Day of month'}).fill('32');await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('alert')).toHaveText('Day must be 1–31');
 await page.getByRole('textbox',{name:'Day of month'}).fill('31');
 await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Schedule prompt'})).toHaveValue('Check supplies');
 await expect(page.locator('.next-occurrence')).not.toContainText('Day must be 1–31');
});
