import {readFileSync} from 'node:fs';
import {expect,test} from '@playwright/test';

const pinned=JSON.parse(readFileSync(new URL('../src/lfm3-manifest.json',import.meta.url),'utf8')) as {file:{sha256:string;bytes:number}};

test('partial pinned model download is visibly discarded only after confirmation',async({page})=>{
 await page.goto('/tests/runtime-fixture.html');
 await page.evaluate(async({digest})=>{
  const root=await navigator.storage.getDirectory(),directory=await root.getDirectoryHandle('babelshelf-text-lfm3-v1',{create:true}),handle=await directory.getFileHandle(digest,{create:true}),writer=await handle.createWritable();
  await writer.write(new Uint8Array([1,2,3,4,5]));await writer.close();
 },{digest:pinned.file.sha256});
 await page.goto('/');
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 const discard=page.getByRole('button',{name:/Discard incomplete download/});await expect(discard).toBeVisible();
 await discard.click();const confirmation=page.getByRole('alertdialog',{name:'Discard incomplete model download'});
 await expect(confirmation).toContainText('only the incomplete download');await expect(confirmation).toContainText('Complete model files and saved data are not touched.');
 await confirmation.getByRole('button',{name:'Cancel'}).click();
 await expect(page.getByRole('button',{name:/Discard incomplete download/})).toBeVisible();
 await page.getByRole('button',{name:/Discard incomplete download/}).click();
 await page.getByRole('alertdialog',{name:'Discard incomplete model download'}).getByRole('button',{name:'Discard incomplete data'}).click();
 await expect(page.getByRole('button',{name:/Discard incomplete download/})).toHaveCount(0);
 expect(await page.evaluate(async({digest})=>{const root=await navigator.storage.getDirectory(),directory=await root.getDirectoryHandle('babelshelf-text-lfm3-v1');try{await directory.getFileHandle(digest);return true;}catch(error){return (error as DOMException).name!=='NotFoundError';}},{digest:pinned.file.sha256})).toBe(false);
});
