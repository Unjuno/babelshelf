import {expect,test,type Page} from '@playwright/test';
import {createNote,reviseNote,withdrawNote} from '../../../dist/core.js';

async function writeSourceRecords(page:Page,records:any[]){
 await page.evaluate(async records=>{await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('notes','readwrite');for(const record of records)tx.objectStore('notes').put(record);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};});},records);
}
async function sourceFixture(page:Page,records:any[]){
 await page.goto('/');await memory(page);await writeSourceRecords(page,records);
 await page.reload();await memory(page);await page.getByRole('button',{name:'Open Inbox',exact:true}).click();
}

test('saved generated notes expose changed provenance and open the pinned original before the latest source',async({page})=>{
 // Controlled canonical records verify presentation, not model generation.
 const original=createNote({path:'Inbox/QA-source.md',body:'Meet at the north gate.'}),sourceRef={noteId:original.id,revision:1,start:0,end:23,quote:'Meet at the north gate.'},changed=reviseNote(original,{body:'Meet at the south gate.'},1),saved=createNote({path:'Inbox/QA-sourced-summary.md',body:'North gate meeting.',kind:'generated',sources:[sourceRef]});
 await sourceFixture(page,[changed,saved]);await page.getByRole('button',{name:'Open QA-sourced-summary.md',exact:true}).click();
 await expect(page.locator('.note-sources > summary')).toHaveAccessibleName('Sources · 1 · Source changed');await page.locator('.note-sources > summary').click();const source=page.getByRole('button',{name:'View saved source 1',exact:true});await expect(source).toContainText('Inbox/QA-source.md · v1');await expect(source).toContainText('Now v2');
 for(const target of [page.locator('.note-sources > summary'),source])expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await page.evaluate(()=>{document.documentElement.style.fontSize='24px';});await expect(source).toBeVisible();expect((await source.boundingBox())!.height).toBeGreaterThanOrEqual(44);await source.click();
 await expect(page.getByRole('dialog')).toContainText('Meet at the north gate.');await expect(page.getByRole('dialog')).not.toContainText('Meet at the south gate.');const newest=reviseNote(changed,{body:'Meet at the east gate.'},2);await writeSourceRecords(page,[newest]);await page.getByRole('button',{name:'Open file',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();await expect(page.locator('.file-body')).toHaveText('Meet at the east gate.');
 const retained=await page.evaluate(async ids=>new Promise<any[]>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('notes','readonly'),records:any[]=[];for(const id of ids){const read=tx.objectStore('notes').get(id);read.onsuccess=()=>records.push(read.result);}tx.oncomplete=()=>{db.close();resolve(records);};};}),[changed.id,saved.id]);expect(retained).toEqual([newest,saved]);
});

