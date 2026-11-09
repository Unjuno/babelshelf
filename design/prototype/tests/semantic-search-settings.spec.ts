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
 await expect(section.getByRole('button',{name:'Use for Search',exact:true})).toBeVisible();
 await section.getByRole('button',{name:'Use for Search',exact:true}).click();
 await expect(section).toContainText('No download or indexing starts automatically');
 await expect(section.getByRole('button',{name:'Turn off',exact:true})).toBeVisible();
 expect(external).toEqual([]);
 await section.getByRole('button',{name:'Turn off',exact:true}).click();
 await expect(section.getByRole('button',{name:'Use for Search',exact:true})).toBeVisible();
 expect(external).toEqual([]);
});
