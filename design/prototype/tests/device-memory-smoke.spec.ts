import {expect,test} from '@playwright/test';

test('isolated on-device Memory smoke uses the production store and removes its temporary database',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  try{
   const module=await import('/src/device-memory-smoke.ts');
   await module.runDeviceMemorySmokeTest();
   return {ok:true};
  }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)};}
 });
 expect(result).toEqual({ok:true});
 const leftovers=await page.evaluate(async()=>typeof indexedDB.databases==='function'?(await indexedDB.databases()).filter(item=>item.name?.startsWith('babelshelf-device-smoke-')).map(item=>item.name):[]);
 expect(leftovers).toEqual([]);
});
