/// <reference lib="webworker" />
import {AutoModel,AutoTokenizer,env} from '@huggingface/transformers';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url';
import {configureLocalTransformerRuntime} from './transformers-runtime';
import {createPinnedAssetStore} from './pinned-text-assets';
import {semanticEmbeddingManifest as manifest,validateSemanticEmbeddingConfig} from './semantic-embedding-manifest';
import {withTensorResources} from './tensor-resources';

const networkFetch=globalThis.fetch.bind(globalThis),runtimeURLs=new Set([wasmURL,mjsURL].map(url=>new URL(url,location.href).href));
globalThis.fetch=(input,options)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).href;
 return runtimeURLs.has(url)?networkFetch(input,options):Promise.reject(Error('Network disabled for embedding inference'));
};
const store=createPinnedAssetStore(manifest,{directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-semantic-assets-v1',{create:true}),fetch:networkFetch});
let controller:AbortController|undefined,busy=false,model:any=null,tokenizer:any=null;
let reportProgress:(value:string)=>void=()=>{};
const check=()=>controller!.signal.throwIfAborted();
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath='/semantic-model/';
env.useBrowserCache=false;env.useFSCache=false;env.useCustomCache=true;
env.customCache={
 async match(path:any){
  const requested=String(path),pin=manifest.files.find(file=>requested.replaceAll('\\','/').endsWith('/'+file.path)||requested==='/'+file.path);
  if(!pin)return new Response('Unknown embedding asset',{status:404});
  try{return new Response(await store.read(pin.path,controller!.signal,(done,total)=>reportProgress('Verifying '+pin.path+' · '+Math.floor(done/total*100)+'%')));}
  catch{check();return new Response('Embedding asset unavailable',{status:404});}
 },
 async put(){throw Error('Use explicit embedding preparation');}
};
configureLocalTransformerRuntime(env,wasmURL,mjsURL);

function checkedTexts(value:unknown){
 if(!Array.isArray(value)||value.length<1||value.length>8||value.some(text=>typeof text!=='string'||!text.trim()||text.length>8000))throw Error('Embedding batch must contain 1–8 short texts');
 return value as string[];
}
async function embed(value:unknown){
 if(!model||!tokenizer)throw Error('Embedding model not loaded');
 const texts=checkedTexts(value),inputs=tokenizer(texts,{padding:true,truncation:true,max_length:512});
 return withTensorResources(async own=>{
  for(const tensor of Object.values(inputs))own(tensor);
  const outputs=await model(inputs),hidden=own(outputs.last_hidden_state??outputs.token_embeddings);
  if(!hidden||hidden.dims?.length!==3||hidden.dims[0]!==texts.length||hidden.dims[2]!==manifest.dimensions)throw Error('Embedding output shape mismatch');
  const pooled=own(hidden.slice(null,0)),normalized=own(pooled.normalize(2,-1)),rows=normalized.tolist();
  if(!Array.isArray(rows)||rows.length!==texts.length||rows.some(row=>!Array.isArray(row)||row.length!==manifest.dimensions||row.some(value=>!Number.isFinite(value))))throw Error('Invalid embedding output');
  check();return rows.map(row=>Float32Array.from(row));
 });
}

self.onmessage=async({data})=>{
 if(data?.cmd==='abort'){controller?.abort(Error('Stopped'));return;}
 if(busy){self.postMessage({id:data?.id,type:'error',value:'Embedding worker busy'});return;}
 busy=true;const active=controller=new AbortController(),progress=(value:string)=>self.postMessage({id:data.id,type:'progress',value});
 reportProgress=progress;
 try{
  const args=data.args??{};let value:unknown;
  if(data.cmd==='status')value=await store.status(active.signal);
  else if(data.cmd==='verify'){
   progress('Verifying embedding files');
   for(const file of manifest.files){check();progress('Verifying '+file.path);await store.read(file.path,active.signal,(done,total)=>progress('Verifying '+file.path+' · '+Math.floor(done/total*100)+'%'));}
   value=true;
  }else if(data.cmd==='prepare'){
   const result=await store.prepare(args.allowNetwork===true,active.signal,(done,total)=>progress('Preparing embedding files · '+Math.floor(done/total*100)+'%'),args.localFiles??[]);value=result;
  }else if(data.cmd==='load'){
   if(model)throw Error('Embedding model already loaded');
   progress('Verifying embedding model');
   validateSemanticEmbeddingConfig(JSON.parse(await(await store.read('config.json',active.signal)).text()));
   progress('Loading embedding model · WASM');
   tokenizer=await AutoTokenizer.from_pretrained(manifest.repository,{local_files_only:true,revision:manifest.revision});check();
   try{model=await AutoModel.from_pretrained(manifest.repository,{local_files_only:true,revision:manifest.revision,device:manifest.device,dtype:manifest.dtype});check();value={model:manifest.id,dimensions:manifest.dimensions,device:manifest.device};}
   catch(error){tokenizer=null;throw error;}
  }else if(data.cmd==='embed')value=await embed(args.texts);
  else if(data.cmd==='unload'){
   const old=model;model=null;tokenizer=null;if(old)await old.dispose();value=true;
  }else throw Error('Unknown embedding operation');
  check();self.postMessage({id:data.id,type:'done',value});
 }catch(error){self.postMessage({id:data?.id,type:'error',value:active.signal.aborted?'Stopped':error instanceof Error?error.message:'Embedding operation failed'});}
 finally{if(controller===active)controller=undefined;reportProgress=()=>{};busy=false;}
};
