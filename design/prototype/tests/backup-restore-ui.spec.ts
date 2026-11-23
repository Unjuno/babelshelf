import {expect,test} from '@playwright/test';
import {createNote,makeBackup} from '../../../dist/core.js';

test('Restore backup opens a review and restores its note through the Settings file picker',async({page})=>{
 await page.goto('/');
 const note=createNote({path:'Inbox/audit20-restore-roundtrip.md',body:'Restore UI roundtrip · preserved local record'});
 note.id='audit20-restore-roundtrip';
 const archive=await makeBackup([note]);
 const input=page.locator('input[type="file"][accept=".brainpack,application/json"]');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Local files',exact:true}).click();
 await page.getByRole('button',{name:'Restore backup',exact:true}).click();
 await input.setInputFiles({name:'audit20-roundtrip.brainpack',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
 const dialog=page.getByRole('dialog',{name:'Restore backup?'});
 await expect(dialog).toContainText('1 records');
 await dialog.getByRole('button',{name:'Restore',exact:true}).click();
 await expect(dialog).toHaveCount(0);
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Memory',exact:true}).click();
 await page.getByRole('button',{name:'Open Inbox',exact:true}).click();
 await expect(page.getByText('audit20-restore-roundtrip.md',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open audit20-restore-roundtrip.md',exact:true}).click();
 await expect(page.locator('.file-body')).toContainText('Restore UI roundtrip · preserved local record');
});
