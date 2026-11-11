import {expect,test} from '@playwright/test';

test('Search model selection is explicit and does not download or index files',async({page})=>{
 const external:string[]=[];
 page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());});
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 const section=page.locator('[data-model-role="search"]');
 await expect(section).toContainText('Granite Embedding');
 await expect(section).toContainText('Off');
 const picker=section.getByRole('combobox',{name:'Search model'});
 await expect(picker).toBeVisible();
 await expect(picker.locator('option')).toHaveCount(3);
 await picker.selectOption('granite-embedding-97m-multilingual-r2-onnx');
 await expect(section).toContainText('Prepare and load to use semantic matches');
 await expect(section.getByRole('button',{name:'Turn off',exact:true})).toBeVisible();
 await picker.selectOption('granite-embedding-311m-multilingual-r2-onnx');
 await expect(section).toContainText('347 MB');
 expect(external).toEqual([]);
 await section.getByRole('button',{name:'Turn off',exact:true}).click();
 await expect(picker).toHaveValue('');
 await expect(section).toContainText('Off');
 expect(external).toEqual([]);
});
