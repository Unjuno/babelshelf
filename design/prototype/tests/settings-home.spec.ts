import {expect,test} from '@playwright/test';

test('local Vision file errors stay visible without an installed inference runtime',async({page})=>{
 const remote:string[]=[];page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))remote.push(request.url());});
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();await page.getByRole('button',{name:'Browse vision models',exact:true}).click();await page.getByRole('button',{name:/^Add LFM2\.5-VL.*450M/}).click();
 const section=page.locator('[data-model-role="vision"]');
 await page.getByLabel('Pinned vision model files',{exact:true}).setInputFiles({name:'config.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(section.getByRole('alert')).toContainText('Vision file size mismatch');
 await page.getByRole('button',{name:'Prepare vision model',exact:true}).waitFor({state:'visible'});
 // The transient toast disappears; the actionable error remains beside its model.
 await expect(page.locator('.preview-toast')).toHaveCount(0,{timeout:6000});
 await expect(section.getByRole('alert')).toContainText('config.json');expect(remote).toEqual([]);
});

test('Settings keeps core categories visible and secondary tools grouped under More',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();

 for(const label of ['Models','Files & media','Appearance','Connection','Local files','Help','Licenses']){
  await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
 }
 await expect(page.getByRole('button',{name:'Assistant',exact:true})).toHaveCount(0);
 const more=page.locator('.settings-more');
 const moreDisclosure=more.locator('summary');
 await expect(moreDisclosure.locator('svg')).toBeVisible();
 await moreDisclosure.click();
 await expect(more).toHaveAttribute('open','');
 for(const label of ['Assistant','Tools','Developer','Tool files','Restore defaults']){
  await expect(page.getByRole('button',{name:label,exact:true})).toBeVisible();
 }
});

test('Connection separates cached app readiness from Home Screen launch mode',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(page.getByText('App shell',{exact:true})).toBeVisible();
 const shell=page.getByRole('status',{name:'App shell status',exact:true});
 await expect(shell).not.toHaveText('Installed');
 await expect(page.getByRole('status',{name:'Launch mode',exact:true})).toHaveText('Browser tab');
 await expect(page.getByText('Text model files',{exact:true})).toBeVisible();
 await expect(page.getByRole('status',{name:'Text model file status',exact:true})).not.toHaveText('Files present');
 await expect(page.getByRole('status',{name:'Text runtime status',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open model setup',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Models',exact:true})).toBeVisible();
});

test('pinned LFM3 context window is selectable and persists without loading model weights',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await expect(page.getByRole('button',{name:'Set up text model'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Browse text models'})).toBeVisible();
 await page.getByText('More text options',{exact:true}).click();
 const section=page.getByRole('region',{name:'LFM3 context window',exact:true}),group=section.getByRole('group',{name:'LFM3 context window',exact:true});
 await expect(group).toBeVisible();
 await expect(group.getByRole('button',{name:'8K',exact:true})).toHaveAttribute('aria-pressed','true');
 await group.getByRole('button',{name:'256K',exact:true}).click();
 await expect(group.getByRole('button',{name:'256K',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(group.getByRole('button',{name:'16K',exact:true})).toBeVisible();
 await expect(section).toContainText('Larger windows need more memory and may fail on this device');
 await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByText('More text options',{exact:true}).click();
 await expect(page.getByRole('group',{name:'LFM3 context window',exact:true}).getByRole('button',{name:'256K',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('Loaded',{exact:true})).toHaveCount(0);
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
 await expect(page.getByRole('dialog',{name:'Initial preparation'})).toContainText('Turn on downloads to prepare missing files.');
 const chooserPromise=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Choose local files',exact:true}).click();
 const chooser=await chooserPromise;
 expect(chooser.isMultiple()).toBe(true);
 await chooser.setFiles([]);
});

test('verified LFM3 Q8 candidate can be selected without changing the default or downloading implicitly',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByText('More text options',{exact:true}).click();
 await page.getByRole('button',{name:'Browse text models',exact:true}).click();
 await page.getByRole('button',{name:'Add LFM3 · 1.7B · Q8_0',exact:true}).click();
 await expect(page.getByRole('button',{name:'Text model',exact:true})).toContainText('LFM3 · 1.7B · Q8_0');
 await expect(page.getByRole('button',{name:'Initial setup',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Initial setup',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Initial preparation'});
 await expect(dialog).toContainText('LFM3 · 1.7B · Q8_0');
 await expect(dialog).toContainText('1873.8 MB');
 await expect(dialog.getByRole('switch',{name:'Allow model downloads'})).not.toBeChecked();
 await expect(dialog.getByRole('button',{name:'Prepare',exact:true})).toBeDisabled();
});

test('current model choices can be saved as a Memory-backed model set and remain available after reload',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:/Model set ·/}).click();
 await expect(page.getByRole('heading',{name:'Model set'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Text models',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Input sets',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Combined sets',exact:true})).toBeVisible();
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
 await expect(page.getByRole('heading',{name:'Saved by you',exact:true})).toBeVisible();
});

test('a model set reviews role changes before applying and never prepares files implicitly',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:/Model set ·/}).click();
 await page.getByRole('button',{name:/Bonsai 2 · 2B/}).click();
 await expect(page.getByRole('heading',{name:'Review model set'})).toBeVisible();
 await expect(page.getByText('Text',{exact:true})).toBeVisible();
 await expect(page.getByText(/Applying a set does not prepare files/)).toBeVisible();
 await page.getByRole('button',{name:'Apply set'}).click();
 await expect(page.getByText('Set selected · files are prepared separately')).toBeVisible();
 await expect(page.getByRole('button',{name:'Prepare models'})).toBeVisible();
 await page.getByRole('button',{name:'Done'}).click();
 await expect(page.getByRole('button',{name:'Text model',exact:true})).toContainText('Bonsai 2 · 2B');
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
