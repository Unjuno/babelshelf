import type {env} from '@huggingface/transformers';
import {preferHighPerformanceAdapterRequests} from './webgpu-preference.ts';

// Model caches contain only model files and intentionally return terminal
// misses. Transformers 4 also consults that cache for its WASM factory unless
// disabled, which can turn a model-cache 404 body into executable JavaScript.
// The app Service Worker owns the verified, bundled runtime URLs instead.
export function configureLocalTransformerRuntime(runtime:typeof env,wasm:string,mjs:string){
 runtime.useWasmCache=false;
 preferHighPerformanceAdapterRequests((globalThis.navigator as Navigator&{gpu?:{requestAdapter:(options?:{powerPreference?:'low-power'|'high-performance'})=>Promise<unknown>}}|undefined)?.gpu);
 // Ask WebGPU-capable browsers for their high-performance adapter across all
 // Transformers.js workers. This is only a preference; the browser/runtime
 // may choose another adapter or fall back to WASM.
 if(runtime.backends.onnx.webgpu)runtime.backends.onnx.webgpu.powerPreference='high-performance';
 runtime.backends.onnx.wasm!.wasmPaths={wasm,mjs};
 // Leave numThreads unset so the pinned ONNX Runtime can use its built-in
 // capability policy: one thread without cross-origin isolation, otherwise
 // up to four based on reported logical cores. Do not infer this from OS names.
 runtime.backends.onnx.wasm!.proxy=false;
}
