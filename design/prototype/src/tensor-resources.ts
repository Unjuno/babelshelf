/** Own only request-created tensors, never model weights or runtime caches. */
export async function withTensorResources<T>(work:(own:<V>(value:V)=>V)=>Promise<T>):Promise<T>{
 const resources=new Set<{dispose:()=>unknown}>();
 const own=<V>(value:V):V=>{if(value&&typeof (value as any).dispose==='function')resources.add(value as any);return value;};
 let failed=false;
 try{return await work(own);}catch(error){failed=true;throw error;}
 finally{
  let cleanupFailed=false,cleanupError:unknown;
  for(const resource of resources){try{await resource.dispose();}catch(error){if(!cleanupFailed){cleanupFailed=true;cleanupError=error;}}}
  resources.clear();
  // Preserve the original inference/Stop error; still attempt every release.
  if(!failed&&cleanupFailed)throw cleanupError;
 }
}
