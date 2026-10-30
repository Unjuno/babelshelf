export type DecisionBackend='webgpu'|'wasm';

/** Prefer WebGPU, but recover through the already packaged WASM backend when
 * GPU session creation fails. Cancellation stays terminal and is never retried.
 */
export async function createDecisionSession<T>(input:{preferred:DecisionBackend;create:(backend:DecisionBackend)=>Promise<T>;check:()=>void;onFallback:()=>void}){
 if(input.preferred==='wasm')return {session:await input.create('wasm'),device:'wasm' as const,fellBack:false};
 try{return {session:await input.create('webgpu'),device:'webgpu' as const,fellBack:false};}
 catch(error){
  input.check();
  input.onFallback();
  input.check();
  return {session:await input.create('wasm'),device:'wasm' as const,fellBack:true};
 }
}
