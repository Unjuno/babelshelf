import {expect,test,type Page} from '@playwright/test';import {readFile} from 'node:fs/promises';import {prepareOfflineShell} from './pwa-offline-setup';

async function createInboxFile(page:Page,name:string,content:string){
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click();await page.getByRole('textbox',{name:'File name'}).fill(name);await page.getByRole('textbox',{name:'New file content'}).fill(content);await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('main')).toContainText(name);
}

test('an older file version can be reviewed in the editor and saved as a new revision',async({page})=>{
 await page.goto('/');await createInboxFile(page,'QA-history-edit','original text');
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Markdown content'}).fill('changed text');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'History',exact:true}).click();const history=page.getByRole('dialog',{name:'History'});await history.getByText('v1',{exact:true}).click();await history.getByRole('button',{name:'Edit from v1'}).click();
 await expect(page.getByRole('textbox',{name:'Markdown content'})).toHaveValue('original text');await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();await expect(page.locator('main')).toContainText('changed text');await expect(page.locator('main')).toContainText('v2');
 await page.getByRole('button',{name:'History',exact:true}).click();await history.getByText('v1',{exact:true}).click();await history.getByRole('button',{name:'Edit from v1'}).click();await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('main')).toContainText('v3');
 await page.getByRole('button',{name:'History',exact:true}).click();await expect(history).toContainText('v1');await expect(history).toContainText('v2');await expect(history).toContainText('v3');
});

test('an old-version draft cannot overwrite another tab’s newer edit',async({page,context})=>{
 await page.goto('/');await createInboxFile(page,'QA-history-conflict','first version');
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Markdown content'}).fill('second version');await page.getByRole('button',{name:'Save',exact:true}).click();
 const other=await context.newPage();await other.goto('/');await other.getByRole('button',{name:'Input',exact:true}).click();await other.getByRole('menuitem',{name:'BabelShelf'}).click();await other.getByRole('button',{name:'Open Inbox'}).click();await other.getByRole('button',{name:'Open QA-history-conflict.md'}).click();
 await page.getByRole('button',{name:'History',exact:true}).click();const history=page.getByRole('dialog',{name:'History'});await history.getByText('v1',{exact:true}).click();await history.getByRole('button',{name:'Edit from v1'}).click();
 await other.getByRole('button',{name:'Edit',exact:true}).click();await other.getByRole('textbox',{name:'Markdown content'}).fill('third version in another tab');await other.getByRole('button',{name:'Save',exact:true}).click();await expect(other.locator('main')).toContainText('v3');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByText(/conflict|changed/i).last()).toBeVisible();
 await other.reload();await other.getByRole('button',{name:'Input',exact:true}).click();await other.getByRole('menuitem',{name:'BabelShelf'}).click();await other.getByRole('button',{name:'Open Inbox'}).click();await other.getByRole('button',{name:'Open QA-history-conflict.md'}).click();await expect(other.locator('main')).toContainText('third version in another tab');await expect(other.locator('main')).toContainText('v3');
});

test('Trash identifies a deleted file by its original path before restoring it',async({page})=>{
 await page.goto('/');await createInboxFile(page,'QA-trash-path','trash location');
 await page.getByRole('button',{name:'File actions'}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete',exact:true}).click();
 await page.getByRole('button',{name:'Open Trash'}).click();const trash=page.getByRole('dialog',{name:'Trash'});await expect(trash).toContainText('Inbox/QA-trash-path.md');await trash.getByRole('button',{name:'Restore Inbox/QA-trash-path.md'}).click();await expect(trash).toContainText('Trash is empty');
});

test('Trash identifies a deleted folder by its original path',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();await page.getByRole('button',{name:'Open Notes'}).click();
 await page.getByRole('button',{name:'New file'}).click();await page.getByRole('tab',{name:'Folder'}).click();await page.getByRole('textbox',{name:'Folder name'}).fill('QA-folder-location');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Notes',exact:true}).click();await page.getByRole('button',{name:'Actions for QA-folder-location'}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete',exact:true}).click();
 await page.getByRole('button',{name:'Open Trash'}).click();const trash=page.getByRole('dialog',{name:'Trash'});await expect(trash).toContainText('Notes/QA-folder-location');await trash.getByRole('button',{name:'Restore Notes/QA-folder-location'}).click();await expect(trash).toContainText('Trash is empty');
});

