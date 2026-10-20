import type {env} from '@huggingface/transformers';

// Model caches contain only model files and intentionally return terminal
// misses. Transformers 4 also consults that cache for its WASM factory unless
// disabled, which can turn a model-cache 404 body into executable JavaScript.
// The app Service Worker owns the verified, bundled runtime URLs instead.
export function configureLocalTransformerRuntime(runtime:typeof env,wasm:string,mjs:string){
 runtime.useWasmCache=false;
 runtime.backends.onnx.wasm!.wasmPaths={wasm,mjs};
 runtime.backends.onnx.wasm!.numThreads=1;
 runtime.backends.onnx.wasm!.proxy=false;
}
