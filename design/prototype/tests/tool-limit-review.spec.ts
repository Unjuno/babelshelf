import {expect,test} from '@playwright/test';

test('an existing three-call setting is preserved until the user reviews and approves',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Input',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();
  try{const db=await store.open();await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(['notes'],'readwrite'),notes=tx.objectStore('notes'),request=notes.get('settings-harness');
   request.onsuccess=()=>{const record=request.result,revision=record.revisions.at(-1),match=revision.body.match(/```json\n([\s\S]+)\n```/),value=JSON.parse(match[1]);value.profiles.find((profile:any)=>profile.id===value.activeProfileId).maxToolCalls=3;revision.body=revision.body.replace(match[1],JSON.stringify(value,null,2));notes.put(record);};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Fixture failed'));
  });}finally{store.close();}
 });
 await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByText('More',{exact:true}).click();await page.getByRole('button',{name:'Assistant',exact:true}).click();
 await expect(page.getByText('Tool call limit',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review call limit',exact:true}).click();
 const before=page.getByRole('region',{name:'Profile before'}),after=page.getByRole('region',{name:'Profile after'});
 await expect(before).toContainText('3');await expect(after).toContainText('No profile limit');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Review changes'})).toBeHidden();
 await expect(page.getByRole('button',{name:'Review call limit',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Assistant profile',exact:true}).getByText('No profile limit',{exact:true})).toBeVisible();
});

test('an untouched schema-1 Standard default is modernized only after full before/after review',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Input',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();
  try{const db=await store.open();await new Promise<void>((resolve,reject)=>{
   const tx=db.transaction(['notes'],'readwrite'),notes=tx.objectStore('notes'),request=notes.get('settings-harness');
   request.onsuccess=()=>{const record=request.result,revision=record.revisions.at(-1),match=revision.body.match(/```json\n([\s\S]+)\n```/),value=JSON.parse(match[1]);value.schemaVersion=1;value.profiles=value.profiles.map((profile:any)=>profile.id==='standard'?{...profile,enabledTools:['memory.search','memory.read','math.calculate'],maxToolCalls:3}:profile.id==='source-first'?{...profile,enabledTools:['memory.search','memory.read'],maxToolCalls:2}:profile);revision.body=revision.body.replace(match[1],JSON.stringify(value,null,2));notes.put(record);};
   tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Fixture failed'));
  });}finally{store.close();}
 });
 await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByText('More',{exact:true}).click();await page.getByRole('button',{name:'Assistant',exact:true}).click();
 await expect(page.getByRole('button',{name:'Review old Standard defaults',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review old Standard defaults',exact:true}).click();
 const before=page.getByRole('region',{name:'Profile before'}),after=page.getByRole('region',{name:'Profile after'});
 await expect(before).toContainText('3');await expect(after).toContainText('No profile limit');
 await page.getByText('File changes',{exact:true}).click();
 await expect(page.getByText(/memory\.list/)).toBeVisible();await expect(page.getByText(/time\.now/)).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Review changes'})).toBeHidden();
 await expect(page.getByRole('button',{name:'Review old Standard defaults',exact:true})).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Assistant profile',exact:true}).getByText('No profile limit',{exact:true})).toBeVisible();
});
