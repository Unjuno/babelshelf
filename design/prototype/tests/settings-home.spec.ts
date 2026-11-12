import {expect,test} from '@playwright/test';

test('audit: navigation offers a visible route back to chat and preserves the draft',async({page})=>{
 await page.goto('/');const input=page.getByRole('textbox',{name:'Message',exact:true});
 await input.fill('Unsent text');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Back to chat',exact:true}).click();
 await expect(input).toHaveValue('Unsent text');
});

test('audit: a saved text draft does not block updating and survives reload',async({page})=>{
 await page.goto('/');const input=page.getByRole('textbox',{name:'Message',exact:true});await input.fill('Saved draft after stopping');
 const online=page.getByRole('button',{name:/^Offline · Tap to switch/});if(await online.count())await online.click();
 await expect(page.getByRole('button',{name:'Update app',exact:true})).not.toHaveAttribute('data-blocked','true');
 await page.reload();await expect(input).toHaveValue('Saved draft after stopping');
});

test('audit: Check device produces a result even when a browser storage probe stalls',async({page})=>{
 test.setTimeout(35_000);
 await page.addInitScript(()=>{Object.defineProperty(navigator.storage,'estimate',{value:()=>new Promise(()=>{})});Object.defineProperty(navigator,'gpu',{value:undefined});});
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Models',exact:true}).click();await page.getByRole('button',{name:/^Model set ·/}).click();await page.getByRole('button',{name:/^LFM3 · 1\.7B · QAD Q4_0 Text/}).click();
 const review=page.getByRole('dialog');await review.getByRole('button',{name:'Check device',exact:true}).click();await expect(review.getByText('Checking storage and available processors…',{exact:true})).toBeVisible();
 await expect(review.getByRole('status').filter({hasText:'Storage estimate unavailable'})).toContainText('GPU unavailable',{timeout:12_000});await expect(review.getByRole('button',{name:'Check device',exact:true})).toBeEnabled();
});

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

 for(const label of ['Models','Files & media','Appearance','Connection','Local files','Help','Send feedback','Licenses']){
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

test('feedback can be drafted in Settings but cannot be sent while app connection is Offline',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Send feedback',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Feedback',exact:true})).toBeVisible();
 const message=page.getByRole('textbox',{name:'Feedback message',exact:true});await expect(message).toBeEnabled();await message.fill('Draft stays local until an explicit online send.');
 await expect(page.getByRole('button',{name:'Send feedback',exact:true})).toBeDisabled();
 await expect(page.getByRole('status')).toContainText('Connect and turn Online on to send');
 await expect(page.getByText(/Do not include private notes or personal information/)).toBeVisible();
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
 await expect(section).toContainText('256K is the model maximum, not a recommended phone setting');
 await expect(section.getByRole('note')).toContainText('try 8K first if model loading is slow');
 await expect(page.getByRole('note',{name:'256K context may need more memory'})).toContainText('not a phone recommendation');
 await expect(page.getByRole('button',{name:'Use 16K',exact:true})).toBeVisible();
 await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByText('More text options',{exact:true}).click();
 await expect(page.getByRole('group',{name:'LFM3 context window',exact:true}).getByRole('button',{name:'256K',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Use 16K',exact:true}).click();
 await expect(page.getByRole('group',{name:'LFM3 context window',exact:true}).getByRole('button',{name:'16K',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('note',{name:'256K context may need more memory'})).toHaveCount(0);
 await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByText('More text options',{exact:true}).click();
 await expect(page.getByRole('group',{name:'LFM3 context window',exact:true}).getByRole('button',{name:'16K',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('Loaded',{exact:true})).toHaveCount(0);
});

test('Developer model tests use a bounded LFM3 context without changing the saved context',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByText('More text options',{exact:true}).click();
 const group=page.getByRole('group',{name:'LFM3 context window',exact:true});
 await group.getByRole('button',{name:'256K',exact:true}).click();
 await page.getByRole('button',{name:'Back to Settings',exact:true}).click();
 await page.locator('.settings-more').filter({hasText:'Developer'}).locator('summary').click();
 await page.getByRole('button',{name:'Developer',exact:true}).click();
 await page.locator('.device-test-steps').first().locator('summary').click();
 await page.getByRole('button',{name:'Performance',exact:true}).click();
 const run=page.getByRole('button',{name:'Run speed sample',exact:true});
 await expect(page.getByText(/unloaded LFM3 tests use at most an 8K context, or the model’s lower configured context/i)).toBeVisible();
 await run.click();
 await expect(page.getByRole('group',{name:'Large context test options',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Run speed sample',exact:true})).toBeVisible();
});

test('LFM3 runtime has a separate visible prepare or local-check action',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 const text=page.locator('[data-model-role="text"]');
 await expect(text.getByRole('button',{name:'Text model',exact:true})).toContainText('LFM3');
 const runtime=text.locator('.model-preparation').nth(1);
 await expect(runtime).toContainText('Runtime ·');
 await expect(runtime.getByRole('button')).toHaveAttribute('aria-label',/^(Prepare text runtime|Check local text runtime files|Check text runtime)$/);
 await expect(runtime.getByRole('button')).toBeVisible();
});

test('older schema-1 settings keep the selected model until an explicit edit adds a history revision',async({page})=>{
 await page.goto('/');await expect(page.getByRole('button',{name:'Input',exact:true})).toBeVisible();
 const legacyBody=await page.evaluate(async()=>{
  const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();
  try{const db=await store.open();return await new Promise<string>((resolve,reject)=>{
   const tx=db.transaction(['notes'],'readwrite'),notes=tx.objectStore('notes'),request=notes.get('settings-models');let body='';
   request.onsuccess=()=>{const record=request.result;if(!record){tx.abort();return;}const revision=record.revisions.at(-1),match=revision.body.match(/^# Models\n\n```json\n([\s\S]+)\n```\n?$/);if(!match){tx.abort();return;}const models=JSON.parse(match[1]);models.schemaVersion=1;models.textModel='2B';for(const key of ['textLibrary','decisionLibrary','transcriptionLanguage','ocrModel','ocrLibrary','ocrLanguage','visionModel','visionLibrary','customModels','customDecisionModels','customSpeechModels','customVisionModels','customSets','lfm3ContextTokens'])delete models[key];body=`# Models\n\n\`\`\`json\n${JSON.stringify(models,null,2)}\n\`\`\`\n`;revision.body=body;notes.put(record);};
   tx.oncomplete=()=>resolve(body);tx.onabort=()=>reject(tx.error??Error('Legacy settings fixture failed'));tx.onerror=()=>reject(tx.error??Error('Legacy settings fixture failed'));
  });}finally{store.close();}
 });
 await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Models',exact:true}).click();
 await expect(page.getByRole('button',{name:'Text model',exact:true})).toContainText('Bonsai 2 · 2B');
 const readBack=async()=>page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();try{const db=await store.open();return await new Promise<any>((resolve,reject)=>{const tx=db.transaction(['notes'],'readonly'),request=tx.objectStore('notes').get('settings-models');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}finally{store.close();}});
 const untouched=await readBack();expect(untouched.revisions.at(-1).body).toBe(legacyBody);expect(untouched.revisions).toHaveLength(1);
 await page.getByRole('button',{name:'Browse text models',exact:true}).click();await page.getByRole('button',{name:'Add LFM3 · 1.7B · Q8_0',exact:true}).click();
 const saved=await readBack(),latest=JSON.parse(saved.revisions.at(-1).body.match(/```json\n([\s\S]+)\n```/)[1]);expect(saved.revisions).toHaveLength(2);expect(saved.revisions[0].body).toBe(legacyBody);expect(latest.textModel).toBe('lfm3-1.7b-q8-0');expect(latest.textLibrary).toContain('2B');expect(latest.textLibrary).toContain('lfm3-1.7b-q8-0');
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
 await expect(page.getByRole('heading',{name:'Compact local set',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:/Compact local media set LFM3 IQ3_M/})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Complete local set',exact:true})).toBeVisible();
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

test('compact LFM3 IQ3_M media set is selectable without preparing model files',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:/Model set ·/}).click();
 await page.getByRole('button',{name:/Compact local media set LFM3 IQ3_M/}).click();
 await expect(page.getByRole('heading',{name:'Review model set'})).toBeVisible();
 await expect(page.getByText(/Applying a set does not prepare files/)).toBeVisible();
 await page.getByRole('button',{name:'Apply set'}).click();
 await expect(page.getByText('Set selected · files are prepared separately')).toBeVisible();
 await expect(page.getByRole('button',{name:'Prepare models'})).toBeVisible();
 await page.getByRole('button',{name:'Done'}).click();
 await expect(page.getByRole('button',{name:'Text model',exact:true})).toContainText('IQ3_M');
 await expect(page.getByRole('button',{name:'Vision model',exact:true})).toContainText(/LFM2\.5-VL.*450M/);
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
