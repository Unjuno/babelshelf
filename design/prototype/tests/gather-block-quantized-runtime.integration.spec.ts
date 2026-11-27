import {expect,test} from '@playwright/test';

test('pinned ONNX Runtime JSEP/WASM executes a Q4 GatherBlockQuantized graph',async({page})=>{
 await page.goto('/tests/runtime-fixture.html');
 const result=await page.evaluate(async()=>{
  const response=await fetch('/tests/fixtures/gather-block-quantized-probe.onnx');
  if(!response.ok)throw Error('GatherBlockQuantized probe graph unavailable');
  const model=await response.arrayBuffer(),worker=new Worker('/tests/gather-block-quantized-probe-worker.ts',{type:'module'});
  return new Promise<{backend:string;shape:number[];values:number[]}>((resolve,reject)=>{
   const timer=setTimeout(()=>{worker.terminate();reject(Error('GatherBlockQuantized WASM probe timed out'));},30_000);
   worker.onmessage=event=>{clearTimeout(timer);worker.terminate();event.data.error?reject(Error(event.data.error)):resolve(event.data.result);};
   worker.onerror=event=>{clearTimeout(timer);worker.terminate();reject(Error(event.message));};
   worker.postMessage({id:'gather-block-quantized-probe',model},[model]);
  });
 });
 expect(result).toEqual({backend:'wasm',shape:[1,16],values:[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,0]});
});
