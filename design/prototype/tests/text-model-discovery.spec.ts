import {expect,test} from '@playwright/test';

test('text model catalog is directly accessible from model settings',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Browse text models',exact:true}).click();
 const iq3=page.getByRole('button',{name:/Add LFM3.*IQ3_M.*Community/});
 await expect(iq3).toBeVisible();
 await expect(iq3).toContainText('869 MB');
 await iq3.click();
 await expect(page.getByRole('button',{name:'Text model',exact:true})).toContainText('IQ3_M');
 await page.getByRole('button',{name:'Text model',exact:true}).click();
 const selectIq3=page.getByRole('button',{name:/Select LFM3.*IQ3_M.*Community/});
 await expect(selectIq3).toBeVisible();
 await selectIq3.click();
 await page.getByRole('button',{name:'Browse text models',exact:true}).click();
 const q8=page.getByRole('button',{name:/LFM3.*Q8_0/});
 await expect(q8).toBeVisible();
 await expect(q8).toContainText('GPU preferred');
 await expect(q8).toContainText('not tested on this device');
});

test('media and Decision catalogs offer only registered local adapters',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.locator('summary').filter({hasText:'More decision options'}).click();
 await page.getByRole('button',{name:'Browse decision models',exact:true}).click();
 await expect(page.getByRole('button',{name:/Add Open d1.*600M/})).toBeVisible();
 await expect(page.getByRole('button',{name:/3B/})).toHaveCount(0);
 await page.getByRole('button',{name:/Add Open d1.*600M/}).click();
 await expect(page.getByRole('button',{name:'Decision model',exact:true})).toContainText('600M');
 await page.getByRole('button',{name:'Browse image text models',exact:true}).click();
 await expect(page.getByRole('button',{name:/Add Tesseract 7/})).toBeVisible();
 await page.getByRole('button',{name:/Add Tesseract 7/}).click();
 await expect(page.getByRole('button',{name:'Image text model',exact:true})).toContainText('Tesseract 7');
 await page.getByRole('button',{name:'Browse vision models',exact:true}).click();
 await expect(page.getByRole('button',{name:/Add LFM2\.5-VL.*450M/})).toBeVisible();
});
