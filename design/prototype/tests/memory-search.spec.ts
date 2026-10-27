import {expect,test} from '@playwright/test';
import {prepareOfflineShell} from './pwa-offline-setup.ts';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination,exact:true}).click();
}
async function returnToInput(page:any){
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await expect(home).toHaveAttribute('aria-expanded','true');await home.click();
}

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
