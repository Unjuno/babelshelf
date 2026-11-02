function unavailable(message,cause){
 const error=Error(message);error.code='webgpu_unavailable';if(cause!==undefined)error.cause=cause;return error;
}

/** Resolve a preferred adapter without letting a browser's pending request hang model setup. */
export async function requestHighPerformanceAdapter(gpu,{timeoutMs=8000,signal}={}){
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('Invalid WebGPU check timeout');
 if(!gpu||typeof gpu.requestAdapter!=='function')throw unavailable('WebGPU unavailable');
 if(signal?.aborted)throw Error('Stopped');
 const timeout=Symbol('timeout'),stopped=Symbol('stopped');let timer,abort;
 try{
  const outcomes=[
   Promise.resolve().then(()=>gpu.requestAdapter({powerPreference:'high-performance'})).then(adapter=>({kind:'adapter',adapter}),error=>({kind:'error',error})),
   new Promise(resolve=>{timer=setTimeout(()=>resolve({kind:timeout}),timeoutMs);}),
  ];
  if(signal)outcomes.push(new Promise(resolve=>{abort=()=>resolve({kind:stopped});signal.addEventListener('abort',abort,{once:true});}));
  const result=await Promise.race(outcomes);
  if(result.kind===timeout)throw unavailable('WebGPU check timed out · retry');
  if(result.kind===stopped||signal?.aborted)throw Error('Stopped');
  if(result.kind==='error')throw unavailable('WebGPU check failed · retry',result.error);
  if(!result.adapter)throw unavailable('WebGPU unavailable');
  return result.adapter;
 }finally{if(timer)clearTimeout(timer);if(abort)signal.removeEventListener('abort',abort);}
}
