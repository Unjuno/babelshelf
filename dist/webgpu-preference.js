/** Apply the model worker's preference to the runtime's own adapter requests.
 * Existing explicit choices stay intact; the browser may still ignore this hint.
 */
export function preferHighPerformanceAdapterRequests(gpu){
 if(!gpu||typeof gpu.requestAdapter!=='function')return false;
 const original=gpu.requestAdapter;
 const wrapped=function(options){
  const requested=options?.powerPreference;
  const next={...options,...(requested===undefined?{powerPreference:'high-performance'}:{})};
  return Reflect.apply(original,this,[next]);
 };
 try{
  Object.defineProperty(gpu,'requestAdapter',{configurable:true,writable:true,value:wrapped});
  return gpu.requestAdapter===wrapped;
 }catch{return false;}
}
