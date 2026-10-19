import {readDeviceStorage,type StoragePort} from './device-storage.ts';
import {textModelFileSize} from './model-catalog-status.ts';
import type {CustomLocalModel} from './preference-records.ts';

type GpuPort={requestAdapter:()=>Promise<unknown>};
export type TextDeviceCheck={modelId:string;modelBytes:number|null;availableBytes:number|null;storage:'already-present'|'below-file-size'|'estimate-covers-file'|'unknown';backend:'webgpu'|'cpu-wasm';webgpu:'available'|'unavailable'|'unknown'|'not-needed'};

export function describeTextDeviceCheck(check:TextDeviceCheck):string {
 const storage=check.storage==='below-file-size'?'Reported storage below model file size':check.storage==='estimate-covers-file'?'Storage estimate covers model file':check.storage==='already-present'?'Model files already present':'Storage estimate unavailable';
 const runtime=check.backend==='webgpu'?(check.webgpu==='available'?'WebGPU adapter detected':check.webgpu==='unavailable'?'WebGPU adapter unavailable':'WebGPU check inconclusive'):'CPU/WASM path';
 return `${storage} · ${runtime} · Loading and generation untested`;
}

// A user-initiated, read-only preflight. Quota is not physical free space and
// an adapter is not proof of enough GPU memory, model loading or generation.
export async function checkTextDevice(modelId:string,customModels:readonly CustomLocalModel[]=[],filesPresent=false,ports:{storage?:StoragePort;gpu?:GpuPort}={}):Promise<TextDeviceCheck>{
 const modelBytes=textModelFileSize(modelId,customModels);
 if(modelBytes===null)throw Error('Selected model size unavailable');
 const backend=['2B','4B','9B'].includes(modelId)||customModels.some(model=>model.id===modelId&&model.engine==='webml-qwen35')?'webgpu':'cpu-wasm';
 const gpu=ports.gpu??(globalThis.navigator as Navigator&{gpu?:GpuPort}|undefined)?.gpu;
 const [space,webgpu]=await Promise.all([
  readDeviceStorage(ports.storage),
  backend==='cpu-wasm'?Promise.resolve('not-needed' as const):gpu?.requestAdapter?adapterStatus(gpu):Promise.resolve('unavailable' as const),
 ]);
 const availableBytes=space.available;
 const storage=filesPresent?'already-present':availableBytes===null?'unknown':availableBytes<modelBytes?'below-file-size':'estimate-covers-file';
 return {modelId,modelBytes,availableBytes,storage,backend,webgpu};
}

async function adapterStatus(gpu:GpuPort):Promise<'available'|'unavailable'|'unknown'>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const result=await Promise.race([gpu.requestAdapter().then(adapter=>adapter?'available' as const:'unavailable' as const),new Promise<'unknown'>(resolve=>{timer=setTimeout(()=>resolve('unknown'),8000);})]);
  return result;
 }catch{return 'unknown';}finally{if(timer)clearTimeout(timer);}
}
