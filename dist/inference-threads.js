// Use the pinned wllama pthread runtime only when the page is cross-origin
// isolated. Otherwise SharedArrayBuffer is unavailable and the runtime falls
// back to one thread anyway.
export function inferenceThreadCount({isolated=globalThis.crossOriginIsolated===true,sharedMemory=typeof SharedArrayBuffer!=='undefined',hardwareConcurrency=globalThis.navigator?.hardwareConcurrency}={}) {
 if(!isolated||!sharedMemory)return 1;
 const cores=Number.isSafeInteger(hardwareConcurrency)&&hardwareConcurrency>0?hardwareConcurrency:2;
 return Math.min(4,Math.max(1,Math.floor(cores/2)));
}
