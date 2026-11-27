export type DecisionBackend='webgpu'|'wasm';

/** The pinned ONNX Runtime WebGPU backend does not support every ONNX op in
 * eligible D1 graphs. Route known unsupported graphs directly to WASM instead
 * of probing a GPU session that will fail during construction. */
export function decisionBackendForModel(input:{modelId:string;quantization?:string;requiresGatherBlockQuantized?:boolean;webgpuAvailable:boolean}){
 if(input.requiresGatherBlockQuantized)return {backend:'wasm' as const,reason:'GatherBlockQuantized is unsupported by this WebGPU runtime'};
 if(input.modelId==='d1-omni-600M'&&input.quantization==='q8')return {backend:'wasm' as const,reason:'D1 Q8 MatMulNBits is unsupported by this WebGPU runtime'};
 return input.webgpuAvailable?{backend:'webgpu' as const}:{backend:'wasm' as const,reason:'WebGPU unavailable'};
}