test('reviewed from/to correction saves a revision and Undo retains history',async({page})=>{
 await page.goto('/');await createInboxFile(page,'QA-correction-undo','集合場所は北口です。持ち物は水です。');const message=page.getByRole('textbox',{name:'Message'}),home=page.getByRole('button',{name:'Input',exact:true});
 await home.click();await home.click();await message.fill('このファイルの集合場所を北口から南口に直して。持ち物は変えないで。');await page.getByRole('button',{name:'Send',exact:true}).click();const review=page.getByRole('dialog',{name:'Review changes'});await expect(review).toContainText('北口');await expect(review).toContainText('南口');await review.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('main')).toContainText('集合場所は南口です。持ち物は水です。');
 await page.getByRole('button',{name:'History',exact:true}).click();const history=page.getByRole('dialog',{name:'History'});await expect(history).toContainText('v1');await expect(history).toContainText('v2');await history.getByRole('button',{name:'Undo',exact:true}).click();await expect(history).toContainText('Undone · v3');await history.getByRole('button',{name:'Close'}).click();await expect(page.locator('main')).toContainText('集合場所は北口です。持ち物は水です。');await expect(page.locator('main')).toContainText('v3');
});

test('restoring an identical backup explains that nothing new was added',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings'}).click();await page.getByRole('button',{name:'Local files'}).click();
 const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup'}).click();const path=await (await wait).path();const choose=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Restore backup'}).click();await (await choose).setFiles(path!);await page.getByRole('dialog',{name:'Restore backup?'}).getByRole('button',{name:'Restore',exact:true}).click();await expect(page.getByText('No new records',{exact:true})).toBeVisible();
});

test('dark add buttons remain legible in Schedule and Memory',async({page})=>{
 await page.goto('/');const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await page.getByRole('menuitem',{name:'Settings'}).click();await page.getByRole('button',{name:'Appearance',exact:true}).click();await page.getByRole('button',{name:'Dark',exact:true}).click();
 const check=async(name:string)=>{const button=page.getByRole('button',{name,exact:true});const colors=await button.evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor,image:getComputedStyle(el).backgroundImage}));const lum=(s:string)=>{const n=s.match(/\d+/g)!.slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*n[0]+.7152*n[1]+.0722*n[2];};const a=lum(colors.fg),b=lum(colors.bg);expect(colors.image).toBe('none');expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);};
 await home.click();await page.getByRole('menuitem',{name:'Schedule'}).click();await check('New schedule');await home.click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();await check('New file');
});

test('invalid stored path offers offline startup recovery without changing the stored note',async({page,context})=>{
 await page.goto('/');await prepareOfflineShell(page);await createInboxFile(page,'QA-invalid-path','recovery check');
 const stored=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction('notes','readwrite'),store=tx.objectStore('notes'),notes=await new Promise<any[]>((resolve,reject)=>{const r=store.getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const note=notes.find(n=>n.revisions.at(-1).path==='Inbox/QA-invalid-path.md');note.revisions.at(-1).path='Inbox/invalid?.md';for(let n=2;n<=101;n++)note.revisions.push({...note.revisions[0],version:n,path:'Inbox/invalid'+n+'?.md'});store.put(note);await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();return note;});
 const hash='2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';stored.originalAsset={id:'qa-original',revision:1,sha256:hash};await page.evaluate(async({note,hash})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction(['notes','runs'],'readwrite');tx.objectStore('notes').put(note);tx.objectStore('runs').put({schema:1,type:'original-asset',id:'qa-original',revision:1,name:'original.txt',mime:'text/plain',kind:'text',bytes:5,sha256:hash,createdAt:'2026-10-27T00:00:00.000Z',data:'aGVsbG8='},'ui-v1-original-qa-original');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},{note:stored,hash});
 await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'Invalid Markdown path'})).toBeVisible();await expect(page.getByRole('button',{name:'Update',exact:true})).toBeVisible();await page.getByRole('button',{name:'Check paths'}).click();await expect(page.getByRole('region',{name:'Path check'})).toContainText('Inbox/invalid?.md · v1');await page.getByRole('button',{name:'Show more'}).click();const last=page.getByRole('button',{name:'Export text for Inbox/invalid101?.md'});await last.scrollIntoViewIfNeeded();await expect(last).toBeInViewport();
 await expect(page.getByText(/excludes unsaved drafts, unsaved attachments/)).toBeVisible();await expect(page.getByText(/cannot restore directly · 200 MB limit/)).toBeVisible();const snapshotPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export recovery snapshot'}).click();const snapshot=JSON.parse(await readFile((await (await snapshotPromise).path())!,'utf8'));expect(snapshot.format).toBe('babelshelf-unverified-recovery');expect(snapshot.payload.notes.find((n:any)=>n.id===stored.id).revisions).toEqual(stored.revisions);expect(snapshot.payload.runs.find((r:any)=>r.key==='ui-v1-original-qa-original').value.data).toBe('aGVsbG8=');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export text for Inbox/invalid?.md'}).click();const download=await downloadPromise;const exported=JSON.parse(await readFile((await download.path())!,'utf8'));expect(exported.id).toBe(stored.id);expect(exported.revisions).toEqual(stored.revisions);expect(exported.format).toBe('babelshelf-recovery-text');
 const originalPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export original for Inbox/invalid?.md'}).click();const original=await originalPromise;expect(original.suggestedFilename()).toBe('original.txt');expect(await readFile((await original.path())!,'utf8')).toBe('hello');
 await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction('runs','readwrite'),store=tx.objectStore('runs'),asset=await new Promise<any>((resolve,reject)=>{const r=store.get('ui-v1-original-qa-original');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});asset.data='d29ybGQ=';store.put(asset,'ui-v1-original-qa-original');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();});await page.getByRole('button',{name:'Export original for Inbox/invalid?.md'}).click();await expect(page.getByRole('status')).toHaveText('Could not verify original');
 const after=await page.evaluate(async(id)=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction('notes','readonly'),value=await new Promise<any>((resolve,reject)=>{const r=tx.objectStore('notes').get(id);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return value;},stored.id);expect(after).toEqual(stored);
});

