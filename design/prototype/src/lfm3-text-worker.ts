/// <reference lib="webworker" />
// @ts-expect-error App-owned, hash-pinned LFM3-compatible runtime build.
import {Wllama} from '../runtime/wllama-lfm3/index.js';
import wasm from '../runtime/wllama-lfm3/lfm3-wllama.wasm?url';
import compatWasm from '../runtime/wllama-lfm3/lfm3-compat.wasm?url';
import compatCode from '../runtime/wllama-lfm3/compat.js?raw';
// @ts-expect-error Shared prepared-file adapter.
import {Lfm3Adapter} from '../../../dist/lfm-adapter.js';
// @ts-expect-error Shared strict GGUF record validator.
import {validateLocalModel} from '../../../dist/local-models.js';
import {describeLfm3Text,lfm3TextModels} from './lfm3-text-manifest.ts';
import {createRecentPreparedFileReader} from './prepared-file-snapshot.ts';
import {createLfmTextRuntime} from './lfm-text-runtime.ts';
import {createTextWorkerHost} from './text-worker-host.ts';
import {ownChildWorkers} from './owned-workers.ts';
import {preferHighPerformanceAdapterRequests} from './webgpu-preference.ts';
import {currentDeviceSignals,textBackendPolicy} from './text-device-policy.ts';

const owned=ownChildWorkers(self as unknown as {Worker:typeof Worker});
// Wllama/Emdawn asks navigator.gpu.requestAdapter directly. A separate
// preflight request does not configure that later runtime-owned request.
preferHighPerformanceAdapterRequests((globalThis.navigator as Navigator&{gpu?:{requestAdapter:(options?:{powerPreference?:'low-power'|'high-performance'})=>Promise<unknown>}}|undefined)?.gpu);
const networkFetch=globalThis.fetch.bind(globalThis);
const allowed=new Set([wasm,compatWasm].map(url=>new URL(url,location.href).href));
globalThis.fetch=(input,options)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).href;
 return allowed.has(url)?networkFetch(input,options):Promise.reject(Error('Network disabled for LFM3 inference'));
};
self.onmessage=createTextWorkerHost(async(progress,configuration)=>{
 const supplied=configuration?.customModels??[];
 if(!Array.isArray(supplied)||supplied.length>64)throw Error('Invalid LFM3 model registry');
 const custom=supplied.map((value:unknown)=>validateLocalModel(value));
 if(custom.some((model:any)=>model.engine!=='wllama-lfm3'))throw Error('Unexpected LFM3 model registry');
 const pinnedContextTokens=configuration?.pinnedContextTokens??8192;
 const manifest=describeLfm3Text(custom,'',pinnedContextTokens),byId=new Map(manifest.models.map((model:any)=>[model.id,model]));
 const readFile=createRecentPreparedFileReader(async(id:string)=>{
  const model=byId.get(id) as any;if(!model)throw Error('Unknown LFM3 model');
  const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm3-v1');
  return(await dir.getFileHandle(model.file.sha256)).getFile();
 },id=>(byId.get(id) as any)?.file.sha256??'',id=>(byId.get(id) as any)?.file.bytes??0);
 const assets:Record<string,{filesPresent:boolean}>={};
 for(const model of manifest.models){let present=false;try{present=(await readFile(model.id)).size===model.file.bytes;}catch{/* missing is not ready */}assets[model.id]={filesPresent:present};}
 const adapter=new Lfm3Adapter({Wllama,paths:{default:wasm},compat:{wasm:compatWasm,worker:{code:compatCode}},models:manifest.models,maxReplyTokens:3072,reusePrompt:true,onProgress:progress});
 return createLfmTextRuntime({adapter,manifest,readFile,readAssets:()=>assets,backend:textBackendPolicy(currentDeviceSignals())});
},message=>self.postMessage(message),owned.dispose);
