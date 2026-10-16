import {useEffect,useRef,useState} from 'react';
// @ts-expect-error Shared baseline worker controller is JavaScript.
import {Engine} from '../../../dist/engine.js';
import manifest from '../../../dist/model-manifest.json';
export function useBonsai(){
 const cancelled=useRef(false),operationLock=useRef(false);const engine=useRef<any>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[,setLoaded]=useState(''),[assets,setAssets]=useState<Record<string,any>>({});
 useEffect(()=>{const worker=new Worker(new URL('./bonsai-worker.ts',import.meta.url),{type:'module'});const e=new Engine(manifest,(error:string)=>{setProgress(error);setLoaded('');},worker);engine.current=e;e.init().then(setAssets).catch((err:Error)=>setProgress(err.message));return()=>{e.abort();e.worker.terminate();if(engine.current===e)engine.current=null;};},[]);
 const events=(type:string,value:string)=>{if(type==='progress')setProgress(String(value));};
 async function operation<T>(work:()=>Promise<T>){if(operationLock.current)throw Error('Model busy');operationLock.current=true;setBusy(true);try{return await work();}catch(e){setProgress((e as Error).message);throw e;}finally{operationLock.current=false;setBusy(false);}}
 async function prepare(model:string,allowNetwork:boolean,localFiles?:File[]){return operation(async()=>{if(!allowNetwork&&!localFiles)throw Error('Downloads are off');await engine.current.call('prepare',{model,allowNetwork,localFiles},events);setAssets(await engine.current.call('status'));setProgress('Verified');});}
 async function load(model:string){return operation(async()=>{setLoaded('');await engine.current.load(model,events);setLoaded(model);setProgress('Loaded');});}
 async function unload(){return operation(async()=>{await engine.current.unload();setLoaded('');setProgress('Unloaded');});}
 async function generate(messages:unknown[],maxTokens=256){return operation(async()=>{if(!engine.current?.loaded)throw Error('Model not loaded');cancelled.current=false;setProgress('Generating…');const result=await engine.current.generate(messages,events,maxTokens);if(cancelled.current)throw Error('Stopped');return result;});}
 function stop(){cancelled.current=true;engine.current?.abort();setProgress('Stopping…');}
 return {manifest,busy,progress,get loaded():string{return engine.current?.loaded??'';},assets,prepare,load,unload,generate,stop,count:(messages:unknown[])=>engine.current.call('count',{messages})};
}
