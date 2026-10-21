// QA only: actual linked ggml WebGPU allocation, dispatch and readback.
// There is no CPU scheduler or substitute quantization kernel here.
#include "ggml.h"
#include "ggml-alloc.h"
#include "ggml-backend.h"
#include "ggml-webgpu.h"
#include <cstdlib>
#include <cstdint>
#include <cstring>
#include <cstdio>

static ggml_backend_t backend = nullptr;
extern "C" {
uintptr_t probe_alloc(int bytes) { return bytes > 0 && bytes <= 16*1024*1024 ? reinterpret_cast<uintptr_t>(malloc(bytes)) : 0; }
void probe_free(uintptr_t ptr) { free(reinterpret_cast<void *>(ptr)); }
int probe_init() {
    if (backend) return 1;
    backend = ggml_backend_webgpu_init();
    if (backend) printf("probe backend: %s\n", ggml_backend_name(backend));
    return backend != nullptr; // This factory creates only the WebGPU backend.
}
int probe_registry_count() { return static_cast<int>(ggml_backend_reg_dev_count(ggml_backend_webgpu_reg())); }
int probe_shutdown() { if (backend) ggml_backend_free(backend); backend = nullptr; return 1; }

int probe_matmul(uintptr_t w, uintptr_t x, uintptr_t y, int k, int rows, int columns, int batches, int row_offset) {
    if (!backend || k < 64 || k > 14336 || k % 64 || rows < 1 || rows > 8 || columns < 1 || columns > 33 || batches < 1 || batches > 2 || row_offset < 0 || row_offset > 1) return 0;
    auto * ctx = ggml_init({2*1024*1024, nullptr, true});
    if (!ctx) return 0;
    // Padding and views force tensor offsets, quantized row offsets, nontrivial
    // batch strides, and several tensors sharing one backend allocation.
    ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 65);
    auto * parent = ggml_new_tensor_3d(ctx, GGML_TYPE_Q2_0, k, rows+row_offset+1, batches);
    auto * a = ggml_view_3d(ctx, parent, k, rows, batches, parent->nb[1], parent->nb[2], row_offset*parent->nb[1]);
    auto * input_parent = ggml_new_tensor_3d(ctx, GGML_TYPE_F32, k, columns+1, batches);
    auto * b = ggml_view_3d(ctx, input_parent, k, columns, batches, input_parent->nb[1], input_parent->nb[2], input_parent->nb[1]);
    auto * c = ggml_mul_mat(ctx, a, b);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, c);
    if (!ggml_backend_supports_op(backend, c)) { ggml_free(ctx); return -1; }
    auto buffer = ggml_backend_alloc_ctx_tensors(ctx, backend);
    if (!buffer) { ggml_free(ctx); return -2; }
    ggml_backend_tensor_set(parent, reinterpret_cast<void *>(w), 0, ggml_nbytes(parent));
    ggml_backend_tensor_set(input_parent, reinterpret_cast<void *>(x), 0, ggml_nbytes(input_parent));
    const auto status = ggml_backend_graph_compute(backend, graph);
    if (status == GGML_STATUS_SUCCESS) ggml_backend_tensor_get(c, reinterpret_cast<void *>(y), 0, ggml_nbytes(c));
    ggml_backend_buffer_free(buffer);
    ggml_free(ctx);
    return status == GGML_STATUS_SUCCESS ? 1 : -3;
}
int probe_rows(uintptr_t w, uintptr_t ids, uintptr_t y, int k, int rows, int count, int row_offset) {
    if (!backend || k < 64 || k > 14336 || k % 64 || rows < 1 || rows > 8 || count < 1 || count > 8 || row_offset < 0 || row_offset > 1) return 0;
    auto * ctx = ggml_init({2*1024*1024, nullptr, true});
    if (!ctx) return 0;
    ggml_new_tensor_1d(ctx, GGML_TYPE_F32, 65);
    auto * parent = ggml_new_tensor_2d(ctx, GGML_TYPE_Q2_0, k, rows+row_offset+1);
    auto * a = ggml_view_2d(ctx, parent, k, rows, parent->nb[1], row_offset*parent->nb[1]);
    auto * indices = ggml_new_tensor_1d(ctx, GGML_TYPE_I32, count);
    auto * c = ggml_get_rows(ctx, a, indices);
    auto * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, c);
    if (!ggml_backend_supports_op(backend, c)) { ggml_free(ctx); return -1; }
    auto buffer = ggml_backend_alloc_ctx_tensors(ctx, backend);
    if (!buffer) { ggml_free(ctx); return -2; }
    ggml_backend_tensor_set(parent, reinterpret_cast<void *>(w), 0, ggml_nbytes(parent));
    ggml_backend_tensor_set(indices, reinterpret_cast<void *>(ids), 0, ggml_nbytes(indices));
    const auto status = ggml_backend_graph_compute(backend, graph);
    if (status == GGML_STATUS_SUCCESS) ggml_backend_tensor_get(c, reinterpret_cast<void *>(y), 0, ggml_nbytes(c));
    ggml_backend_buffer_free(buffer);
    ggml_free(ctx);
    return status == GGML_STATUS_SUCCESS ? 1 : -3;
}
}
