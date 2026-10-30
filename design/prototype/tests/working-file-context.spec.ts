import {expect,test} from '@playwright/test';
import {prepareOfflineShell} from './pwa-offline-setup.ts';

async function navigate(page:any,destination:string){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:destination==='Memory'?'BabelShelf':destination,exact:true}).click();
}
async function openScheduleFile(page:any){
 await navigate(page,'Memory');
 await page.getByRole('navigation',{name:'Memory path'}).getByRole('button',{name:'Memory',exact:true}).click();
 await page.getByRole('button',{name:'Open Schedule',exact:true}).click();
 await page.locator('.file-row').first().click();
}

test('input exposes file context and removal persists offline without deleting the file',async({page,context})=>{
 await page.goto('/');await prepareOfflineShell(page);
 await navigate(page,'Schedule');await page.getByRole('button',{name:'New schedule'}).click();
 await page.getByRole('textbox',{name:'Schedule prompt'}).fill('File scope check');
 await page.getByRole('textbox',{name:'Schedule date'}).fill('2099-01-01');
 await page.getByRole('textbox',{name:'Schedule time'}).fill('09:00');
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await openScheduleFile(page);
 const original=await page.locator('.file-body').innerText();expect(original).toContain('File scope check');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();
 const chip=page.getByRole('group',{name:'Input file',exact:true});await expect(chip).toContainText('v1');
 await page.getByRole('button',{name:'Offline · Tap to switch Online',exact:true}).click();
 const toast=page.locator('.preview-toast');await expect(toast).toBeVisible();
 const chipBounds=await chip.boundingBox(),toastBounds=await toast.boundingBox();expect(toastBounds!.y+toastBounds!.height).toBeLessThanOrEqual(chipBounds!.y-4);
 await page.getByRole('button',{name:'Online · Tap to switch Offline',exact:true}).click();
 const remove=chip.getByRole('button',{name:'Remove file from input',exact:true}),bounds=await remove.boundingBox();expect(bounds!.width).toBeGreaterThanOrEqual(44);expect(bounds!.height).toBeGreaterThanOrEqual(44);
 await page.addStyleTag({content:'html{font-size:200% !important}'});expect(await chip.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Keep this draft');
 await chip.getByRole('button',{name:'Remove file from input',exact:true}).click();
 await expect(chip).toHaveCount(0);await expect(page.getByRole('textbox',{name:'Message',exact:true})).toHaveValue('Keep this draft');
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('');
 await context.setOffline(true);await page.reload();await expect(chip).toHaveCount(0);
 await openScheduleFile(page);await expect(page.locator('.file-body')).toHaveText(original);
});
