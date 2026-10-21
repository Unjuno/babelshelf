/// <reference lib="webworker" />
import './fast-hash';
// @ts-expect-error App-owned pinned generated runtime.
import {Wllama} from '../runtime/wllama-count/index.js';
import wasm from '../runtime/wllama-count/default.wasm?url';
import compatWasm from '../runtime/wllama-count/compat.wasm?url';
import compatCode from '../runtime/wllama-count/compat.js?raw';
// @ts-expect-error Shared prepared-file CPU adapter.
import {Qwen3Adapter} from '../../../dist/qwen3-adapter.js';
// @ts-expect-error Shared strict declarative validation.
import {validateLocalModel} from '../../../dist/local-models.js';
import {describeQwen3Text} from './qwen3-text-manifest.ts';
import type {CustomLocalModel} from './preference-records.ts';
import {createLfmTextRuntime as createPreparedGgufTextRuntime} from './lfm-text-runtime.ts';
import {createTextWorkerHost} from './text-worker-host.ts';
import {ownChildWorkers} from './owned-workers.ts';
const owned=ownChildWorkers(self as unknown as {Worker:typeof Worker}),networkFetch=globalThis.fetch.bind(globalThis),allowed=new Set([wasm,compatWasm].map(url=>new URL(url,location.href).href));
globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).href;return allowed.has(url)?networkFetch(input,options):Promise.reject(Error('Network disabled for text inference'));};
self.onmessage=createTextWorkerHost(async(progress,configuration)=>{
 const supplied=configuration?.customModels??[];if(!Array.isArray(supplied)||!supplied.length||supplied.length>64)throw Error('Invalid Qwen3 model registry');
 const custom=supplied.map((value:unknown)=>validateLocalModel(value)) as CustomLocalModel[];if(custom.some(m=>m.engine!=='wllama-qwen3'))throw Error('Unexpected Qwen3 model registry');const manifest=describeQwen3Text(custom);
 const readFile=async(id:string)=>{const model=manifest.models.find(m=>m.id===id);if(!model)throw Error('Unknown Qwen3 model');const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-qwen3-v1');return (await dir.getFileHandle(model.file.sha256)).getFile();};
 const assets:Record<string,{filesPresent:boolean}>={};for(const model of manifest.models){let present=false;try{present=(await readFile(model.id)).size===model.file.bytes;}catch{}assets[model.id]={filesPresent:present};}
 const adapter=new Qwen3Adapter({Wllama,paths:{default:wasm},compat:{wasm:compatWasm,worker:{code:compatCode}},models:manifest.models,maxReplyTokens:768,onProgress:progress});
 return createPreparedGgufTextRuntime({adapter,manifest,readFile,readAssets:()=>assets});
},message=>self.postMessage(message),owned.dispose);
