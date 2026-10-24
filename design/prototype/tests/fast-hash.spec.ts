import {expect,test} from '@playwright/test';

declare global {interface Window {runHash?:()=>Promise<{digest:string;backend:string}>;runWorkerHash?:()=>Promise<{digest:string;backend:string}>}}

test('browser lazily loads the pinned SHA-256-only module and verifies standard vectors',async({page})=>{
 await page.goto('/tests/fast-hash-fixture.html');
 await expect.poll(()=>page.evaluate(()=>typeof window.runHash)).toBe('function');
 const result=await page.evaluate(()=>window.runHash!());
 expect(result).toEqual({digest:'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',backend:'hash-wasm-4.12.0'});
 const workerResult=await page.evaluate(()=>window.runWorkerHash!());
 expect(workerResult).toEqual(result);
});
