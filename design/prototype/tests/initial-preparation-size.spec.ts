import {expect,test} from '@playwright/test';

test('initial preparation does not present a partial asset estimate as a maximum',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Initial setup',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Initial preparation'});
 await expect(dialog.getByText(/Estimated assets · .* MB/)).toBeVisible();
 await expect(dialog.getByText('Extra runtime space may be needed.',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('switch',{name:'Allow model downloads'})).not.toBeChecked();
});

test('the Q8 image and audio set persists without an implicit download',async({page})=>{
 const remote:string[]=[];page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))remote.push(request.url());});
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();await page.getByRole('button',{name:/Model set ·/}).click();
 await page.getByRole('button',{name:/^Text \+ image \+ audio · Q8/}).click();
 await expect(page.getByText(/LFM3 Q8_0 · Whisper tiny · Tesseract 7/)).toBeVisible();
 await page.getByRole('button',{name:'Apply set',exact:true}).click();
 await expect(page.getByText('Set selected · files are prepared separately',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Done',exact:true}).click();await page.reload();
 await expect.poll(()=>page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const {parsePreference}=await import('/src/preference-records.ts');const store=new KnowledgeStore();try{const note=(await store.all()).find((item:any)=>item.id==='settings-models');if(!note)return null;const value=parsePreference('models',note.revisions.at(-1).body);return {selected:[value.textModel,value.transcriptionModel,value.ocrModel,value.visionModel],original:parsePreference('models',note.revisions[0].body).textModel,revisionCount:note.revisions.length};}finally{store.close();}})).toEqual({selected:['lfm3-1.7b-q8-0','whisper-tiny','tesseract-7','lfm25-vl-450m-q4f16'],original:'lfm3-1.7b-qad-q4-0',revisionCount:2});
 expect(remote).toEqual([]);
});
