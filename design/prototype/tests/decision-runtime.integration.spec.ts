import {expect,test} from '@playwright/test';
const enabled=process.env.BABELSHELF_RUN_D1_INTEGRATION==='1';

test('pinned D1 model prepares, creates a real ONNX session and classifies a statement',async({page})=>{
 test.skip(!enabled,'Explicit opt-in: downloads about 406 MB of pinned D1 weights into this isolated browser profile.');
 test.setTimeout(25*60_000);
 page.on('console',message=>console.log('Decision browser console · '+message.type()+' · '+message.text()));
 page.on('requestfailed',request=>console.log('Decision request failed · '+request.url()+' · '+request.failure()?.errorText));
 await page.goto('/tests/runtime-fixture.html');
 const result=await page.evaluate(async()=>{
  const worker=new Worker('/src/decision-worker.ts',{type:'module'}),progress:string[]=[];let nextId=0;
  const operation=(type:string,extra:Record<string,unknown>={})=>new Promise<any>((resolve,reject)=>{
   const id='d1-integration-'+(++nextId),timer=setTimeout(()=>reject(Error(type+' timed out')),20*60_000);
   const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('message',onMessage);worker.removeEventListener('error',onError);worker.removeEventListener('messageerror',onMessageError);};
   const onError=(event:ErrorEvent)=>{cleanup();reject(Error(type+' worker error · '+JSON.stringify({message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno,stack:(event.error as Error|undefined)?.stack??null})));};
   const onMessageError=()=>{cleanup();reject(Error(type+' worker message could not be cloned'));};
   const onMessage=(event:MessageEvent)=>{const data=event.data;if(data?.id!==id)return;if(data.progress){progress.push(data.progress);console.log('D1 integration · '+data.progress);return;}cleanup();data.error?reject(Error(type+' failed · '+data.error)):resolve(data.value);};
   worker.addEventListener('message',onMessage);worker.addEventListener('error',onError);worker.addEventListener('messageerror',onMessageError);worker.postMessage({id,type,model:'d1-omni-600M',...extra});
  });
  try{
   const prepared=await operation('prepare',{allowNetwork:true});
   const loaded=await operation('load');
   const classified=await operation('classify',{state:'Statement: Paris is the capital of France. The statement is true.',question:{type:'noul',instructions:'Is the statement true?'}});
   return {prepared,loaded,classified,progress};
  }finally{worker.terminate();}
 });
 expect(result.prepared).toMatchObject({prepared:true});
 expect(result.loaded).toMatchObject({loaded:true,model:'d1-omni-600M'});
 expect(result.loaded.device).toBe('wasm');
 expect(result.progress).toContain('WebGPU skipped · D1 Q8 MatMulNBits is unsupported by this WebGPU runtime · using WASM');
 expect(result.classified).toMatchObject({scope:'text-only',model:'d1-omni-600M',answer:{type:'noul',answer:true}});
});
