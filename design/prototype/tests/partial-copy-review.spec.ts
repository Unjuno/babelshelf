import {expect,test} from '@playwright/test';

test('saving a partial answer identifies it during review',async({page})=>{
 await page.goto('/');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({schema:1,revision:1,turns:[{id:'partial-fixture',user:'Compare the reviews',answer:'One review is on Monday.',status:'Partial · incomplete inspection'}],compaction:null},'ui-v1-dialogue');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await page.reload();await expect(page.locator('.sent-message')).toContainText('Partial · incomplete inspection');
 await page.getByRole('button',{name:'Save note',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'New file'});await expect(dialog.getByText('Partial answer',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('textbox',{name:'File content'})).toHaveValue('One review is on Monday.');
});

test('a complete answer is not labelled partial during review',async({page})=>{
 await page.goto('/');await expect(page.getByRole('textbox',{name:'Message',exact:true})).toBeVisible();
 await page.evaluate(()=>new Promise<void>((resolve,reject)=>{const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings','readwrite');tx.objectStore('settings').put({schema:1,revision:1,turns:[{id:'complete-fixture',user:'What is the time?',answer:'Monday at ten.'}],compaction:null},'ui-v1-dialogue');tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}));
 await page.reload();await expect(page.locator('.sent-message')).toContainText('Monday at ten.');await page.getByRole('button',{name:'Save note',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'New file'}).getByText('Partial answer',{exact:true})).toHaveCount(0);
});
