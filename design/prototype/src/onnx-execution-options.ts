type OnnxTextManifest={id:string;engine:string;device:string;dtype:string};

/**
 * Keep execution placement an explicit property of an app-owned model
 * manifest. In particular, do not turn a requested WebGPU run into an
 * implicit WASM fallback when the browser cannot create a GPU session.
 */
export function transformerLoadOptions(manifest:OnnxTextManifest){
 if(manifest.engine==='transformers-causal-wasm'&&manifest.device==='wasm'&&manifest.dtype==='q8')return Object.freeze({device:'wasm',dtype:'q8'} as const);
 if(manifest.engine==='transformers-causal-webgpu'&&manifest.device==='webgpu'&&manifest.dtype==='q4f16')return Object.freeze({device:'webgpu',dtype:'q4f16'} as const);
 throw Error('Unsupported ONNX execution profile');
}
