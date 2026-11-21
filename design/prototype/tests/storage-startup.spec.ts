import {expect,test} from '@playwright/test';

test('an IndexedDB open that never settles reaches recovery without changing stored data',async({page})=>{
 await page.addInitScript(()=>{
  const originalOpen=IDBFactory.prototype.open,originalDelete=IDBFactory.prototype.deleteDatabase;
  let opens=0,deletes=0;
  IDBFactory.prototype.open=function(){opens++;return {} as IDBOpenDBRequest;};
  IDBFactory.prototype.deleteDatabase=function(name:string){deletes++;return originalDelete.call(this,name);};
  localStorage.setItem('babelshelf-startup-retained-draft','keep this draft');
  (window as any).__storageProbe=()=>({opens,deletes,draft:localStorage.getItem('babelshelf-startup-retained-draft')});
  (window as any).__originalIndexedDBOpen=originalOpen;
 });
 await page.goto('/',{waitUntil:'domcontentloaded'});
 await expect(page.getByRole('heading',{name:/Local storage did not respond/})).toBeVisible({timeout:20_000});
 await expect(page.getByRole('button',{name:'Export recovery snapshot'})).toBeVisible();
 expect(await page.evaluate(()=>(window as any).__storageProbe())).toMatchObject({opens:1,deletes:0,draft:'keep this draft'});
 await expect(page.getByText(/Your saved data was not changed/)).toBeVisible();
});
