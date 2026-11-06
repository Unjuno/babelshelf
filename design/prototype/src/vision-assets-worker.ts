/// <reference lib="webworker" />
// Asset inspection must work without downloading or initializing inference code.
import {visionManifest,visionReady,prepareVision} from './vision-assets.ts';
import {customVisionReady,validateCustomVisionModel} from './custom-vision-assets.ts';

let busy=false;
self.onmessage=async({data}:MessageEvent<any>)=>{
 if(busy){self.postMessage({id:data.id,error:'Vision model busy'});return;}busy=true;
 try{
  const selected=typeof data.model==='string'?data.model:visionManifest.id;
  const custom=data.customModel?validateCustomVisionModel(data.customModel):undefined;
  if(custom&&custom.id!==selected||selected!==visionManifest.id&&!custom)throw Error('Vision model not registered');
  const identity=custom?{model:custom.id,revision:custom.revision,runtime:visionManifest.runtime}:{model:visionManifest.id,revision:visionManifest.revision,runtime:visionManifest.runtime};
  let value;
  if(data.type==='status')value={ready:custom?await customVisionReady(custom):await visionReady(),...identity};
  else if(data.type==='prepare'){
   if(custom)throw Error('Import custom Vision files locally before use');
   await prepareVision(data.allowNetwork===true,new AbortController().signal,text=>self.postMessage({id:data.id,progress:text}),data.localFiles);
   value={ready:true,...identity};
  }else throw Error('Vision asset action unavailable');
  self.postMessage({id:data.id,value});
 }catch(error){self.postMessage({id:data.id,error:(error as Error).message});}finally{busy=false;}
};
