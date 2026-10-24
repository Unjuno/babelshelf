import {expect,test} from '@playwright/test';

test('Settings keeps core categories visible and secondary tools grouped under More',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();

 for(const label of ['Models','Files & media','Appearance','Connection','Local files','Help','Licenses']){
  await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
 }
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toHaveCount(0);
 await page.getByText('More',{exact:true}).click();
 for(const label of ['Assistant','Tools','Developer','Tool files','Restore defaults']){
  await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
 }
});

test('one malformed settings file can be recovered without restoring the other settings',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('button',{name:'Input',exact:true})).toBeVisible();
 await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');
  const store=new KnowledgeStore();
  try{
   const db=await store.open();
   await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['notes'],'readwrite'),notes=tx.objectStore('notes'),request=notes.get('settings-appearance');
    request.onsuccess=()=>{if(!request.result){tx.abort();reject(Error('Appearance settings missing'));return;}const record=request.result;record.revisions.at(-1).body='invalid settings body';notes.put(record);};
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('Corruption fixture failed'));
   });
  }finally{store.close();}
 });
 await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Settings need recovery');
 await page.getByRole('button',{name:'Recover Appearance settings'}).click();
 await expect(page.getByRole('button',{name:'Recover Appearance settings'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Models',exact:true})).toBeVisible();
});

test('offline initial setup offers a local import path for a missing selected text model',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Initial setup',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Initial preparation'})).toBeVisible();
 await expect(page.getByRole('switch',{name:'Allow model downloads'})).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Prepare',exact:true})).toBeDisabled();
 const chooserPromise=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Choose local files',exact:true}).click();
 const chooser=await chooserPromise;
 expect(chooser.isMultiple()).toBe(true);
 await chooser.setFiles([]);
});

test('current model choices can be saved as a Memory-backed model set and remain available after reload',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:/Model set ·/}).click();
 await expect(page.getByRole('heading',{name:'Model set'})).toBeVisible();
 await page.getByRole('button',{name:'Save current as set'}).click();
 await page.getByRole('textbox',{name:'Model set name'}).fill('My reading setup');
 await page.getByRole('textbox',{name:'Model set detail'}).fill('Text only');
 await page.getByRole('button',{name:'Save set'}).click();
 await expect(page.getByRole('button',{name:/My reading setup/})).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:/Model set ·/}).click();
 await expect(page.getByRole('button',{name:/My reading setup/})).toBeVisible();
});

test('a named palette edited in Memory appears as an explicit Appearance choice',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await expect(page.getByRole('button',{name:'Default',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Edit appearance file',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'}),body=await editor.inputValue(),match=body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);
 expect(match).not.toBeNull();
 const settings=JSON.parse(match![1]);
 settings.paletteRegistry=[{id:'palette-night-garden',name:'Night garden',canvas:'#101820',text:'#f2f5f7',surface:'#203040',surfaceText:'#f2f5f7',accent:'#76e3c1',accentText:'#102018',muted:'#d1dae1',border:'#506070'}];
 settings.activePaletteId='palette-night-garden';
 await editor.fill(`# Appearance\n\n\`\`\`json\n${JSON.stringify(settings,null,2)}\n\`\`\`\n`);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await expect(page.getByRole('button',{name:'Night garden',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Default',exact:true}).click();
 await expect(page.getByRole('button',{name:'Default',exact:true})).toHaveAttribute('aria-pressed','true');
});