test('a stale tab offers conversation recovery without losing its draft',async({page,context})=>{
 await page.setViewportSize({width:320,height:700});await page.goto('/');
 await page.getByRole('textbox',{name:'Message'}).fill('Remember: amber lantern');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.turn-status')).toContainText('Saved · Inbox/amber lantern.md');await expect(page.getByRole('dialog')).toHaveCount(0);
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await home.click();
 await expect(page.locator('.turn-status')).toContainText('Saved · Inbox/amber lantern.md');
 await home.click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();await page.getByRole('button',{name:'Open Inbox'}).click();await page.getByRole('button',{name:'Open amber lantern.md'}).click();await home.click();await home.click();
 const other=await context.newPage();await other.setViewportSize({width:320,height:700});await other.goto('/');await expect(other.locator('.turn-status')).toContainText('Saved · Inbox/amber lantern.md');await expect(other.getByRole('button',{name:'Remove file from input'})).toBeVisible();
 await page.getByRole('textbox',{name:'Message'}).fill('12 + 8');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.reply-text')).toContainText('20');
 await other.getByRole('button',{name:'Remove file from input'}).click();const warning=other.locator('.conversation-warning');await expect(warning).toContainText('Conversation changed');await expect(warning.getByRole('button',{name:'Reload conversation'})).toBeVisible();const bounds=await warning.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(320);await other.getByRole('textbox',{name:'Message'}).fill('My unfinished question');
 await other.getByRole('button',{name:'Reload conversation'}).click();await expect(other.getByRole('textbox',{name:'Message'})).toHaveValue('My unfinished question');await expect(other.locator('.reply-text')).toContainText('20');await other.close();
});

test('saving an answer keeps actions visible while the source list scrolls',async({page})=>{
 await page.setViewportSize({width:320,height:600});await page.goto('/');
 await page.getByRole('textbox',{name:'Message'}).fill('12 + 8');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.reply-text')).toContainText('20');await page.getByRole('button',{name:'Save note'}).click();
 const dialog=page.getByRole('dialog',{name:'New file'}),save=dialog.getByRole('button',{name:'Save',exact:true});
 const assertVisible=async()=>{const b=await save.boundingBox(),d=await dialog.boundingBox();expect(b).not.toBeNull();expect(d).not.toBeNull();expect(b!.y+b!.height).toBeLessThanOrEqual(d!.y+d!.height);expect(b!.y+b!.height).toBeLessThanOrEqual(600);};
 await assertVisible();await dialog.getByRole('button',{name:'Change source'}).click();await assertVisible();
 await expect(dialog.getByRole('textbox',{name:'New file content'})).toHaveValue('20');
});

test('explicit user note capture saves the exact text as a new file without opening generated-answer review',async({page})=>{
 await page.goto('/');
 await page.getByRole('textbox',{name:'Message'}).fill('Remember: amber lantern');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.turn-status')).toContainText('Saved · Inbox/amber lantern.md');
 await expect(page.getByRole('dialog')).toHaveCount(0);
 const stored=await page.evaluate(()=>new Promise<any>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('notes','readonly'),read=tx.objectStore('notes').getAll();read.onsuccess=()=>resolve(read.result.find((note:any)=>note.revisions.at(-1).path==='Inbox/amber lantern.md'));read.onerror=()=>reject(read.error);tx.oncomplete=()=>db.close();};}));
 expect(stored.revisions.at(-1).body).toBe('amber lantern');
});

