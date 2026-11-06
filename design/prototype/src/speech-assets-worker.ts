/// <reference lib="webworker" />
// Checking or preparing speech files does not need to load Transformers or
// ONNX Runtime. Keep that heavier inference bundle out of the app's startup path.
import {prepareSpeech,speechReady} from './speech-assets.ts';
import type {CustomSpeechModel} from './preference-records.ts';

let busy=false;
self.onmessage=async({data}:MessageEvent<any>)=>{
 if(busy){self.postMessage({id:data.id,error:'Speech model busy'});return;}
 busy=true;
 const progress=(text:string)=>self.postMessage({id:data.id,progress:text});
 try{
  const custom=data.custom?data.custom as CustomSpeechModel:undefined;
  const model=custom??String(data.model||'whisper-tiny');
  let value:any;
  if(data.type==='status')value=await speechReady(model);
  else if(data.type==='prepare'){
   await prepareSpeech(data.allowNetwork===true,progress,model,new AbortController().signal);
   value=true;
  }else throw Error('Speech asset action unavailable');
  self.postMessage({id:data.id,value});
 }catch(error){self.postMessage({id:data.id,error:(error as Error).message});}
 finally{busy=false;}
};
