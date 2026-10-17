import bridgeURL from '../.ocr-runtime/bridge.bin?url&no-inline';
import workerURL from '../.ocr-runtime/worker.bin?url';
import basicURL from '../.ocr-runtime/lstm.bin?url';
import simdURL from '../.ocr-runtime/simd-lstm.bin?url';
import relaxedURL from '../.ocr-runtime/relaxedsimd-lstm.bin?url';
import {simd,relaxedSimd} from 'wasm-feature-detect';
import {ocrManifest,readOcrData,verifyOcrBytes,type OcrLanguage} from './ocr-assets.ts';
import {makeOcrText,ocrRegions} from './ocr-text.ts';
import {rasterizeImage} from './ocr-raster.ts';
import type {OriginalAsset} from './original-assets.ts';
const runtimeURLs:{[id:string]:string}={worker:workerURL,lstm:basicURL,'simd-lstm':simdURL,'relaxedsimd-lstm':relaxedURL};
async function runtimeBlob(id:string,signal:AbortSignal){const file=ocrManifest.runtime.files.find(f=>f.id===id)!;const url=new URL(runtimeURLs[id],location.href);if(url.origin!==location.origin)throw Error('OCR runtime not local');const response=await fetch(url.href,{signal,credentials:'same-origin'});if(!response.ok)throw Error('OCR runtime unavailable · update app');const bytes=verifyOcrBytes(file,new Uint8Array(await response.arrayBuffer()));signal.throwIfAborted();return URL.createObjectURL(new Blob([bytes.slice().buffer],{type:'text/javascript'}));}
export async function extractImageText(asset:OriginalAsset,language:OcrLanguage,signal:AbortSignal,progress:(s:string)=>void){
 signal.throwIfAborted();progress('Reading image');const raster=await rasterizeImage(asset,signal),langs=await readOcrData(language);signal.throwIfAborted();const core=await relaxedSimd()?'relaxedsimd-lstm':await simd()?'simd-lstm':'lstm',urls:string[]=[];let worker:Worker|undefined,timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
 try{const runtime=await runtimeBlob('worker',signal);urls.push(runtime);const coreBlob=await runtimeBlob(core,signal);urls.push(coreBlob);const coreURL=coreBlob+'#core.js';signal.throwIfAborted();const bridge=new URL(bridgeURL,location.href);if(bridge.origin!==location.origin)throw Error('OCR bridge not local');const bridgeResponse=await fetch(bridge.href,{signal,credentials:'same-origin'});if(!bridgeResponse.ok)throw Error('OCR runtime unavailable · update app');const bridgeBytes=await bridgeResponse.arrayBuffer();signal.throwIfAborted();const bridgeBlob=URL.createObjectURL(new Blob([bridgeBytes],{type:'text/javascript'}));urls.push(bridgeBlob);worker=new Worker(bridgeBlob);let sequence=0,pending:{resolve:(v:any)=>void;reject:(e:Error)=>void;jobId?:string}|undefined;
  const fail=(message:string)=>{const p=pending;pending=undefined;worker?.terminate();p?.reject(Error(message));};abort=()=>fail('Stopped');signal.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>fail('Image reading timed out'),120000);
  worker.onerror=()=>fail('OCR runtime failed');worker.onmessage=({data})=>{if(data.bootstrap==='ready'&&pending&&!pending.jobId){const p=pending;pending=undefined;p.resolve(null);return;}if(!pending||pending.jobId!==data.jobId)return;if(data.status==='progress'){progress(data.data.status==='recognizing text'?'Reading · '+Math.round(data.data.progress*100)+'%':'Preparing reader');return;}const p=pending;pending=undefined;if(data.status==='resolve')p.resolve(data.data);else p.reject(Error(String(data.data)));};
  await new Promise<void>((resolve,reject)=>{pending={resolve,reject};worker!.postMessage({type:'bootstrap',workerURL:runtime,coreURL});});
  const call=(action:string,payload:any)=>new Promise<any>((resolve,reject)=>{signal.throwIfAborted();const jobId=String(++sequence);pending={resolve,reject,jobId};worker!.postMessage({workerId:'local-ocr',jobId,action,payload});});
  await call('load',{options:{corePath:coreURL,lstmOnly:true,logging:false}});await call('loadLanguage',{langs,options:{cacheMethod:'none',gzip:true}});await call('initialize',{langs:language,oem:1,config:{}});await call('setParameters',{params:{tessedit_pageseg_mode:'3'}});const result=await call('recognize',{image:raster.bytes,options:{},output:{text:true,blocks:true}});signal.throwIfAborted();
  if(typeof result.text!=='string'||!(Array.isArray(result.blocks)||result.blocks===null&&!result.text.trim()))throw Error('Invalid OCR result');return makeOcrText(asset,language,raster.image,result.text,ocrRegions(result.text,result.blocks??[],raster.image.processedWidth,raster.image.processedHeight));
 }finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);worker?.terminate();urls.forEach(url=>URL.revokeObjectURL(url));}
}
