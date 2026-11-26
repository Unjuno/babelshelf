import {expect,test} from '@playwright/test';
import {createNote,makeBackup} from '../../../dist/core.js';

test('Restore backup opens a review and restores its note through the Settings file picker',async({page})=>{
 await page.goto('/');
 const note=createNote({path:'Inbox/audit20-restore-roundtrip.md',body:'Restore UI roundtrip · preserved local record'});
 note.id='audit20-restore-roundtrip';
 const archive=await makeBackup([note]);
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Local files',exact:true}).click();
 const chooserPromise=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Restore backup',exact:true}).click();
 const chooser=await chooserPromise;
 expect(chooser.isMultiple()).toBe(false);
 await chooser.setFiles({name:'audit20-roundtrip.brainpack',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
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

test('Restore backup keeps invalid-file errors visible in Local files and leaves storage unchanged',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Local files',exact:true}).click();
 const chooserPromise=page.waitForEvent('filechooser');
 await page.getByRole('button',{name:'Restore backup',exact:true}).click();
 const chooser=await chooserPromise;
 await chooser.setFiles({name:'invalid.brainpack',mimeType:'application/json',buffer:Buffer.from('{"not":"a backup"}')});
 const alert=page.getByRole('alert');
 await expect(alert).toContainText('Backup verification failed');
 await expect(alert).toContainText('nothing changed');
 await expect(page.getByRole('dialog',{name:'Restore backup?'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Restore backup',exact:true})).toBeEnabled();
 const nativeInput=page.getByLabel('Backup file',{exact:true});
 await expect(nativeInput).toBeVisible();
 const archive=await makeBackup([createNote({path:'Inbox/fallback.md',body:'Native file selection'})]);
 await nativeInput.setInputFiles({name:'fallback.brainpack',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(archive))});
 const review=page.getByRole('dialog',{name:'Restore backup?'});
 await expect(review).toContainText('1 records');
 await review.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(review).toHaveCount(0);
});

test('a conflicting backup is reviewed without overwriting a later file edit',async({page},testInfo)=>{
 await page.goto('/');
 const navigate=async(label:string)=>{await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:label,exact:true}).click();};
 await navigate('Memory');await page.getByRole('button',{name:'Open Inbox',exact:true}).click();await page.getByRole('button',{name:'New file',exact:true}).click();
 await page.getByRole('textbox',{name:'File name',exact:true}).fill('backup-conflict-ui');await page.getByRole('textbox',{name:'New file content',exact:true}).fill('Original before backup');await page.getByRole('dialog',{name:'New file'}).getByRole('button',{name:'Save',exact:true}).click();
 await navigate('Settings');await page.getByRole('button',{name:'Local files',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();const path=testInfo.outputPath('conflict.brainpack');await (await download).saveAs(path);
 await navigate('Memory');await page.getByRole('button',{name:'Open Inbox',exact:true}).click();await page.getByRole('button',{name:'Open backup-conflict-ui.md',exact:true}).click();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('textbox',{name:'Markdown content',exact:true}).fill('Later local edit must remain');await page.getByRole('button',{name:'Save',exact:true}).click();await expect(page.locator('main')).toContainText('Later local edit must remain');
 await navigate('Settings');await page.getByRole('button',{name:'Local files',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Restore backup',exact:true}).click();await (await chooser).setFiles(path);
 const review=page.getByRole('dialog',{name:'Restore backup?'});await expect(review.getByRole('alert')).toContainText('conflicts · Existing kept');await expect(review).toContainText('backup-conflict-ui.md');await expect(review.getByRole('button',{name:'Restore',exact:true})).toBeDisabled();await review.getByRole('button',{name:'Cancel',exact:true}).click();
 await navigate('Memory');await page.getByRole('button',{name:'Open Inbox',exact:true}).click();await page.getByRole('button',{name:'Open backup-conflict-ui.md',exact:true}).click();await expect(page.locator('main')).toContainText('Later local edit must remain');
});
