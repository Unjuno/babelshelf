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
