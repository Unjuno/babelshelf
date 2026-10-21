import '../../design/prototype/src/fast-hash.ts';
import {createQwen3TextBackend} from '../../design/prototype/src/qwen3-text-backend.ts';
import {describeQwen3Text} from '../../design/prototype/src/qwen3-text-manifest.ts';
import {TextEngineRouter} from '../../design/prototype/src/text-engine-router.ts';
import {createTextInference} from '../../design/prototype/src/text-inference.ts';
// @ts-expect-error Canonical strict intake is shared JavaScript.
import {inspectLocalModel} from '../../dist/local-models.js';
// @ts-expect-error Canonical worker controller is shared JavaScript.
import {Engine} from '../../dist/engine.js';
import baseManifest from '../../dist/model-manifest.json' with {type:'json'};
export async function checkQwen3Product(file:File,workerUrl:string,baseWorkerUrl:string,notify:(data:any)=>void){
 const record=await inspectLocalModel(file);if(record.engine!=='wllama-qwen3')throw Error('Unexpected intake engine');
 // Same real base status owner as the app; no base model is loaded or prepared.
 const base=new Engine(baseManifest,()=>{},new Worker(baseWorkerUrl,{type:'module'}));await base.init();
 let constructions=0;const router=new TextEngineRouter(base,()=>{throw Error('ONNX must stay idle');},[{id:'qwen3-text',modelIds:[],describe:()=>describeQwen3Text(),create:()=>{throw Error('Empty registry must stay idle');}}]);
 router.replaceRegistration('qwen3-text',{id:'qwen3-text',modelIds:[record.id],describe:()=>describeQwen3Text([record]),create:()=>{constructions++;return createQwen3TextBackend(()=>new Worker(workerUrl,{type:'module'}),[record]);}});
 const result:any={scope:'Actual built product Qwen3 Worker, strict intake/preparation/router/count/generation/Stop/reload; no knowledge or settings write',record,constructions,cases:[],passed:false};
 const port=createTextInference(()=>({get manifest(){return router.manifest;},get loaded(){return router.loaded??'';},assets:{[record.id]:{filesPresent:true}},load:async id=>{await router.load(id,(type:any,value:any)=>notify({phase:type,value}));},stop:()=>router.abort(),count:(messages,format)=>router.call('count',{messages,format}),generate:(messages,maxTokens,format)=>router.generate(messages,(type:any,value:any)=>notify({phase:type,value}),maxTokens,format)}));
 try{
  notify({phase:'Preparing verified local file'});await router.call('prepare',{model:record.id,allowNetwork:false,localFiles:[file]});result.prepared=await router.call('status',{model:record.id});
  let started=performance.now();await port.load(record.id);result.loadMs=performance.now()-started;notify(result);
  const messages=[{role:'system',content:'Return only a JSON object with an answer string.'},{role:'user',content:'What is 6 plus 7?'}];
  const run=async(name:string)=>{const before=await port.count(messages,'dialogue-answer'),timer=performance.now(),output=await port.generate(messages,48,'dialogue-answer'),after=await port.count(messages,'dialogue-answer');let answer;try{answer=JSON.parse(output.text);}catch{}const entry={name,count:before.prompt_tokens,countAfter:after.prompt_tokens,output,elapsedMs:performance.now()-timer,passed:before.prompt_tokens===after.prompt_tokens&&answer&&Object.keys(answer).join(',')==='answer'&&answer.answer==='13'};result.cases.push(entry);notify(result);};
  await run('Structured answer');
  let requested=false;try{await router.generate([{role:'user',content:'Count from 1 to 100, one number per line.'}],(type:any,value:any)=>{if(type==='progress'&&value==='Generating'&&!requested){requested=true;port.stop();}},128,'prose');result.stop={requested,stopped:false};}catch(error:any){result.stop={requested,stopped:requested&&error.message==='Stopped',error:error.message};}
  started=performance.now();await port.load(record.id);result.reloadMs=performance.now()-started;await run('Fresh Worker after Stop');result.constructions=constructions;result.passed=result.cases.every((c:any)=>c.passed)&&result.stop.stopped&&constructions===2;
 }catch(error:any){result.error=error.stack??error.message;}
 finally{try{await router.unload();}catch(error:any){result.cleanupError=error.message;}router.abort();router.worker.terminate();notify(result);}
 return result;
}
