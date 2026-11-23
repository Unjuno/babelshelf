export type DecisionBackend='webgpu'|'wasm';

/** The pinned ONNX Runtime WebGPU MatMulNBits kernel accepts 2-bit and 4-bit
 * weights only. The built-in D1 graph is Q8, so skip a doomed GPU session
 * attempt and use the already verified WASM path directly. */
export function decisionBackendForModel(input:{modelId:string;quantization?:string;webgpuAvailable:boolean}){
 if(input.modelId==='d1-omni-600M'&&input.quantization==='q8')return {backend:'wasm' as const,reason:'D1 Q8 MatMulNBits is unsupported by this WebGPU runtime'};
 return input.webgpuAvailable?{backend:'webgpu' as const}:{backend:'wasm' as const,reason:'WebGPU unavailable'};
}
