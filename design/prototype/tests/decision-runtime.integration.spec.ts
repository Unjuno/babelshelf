import {expect,test} from '@playwright/test';
import {decisionRoutingQuestion,decisionRoutingState,decisionRoute} from '../src/decision-routing.ts';
import {decisionManifest} from '../src/decision-assets.ts';
const enabled=process.env.BABELSHELF_RUN_D1_INTEGRATION==='1';

test('pinned D1 model creates a real session, verifies a statement, and defers an ambiguous route',async({page})=>{
 test.skip(!enabled,'Explicit opt-in: may download about 406 MB of pinned D1 weights into this isolated browser profile when assets are missing.');
 test.setTimeout(25*60_000);
 let lastProgress='';
 page.on('console',message=>{const text=message.text();if(text.startsWith('D1 integration · ')){if(text===lastProgress)return;lastProgress=text;}console.log('Decision browser console · '+message.type()+' · '+text);});
 page.on('requestfailed',request=>console.log('Decision request failed · '+request.url()+' · '+request.failure()?.errorText));
 await page.goto('/tests/runtime-fixture.html');
 const decisionState=decisionRoutingState('Give me a one-sentence explanation of lunar phases.');
 const result=await page.evaluate(async({routingQuestion,routingState})=>{
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
   const routeClassification=await operation('classify',{state:routingState,question:routingQuestion});
   return {prepared,loaded,classified,routeClassification,progress};
  }finally{worker.terminate();}
 },{routingQuestion:decisionRoutingQuestion,routingState:decisionState});
 const routeQuestion='Give me a one-sentence explanation of lunar phases.',route=decisionRoute(result.routeClassification,routeQuestion,{summary:'',recent:[],refs:[],turnCount:0},{model:decisionManifest.id,revision:decisionManifest.conversion.revision,inputLimit:decisionManifest.inputLimit,scope:'text-only'});
 expect(result.prepared).toMatchObject({prepared:true});
 expect(result.loaded).toMatchObject({loaded:true,model:'d1-omni-600M'});
 expect(result.loaded.device).toBe('wasm');
 const backendFallback=result.progress.find((message:string)=>message.startsWith('WebGPU skipped · '));
 expect(backendFallback).toMatch(/^WebGPU skipped · (?:D1 Q8 MatMulNBits|GatherBlockQuantized) is unsupported by this WebGPU runtime · using WASM$/);
 expect(result.progress).toContain('Loading · WASM');
 expect(result.classified).toMatchObject({scope:'text-only',model:'d1-omni-600M',answer:{type:'noul',answer:true}});
 expect(route).toEqual({request:null,reason:'ambiguous'});
 expect(result.routeClassification).toMatchObject({scope:'text-only',model:'d1-omni-600M',answer:{type:'choice',choice:'answer'}});
 expect(result.routeClassification.answer.confidence).toBeLessThan(.95);
});
