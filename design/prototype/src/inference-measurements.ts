import type {GenerationResult,TextRuntime} from './text-inference.ts';

export type InferenceMeasurements={measuredModelCalls:number;promptTokens?:number;outputTokens?:number;countMs?:number;generationWallMs?:number;runtimeTtftMs?:number;runtimePrefillMs?:number;runtimeDecodeMs?:number;runtimeCachedTokens?:number};
export function addMeasurement(total:number|undefined,value:unknown,integer=false){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||integer&&!Number.isSafeInteger(value))return total;
 const next=(total??0)+value;return Number.isFinite(next)&&next<=Number.MAX_SAFE_INTEGER?next:total;
}
/** Aggregate only numeric runtime evidence, never model text or raw metadata. */
export function recordGenerationMeasurements(usage:InferenceMeasurements,result:GenerationResult){
 const promptTokens=addMeasurement(usage.promptTokens,result.metrics?.runtimePromptTokens,true),outputTokens=addMeasurement(usage.outputTokens,result.outputTokens??result.metrics?.outputTokens,true),runtimeCountMs=addMeasurement(usage.countMs,result.metrics?.countMs);
 if(promptTokens!==undefined)usage.promptTokens=promptTokens;if(outputTokens!==undefined)usage.outputTokens=outputTokens;if(runtimeCountMs!==undefined)usage.countMs=runtimeCountMs;
 for(const key of ['runtimeTtftMs','runtimePrefillMs','runtimeDecodeMs','runtimeCachedTokens'] as const){
  const total=addMeasurement(usage[key],result.metrics?.[key],key==='runtimeCachedTokens');
  if(total!==undefined)usage[key]=total;
 }
}
/** Capture bounded inference measurements without retaining generated content. */
export function observeInference<T extends Pick<TextRuntime,'count'|'generate'>>(runtime:T,usage:InferenceMeasurements,onInference?:(metrics:Readonly<InferenceMeasurements>)=>void):T{
 const notify=()=>{try{onInference?.({...usage});}catch{/* Measurement observers must never change inference results. */}};
 return new Proxy(runtime,{get(target,property){
  if(property==='count'){
   const count=Reflect.get(target,property,target) as TextRuntime['count'];
   return async(...args:Parameters<TextRuntime['count']>)=>{const started=performance.now();try{return await count.apply(target,args);}finally{usage.countMs=addMeasurement(usage.countMs,performance.now()-started);}};
  }
  if(property==='generate'){
   const generate=Reflect.get(target,property,target) as TextRuntime['generate'];
   return async(...args:Parameters<TextRuntime['generate']>)=>{
    const started=performance.now();usage.measuredModelCalls++;
    try{
     const result=await generate.apply(target,args);
     recordGenerationMeasurements(usage,result);
     return result;
    }finally{usage.generationWallMs=addMeasurement(usage.generationWallMs,performance.now()-started);notify();}
   };
  }
  return Reflect.get(target,property,target);
 }});
}
