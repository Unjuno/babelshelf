import {expect,test,type Page} from '@playwright/test';

async function openSettingsItem(page:Page,name:string){
 const item=page.getByRole('button',{name,exact:true});
 if(!(await item.isVisible()))await page.locator('.settings-more > summary').click();
 await item.click();
}

test('unsaved tool source survives closing and protects app refresh until explicitly discarded',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Tools');
 await page.getByRole('button',{name:'Create tool package',exact:true}).click();
 const code='({ input }) => ({ length: input.query.length })';
 await page.getByRole('textbox',{name:'Tool code',exact:true}).fill(code);
 await page.getByRole('textbox',{name:'Tool idea',exact:true}).fill('Count characters locally');
 await page.getByRole('button',{name:/^(Cancel|Close)$/,exact:true}).click();
 await page.getByRole('button',{name:/^(Create tool package|Resume tool draft)$/,exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Tool code',exact:true})).toHaveValue(code);
 await expect(page.getByRole('textbox',{name:'Tool idea',exact:true})).toHaveValue('Count characters locally');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Back to Settings'}).click();await openSettingsItem(page,'Connection');
 await page.getByRole('button',{name:'Online',exact:true}).click();
 await expect(page.getByRole('button',{name:'Refresh app and check for updates'})).toBeDisabled();
 await page.getByRole('button',{name:'Back to Settings'}).click();await openSettingsItem(page,'Tools');
 await page.getByRole('button',{name:'Resume tool draft',exact:true}).click();
 await page.getByRole('button',{name:'Discard draft',exact:true}).click();
 await expect(page.getByRole('button',{name:'Create tool package',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Back to Settings'}).click();await openSettingsItem(page,'Connection');
 await expect(page.getByRole('button',{name:'Refresh app and check for updates'})).toBeEnabled();
 const packages=await page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();try{return (await store.all()).filter((n:any)=>n.revisions.at(-1).path?.startsWith('Tools/user.')).length;}finally{store.close();}});
 expect(packages).toBe(0);
});

test('source approval is atomic when the paired instructions change through Memory',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Tools');
 await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('button',{name:'Save files'}).click();
 // Construct an inert proposal through the production API; this test does not
 // stand in for model generation. The UI below changes the real paired record.
 const proposal=await page.evaluate(async()=>{
  const {KnowledgeStore,prepareCorrection}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();
  try{const records=await store.all(),target=records.find((note:any)=>note.revisions.at(-1).path==='Tools/user.my-tool/tool.js');return prepareCorrection(target,'Trim input',JSON.stringify({body:'({ input }) => ({ value: input.query.trim() })'}),records);}finally{store.close();}
 });
 await expect(page.getByText('Tools/user.my-tool/SKILL.md',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'});
 await editor.fill((await editor.inputValue())+'\nUse the latest instructions.\n');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(editor).toHaveCount(0);
 const result=await page.evaluate(async proposal=>{
  const {KnowledgeStore,prepareCorrection}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();
  try{
   let error='';try{await store.approveCorrection(proposal);}catch(reason){error=(reason as Error).message;}
   const records=await store.all(),target=records.find((note:any)=>note.id===proposal.expected.id);
   const before={error,version:target.revisions.at(-1).version,receipts:(await store.corrections(target.id)).length};
   // A fresh review can save once, then Undo appends the original as a revision.
   const fresh=prepareCorrection(target,'Trim input',JSON.stringify({body:proposal.after}),records),receipt=await store.approveCorrection(fresh);
   await store.revertCorrection(receipt.id);
   const final=(await store.all()).find((note:any)=>note.id===target.id);
   return {before,version:final.revisions.at(-1).version,body:final.revisions.at(-1).body};
  }finally{store.close();}
 },proposal);
 expect(result.before).toEqual({error:'Version conflict · regenerate the proposal',version:1,receipts:0});
 expect(result.version).toBe(3);expect(result.body).toBe(proposal.before);
});


test('custom package save code loads only when the user saves a package',async({page})=>{
 const packageRequests:string[]=[];
 page.on('request',request=>{if(request.url().includes('custom-tool-package'))packageRequests.push(request.url());});
 await page.goto('/');
 expect(packageRequests).toHaveLength(0);
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');
 await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('button',{name:'Save files'}).click();
 await expect.poll(()=>packageRequests.length).toBeGreaterThan(0);
});

test('Settings links to custom tool runtime and editable harness profile',async({page})=>{
 await page.goto('/');
 // The compact navigation opens on click; the other destinations are then available.
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await expect(page.getByRole('heading',{name:'Settings'})).toBeVisible();
 await openSettingsItem(page,'Assistant');
 await expect(page.getByRole('heading',{name:'Assistant',exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Default response style'})).toBeVisible();
 await page.getByRole('button',{name:'Edit harness file'}).click();
 await expect(page.getByText('Settings/harness.md',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');
 await expect(page.getByRole('heading',{name:'Tools'})).toBeVisible();
 await expect(page.getByRole('button',{name:/Check local files|Prepare runtime/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open tool files'})).toBeVisible();
});

test('response style is persisted in the canonical harness settings',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Assistant');
 const styles=page.getByRole('group',{name:'Default response style'});
 await expect(styles.getByRole('button',{name:'Balanced'})).toHaveAttribute('aria-pressed','true');
 await styles.getByRole('button',{name:'Concise'}).click();
 await expect(styles.getByRole('button',{name:'Concise'})).toHaveAttribute('aria-pressed','true');
 await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Assistant');
 await expect(page.getByRole('group',{name:'Default response style'}).getByRole('button',{name:'Concise'})).toHaveAttribute('aria-pressed','true');
});

test('Assistant profile selection is reviewed before saving and persists in the same Memory file',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Assistant');
 const profile=page.getByRole('button',{name:'Harness profile',exact:true});
 await expect(profile).toContainText('Standard');
 await profile.click();
 await page.getByRole('button',{name:'Conversation',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Profile after'})).toContainText('No tools');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(profile).toContainText('Standard');
 await profile.click();
 await page.getByRole('button',{name:'Conversation',exact:true}).click();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Assistant',exact:true})).toBeVisible();
 await expect(profile).toContainText('Conversation');
 await page.reload();
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Assistant');
 await expect(profile).toContainText('Conversation');
 await page.getByRole('button',{name:'Edit harness file'}).click();
 await expect(page.getByText('Settings/harness.md',{exact:true})).toBeVisible();
 await expect(page.locator('.file-body')).toContainText('"activeProfileId": "conversation"');
});

test('custom profile approval refuses tool source changes in another tab and can be reviewed again',async({page})=>{
 test.setTimeout(60000);
 const settings=async(target:Page,item:string)=>{
  await target.getByRole('button',{name:'Input',exact:true}).click();
  await target.getByRole('menuitem',{name:'Settings'}).click();
  await openSettingsItem(target,item);
 };
 await page.goto('/');await settings(page,'Tools');
 await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('button',{name:'Save files'}).click();
 await settings(page,'Assistant');
 await page.getByRole('button',{name:'Edit harness file'}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'}),original=await editor.inputValue();
 const value=JSON.parse(original.match(/```json\n([\s\S]+)\n```/)![1]);
 value.profiles.push({id:'custom-lookup',label:'Custom lookup',enabledTools:['user.my-tool'],maxToolCalls:1,maxResultChars:1000});
 await editor.fill('# Harness\n\n```json\n'+JSON.stringify(value,null,2)+'\n```\n');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(editor).toHaveCount(0);
 await settings(page,'Assistant');
 await page.getByRole('button',{name:'Harness profile'}).click();
 await page.getByRole('button',{name:'Custom lookup',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toBeVisible();
 await expect(page.locator('.harness-profile-review')).toContainText('Tool files');
 const other=await page.context().newPage();
 try{
  await other.goto('/');await settings(other,'Tools');
  await other.getByRole('button',{name:'Open tool files'}).click();
  await other.getByRole('button',{name:'Open user.my-tool'}).click();
  await other.getByRole('button',{name:'Open tool.js'}).click();
  await other.getByRole('button',{name:'Edit',exact:true}).click();
  await other.getByRole('textbox',{name:'Markdown content'}).fill('({ input }) => ({ reviewed: input.query })');
  await other.getByRole('button',{name:'Save',exact:true}).click();
  await expect(other.getByRole('textbox',{name:'Markdown content'})).toHaveCount(0);
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Version conflict');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('button',{name:'Harness profile'})).toContainText('Standard');
  await page.getByRole('button',{name:'Harness profile'}).click();
  await page.getByRole('button',{name:'Custom lookup',exact:true}).click();
  await page.getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('button',{name:'Harness profile'})).toContainText('Custom lookup');
 }finally{await other.close();}
});

test('assistant instructions are saved in Memory and stay separate from tool permissions',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Assistant');
 const guidance='Prefer concise Japanese answers. Mention the source path when useful.';
 const editor=page.getByRole('textbox',{name:'Assistant instructions'});await editor.fill(guidance);
 await page.getByRole('button',{name:'Save instructions'}).click();
 await expect(page.getByRole('button',{name:'Save instructions'})).toBeDisabled();
 await page.reload();await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Assistant');
 await expect(page.getByRole('textbox',{name:'Assistant instructions'})).toHaveValue(guidance);
 await page.getByRole('button',{name:'Edit harness file'}).click();
 await expect(page.getByText('Settings/harness.md',{exact:true})).toBeVisible();
});

test('assistant instruction byte overflow is explained and can be corrected',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Assistant');
 const editor=page.getByRole('textbox',{name:'Assistant instructions'}),save=page.getByRole('button',{name:'Save instructions'});
 await editor.fill('あ'.repeat(700));await expect(page.getByText('Over 2,048 bytes',{exact:true})).toBeVisible();await expect(save).toBeDisabled();
 await editor.fill('あ'.repeat(650));await expect(page.getByText('Over 2,048 bytes',{exact:true})).toHaveCount(0);await expect(save).toBeEnabled();
});

test('unsaved assistant instructions survive navigation and block app refresh until discarded',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Offline · Tap to switch Online'}).click();
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Assistant');
 await page.getByRole('textbox',{name:'Assistant instructions'}).fill('Keep my unsaved guidance');
 await page.getByRole('button',{name:'Back to Settings'}).click();await openSettingsItem(page,'Assistant');
 await expect(page.getByRole('textbox',{name:'Assistant instructions'})).toHaveValue('Keep my unsaved guidance');
 await page.getByRole('button',{name:'Back to Settings'}).click();await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(page.getByRole('button',{name:'Refresh app and check for updates'})).toBeDisabled();
 await page.getByRole('button',{name:'Back to Settings'}).click();await openSettingsItem(page,'Assistant');
 await page.getByRole('button',{name:'Discard instruction changes'}).click();
 await expect(page.getByRole('textbox',{name:'Assistant instructions'})).toHaveValue('');
 await page.getByRole('button',{name:'Back to Settings'}).click();await page.getByRole('button',{name:'Connection',exact:true}).click();
 await expect(page.getByRole('button',{name:'Refresh app and check for updates'})).toBeEnabled();
});

test('an instruction save conflict keeps the draft and requires an explicit choice of the saved version',async({page})=>{
 const assistant=async(target:Page)=>{await target.getByRole('button',{name:'Input',exact:true}).click();await target.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(target,'Assistant');};
 await page.goto('/');await assistant(page);await page.getByRole('textbox',{name:'Assistant instructions'}).fill('Draft in the first tab');
 const other=await page.context().newPage();
 try{
  await other.goto('/');await assistant(other);await other.getByRole('textbox',{name:'Assistant instructions'}).fill('Saved in the second tab');
  await other.getByRole('button',{name:'Save instructions'}).click();await expect(other.getByRole('button',{name:'Save instructions'})).toBeDisabled();
  await page.getByRole('button',{name:'Save instructions'}).click();
  await expect(page.getByRole('textbox',{name:'Assistant instructions'})).toHaveValue('Draft in the first tab');
  await expect(page.getByText('Changed elsewhere · draft kept',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save instructions'})).toBeDisabled();
  await page.getByText('Saved version',{exact:true}).click();await expect(page.getByText('Saved in the second tab',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Discard instruction changes'}).click();
  await expect(page.getByRole('textbox',{name:'Assistant instructions'})).toHaveValue('Saved in the second tab');
 }finally{await other.close();}
});

test('model-assisted tool drafting requires an already loaded selected model and keeps Save separate',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('textbox',{name:'Tool idea'}).fill('Summarize local meeting notes');
 await expect(page.getByText(/Load selected Text model in Models first/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Draft with selected model'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Save files'})).toBeEnabled();
 await expect(page.getByText(/Saving makes this tool available in the current profile/)).toBeVisible();
});

test('tool creation explains that saved code runs when selected and should be trusted',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Create tool package'}).click();
 await expect(page.getByText('Code runs locally when the active profile calls this tool. Save the package to make it available.',{exact:true})).toBeVisible();
});

test('custom tool creation persists its schema and immediately makes it available to the active profile',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('textbox',{name:'Tool ID',exact:true}).fill('user.precise-calc');
 const schema={type:'object',required:['expression','decimals'],additionalProperties:false,properties:{expression:{type:'string',minLength:1,maxLength:160},decimals:{type:'integer',minimum:0,maximum:6}}};
 await page.getByRole('textbox',{name:'Tool input schema',exact:true}).fill(JSON.stringify(schema,null,2));
 await page.getByRole('textbox',{name:'Tool code',exact:true}).fill('({input,capabilities})=>({result:capabilities.calculate(input.expression),decimals:input.decimals})');
 await page.getByRole('button',{name:'Save files',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();try{return (await store.all()).find((note:any)=>note.revisions.at(-1).path==='Tools/user.precise-calc/SKILL.md')?.revisions.at(-1).body??null;}finally{store.close();}})).toContain('"expression"');
 const saved=await page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const store=new KnowledgeStore();try{return (await store.all()).find((note:any)=>note.revisions.at(-1).path==='Tools/user.precise-calc/SKILL.md')?.revisions.at(-1).body??null;}finally{store.close();}});
 expect(saved).toContain('"decimals"');
});

test('a custom tool is stored and added to the active profile in one save without an activation dialog',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('textbox',{name:'Tool ID',exact:true}).fill('user.ui-check');
 await page.getByRole('textbox',{name:'Tool title'}).fill('UI check');
 await page.getByRole('textbox',{name:'Tool instructions'}).fill('Return the query unchanged.');
 await expect(page.getByText(/Saving makes this tool available in the current profile/)).toBeVisible();
 await page.getByRole('button',{name:'Save files'}).click();
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const {parsePreference}=await import('/src/preference-records.ts');const store=new KnowledgeStore();try{const note=(await store.all()).find((item:any)=>item.id==='settings-harness');return note?parsePreference('harness',note.revisions.at(-1).body).profiles.find((profile:any)=>profile.id==='standard')?.enabledTools??[]:[];}finally{store.close();}})).toContain('user.ui-check');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Open tool files'}).click();
 await page.getByRole('button',{name:'Open user.ui-check'}).click();
 await expect(page.getByRole('button',{name:'Open SKILL.md'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open tool.js'})).toBeVisible();
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Create tool package'}).click();
 await page.getByRole('textbox',{name:'Tool ID',exact:true}).fill('user.ui-check');await page.getByRole('button',{name:'Save files'}).click();
 await expect(page.getByRole('alert')).toContainText('Tool folder already exists');
});

test('importing a validated local tool pair makes it available without executing it immediately',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Import SKILL.md + tool.js'}).click();
 const skill='---\n{"id":"user.imported","version":1,"title":"Imported lookup","inputSchema":{"type":"object","required":["query"],"additionalProperties":false,"properties":{"query":{"type":"string","minLength":1,"maxLength":80}}},"capabilities":["memory.search"]}\n---\n\nSearch local notes.\n';
 await page.getByLabel('Custom tool source files').setInputFiles([{name:'SKILL.md',mimeType:'text/markdown',buffer:Buffer.from(skill)},{name:'tool.js',mimeType:'text/javascript',buffer:Buffer.from('({input,capabilities})=>capabilities.memorySearch(input.query)')}]);
 await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toHaveCount(0);
 await expect.poll(()=>page.evaluate(async()=>{const {KnowledgeStore}=await import('/src/knowledge-store.ts');const {parsePreference}=await import('/src/preference-records.ts');const store=new KnowledgeStore();try{return parsePreference('harness',(await store.all()).find((note:any)=>note.id==='settings-harness').revisions.at(-1).body).profiles.find((profile:any)=>profile.id==='standard').enabledTools;}finally{store.close();}})).toContain('user.imported');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await openSettingsItem(page,'Tools');await page.getByRole('button',{name:'Open tool files'}).click();
 await page.getByRole('button',{name:'Open user.imported'}).click();await expect(page.getByRole('button',{name:'Open SKILL.md'})).toBeVisible();await expect(page.getByRole('button',{name:'Open tool.js'})).toBeVisible();
});
