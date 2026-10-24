import {expect,test} from '@playwright/test';

test('video frame setup opens the matching Vision model controls',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Files & media',exact:true}).click();
 await expect(page.getByRole('button',{name:'Configure video frame model'})).toBeVisible();
 await page.getByRole('button',{name:'Configure video frame model'}).click();
 await expect(page.getByRole('heading',{name:'Image understanding',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Browse vision models',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Add local LFM2-VL ONNX model',exact:true})).toBeVisible();
});
