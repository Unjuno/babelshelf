import {expect,test} from '@playwright/test';

test('video frame status opens its selected local Vision model settings',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings'}).click();
 await page.getByRole('button',{name:'Files & media'}).click();

 const videoFrames=page.getByRole('button',{name:'Configure video frame model'});
 await expect(videoFrames).toBeVisible();
 await expect(videoFrames).toContainText('Sampled video frames');
 await videoFrames.click();

 const vision=page.locator('[data-model-role="vision"]');
 await expect(vision).toBeVisible();
 await expect(vision.getByRole('heading',{name:'Image understanding'})).toBeVisible();
 await expect(vision.getByRole('button',{name:'Vision model',exact:true})).toBeVisible();
});
