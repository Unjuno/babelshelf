/** Ask for discrete/high-throughput GPU first, then retry default selection if
 * that hint yields no adapter. This preserves GPU use on integrated-only and
 * browser-specific implementations without selecting a device by user-agent.
 */
export function requestAdapterWithFallback(gpu,options,signal){
 if(!gpu||typeof gpu.requestAdapter!=='function')return Promise.resolve(null);
 if(signal?.aborted)return Promise.reject(Error('Stopped'));
 const original=gpu.requestAdapter,requested=options?.powerPreference;
 const next={...options,...(requested===undefined?{powerPreference:'high-performance'}:{})};
 const mayRetry=requested===undefined||requested==='high-performance';
 const fallback={...options};delete fallback.powerPreference;
 return Promise.resolve().then(()=>Reflect.apply(original,gpu,[next])).then(adapter=>{
  if(adapter||!mayRetry)return adapter;
  if(signal?.aborted)throw Error('Stopped');
  return Reflect.apply(original,gpu,[fallback]);
 },error=>{
  if(!mayRetry||signal?.aborted)throw signal?.aborted?Error('Stopped'):error;
  return Promise.resolve().then(()=>Reflect.apply(original,gpu,[fallback])).catch(()=>{throw error;});
 });
}

/** Apply the model worker's preference to the runtime's own adapter requests.
 * Explicit low-power requests stay intact; unsupported performance hints retry
 * using the browser's ordinary adapter selection.
 */
export function preferHighPerformanceAdapterRequests(gpu){
 if(!gpu||typeof gpu.requestAdapter!=='function')return false;
 const original=gpu.requestAdapter;
 const wrapped=function(options){
  return requestAdapterWithFallback({requestAdapter:original.bind(this)},options);
 };
 try{
  Object.defineProperty(gpu,'requestAdapter',{configurable:true,writable:true,value:wrapped});
  return gpu.requestAdapter===wrapped;
 }catch{return false;}
}
