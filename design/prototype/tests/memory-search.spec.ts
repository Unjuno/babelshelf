import {expect,test} from '@playwright/test';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination,exact:true}).click();
}
async function returnToInput(page:any){
 const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await expect(home).toHaveAttribute('aria-expanded','true');await home.click();
}

test('plain natural-language Memory search and open work offline without preparing a model',async({page,context})=>{
 await page.goto('/');await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
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