test('a removed source remains inspectable at its original version without an unavailable current-file action',async({page})=>{
 const original=createNote({path:'Inbox/QA-removed-source.md',body:'Original source text.'}),saved=createNote({path:'Inbox/QA-removed-summary.md',body:'Saved summary.',kind:'generated',sources:[{noteId:original.id,revision:1,start:0,end:21,quote:'Original source text.'}]}),removed=withdrawNote(original,1);
 await sourceFixture(page,[original,saved]);await page.getByRole('button',{name:'Open QA-removed-summary.md',exact:true}).click();await expect(page.locator('.note-sources > summary')).toHaveAccessibleName('Sources · 1');await writeSourceRecords(page,[removed]);await page.locator('.note-sources > summary').click();await expect(page.locator('.note-sources')).toContainText('Source removed');await page.getByRole('button',{name:'View saved source 1',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Original source text.');await expect(page.getByRole('button',{name:'Open file',exact:true})).toBeDisabled();await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page.locator('.file-body')).toHaveText('Saved summary.');
});

async function memory(page:Page){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Memory',exact:true}).click();
}
async function create(page:Page){
 await page.goto('/');await memory(page);
 await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('Travel');
 await page.getByRole('textbox',{name:'New file content',exact:true}).fill('Meet at 09:00. 青いノート。');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText('Meet at 09:00. 青いノート。');
 await page.getByRole('button',{name:'Edit',exact:true}).click();
}

test('Memory search accepts IME width and combining marks without changing originals or scope',async({page})=>{
 await page.goto('/');await memory(page);
 await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('QA-ガラス');
 const original='Cafe\u0301で集合。ＡＢＣ１２３。';
 await page.getByRole('textbox',{name:'New file content',exact:true}).fill(original);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Home',exact:true}).click();
 const find=page.getByRole('textbox',{name:'Find files',exact:true});
 for(const query of ['ｑａ-ｶﾞﾗｽ','café','abc123']){
  await find.fill(query);await expect(page.getByRole('button',{name:'Open Inbox/QA-ガラス.md',exact:true})).toBeVisible();
 }
 await page.getByRole('button',{name:'Open Inbox/QA-ガラス.md',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText(original);
 await page.getByRole('button',{name:'Home',exact:true}).click();await find.fill('　 ');
 await expect(page.getByRole('button',{name:'Open Inbox',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Open Inbox/QA-ガラス.md',exact:true})).toHaveCount(0);
 await find.fill('');await page.getByRole('button',{name:'Open Notes',exact:true}).click();
 await find.fill('ｑａ-ｶﾞﾗｽ');await expect(page.getByRole('button',{name:'Open Inbox/QA-ガラス.md',exact:true})).toHaveCount(0);
 await find.fill('');await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('tab',{name:'Folder',exact:true}).click();
 await page.getByRole('textbox',{name:'Folder name',exact:true}).fill('ガラス');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'Notes',exact:true}).click();await find.fill('ｶﾞﾗｽ');
 await expect(page.getByRole('button',{name:'Open ガラス',exact:true})).toBeVisible();
});

test('input file opens directly and explicitly refreshes a restored revision without losing the message draft',async({page})=>{
 const input=async()=>{await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();};
 await create(page);await page.getByRole('button',{name:'Cancel',exact:true}).click();await input();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Keep this unsent message');
 await page.getByRole('button',{name:'Open input file Inbox/Travel.md',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText('Meet at 09:00. 青いノート。');
 await page.getByRole('button',{name:'File actions',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await input();
 await expect(page.getByRole('group',{name:'Input file',exact:true})).toContainText('Unavailable');
 await expect(page.getByRole('button',{name:/^Open (?:latest )?input file /})).toHaveCount(0);
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Local files',exact:true}).click();await page.getByRole('button',{name:'Trash',exact:true}).click();await page.getByRole('button',{name:'Restore Travel.md',exact:true}).click();await page.getByRole('button',{name:'Close',exact:true}).click();await input();
 await expect(page.getByRole('group',{name:'Input file',exact:true})).toContainText('v1 · Changed · Open latest');
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent message');
 await page.getByRole('button',{name:'Open latest input file Inbox/Travel.md',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText('Meet at 09:00. 青いノート。');await expect(page.locator('.file-footer > span')).toHaveText('v3');
 await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('dialog').getByText('v1',{exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Meet at 09:00. 青いノート。');await page.getByRole('button',{name:'Close',exact:true}).click();await input();
 await expect(page.getByRole('group',{name:'Input file',exact:true})).toContainText('v3');await expect(page.getByRole('group',{name:'Input file',exact:true})).not.toContainText('Changed');
 await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent message');
 // Both the explicit revision selection and the unsent text survive ordinary reload.
 await page.reload();await expect(page.getByRole('button',{name:'Open input file Inbox/Travel.md',exact:true})).toBeVisible();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this unsent message');
});

test('composer reload keeps exact text per tab and successful Send clears only its own draft',async({page,context})=>{
 await page.goto('/');const composer=page.getByRole('textbox',{name:'Message',exact:true});
 const text='  Cafe\u0301とｶﾞﾗｽ。\nKeep these spaces.　';await composer.fill(text);await page.reload();await expect(composer).toHaveValue(text);
 const other=await context.newPage();await other.goto('/');const otherComposer=other.getByRole('textbox',{name:'Message',exact:true});await expect(otherComposer).toHaveValue('');await otherComposer.fill('Other tab');
 await composer.fill('Calculate 6 * 7');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.reply-text')).toContainText('6 * 7 = 42');await page.reload();await expect(composer).toHaveValue('');
 await composer.fill('Calculate 8 + 5');await page.getByRole('button',{name:'Send',exact:true}).click();await composer.fill('Next unsent message');await expect(page.locator('.reply-text').last()).toContainText('8 + 5 = 13');await page.reload();await expect(composer).toHaveValue('Next unsent message');await composer.fill('');
 await other.reload();await expect(otherComposer).toHaveValue('Other tab');await otherComposer.fill('');await other.reload();await expect(otherComposer).toHaveValue('');await other.close();
});

test('a blocked draft write keeps live text and allows cancelling reload',async({page})=>{
 await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='babelshelf.composer-draft.v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,key,value);};});
 await page.goto('/');const composer=page.getByRole('textbox',{name:'Message',exact:true});await composer.click();await composer.fill('Keep this live text');await expect(page.getByRole('alert')).toHaveText('Draft not saved');
 const blocked=page.waitForEvent('dialog'),reload=page.reload({timeout:3000}).catch(()=>null);const dialog=await blocked;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();await reload;await expect(composer).toHaveValue('Keep this live text');
});

test('pending attachments protect reload instead of pretending files are durable composer text',async({page})=>{
 await page.goto('/');await page.getByRole('textbox',{name:'Message',exact:true}).fill('Read the attachment');const pending=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add attachment',exact:true}).click();await (await pending).setFiles({name:'tiny.txt',mimeType:'text/plain',buffer:Buffer.from('Original attachment')});await expect(page.locator('.pending-attachments')).toContainText('tiny.txt');
 const blocked=page.waitForEvent('dialog'),reload=page.reload({timeout:3000}).catch(()=>null);const dialog=await blocked;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();await reload;await expect(page.locator('.pending-attachments')).toContainText('tiny.txt');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Read the attachment');
});

test('breadcrumb exit keeps a dirty draft until reviewed Save, including revision history after reload',async({page})=>{
 await create(page);
 await page.getByRole('textbox',{name:'Markdown content',exact:true}).fill('Meet at 10:00. 青いノート。\n');
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Markdown content',exact:true})).toHaveValue('Meet at 10:00. 青いノート。\n');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'History',exact:true}).click();
 await page.getByRole('dialog').getByText('v1',{exact:true}).click();
 await expect(page.getByRole('dialog')).toContainText('Meet at 09:00. 青いノート。');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();await memory(page);
 await page.getByRole('button',{name:'Open Inbox',exact:true}).click();
 await page.getByRole('button',{name:'Open Travel.md',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText('Meet at 10:00. 青いノート。');
});

test('explicit discard follows the requested navigation without writing a revision',async({page})=>{
 await create(page);
 await page.getByRole('textbox',{name:'Markdown content',exact:true}).fill('Do not save this');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
 await memory(page);await page.getByRole('button',{name:'Open Inbox',exact:true}).click();
 await page.getByRole('button',{name:'Open Travel.md',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText('Meet at 09:00. 青いノート。');
 await page.getByRole('button',{name:'History',exact:true}).click();
 await expect(page.getByRole('dialog').getByText('v1',{exact:true})).toBeVisible();
 await expect(page.getByRole('dialog').getByText('v2',{exact:true})).toHaveCount(0);
});

test('unchanged edit leaves directly; changed path is protected on Cancel and dismiss keeps editing',async({page})=>{
 await create(page);
 await page.getByRole('button',{name:'Inbox',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open Travel.md',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByRole('textbox',{name:'Markdown path',exact:true}).fill('Notes/Travel.md');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('textbox',{name:'Markdown path',exact:true})).toHaveValue('Notes/Travel.md');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Markdown path',exact:true})).toHaveCount(0);
});

test('browser reload can be cancelled and reverting the exact draft removes the exit question',async({page})=>{
 await create(page);
 await page.getByRole('textbox',{name:'Markdown content',exact:true}).fill('Meet at 09:00. 青いノート。 ');
 const blocked=page.waitForEvent('dialog');
 const reload=page.reload({timeout:3000}).catch(()=>null);
 const dialog=await blocked;expect(dialog.type()).toBe('beforeunload');await dialog.dismiss();await reload;
 await expect(page.getByRole('textbox',{name:'Markdown content',exact:true})).toHaveValue('Meet at 09:00. 青いノート。 ');
 await page.getByRole('textbox',{name:'Markdown content',exact:true}).fill('Meet at 09:00. 青いノート。');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toHaveCount(0);
});

test('new file dismissal and kind switching protect the exact draft until explicit save',async({page})=>{
 await page.goto('/');await memory(page);
 await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('Draft');
 await page.getByRole('textbox',{name:'New file content',exact:true}).fill('集合は北口。\n');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue('集合は北口。\n');
 await page.getByRole('tab',{name:'Folder',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('tab',{name:'File',exact:true})).toHaveAttribute('aria-selected','true');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText('集合は北口。');
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toHaveCount(0);
});

test('schedule repeat choices preserve dirty prompt through cancellation, and Save bypasses discard',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Schedule',exact:true}).click();
 await page.getByRole('button',{name:'New schedule',exact:true}).click();
 await page.getByRole('textbox',{name:'Schedule prompt',exact:true}).fill('明日の予定をまとめる。\n');
 await page.getByRole('button',{name:'Repeat',exact:true}).click();
 await page.getByRole('button',{name:'Every day',exact:true}).click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Schedule prompt',exact:true})).toHaveValue('明日の予定をまとめる。\n');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Schedule',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:/明日の予定をまとめる。/}).first()).toBeVisible();
});

test('empty creation closes directly; folder changes can be discarded without creating a folder',async({page})=>{
 await page.goto('/');await memory(page);
 await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('tab',{name:'Folder',exact:true}).click();
 await page.getByRole('textbox',{name:'Folder name',exact:true}).fill('Uncommitted folder');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Discard changes',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Open Uncommitted folder',exact:true})).toHaveCount(0);
});

test('answer-copy provenance survives dismiss and Keep editing without regeneration',async({page})=>{
 await page.goto('/');await page.getByRole('textbox',{name:'Message',exact:true}).fill('Calculate 6 * 7');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByRole('button',{name:'Save note',exact:true}).click();
 const source=await page.getByRole('textbox',{name:'New file content',exact:true}).inputValue();
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('Reviewed calculation');
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue(source);
 await expect(page.getByRole('textbox',{name:'Source message number',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Change source',exact:true})).toBeVisible();
 await expect(page.getByText('Original copy',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.locator('.file-body')).toHaveText([source,source]);
 await expect(page.getByRole('button',{name:'Edit',exact:true})).toBeVisible();
});

test('answer copy chooses an earlier source by text and preserves its original through edited Save',async({page})=>{
 await page.goto('/');
 for(const question of ['Calculate 6 * 7','Calculate 5 * 9']){await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.locator('.sent-message').last()).toContainText('Calculated');}
 const first=await page.locator('.reply-text').first().evaluate(node=>{const copy=node.cloneNode(true) as HTMLElement;copy.querySelectorAll('button').forEach(b=>b.remove());return copy.textContent!.trim();});
 await page.getByRole('button',{name:'Save note',exact:true}).last().click();
 await expect(page.getByRole('textbox',{name:'Source message number',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Change source',exact:true}).click();
 await page.getByRole('searchbox',{name:'Find message',exact:true}).fill('42');
 await page.getByRole('button',{name:/^Answer · .*42/}).click();
 await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue(first);
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('Earlier reviewed answer');
 const edited='Reviewed: '+first;await page.getByRole('textbox',{name:'New file content',exact:true}).fill(edited);
 await expect(page.getByText('Edited copy',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Change source',exact:true}).click();await page.getByRole('button',{name:/^Answer · .*42/}).click();
 await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue(edited);
 await page.getByRole('button',{name:'Change source',exact:true}).click();await page.getByRole('searchbox',{name:'Find message',exact:true}).fill('Calculate 5 * 9');await page.getByRole('button',{name:/^Your message · Calculate 5/}).click();
 await expect(page.getByRole('heading',{name:'Unsaved changes',exact:true})).toBeVisible();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue(edited);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Keep editing',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue(edited);
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.file-body')).toHaveText([edited,first]);
 await page.reload();await memory(page);await page.getByRole('button',{name:'Open Inbox',exact:true}).click();await page.getByRole('button',{name:'Open Earlier reviewed answer.md',exact:true}).click();await expect(page.locator('.file-body')).toHaveText([edited,first]);
});

for(const dirty of [false,true])test(`capture review cancellation persists an honest outcome without a note write: dirty=${dirty}`,async({page})=>{
 await page.goto('/');
 const count=()=>page.evaluate(()=>new Promise<number>((resolve,reject)=>{const q=indexedDB.open('mlb-memory-v1');q.onsuccess=()=>{const db=q.result,r=db.transaction('notes').objectStore('notes').count();r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>{db.close();reject(r.error);};};q.onerror=()=>reject(q.error);}));
 await expect(page.getByRole('button',{name:'Send',exact:true})).toBeEnabled();const before=await count();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('note: Original capture body');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue('Original capture body');
 if(dirty){await page.getByRole('textbox',{name:'New file content',exact:true}).fill('Edited capture draft');await page.keyboard.press('Escape');await page.getByRole('button',{name:'Keep editing',exact:true}).click();await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue('Edited capture draft');await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Discard changes',exact:true}).click();}
 else await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByText('Save cancelled',{exact:true})).toBeVisible();expect(await count()).toBe(before);await page.reload();await expect(page.getByText('Save cancelled',{exact:true})).toBeVisible();await expect(page.getByText('Review before saving',{exact:true})).toHaveCount(0);expect(await count()).toBe(before);
});

test('approved capture Save remains Saved rather than cancellation when the creation sheet closes',async({page})=>{
 await page.goto('/');await page.getByRole('textbox',{name:'Message',exact:true}).fill('note: Approved capture body');await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByRole('textbox',{name:'New file content',exact:true})).toHaveValue('Approved capture body');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('.file-body')).toHaveText('Approved capture body');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();await expect(page.locator('.sent-message').last()).toContainText('Saved · Inbox/');await expect(page.getByText('Save cancelled',{exact:true})).toHaveCount(0);await page.reload();await expect(page.locator('.sent-message').last()).toContainText('Saved · Inbox/');
});
