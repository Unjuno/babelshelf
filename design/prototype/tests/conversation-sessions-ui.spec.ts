import {expect,test} from '@playwright/test';

test('conversation manager creates, renames, switches and deletes sessions without losing the retained chat',async({page})=>{
 await page.goto('/');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
 const open=async()=>{await page.getByRole('button',{name:/Manage conversations/}).click();return page.getByRole('dialog',{name:'Conversations'});};
 let dialog=await open();await expect(dialog).toContainText('Conversation 1');await dialog.getByRole('button',{name:'New conversation'}).click();
 await expect(dialog).toContainText('New conversation');
 const active=dialog.locator('.conversation-session-row').filter({has:page.getByText('New conversation',{exact:true})}).first();await active.getByRole('button',{name:'Rename'}).click();await dialog.getByRole('textbox',{name:'Conversation name'}).fill('Research');await dialog.getByRole('button',{name:'Save name'}).click();await expect(dialog).toContainText('Research');
 await dialog.getByRole('button',{name:'Close'}).click();await page.reload();dialog=await open();await expect(dialog).toContainText('Research');
 const old=dialog.locator('.conversation-session-row').filter({has:page.getByText('Conversation 1',{exact:true})});await old.getByRole('button',{name:'Delete'}).click();await old.getByRole('button',{name:'Delete conversation'}).click();await expect(dialog).not.toContainText('Conversation 1');
 await dialog.getByRole('button',{name:'New conversation'}).click();const rows=dialog.locator('.conversation-session-row');await expect(rows).toHaveCount(2);
 const current=rows.filter({has:page.getByText('New conversation',{exact:true})}).first();await current.getByRole('button',{name:'Delete'}).click();await expect(current.getByLabel('Replacement conversation')).toBeVisible();await current.getByRole('button',{name:'Delete conversation'}).click();await expect(dialog).toContainText('Research');
 await dialog.getByRole('button',{name:'Close'}).click();await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
});
