import {expect,test} from '@playwright/test';

test('PDF text layer is not advertised as ready before local reader files are checked',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Files & media',exact:true}).click();
 const pdf=page.getByRole('button',{name:'Add PDF to input'});await expect(pdf).toContainText('Text layer · not checked');
 await page.getByRole('button',{name:'PDF reader Check local files'}).click();await expect(pdf).toContainText('Text layer · check failed');
});

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
