// QA only: link the frozen CPU archives, exercise their registered type traits.
// Does not implement substitute quantization kernels or load a language model.
#include "ggml.h"
#include "ggml-cpu.h"
#include <stddef.h>
#include <string.h>
#ifdef __cplusplus
extern "C" {
#endif

int probe_init(void) {
    struct ggml_context * ctx = ggml_init((struct ggml_init_params){0, NULL, true});
    if (!ctx) return 0;
    ggml_free(ctx);
    ggml_cpu_init();
    const struct ggml_type_traits_cpu * cpu = ggml_get_type_traits_cpu(GGML_TYPE_Q2_0);
    return ggml_blck_size(GGML_TYPE_Q2_0) == 64 && ggml_type_size(GGML_TYPE_Q2_0) == 18
        && ggml_get_type_traits(GGML_TYPE_Q2_0)->to_float != NULL
        && cpu->vec_dot != NULL && cpu->vec_dot_type == GGML_TYPE_Q8_0;
}
int probe_dequant(const void * weights, float * output, int n) {
    if (n < 64 || n > 131072 || n % 64) return 0;
    ggml_get_type_traits(GGML_TYPE_Q2_0)->to_float(weights, output, n);
    return 1;
}
int probe_dot(const void * weights, const void * activations, float * output, int n) {
    if (n < 64 || n > 131072 || n % 64) return 0;
    ggml_get_type_traits_cpu(GGML_TYPE_Q2_0)->vec_dot(n, output, 0, weights, 0, activations, 0, 1);
    return 1;
}
int probe_matmul(const void * weights, const float * input, float * output, int k, int rows, int columns) {
    if (k < 64 || k > 12288 || k % 64 || rows < 1 || rows > 8 || columns < 1 || columns > 4) return 0;
    struct ggml_context * ctx = ggml_init((struct ggml_init_params){8*1024*1024, NULL, false});
    if (!ctx) return 0;
    struct ggml_tensor * a = ggml_new_tensor_2d(ctx, GGML_TYPE_Q2_0, k, rows);
    struct ggml_tensor * b = ggml_new_tensor_2d(ctx, GGML_TYPE_F32, k, columns);
    memcpy(a->data, weights, ggml_nbytes(a));
    memcpy(b->data, input, ggml_nbytes(b));
    struct ggml_tensor * c = ggml_mul_mat(ctx, a, b);
    struct ggml_cgraph * graph = ggml_new_graph(ctx);
    ggml_build_forward_expand(graph, c);
    const enum ggml_status status = ggml_graph_compute_with_ctx(ctx, graph, 1);
    if (status == GGML_STATUS_SUCCESS) memcpy(output, c->data, ggml_nbytes(c));
    ggml_free(ctx);
    return status == GGML_STATUS_SUCCESS;
}
#ifdef __cplusplus
}
#endif
