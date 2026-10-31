/** Prefer an available GPU on every device, with typed CPU/WASM fallback when
 * WebGPU is unavailable or the pinned runtime cannot load the model there.
 * User-agent labels are not capability or memory measurements and must not
 * block an otherwise registered local route.
 */
export function textBackendPolicy(): 'auto' {
 return 'auto';
}
