import type {StructuredFormat} from './structured-grammar';
import {TextEngineRouter} from './text-engine-router';
import {createOnnxTextBackend} from './onnx-text-backend';
import {combinedLocalTextManifest as combinedTextManifest,lfmTextModels,describeLfmText} from './lfm-text-manifest';
import {createLfmTextBackend} from './lfm-text-backend';
import {createTextInference,type TextRuntime} from './text-inference';
import {useEffect,useRef,useState} from 'react';
// @ts-expect-error Shared baseline worker controller is JavaScript.
import {Engine} from '../../../dist/engine.js';
import type {CustomLocalModel} from './preference-records';
// @ts-expect-error Shared strict manifest builder is JavaScript.
import {withLocalModels} from '../../../dist/local-model-manifest.js';
import baseManifest from '../../../dist/model-manifest.json';
export function useBonsai(models:CustomLocalModel[]=[],ready=true){
 const records=useRef(models);records.current=models;const manifest=withLocalModels(baseManifest,models);const registryKey=JSON.stringify(models),configured=useRef(''),observed=useRef(''),initialized=useRef<Promise<unknown>|null>(null);
 const cancelEpoch=useRef(0),cancelled=useRef(false),operationLock=useRef(false);const engine=useRef<any>(null),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[,setLoaded]=useState(''),[assets,setAssets]=useState<Record<string,any>>({});
 useEffect(()=>{const worker=new Worker(new URL('./bonsai-worker.ts',import.meta.url),{type:'module'});const webml=new Engine(baseManifest,(error:string)=>{setProgress(error);setLoaded('');},worker);const e=new TextEngineRouter(webml,()=>createOnnxTextBackend(()=>new Worker(new URL('./onnx-text-worker.ts',import.meta.url),{type:'module'})),[{id:'lfm-text',modelIds:lfmTextModels.map(m=>m.id),describe:describeLfmText,create:()=>createLfmTextBackend(()=>new Worker(new URL('./lfm-text-worker.ts',import.meta.url),{type:'module'}))}]);engine.current=e;const init:Promise<unknown>=e.init();initialized.current=init;init.catch((err:Error)=>setProgress(err.message));return()=>{e.abort();e.worker.terminate();if(engine.current===e)engine.current=null;};},[]);
 async function syncRegistry(nextRecords=records.current,check=()=>{}){check();if(!ready||!engine.current)throw Error('Storage not ready');await initialized.current;check();const key=JSON.stringify(nextRecords);if(configured.current!==key){if(engine.current.loaded){await engine.current.unload();check();setLoaded('');}const next=withLocalModels(baseManifest,nextRecords);const assets=await engine.current.call('configure',{models:nextRecords});check();setAssets(assets);engine.current.manifest=next;configured.current=key;setProgress('');}}
 useEffect(()=>{if(!ready||operationLock.current||observed.current===registryKey)return;observed.current=registryKey;void operation(check=>syncRegistry(records.current,check)).catch(()=>{});},[ready,registryKey,busy]);
 const events=(type:string,value:string)=>{if(type==='progress')setProgress(String(value));};
 async function operation<T>(work:(check:()=>void)=>Promise<T>){if(operationLock.current)throw Error('Model busy');const epoch=cancelEpoch.current,check=()=>{if(epoch!==cancelEpoch.current)throw Error('Stopped');};operationLock.current=true;setBusy(true);try{const result=await work(check);check();return result;}catch(e){setProgress((e as Error).message);throw e;}finally{operationLock.current=false;setBusy(false);}}
 async function prepare(model:string,allowNetwork:boolean,localFiles?:File[]){return operation(async check=>{await syncRegistry(records.current,check);check();if(!allowNetwork&&!localFiles)throw Error('Downloads are off');await engine.current.call('prepare',{model,allowNetwork,localFiles,...(records.current.some(m=>m.id===model)?{modelFile:localFiles?.find(f=>f.name.toLowerCase().endsWith('.gguf'))}:{})},events);check();const assets=await engine.current.call('status');check();setAssets(assets);setProgress('Verified');});}
 async function verify(model:string){return operation(async check=>{await syncRegistry(records.current,check);check();await engine.current.call('verify',{model},events);check();const assets=await engine.current.call('status');check();setAssets(assets);setProgress('Verified');});}
 async function importCustom(record:CustomLocalModel,files:File[]){return operation(async check=>{const models=[...records.current.filter(m=>m.id!==record.id),record];await syncRegistry(models,check);check();await engine.current.call('prepare',{model:record.id,allowNetwork:false,modelFile:files.find(f=>f.name.toLowerCase().endsWith('.gguf')),localFiles:files},events);check();const assets=await engine.current.call('status');check();setAssets(assets);setProgress('Verified');});}
 async function load(model:string){return operation(async check=>{await syncRegistry(records.current,check);check();setLoaded('');await engine.current.load(model,events);check();setLoaded(model);setProgress('Loaded');});}
 async function unload(){return operation(async check=>{await initialized.current;check();await engine.current.unload();check();setLoaded('');setProgress('Unloaded');});}
 async function generate(messages:unknown[],maxTokens=256,format?:StructuredFormat){return operation(async check=>{await syncRegistry(records.current,check);check();if(!engine.current?.loaded)throw Error('Model not loaded');cancelled.current=false;setProgress('Generating…');const result=await engine.current.generate(messages,events,maxTokens,format);check();if(cancelled.current)throw Error('Stopped');setProgress('');return result;});}
 async function count(messages:unknown[]){return operation(async check=>{await syncRegistry(records.current,check);check();if(!engine.current?.loaded)throw Error('Model not loaded');const result=await engine.current.call('count',{messages});check();return result;});}
 function stop(){cancelEpoch.current++;cancelled.current=true;engine.current?.abort();setProgress('Stopping…');}

 const port=useRef<TextRuntime>(null!);port.current={get manifest(){return engine.current?.manifest??combinedTextManifest(manifest);},get loaded(){return engine.current?.loaded??'';},assets,load,generate,stop,count};
 const inference=useRef<TextRuntime|null>(null);if(!inference.current)inference.current=createTextInference(()=>port.current);
 return {get manifest(){return engine.current?.manifest??combinedTextManifest(manifest);},busy,progress,get loaded():string{return engine.current?.loaded??'';},assets,prepare,verify,importCustom,unload,pin:inference.current.pin,load:inference.current.load,generate:inference.current.generate,stop:inference.current.stop,count:inference.current.count};
}
