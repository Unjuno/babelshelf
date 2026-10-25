import {useEffect,useRef,useState} from 'react';
import {VisionClient} from './vision-control';
import {inferenceLeaseManager} from './inference-lease';
import {customVisionReady,importCustomVisionModel} from './custom-vision-assets.ts';
import type {CustomVisionModel} from './preference-records.ts';

const builtinVision='lfm25-vl-450m-q4f16';

export function useVision(model:string,customModels:readonly CustomVisionModel[]=[],beforeDescribe?:(check:()=>void)=>Promise<void>){
 const before=useRef(beforeDescribe);before.current=beforeDescribe;
 const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const client=useRef<VisionClient|null>(null),importAbort=useRef<AbortController|null>(null);client.current??=new VisionClient(()=>new Worker(new URL('./vision-worker.ts',import.meta.url),{type:'module'}),(active,text)=>{setBusy(active);if(text)setProgress(text);},async check=>{check();await before.current?.(check);check();},()=>inferenceLeaseManager.acquire('Vision'));
 const customModel=customModels.find(item=>item.id===model),customModelId=customModel?.id??'';
 useEffect(()=>{let alive=true;setReady(false);if(!model){client.current!.stop();return()=>{alive=false;};}client.current!.call('status',{model,customModel}).then(value=>{if(alive)setReady(value.ready===true);}).catch(()=>{if(alive)setReady(false);});return()=>{alive=false;client.current!.stop();importAbort.current?.abort();};},[model,customModelId,customModel?.revision]);
 const describe=async(values:Record<string,unknown>)=>{return client.current!.call('describe',{...values,model,...(customModel?{customModel}: {})});};
 const prepare=async(allowNetwork:boolean,localFiles?:File[])=>{
  if(model===builtinVision){setReady(false);await client.current!.call('prepare',{model,allowNetwork,localFiles});setReady(true);setProgress('Verified');return;}
  if(!customModel)throw Error('Vision model not configured');
  setReady(false);setBusy(true);const controller=new AbortController();importAbort.current=controller;
  try{
   if(localFiles?.length)await importCustomVisionModel({model:customModel,files:localFiles,status:'execution-not-tested'},controller.signal,setProgress);
   else setProgress('Verifying local Vision files');
   controller.signal.throwIfAborted();const verified=await customVisionReady(customModel,controller.signal);controller.signal.throwIfAborted();if(!verified)throw Error(localFiles?.length?'Custom Vision files could not be verified':'Custom Vision files missing · choose the package again');setReady(true);setProgress('Files verified · execution not tested');
  }
  finally{if(importAbort.current===controller)importAbort.current=null;setBusy(false);}
 };
 return {ready,busy,progress,stop:()=>{importAbort.current?.abort();importAbort.current=null;client.current!.stop();},prepare,describe:async(image:Blob,prompt:string)=>{if(!ready)throw Error('Vision model not prepared');return describe({image,prompt});},describeFrames:async(images:Blob[],prompt:string)=>{if(!ready)throw Error('Vision model not prepared');return describe({images,prompt});}};
}
