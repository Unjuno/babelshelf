/** Prefer an available GPU on every device, with the runtime's typed CPU/WASM
 * fallback when WebGPU is unavailable. User-agent labels are not capability or
 * memory measurements and must not block an otherwise registered local route.
 */
export function textBackendPolicy(): 'auto' {
 return 'auto';
}
