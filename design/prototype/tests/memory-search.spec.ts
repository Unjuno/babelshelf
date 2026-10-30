import {expect,test} from '@playwright/test';
import {prepareOfflineShell} from './pwa-offline-setup.ts';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination==='Memory'?'BabelShelf':destination,exact:true}).click();
}
async function returnToInput(page:any){
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await expect(home).toHaveAttribute('aria-expanded','true');await home.click();
}

test('a name held by a deleted file explains how to resolve it',async({page})=>{
 await page.goto('/'); await navigate(page,'Memory'); await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click(); await page.getByRole('textbox',{name:'File name'}).fill('trash-conflict');
 await page.getByRole('textbox',{name:'New file content'}).fill('Original retained'); await page.getByRole('button',{name:'Save',exact:true}).click();
 await page.getByRole('button',{name:'File actions'}).click(); await page.getByRole('button',{name:'Delete',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete'}).click();
 await page.getByRole('button',{name:'New file'}).click(); await page.getByRole('textbox',{name:'File name'}).fill('trash-conflict');
 await page.getByRole('textbox',{name:'New file content'}).fill('New text'); await page.getByRole('dialog',{name:'New file'}).getByRole('button',{name:'Save'}).click();
 await expect(page.getByRole('alert')).toContainText('Name used by a deleted file');
 await expect(page.getByRole('textbox',{name:'New file content'})).toHaveValue('New text');
 await page.getByRole('textbox',{name:'New file content'}).fill('New text edited');
 await expect(page.getByRole('button',{name:'Restore deleted file'})).toBeVisible();
 await page.getByRole('button',{name:'Restore deleted file'}).click();
 await expect(page.getByRole('textbox',{name:'New file content'})).toHaveValue('New text edited');
 await expect(page.getByRole('alert')).toContainText('Restored');
 await page.getByRole('textbox',{name:'File name'}).fill('new-name');
 await page.getByRole('dialog',{name:'New file'}).getByRole('button',{name:'Save'}).click();
 await expect(page.getByText('Inbox/new-name.md',{exact:true})).toBeVisible();
});

test('a search topic answers the preceding clarification without a model',async({page})=>{
 await page.goto('/'); await navigate(page,'Memory'); await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click();
 await page.getByRole('textbox',{name:'File name'}).fill('meeting-topic');
 await page.getByRole('textbox',{name:'New file content'}).fill('集合場所は北口。');
 await page.getByRole('button',{name:'Save',exact:true}).click(); await returnToInput(page);
 const message=page.getByRole('textbox',{name:'Message'}),send=page.getByRole('button',{name:'Send',exact:true});
 await message.fill('保存したメモを探して'); await send.click();
 await expect(page.locator('.sent-message').last()).toContainText('What should I search for?');
 await message.fill('集合場所'); await send.click();
 const result=page.locator('.sent-message').last(); await expect(result).toContainText('Found · 1');
 await expect(result.getByRole('button',{name:'Inbox/meeting-topic.md'})).toBeVisible();
});

test('cancel ends the clarification and leaves later calculation independent',async({page})=>{
 await page.goto('/');
 const message=page.getByRole('textbox',{name:'Message'}),send=page.getByRole('button',{name:'Send',exact:true});
 await message.fill('保存したメモを探して'); await send.click();
 await expect(page.locator('.sent-message').last()).toContainText('What should I search for?');
 await message.fill('キャンセル'); await send.click();
 await expect(page.locator('.sent-message').last()).toContainText('Search cancelled');
 await message.fill('１２＋８'); await send.click();
 await expect(page.locator('.sent-message').last()).toContainText('20');
});

test('thanks after clarification is not treated as a search topic',async({page})=>{
 await page.goto('/');
 const message=page.getByRole('textbox',{name:'Message'}),send=page.getByRole('button',{name:'Send',exact:true});
 await message.fill('保存したメモを探して'); await send.click();
 await expect(page.locator('.sent-message').last()).toContainText('What should I search for?');
 await message.fill('ありがとう'); await send.click();
 const reply=page.locator('.sent-message').last();
 await expect(reply).toContainText('Model not prepared');
 await expect(reply).not.toContainText('No matching notes');
});

test('deleted search result reports unavailability without leaving input',async({page})=>{
 await page.goto('/'); await navigate(page,'Memory');
 await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click();
 await page.getByRole('textbox',{name:'File name'}).fill('stale-search');
 await page.getByRole('textbox',{name:'New file content'}).fill('Secret lantern');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await returnToInput(page);
 await page.getByRole('textbox',{name:'Message'}).fill('search: stale-search');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const result=page.getByRole('button',{name:'Inbox/stale-search.md',exact:true});
 await expect(result).toBeVisible(); await result.click();
 await page.getByRole('button',{name:'File actions'}).click();
 await page.getByRole('button',{name:'Delete',exact:true}).click();
 await page.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete'}).click();
 await returnToInput(page); await page.getByRole('button',{name:'stale-search',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('File unavailable');
 await expect(page.getByRole('textbox',{name:'Message'})).toBeVisible();
});

test('a file deleted in another tab cannot be opened from an old result',async({page,context})=>{
 await page.goto('/'); await navigate(page,'Memory');
 await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click();
 await page.getByRole('textbox',{name:'File name'}).fill('other-tab-delete');
 await page.getByRole('textbox',{name:'New file content'}).fill('Cross-tab example');
 await page.getByRole('button',{name:'Save',exact:true}).click(); await returnToInput(page);
 await page.getByRole('textbox',{name:'Message'}).fill('search: other-tab-delete');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.getByRole('button',{name:'Inbox/other-tab-delete.md',exact:true})).toBeVisible();
 const other=await context.newPage(); await other.goto('/'); await navigate(other,'Memory');
 await other.getByRole('button',{name:'Open Inbox'}).click();
 await other.getByRole('button',{name:'Open other-tab-delete.md'}).click();
 await other.getByRole('button',{name:'File actions'}).click();
 await other.getByRole('button',{name:'Delete',exact:true}).click();
 await other.getByRole('dialog',{name:'Delete?'}).getByRole('button',{name:'Delete'}).click();
 await page.getByRole('button',{name:'Inbox/other-tab-delete.md',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('File unavailable');
 await expect(page.getByRole('textbox',{name:'Message'})).toBeVisible(); await other.close();
});

test('an old search result opens the same file after another tab renames it',async({page,context})=>{
 await page.goto('/'); await navigate(page,'Memory'); await page.getByRole('button',{name:'Open Inbox'}).click();
 await page.getByRole('button',{name:'New file'}).click();
 await page.getByRole('textbox',{name:'File name'}).fill('before-rename');
 await page.getByRole('textbox',{name:'New file content'}).fill('Original lantern text');
 await page.getByRole('button',{name:'Save',exact:true}).click(); await returnToInput(page);
 await page.getByRole('textbox',{name:'Message'}).fill('search: before-rename');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const result=page.getByRole('button',{name:'Inbox/before-rename.md',exact:true}); await expect(result).toBeVisible();
 const other=await context.newPage(); await other.goto('/'); await navigate(other,'Memory');
 await other.getByRole('button',{name:'Open Inbox'}).click(); await other.getByRole('button',{name:'Open before-rename.md'}).click();
 await other.getByRole('button',{name:'Edit',exact:true}).click();
 await other.getByRole('textbox',{name:'Markdown path'}).fill('Inbox/after-rename.md');
 await other.getByRole('button',{name:'Save',exact:true}).click();
 await expect(other.getByText('Inbox/after-rename.md',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'View source',exact:true}).last().click();
 const source=page.getByRole('dialog',{name:'Source'});
 await expect(source).toContainText('v1');
 await expect(source).toContainText('Inbox/before-rename.md');
 await expect(source).toContainText('Original lantern text');
 await source.getByRole('button',{name:'Close'}).click();
 await result.click();
 await expect(page.getByText('Inbox/after-rename.md',{exact:true})).toBeVisible();
 await expect(page.locator('.file-body')).toContainText('Original lantern text');
 await page.getByRole('button',{name:'History'}).click();
 await expect(page.getByText('v1',{exact:true})).toBeVisible(); await other.close();
});

test('plain natural-language Memory search and open work offline without preparing a model',async({page,context})=>{
 await page.goto('/');await prepareOfflineShell(page);
 await navigate(page,'Memory');
 await page.getByRole('button',{name:'Open Inbox',exact:true}).click();
 await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('lantern-meeting.md');
 await page.getByRole('textbox',{name:'New file content',exact:true}).fill('# Blue lantern meeting\n\nThe blue lantern meeting is Tuesday at 14:30 at the north pier.');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await expect(page.getByText('Inbox/lantern-meeting.md',{exact:true})).toBeVisible();
 await context.setOffline(true);
 await returnToInput(page);
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Find my notes about the blue lantern meeting.');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 const turn=page.locator('.sent-message').last();
 await expect(turn.locator('.turn-status')).toContainText('Found · 1');
 await expect(turn.getByRole('button',{name:'Inbox/lantern-meeting.md',exact:true})).toBeVisible();
 await expect(turn).not.toContainText('Model not prepared');
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Open my note about the blue lantern meeting.');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await expect(page.locator('.file-heading')).toContainText('Inbox/lantern-meeting.md');
 await expect(page.locator('.file-body')).toContainText('The blue lantern meeting is Tuesday at 14:30 at the north pier.');
});

test('correcting an invalid file name clears its stale error and preserves content',async({page})=>{
 await page.goto('/');await navigate(page,'Memory');await page.getByRole('button',{name:'New file'}).click();
 await page.getByRole('textbox',{name:'File name'}).fill('bad/name');await page.getByRole('textbox',{name:'New file content'}).fill('Draft remains');
 await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.getByRole('alert')).toHaveText('Enter a name without slashes');
 await page.getByRole('textbox',{name:'File name'}).fill('good-name');await expect(page.getByRole('alert')).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'New file content'})).toHaveValue('Draft remains');
});
