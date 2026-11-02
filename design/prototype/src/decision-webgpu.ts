import {requestAdapterWithFallback} from './webgpu-preference.ts';

type DecisionGpuPort={requestAdapter:(options?:{powerPreference?:'low-power'|'high-performance'})=>Promise<unknown|null>};
export type DecisionGpuProbe='available'|'unavailable'|'timed-out';

/** Bounded capability hint. It never claims that ONNX created a GPU session. */
export async function probeDecisionWebGPU(gpu:DecisionGpuPort|null|undefined,timeoutMs=8000,signal?:AbortSignal):Promise<DecisionGpuProbe>{
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Invalid WebGPU check timeout');
 if(signal?.aborted)throw Error('Stopped');
 if(!gpu)return 'unavailable';
 let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
 try{
  const timeout=Symbol('timeout'),stopped=Symbol('stopped');
  const result=await Promise.race([
   Promise.resolve().then(()=>requestAdapterWithFallback(gpu,undefined,signal)).then(adapter=>adapter?'available' as const:'unavailable' as const,()=> 'unavailable' as const),
   new Promise<typeof timeout>(resolve=>{timer=setTimeout(()=>resolve(timeout),timeoutMs);}),
   ...(signal?[new Promise<typeof stopped>(resolve=>{abort=()=>resolve(stopped);signal.addEventListener('abort',abort,{once:true});})]:[]),
  ]);
  if(result===stopped)throw Error('Stopped');
  if(result===timeout)return 'timed-out';
  return result;
 }finally{
  if(timer!==undefined)clearTimeout(timer);
  if(signal)signal.removeEventListener('abort',abort);
 }
}
