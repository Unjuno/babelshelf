import {expect,test,type Page} from '@playwright/test';

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
