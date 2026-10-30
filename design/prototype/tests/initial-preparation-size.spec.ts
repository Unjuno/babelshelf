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

test('the Q8 image and audio set can be reviewed without an implicit download',async({page})=>{
 const remote:string[]=[];page.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:'))remote.push(request.url());});
 await page.goto('/');await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();await page.getByRole('button',{name:/Model set ·/}).click();
 await page.getByRole('button',{name:/^Text \+ image \+ audio · Q8/}).click();
 await expect(page.getByText(/LFM3 Q8_0 · Whisper tiny · Tesseract 7/)).toBeVisible();
 expect(remote).toEqual([]);
});