test('mixed readable and unsupported attachments are not presented as a complete answer',async({page})=>{
 await page.goto('/');const pending=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add attachment'}).click();const chooser=await pending;
 await chooser.setFiles([{name:'qa-mixed.txt',mimeType:'text/plain',buffer:Buffer.from('The first code is QA-4912.')},{name:'qa-mixed.gif',mimeType:'image/gif',buffer:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')}]);
 const message=page.getByRole('textbox',{name:'Message'});await message.fill('What does each attached file contain?');await page.getByRole('button',{name:'Send',exact:true}).click();
 const turn=page.locator('.sent-message').last();await expect(turn).toContainText('Original saved · Unsupported');await expect(turn).toContainText('Text available');await expect(turn).toContainText('Unsupported');
 await expect(turn.locator('.reply-text')).toHaveCount(0);await expect(message).toHaveValue('What does each attached file contain?');
 await expect(page.getByRole('button',{name:'Remove qa-mixed.txt'})).toBeVisible();await expect(page.getByRole('button',{name:'Remove qa-mixed.gif'})).toBeVisible();
});

test('unsupported image is retained without a fabricated answer',async({page})=>{
 await page.goto('/');const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add attachment'}).click();
 const chooser=await chooserPromise;await chooser.setFiles({name:'qa-unread.gif',mimeType:'image/gif',buffer:Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==','base64')});
 const message=page.getByRole('textbox',{name:'Message'});await message.fill('What is shown in this image?');await page.getByRole('button',{name:'Send',exact:true}).click();
 const turn=page.locator('.sent-message').last();await expect(turn).toContainText('Original saved · Unsupported');await expect(turn.getByRole('button',{name:'Open source qa-unread.gif'})).toBeVisible();
 await expect(message).toHaveValue('What is shown in this image?');await expect(page.getByRole('button',{name:'Remove qa-unread.gif'})).toBeVisible();
 await turn.getByRole('button',{name:'Open source qa-unread.gif'}).click();const source=page.getByRole('dialog',{name:'Attachment'});
 await expect(source).toContainText('Unsupported');await expect(source.getByRole('link',{name:'Save original'})).toBeVisible();
});

test('a local text attachment and question survive an unprepared model',async({page})=>{
 await page.goto('/');const chooserPromise=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add attachment'}).click();
 const chooser=await chooserPromise;await chooser.setFiles({name:'qa-import.txt',mimeType:'text/plain',buffer:Buffer.from('QA添付の合言葉は銀河です。')});
 await page.getByRole('button',{name:/Text qa-import\.txt/}).click();const preview=page.getByRole('dialog',{name:'Attachment'});
 await expect(preview).toContainText('QA添付の合言葉は銀河です。');await preview.getByRole('button',{name:'Close'}).click();
 const message=page.getByRole('textbox',{name:'Message'});await message.fill('添付の合言葉は何ですか？');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByRole('main',{name:'Input and results'})).toContainText('Model not prepared');await expect(message).toHaveValue('添付の合言葉は何ですか？');
 await expect(page.getByRole('button',{name:/Text qa-import\.txt/})).toBeVisible();
 await page.getByRole('button',{name:'Open Text model settings'}).last().click();await expect(page.getByRole('heading',{name:'Models',exact:true})).toBeVisible();
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await home.click();await expect(message).toHaveValue('添付の合言葉は何ですか？');await expect(page.getByRole('button',{name:/Text qa-import\.txt/})).toBeVisible();
});

test('an unprepared model offers Memory without losing the question',async({page})=>{
 await page.goto('/');const message=page.getByRole('textbox',{name:'Message'});
 await message.fill('防災用の水は何リットル？');await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByRole('main',{name:'Input and results'})).toContainText('Model not prepared');await expect(message).toHaveValue('防災用の水は何リットル？');
 await page.getByRole('button',{name:'Open Memory'}).click();await expect(page.getByRole('heading',{name:'Memory',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Find files or text'})).toBeVisible();
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await home.click();await expect(message).toHaveValue('防災用の水は何リットル？');
});

test('Memory finds a file by text in its body',async({page})=>{
 await page.goto('/');await createInboxFile(page,'QA-emergency','懐中電灯は玄関にある。');
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();
 await page.getByRole('textbox',{name:'Find files or text'}).fill('懐中電灯');await page.getByRole('button',{name:'Open Inbox/QA-emergency.md'}).click();await expect(page.locator('main')).toContainText('懐中電灯は玄関にある。');
});

test('search citations keep their original revision after a direct correction',async({page})=>{
 await page.goto('/');const home=page.getByRole('button',{name:'Input',exact:true}),message=page.getByRole('textbox',{name:'Message'});
 await createInboxFile(page,'QA-search-update','QA青い彗星の集合場所は東口です。');
 await home.click();await home.click();await message.fill('search: QA青い彗星');await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByRole('button',{name:'Inbox/QA-search-update.md',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByRole('textbox',{name:'Markdown content'}).fill('QA青い彗星の集合場所は西口です。');await page.getByRole('button',{name:'Save',exact:true}).click();
 await home.click();await home.click();await message.fill('search: QA青い彗星');await page.getByRole('button',{name:'Send',exact:true}).click();
 const citations=page.getByRole('button',{name:'View source',exact:true});await expect(citations).toHaveCount(2);const hit=await citations.first().boundingBox();expect(hit!.width).toBeGreaterThanOrEqual(44);expect(hit!.height).toBeGreaterThanOrEqual(44);await citations.first().click();
 const source=page.getByRole('dialog',{name:'Source'});await expect(source).toContainText('v1');await expect(source).toContainText('Current file · v2');await expect(source).toContainText('東口');await expect(source.getByRole('button',{name:'Open current file'})).toBeVisible();
 await source.getByRole('button',{name:'Close'}).click();await citations.last().click();await expect(source).toContainText('v2');await expect(source).toContainText('西口');
 await source.getByRole('button',{name:'Open file'}).click();await page.getByRole('button',{name:'File actions'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Delete'}).click();await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete'}).click();
 await home.click();await home.click();await citations.first().click();await expect(source).toContainText('File removed');await expect(source).toContainText('東口');
 await expect(source.getByRole('button',{name:'Open file'})).toBeDisabled();await source.getByRole('button',{name:'Open Trash'}).click();
 const trash=page.getByRole('dialog',{name:'Trash'});await trash.getByRole('button',{name:'Restore Inbox/QA-search-update.md'}).click();await expect(trash).toContainText('Trash is empty');
});

test('a deleted file can be restored from Memory with its history intact',async({page})=>{
 await page.goto('/');const home=page.getByRole('button',{name:'Input',exact:true});
 await home.click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click();await page.getByRole('textbox',{name:'File name'}).fill('QA-trash-restore');
 await page.getByRole('textbox',{name:'New file content'}).fill('Original');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Markdown content'}).fill('Updated');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'File actions'}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete'}).click();
 await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete'}).click();
 await page.getByRole('button',{name:'Open Trash'}).click();const trash=page.getByRole('dialog',{name:'Trash'});
 await trash.getByRole('button',{name:'Restore Inbox/QA-trash-restore.md'}).click();await expect(trash).toContainText('Trash is empty');await trash.getByRole('button',{name:'Close'}).click();
 await page.getByRole('button',{name:'Open QA-trash-restore.md'}).click();await expect(page.locator('main')).toContainText('Updated');
 await page.getByRole('button',{name:'History'}).click();const history=page.getByRole('dialog',{name:'History'});await history.getByText('v1',{exact:true}).click();await expect(history).toContainText('Original');
});

test('navigation keeps an unfinished edit and its original history',async({page})=>{
 await page.goto('/');const home=page.getByRole('button',{name:'Input',exact:true});
 await home.click();await page.getByRole('menuitem',{name:'BabelShelf'}).click();
 await page.getByRole('button',{name:'Open Inbox'}).click();await page.getByRole('button',{name:'New file'}).click();
 await page.getByRole('textbox',{name:'File name'}).fill('QA-edit-navigation');
 await page.getByRole('textbox',{name:'New file content'}).fill('Original text');await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Markdown content'}).fill('Edited text');
 await home.click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('dialog',{name:'Unsaved changes'}).getByRole('button',{name:'Keep editing'}).click();
 await expect(page.getByRole('textbox',{name:'Markdown content'})).toHaveValue('Edited text');
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'History'}).click();
 const history=page.getByRole('dialog',{name:'History'});await history.getByText('v1',{exact:true}).click();await expect(history).toContainText('Original text');
});

test('settings navigation starts each screen at its heading',async({page})=>{
 await page.goto('/');
 const home=page.getByRole('button',{name:'Input',exact:true});
 await home.click();await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.locator('.native-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await expect.poll(()=>page.locator('.native-scroll').evaluate(el=>el.scrollTop)).toBe(0);
 await expect(page.getByRole('heading',{name:'Appearance'})).toBeInViewport();
 await page.locator('.native-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
 await page.getByRole('button',{name:'Back to Settings'}).click();
 await expect.poll(()=>page.locator('.native-scroll').evaluate(el=>el.scrollTop)).toBe(0);
 await expect(page.getByRole('heading',{name:'Settings'})).toBeInViewport();
});

test('paper appearance keeps navigation and input operable at narrow width and larger text',async({page})=>{
 await page.setViewportSize({width:320,height:700});await page.goto('/');
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 const home=page.getByRole('button',{name:'Input',exact:true});await expect(home).toBeVisible();await home.click();
 await page.getByRole('menuitem',{name:'BabelShelf',exact:true}).click();await expect(page.getByRole('button',{name:'New file'})).toBeVisible();
 const headingBox=await page.getByRole('heading',{name:'Memory'}).boundingBox(),trashBox=await page.getByRole('button',{name:'Open Trash'}).boundingBox(),newBox=await page.getByRole('button',{name:'New file'}).boundingBox();
 for(const box of [headingBox,trashBox,newBox]){expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);}
 expect(headingBox!.x+headingBox!.width).toBeLessThanOrEqual(trashBox!.x);expect(trashBox!.x+trashBox!.width).toBeLessThanOrEqual(newBox!.x);
 expect(trashBox!.height).toBeGreaterThanOrEqual(44);expect(newBox!.height).toBeGreaterThanOrEqual(44);
 await page.getByRole('button',{name:'New file'}).click();await expect(page.getByRole('textbox',{name:'File name'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Save',exact:true})).toBeVisible();
 const dimensions=await page.getByRole('button',{name:'Save',exact:true}).boundingBox();expect(dimensions?.height).toBeGreaterThanOrEqual(44);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await home.click();await home.click();
 const inputBox=await page.getByRole('textbox',{name:'Message'}).boundingBox(),sendBox=await page.getByRole('button',{name:'Send'}).boundingBox(),homeBox=await home.boundingBox();
 for(const box of [inputBox,sendBox,homeBox]){expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(320);expect(box!.y).toBeGreaterThanOrEqual(0);expect(box!.y+box!.height).toBeLessThanOrEqual(700);}
 expect(inputBox!.x+inputBox!.width).toBeLessThanOrEqual(sendBox!.x+1);
 for(const name of ['Add attachment','Voice input','Send']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box!.width,`${name} width`).toBeGreaterThanOrEqual(44);expect(box!.height,`${name} height`).toBeGreaterThanOrEqual(44);}
 await page.getByRole('textbox',{name:'Message'}).fill('12 + 8');await page.getByRole('button',{name:'Send'}).click();await expect(page.locator('.reply-text')).toContainText('20');
 await home.click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Appearance',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Appearance'})).toBeVisible();await expect(page.getByRole('button',{name:'Light',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Dark',exact:true}).click();await expect(page.getByRole('button',{name:'Dark',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Light',exact:true}).click();await expect(page.getByRole('button',{name:'Light',exact:true})).toHaveAttribute('aria-pressed','true');
});

test('a fresh install opens on warm paper with compact, readable primary controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const scroll=page.locator('.knowledge-scroll'),nav=page.getByRole('navigation',{name:'Main navigation'}),home=page.getByRole('button',{name:'Input',exact:true});
 await expect(scroll).toHaveClass(/appearance-light/);
 const paper=await scroll.evaluate(el=>getComputedStyle(el).backgroundColor);expect(paper).toBe('rgb(240, 238, 229)');
 await expect(home).toBeVisible();await expect(home).toHaveAccessibleName('Input');
 const homeSize=await home.boundingBox();expect(homeSize?.width).toBeGreaterThanOrEqual(44);expect(homeSize?.height).toBeGreaterThanOrEqual(44);
 await expect(nav).not.toContainText(/BabelShelf/i);
 for(const name of ['Add attachment','Voice input','Send']){const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box?.width,`${name} width`).toBeGreaterThanOrEqual(44);expect(box?.height,`${name} height`).toBeGreaterThanOrEqual(44);}
 const composer=await page.locator('.compact-composer').evaluate(el=>({background:getComputedStyle(el).backgroundColor,shadow:getComputedStyle(el).boxShadow,input:getComputedStyle(el.querySelector('textarea')!).backgroundColor}));
 expect(composer.background).toBe('rgb(251, 250, 244)');expect(composer.shadow).toBe('none');expect(composer.input).toBe('rgba(0, 0, 0, 0)');
});

for(const theme of ['Light','Dark']) test(`${theme} source preview keeps the original readable and opens its file`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await page.getByRole('menuitem',{name:'Settings'}).click();await page.getByRole('button',{name:'Appearance'}).click();await page.getByRole('button',{name:theme,exact:true}).click();
 await createInboxFile(page,'QA-paper-source','QA紙面の集合場所は北口です。\n'+('別の原文です。'.repeat(150)));
 await home.click();await home.click();
 await page.getByRole('textbox',{name:'Message'}).fill('search: QA紙面の集合場所');await page.getByRole('button',{name:'Send'}).click();
 await page.getByRole('button',{name:'View source',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Source'});
 await expect(dialog).toContainText('Inbox/QA-paper-source.md');await expect(dialog).toContainText('v1');await expect(dialog.locator('mark')).toContainText('QA紙面の集合場所は北口です。');await expect(dialog.locator('.file-body')).toContainText('別の原文です。');
 expect(await dialog.locator('.file-body').evaluate(el=>(el.textContent?.length??0)>(el.querySelector('mark')?.textContent?.length??0))).toBe(true);
 const colors=await dialog.locator('mark').evaluate(el=>{const s=getComputedStyle(el);return {fg:s.color,bg:s.backgroundColor};});
 const luminance=(rgb:string)=>{const n=rgb.match(/\d+/g)!.slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*n[0]+.7152*n[1]+.0722*n[2];};
 const a=luminance(colors.fg),b=luminance(colors.bg);expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(4.5);
 const bodyColors=await dialog.locator('.file-body').evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el.closest('.bottom-sheet')!).backgroundColor}));
 const c=luminance(bodyColors.fg),d=luminance(bodyColors.bg);expect((Math.max(c,d)+.05)/(Math.min(c,d)+.05)).toBeGreaterThanOrEqual(4.5);
 await dialog.getByRole('button',{name:'Open file'}).click();await expect(dialog).toBeHidden();await expect(page.locator('main').getByText('Inbox/QA-paper-source.md',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit',exact:true}).click();const editor=page.getByRole('textbox',{name:'Markdown content'});
 await editor.fill((await editor.inputValue()).replace('北口','南口'));await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('main')).toContainText('南口');await page.getByRole('button',{name:'History'}).click();const history=page.getByRole('dialog',{name:'History'});
 await history.getByText('v1',{exact:true}).click();await expect(history).toContainText('北口');
});

test('paper correction review can be cancelled without changing the original',async({page})=>{
 await page.goto('/');await createInboxFile(page,'QA-review-paper','QA訂正操作の集合場所は北口です。');
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await home.click();
 await page.getByRole('textbox',{name:'Message'}).fill('このファイルの「北口」を「南口」に直して。');await page.getByRole('button',{name:'Send'}).click();
 const review=page.getByRole('dialog',{name:'Review changes'});await expect(review).toContainText('Inbox/QA-review-paper.md · v1');await expect(review).toContainText('集合場所は北口');await expect(review).toContainText('集合場所は南口');
 await review.getByRole('button',{name:'Cancel'}).click();await expect(page.getByText('Correction cancelled · original retained')).toBeVisible();
 await page.getByRole('button',{name:'Open input file Inbox/QA-review-paper.md'}).click();await expect(page.locator('main')).toContainText('集合場所は北口');await expect(page.locator('main')).toContainText('v1');
});

test('curved navigation keeps its Input anchor round and labels only an active destination',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const input=page.getByRole('button',{name:'Input',exact:true});await input.click();
 await expect(input).toHaveAttribute('aria-expanded','true');
 expect(await page.locator('.chat-home,.nav-items [role="menuitem"]').evaluateAll(elements=>elements.map(element=>element.hasAttribute('title')))).toEqual([false,false,false,false,false]);
 await expect(page.locator('.arc-choice')).toHaveCount(0);
 expect(await input.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('50%');
 const schedule=page.getByRole('menuitem',{name:'Schedule',exact:true});await schedule.focus();
 await expect(page.locator('.arc-choice')).toHaveText('Schedule');
 await schedule.click();await expect(page.getByRole('heading',{name:'Schedule',exact:true})).toBeVisible();
 await input.click();await expect(input).toHaveAttribute('aria-expanded','true');
 await input.click();await expect(input).toHaveAttribute('aria-expanded','false');await expect(input).toHaveAttribute('aria-current','page');
});

test('touch hold, slide and release selects the destination on the arc',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 const input=page.getByRole('button',{name:'Input',exact:true});
 const inputBox=await input.boundingBox();expect(inputBox).not.toBeNull();
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,configuration:'mobile'});
 const touch=(box:{x:number;y:number;width:number;height:number})=>({x:box.x+box.width/2,y:box.y+box.height/2,id:1});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch(inputBox!)]});await page.waitForTimeout(100);
  await expect(input).toHaveAttribute('aria-expanded','true');await page.waitForTimeout(130);expect(await input.evaluate(el=>({radius:getComputedStyle(el).borderRadius,zIndex:getComputedStyle(el).zIndex,iconVisible:getComputedStyle(el.querySelector('svg')!).visibility,iconOpacity:getComputedStyle(el.querySelector('svg')!).opacity}))).toEqual({radius:'50%',zIndex:'37',iconVisible:'visible',iconOpacity:'1'});
 expect(await page.locator('.chat-home,.nav-items [role="menuitem"]').evaluateAll(elements=>elements.map(element=>element.hasAttribute('title')))).toEqual([false,false,false,false,false]);
 expect(await page.locator('.glass-nav').evaluate(el=>{const style=getComputedStyle(el);return{background:style.backgroundColor,border:style.borderTopWidth,radius:style.borderRadius,shadow:style.boxShadow};})).toEqual({background:'rgba(0, 0, 0, 0)',border:'0px',radius:'0px',shadow:'none'});
 const destination=page.getByRole('menuitem',{name:'Schedule',exact:true}),destinationBox=await destination.boundingBox();expect(destinationBox).not.toBeNull();
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touch(destinationBox!)]});
 await expect(page.locator('.arc-choice')).toHaveText('Schedule');
  expect(await page.locator('.arc-choice').evaluate(el=>getComputedStyle(el).borderRadius)).toBe('16px');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(page.getByRole('heading',{name:'Schedule',exact:true})).toBeVisible();
 await cdp.detach();
});

