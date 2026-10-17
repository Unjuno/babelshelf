/// <reference lib="webworker" />
// @ts-expect-error App-owned pinned generated runtime.
import {Wllama} from '../runtime/wllama-count/index.js';
import wasm from '../runtime/wllama-count/default.wasm?url';
import compatWasm from '../runtime/wllama-count/compat.wasm?url';
import compatCode from '../runtime/wllama-count/compat.js?raw';
// @ts-expect-error Shared prepared-file adapter.
import {LfmAdapter} from '../../../dist/lfm-adapter.js';
import {lfmTextModels,describeLfmText} from './lfm-text-manifest.ts';
import {createLfmTextRuntime} from './lfm-text-runtime.ts';
import {createTextWorkerHost} from './text-worker-host.ts';
import {ownChildWorkers} from './owned-workers.ts';
const owned=ownChildWorkers(self as unknown as {Worker:typeof Worker});
// Runtime may read only packaged native resources. Models come from prepared OPFS files.
const networkFetch=globalThis.fetch.bind(globalThis),allowed=new Set([wasm,compatWasm].map(url=>new URL(url,location.href).href));
globalThis.fetch=(input,options)=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href).href;return allowed.has(url)?networkFetch(input,options):Promise.reject(Error('Network disabled for text inference'));};
self.onmessage=createTextWorkerHost(async progress=>{
 const readFile=async(id:string)=>{const model=lfmTextModels.find(m=>m.id===id);if(!model)throw Error('Unknown LFM model');const dir=await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-text-lfm-v1');return (await dir.getFileHandle(model.file.sha256)).getFile();};
 const assets:Record<string,{filesPresent:boolean}>={};for(const model of lfmTextModels){let present=false;try{present=(await readFile(model.id)).size===model.file.bytes;}catch{/* absence is not preparation */}assets[model.id]={filesPresent:present};}
 const adapter=new LfmAdapter({Wllama,paths:{default:wasm},compat:{wasm:compatWasm,worker:{code:compatCode}},models:lfmTextModels,maxReplyTokens:768,onProgress:progress});
 return createLfmTextRuntime({adapter,manifest:describeLfmText(),readFile,readAssets:()=>assets});
},message=>self.postMessage(message),owned.dispose);
