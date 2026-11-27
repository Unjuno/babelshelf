/// <reference lib="webworker" />
import * as ort from 'onnxruntime-web';
import wasmURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm?url';
import mjsURL from '../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.mjs?url';

ort.env.wasm.wasmPaths={wasm:wasmURL,mjs:mjsURL};
ort.env.wasm.proxy=false;
ort.env.logLevel='error';

self.onmessage=async({data})=>{
 let session:ort.InferenceSession|undefined;
 try{
  session=await ort.InferenceSession.create(new Uint8Array(data.model),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  const result=await session.run({});
  const output=result.output;
  if(output.type!=='float32'||output.dims.join(',')!=='1,16')throw Error('GatherBlockQuantized probe output shape/type mismatch');
  self.postMessage({id:data.id,result:{backend:'wasm',shape:output.dims,values:Array.from(output.data as Float32Array)}});
  Object.values(result).forEach(tensor=>tensor.dispose());
 }catch(error){self.postMessage({id:data.id,error:error instanceof Error?error.message:String(error)});}
 finally{await session?.release();}
};
