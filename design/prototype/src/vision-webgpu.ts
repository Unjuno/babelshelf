type VisionGpuPort={requestAdapter:(options?:{powerPreference?:'low-power'|'high-performance'})=>Promise<unknown|null>};

/** Check this model's required browser capability before acquiring large assets.
 * The worker still checks again at execution time; this is a UX preflight only.
 */
export async function requireVisionWebGPU(gpu:VisionGpuPort|null|undefined,timeoutMs=8000,signal?:AbortSignal):Promise<void>{
 if(!gpu)throw Error('WebGPU is not available in this browser · this image model needs WebGPU');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Invalid WebGPU check timeout');
 if(signal?.aborted)throw Error('Stopped');
 let timer:ReturnType<typeof setTimeout>|undefined,abort:()=>void=()=>{};
 try{
  const timeout=Symbol('timeout'),stopped=Symbol('stopped');
  const adapter=await Promise.race([gpu.requestAdapter({powerPreference:'high-performance'}),new Promise<typeof timeout>(resolve=>{timer=setTimeout(()=>resolve(timeout),timeoutMs);}),...(signal?[new Promise<typeof stopped>(resolve=>{abort=()=>resolve(stopped);signal.addEventListener('abort',abort,{once:true});})]:[])]);
  if(adapter===stopped)throw Error('Stopped');
  if(adapter===timeout)throw Error('WebGPU check timed out · retry');
  if(!adapter)throw Error('No compatible WebGPU adapter is available · this image model needs WebGPU');
 }catch(error){
  if(error instanceof Error&&/Stopped|WebGPU check timed out|needs WebGPU/.test(error.message))throw error;
  throw Error('WebGPU check failed · retry');
 }finally{if(timer!==undefined)clearTimeout(timer);if(signal&&abort)signal.removeEventListener('abort',abort);}
}