test('long dialogue initially shows recent turns and can reveal earlier turns without losing them',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('textbox',{name:'Message'})).toBeVisible();
 await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const value={schema:1,revision:30,turns:Array.from({length:30},(_,index)=>({id:`history-${index}`,user:`Archived user ${index}`,answer:`Archived answer ${index}`})),compaction:null};
  const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(value,'ui-v1-dialogue');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
 });
 await page.reload();
 await expect(page.locator('.sent-message')).toHaveCount(24);await expect(page.locator('.sent-message').first()).toContainText('Archived user 6');await expect(page.locator('.sent-message').last()).toContainText('Archived user 29');
 const earlier=page.getByRole('button',{name:'Earlier messages · 6'});await expect(earlier).toBeVisible();await earlier.click();await expect(page.locator('.sent-message')).toHaveCount(30);await expect(page.locator('.sent-message').first()).toContainText('Archived user 0');
 await page.getByRole('textbox',{name:'Message'}).fill('17 * 19');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.sent-message').last()).toContainText('323');
 await expect(page.locator('.sent-message')).toHaveCount(24);await expect(page.getByRole('button',{name:'Earlier messages · 7'})).toBeVisible();
});

test('consecutive failed retries are compacted in the view while original attempt activity remains inspectable',async({page})=>{
 await page.goto('/');await expect(page.getByRole('textbox',{name:'Message'})).toBeVisible();
 await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const at=new Date().toISOString(),failed=(id:string)=>({schema:1,id:'activity-'+id,tool:'dialogue.plan',input:{stage:'answer'},startedAt:at,finishedAt:at,status:'failed',error:{code:'invalid_model_output',message:'Citation mismatch'}});
  const value={schema:1,revision:3,turns:[
   {id:'retry-1',user:'Compare these saved notes.',status:'Citation mismatch',activity:[failed('1')]},
   {id:'retry-2',user:'Compare these saved notes.',status:'Citation mismatch',activity:[failed('2')]},
   {id:'retry-success',user:'Compare these saved notes.',answer:'The saved notes contain different locations.'},
  ],compaction:null};
  const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(value,'ui-v1-dialogue');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
 });
 await page.reload();const latest=page.locator('.sent-message');await expect(latest).toHaveCount(1);await expect(latest.locator('.user-bubble.added-message')).toHaveText('Compare these saved notes.');await expect(latest).toContainText('The saved notes contain different locations.');
 const history=latest.locator('details.retry-history');await expect(history).toContainText('Earlier attempts · 2');await history.locator('summary').click();await expect(history).toContainText('Attempt 1 · Citation mismatch');await expect(history).toContainText('Attempt 2 · Citation mismatch');
 await history.getByRole('button',{name:'View attempt 1 activity'}).click();await expect(page.locator('.activity-entry')).toHaveCount(1);await expect(page.locator('.activity-entry summary')).toContainText('Select action');
 const stored=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const value=await new Promise<any>((resolve,reject)=>{const request=db.transaction('settings').objectStore('settings').get('ui-v1-dialogue');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;});
 expect(stored.turns.map((turn:any)=>turn.id)).toEqual(['retry-1','retry-2','retry-success']);
});
