import {expect,test} from '@playwright/test';

test('initial preparation does not present a partial asset estimate as a maximum',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Initial setup',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Initial preparation'});
 await expect(dialog.getByText(/Estimated assets · .* MB/)).toBeVisible();
 await expect(dialog.getByText('Extra runtime space may be needed.',{exact:true})).toBeVisible();
 await expect(dialog.getByRole('switch',{name:'Allow model downloads'})).not.toBeChecked();
});
