import {readDeviceStorage,type StoragePort} from './device-storage.ts';
import {textModelFileSize} from './model-catalog-status.ts';
import {textExecutionRoute} from './text-execution-route.ts';
import {requestAdapterWithFallback} from './webgpu-preference.ts';
import {textBackendPolicy} from './text-device-policy.ts';
import type {CustomLocalModel} from './preference-records.ts';

type GpuPort={requestAdapter:(options?:{powerPreference?:'low-power'|'high-performance'})=>Promise<unknown>};
export type TextDeviceCheck={modelId:string;modelBytes:number|null;availableBytes:number|null;storage:'already-present'|'below-file-size'|'estimate-covers-file'|'unknown';backend:'webgpu'|'cpu-wasm';fallbackBackend?:'cpu-wasm';webgpu:'available'|'unavailable'|'unknown'|'not-needed'};

export function describeTextDeviceCheck(check:TextDeviceCheck):string {
 const storage=check.storage==='below-file-size'?'Storage estimate is below model file size':check.storage==='estimate-covers-file'?'Storage estimate covers model file':check.storage==='already-present'?'Model files already present':'Storage estimate unavailable';
 const runtime=check.backend==='webgpu'?(check.webgpu==='available'?'GPU found · model fit not checked':check.webgpu==='unavailable'?'GPU unavailable':'GPU check incomplete'):'CPU path';
 const fallback=check.fallbackBackend==='cpu-wasm'?' · CPU fallback may be tried':'';
 return `${storage} · ${runtime}${fallback} · Model load not tested`;
}

// A user-initiated, read-only preflight. Quota is not physical free space and
// an adapter is not proof of enough GPU memory, model loading or generation.
export async function checkTextDevice(modelId:string,customModels:readonly CustomLocalModel[]=[],filesPresent=false,ports:{storage?:StoragePort;gpu?:GpuPort;device?:Parameters<typeof textBackendPolicy>[0]}={}):Promise<TextDeviceCheck>{
 const route=textExecutionRoute(modelId,customModels);if(!route)throw Error('Selected text engine route unavailable');
 const modelBytes=textModelFileSize(modelId,customModels);
 if(modelBytes===null)throw Error('Selected model size unavailable');
 const backend=route.backend;
 const gpu=ports.gpu??(globalThis.navigator as Navigator&{gpu?:GpuPort}|undefined)?.gpu;
 const [space,webgpu]=await Promise.all([
  readDeviceStorage(ports.storage),
  backend==='cpu-wasm'?Promise.resolve('not-needed' as const):gpu?.requestAdapter?adapterStatus(gpu):Promise.resolve('unavailable' as const),
 ]);
 const availableBytes=space.available;
 const storage=filesPresent?'already-present':availableBytes===null?'unknown':availableBytes<modelBytes?'below-file-size':'estimate-covers-file';
 const fallbackAllowed=route.fallbackBackend==='cpu-wasm'&&textBackendPolicy(ports.device)==='auto';
 return {modelId,modelBytes,availableBytes,storage,backend,...(fallbackAllowed?{fallbackBackend:'cpu-wasm' as const}:{}),webgpu};
}

async function adapterStatus(gpu:GpuPort):Promise<'available'|'unavailable'|'unknown'>{
 let timer:ReturnType<typeof setTimeout>|undefined;const controller=new AbortController();
 try{
  const result=await Promise.race([requestAdapterWithFallback(gpu,undefined,controller.signal).then((adapter:unknown)=>adapter?'available' as const:'unavailable' as const),new Promise<'unknown'>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve('unknown');},8000);})]);
  return result;
 }catch{return 'unknown';}finally{controller.abort();if(timer)clearTimeout(timer);}
}
