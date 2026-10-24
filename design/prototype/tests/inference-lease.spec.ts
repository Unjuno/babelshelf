import {expect,test} from '@playwright/test';

test('real same-origin browser tabs serialize resident inference leases',async({page,context})=>{
 await page.goto('/');
 expect(await page.evaluate(()=>!!navigator.locks)).toBe(true);
 await page.evaluate(async()=>{
  const {createInferenceLeaseManager}=await import('/src/inference-lease.ts');
  const manager=createInferenceLeaseManager(navigator.locks);
  (window as any).__babelshelfManager=manager;
  (window as any).__babelshelfLease=await manager.acquire('Text');
 });
 const sameTabRefused=await page.evaluate(async()=>{
  try{await (window as any).__babelshelfManager.acquire('Speech');return 'unexpectedly acquired';}
  catch(error){return String((error as Error).message);}
 });
 expect(sameTabRefused).toMatch(/another local inference role is active/i);
 const second=await context.newPage();
 await second.goto('/');
 const refused=await second.evaluate(async()=>{
  const {createInferenceLeaseManager}=await import('/src/inference-lease.ts');
  try{await createInferenceLeaseManager(navigator.locks).acquire('Vision');return 'unexpectedly acquired';}
  catch(error){return String((error as Error).message);}
 });
 expect(refused).toMatch(/already active in another BabelShelf tab/i);
 await page.evaluate(async()=>await (window as any).__babelshelfLease.release());
 const acquired=await second.evaluate(async()=>{
  const {createInferenceLeaseManager}=await import('/src/inference-lease.ts');
  const lease=await createInferenceLeaseManager(navigator.locks).acquire('Vision');
  const result=lease.protected;
  await lease.release();
  return result;
 });
 expect(acquired).toBe(true);
 await second.close();
});
