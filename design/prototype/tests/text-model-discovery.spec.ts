import {expect,test} from '@playwright/test';

test('text model catalog is directly accessible from model settings',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Browse text models',exact:true}).click();
 const q8=page.getByRole('button',{name:/LFM3.*Q8_0/});
 await expect(q8).toBeVisible();
 await expect(q8).toContainText('Configured route: WebGPU first');
 await expect(q8).toContainText('device execution not tested');
});
