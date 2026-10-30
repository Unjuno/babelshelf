type AdapterOptions={powerPreference?:'low-power'|'high-performance';[key:string]:unknown};
type GpuRequester={requestAdapter:(options?:AdapterOptions)=>Promise<unknown>};

/** Apply the model worker's preference to the runtime's own adapter requests.
 * Existing explicit choices stay intact; the browser may still ignore this hint.
 */
export function preferHighPerformanceAdapterRequests(gpu:GpuRequester|undefined):boolean{
 if(!gpu||typeof gpu.requestAdapter!=='function')return false;
 const original=gpu.requestAdapter;
 const wrapped=function(this:GpuRequester,options?:AdapterOptions){
  const requested=options?.powerPreference;
  const next={...options,...(requested===undefined?{powerPreference:'high-performance' as const}:{})};
  return Reflect.apply(original,this,[next]);
 };
 try{
  Object.defineProperty(gpu,'requestAdapter',{configurable:true,writable:true,value:wrapped});
  return gpu.requestAdapter===wrapped;
 }catch{return false;}
}
