// Upstream declarations name the original package rather than its npm alias.
// Bind the alias to its own pinned common types, leaving speech's version alone.
declare module 'onnxruntime-web-d1/webgpu' {
 export const InferenceSession:typeof import('../node_modules/onnxruntime-web-d1/node_modules/onnxruntime-common/dist/esm/index').InferenceSession;
 export type InferenceSession=import('../node_modules/onnxruntime-web-d1/node_modules/onnxruntime-common/dist/esm/index').InferenceSession;
 export const Tensor:typeof import('../node_modules/onnxruntime-web-d1/node_modules/onnxruntime-common/dist/esm/index').Tensor;
 export type Tensor=import('../node_modules/onnxruntime-web-d1/node_modules/onnxruntime-common/dist/esm/index').Tensor;
 export const env:typeof import('../node_modules/onnxruntime-web-d1/node_modules/onnxruntime-common/dist/esm/index').env;
}
