"""Reproducible experimental patch against the frozen MIT llama.cpp source.
Only writes a NEW isolated WebGPU directory; never edits installed runtimes.
"""
import sys, pathlib, shutil, subprocess, difflib, hashlib, json
source, target = map(lambda value: pathlib.Path(value).resolve(), sys.argv[1:3])
pin = '46ca246de9bb1c35269722a6240d37d9dfd79cad'
if subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'], text=True).strip() != pin:
    raise ValueError('Wrong frozen source revision')
relative = pathlib.Path('ggml/src/ggml-webgpu')
subprocess.run(['git','-C',str(source),'diff','--exit-code','HEAD','--',relative.as_posix()], check=True, capture_output=True)
if target.exists() or target.is_relative_to(source): raise ValueError('Use a new directory outside frozen source')
shutil.copytree(source / relative, target)
changes = {}
def edit(name, transform):
    old = (source / relative / name).read_text(encoding='utf8')
    new = transform(old)
    if new == old: raise ValueError('Patch boundary unchanged: '+name)
    (target / name).write_text(new,encoding='utf8',newline='\n')
    changes[name] = (old,new)
def insert_before(text, marker, block):
    if text.count(marker) != 1: raise ValueError('Patch boundary changed: '+marker)
    return text.replace(marker,block+'\n'+marker)
rows = '''#ifdef Q2_0
// Official type42: one FP16 scale and 16 bytes, four consecutive 2-bit
// values per byte. This is not Q2_K or the old Prism group128 packing.
fn copy_elements(src_base: u32, dst_base: u32, offset: u32) {
    let block_byte_base = (src_base + offset) * 18u;
    let d = load_f16_as_f32_at_src(block_byte_base);
    for (var j = 0u; j < 16u; j++) {
        let byte_offset = block_byte_base + 2u + j;
        let bits = (src[byte_offset / 4u] >> ((byte_offset % 4u) * 8u)) & 255u;
        for (var q = 0u; q < 4u; q++) {
            dst[dst_base + offset * 64u + j * 4u + q] =
                (f32((bits >> (2u * q)) & 3u) - 1.0) * d;
        }
    }
}
#endif
'''
edit('wgsl-shaders/get_rows.wgsl',lambda text:insert_before(text,'#ifdef Q4_0',rows))
vector = '''#ifdef MUL_ACC_Q2_0
#define BLOCK_SIZE 64u
#define THREADS_PER_BLOCK 16u
fn accumulate_vec_dot(thread_id: u32, row_base: u32, src0_batch_offset: u32, src1_idx_base: u32) -> array<array<f32, OUTPUTS_PER_WG>, NUM_COLS> {
    var acc: array<array<f32, OUTPUTS_PER_WG>, NUM_COLS>;
    let lane = thread_id % THREADS_PER_BLOCK;
    for (var block = thread_id / THREADS_PER_BLOCK; block < params.k / BLOCK_SIZE; block += WG_SIZE / THREADS_PER_BLOCK) {
        var x: array<array<f32, 4>, NUM_COLS>;
        for (var col = 0u; col < NUM_COLS; col++) {
            for (var q = 0u; q < 4u; q++) {
                x[col][q] = f32(SRC1[src1_idx_base + col * params.stride_11 + block * BLOCK_SIZE + lane * 4u + q]);
            }
        }
        for (var row = 0u; row < OUTPUTS_PER_WG; row++) {
            if (row_base + row < params.m) {
                let base = (src0_batch_offset + (row_base + row) * params.stride_01 + block) * 18u;
                let d = load_f16_as_f32_at_src0(base);
                let offset = base + 2u + lane;
                let bits = (SRC0[offset / 4u] >> ((offset % 4u) * 8u)) & 255u;
                for (var q = 0u; q < 4u; q++) {
                    let w = (f32((bits >> (2u * q)) & 3u) - 1.0) * d;
                    for (var col = 0u; col < NUM_COLS; col++) { acc[col][row] += w * x[col][q]; }
                }
            }
        }
    }
    return acc;
}
#endif
'''
edit('wgsl-shaders/mul_mat_vec_acc.tmpl',lambda text:insert_before(text,'#ifdef MUL_ACC_Q1_0',vector))
tile = '''#ifdef INIT_SRC0_SHMEM_Q2_0
// Tile K can be smaller than a quantization block. Address each global
// element explicitly so K=32 tiles can share an official 64-element block.
fn init_shmem_src0(thread_id: u32, batch_offset: u32, offset_m: u32, k_outer: u32) {
    for (var i = thread_id; i < TILE_SRC0_SHMEM; i += TOTAL_WORKGROUP_SIZE) {
        let row = offset_m + i / TILE_K;
        let k = k_outer + i % TILE_K;
        var value = 0.0;
        if (row < params.m && k < params.k) {
            let base = (batch_offset + row * params.stride_01 + k / 64u) * 18u;
            let offset = base + 2u + (k % 64u) / 4u;
            let bits = (SRC0[offset / 4u] >> ((offset % 4u) * 8u)) & 255u;
            value = (f32((bits >> ((k % 4u) * 2u)) & 3u) - 1.0) * load_f16_as_f32_at_src0(base);
        }
        shmem[i] = f16(value);
    }
}
#endif
'''
edit('wgsl-shaders/mul_mat_decls.tmpl',lambda text:insert_before(text,'#ifdef INIT_SRC0_SHMEM_Q1_0',tile))
def shaderlib(text):
    # Only the GET_ROWS u32 branch; other specialized quantized paths stay off.
    marker='''                        case GGML_TYPE_Q1_0:
                        case GGML_TYPE_Q4_0:'''
    if text.count(marker)!=1: raise ValueError('GET_ROWS type switch changed')
    text=text.replace(marker,'''                        case GGML_TYPE_Q1_0:
                        case GGML_TYPE_Q2_0:
                        case GGML_TYPE_Q4_0:''')
    marker='''                    } else if (key.src_type == GGML_TYPE_NVFP4) {'''
    text=insert_before(text,marker,'''                    } else if (key.src_type == GGML_TYPE_Q2_0) {
                        defines.push_back("BLOCK_SIZE=64u");''')
    return text
edit('ggml-webgpu-shader-lib.hpp',shaderlib)
def backend(text):
    marker='''        case GGML_TYPE_Q1_0:
        case GGML_TYPE_Q4_0:'''
    if text.count(marker)!=1: raise ValueError('Quantized rows type switch changed')
    text=text.replace(marker,'''        case GGML_TYPE_Q1_0:
        case GGML_TYPE_Q2_0:
        case GGML_TYPE_Q4_0:''')
    start=text.index('        case GGML_OP_MUL_MAT:\n',text.index('static bool ggml_backend_webgpu_device_supports_op'))
    end=text.index('        case GGML_OP_MUL_MAT_ID:',start)
    part=text[start:end]
    if part.count('case GGML_TYPE_Q1_0:')!=1: raise ValueError('Matrix type switch changed')
    return text[:start]+part.replace('case GGML_TYPE_Q1_0:','case GGML_TYPE_Q1_0:\n                            case GGML_TYPE_Q2_0:')+text[end:]
edit('ggml-webgpu.cpp',backend)
patch=''.join(''.join(difflib.unified_diff(old.splitlines(keepends=True),new.splitlines(keepends=True),fromfile='a/'+(relative/name).as_posix(),tofile='b/'+(relative/name).as_posix())) for name,(old,new) in changes.items())
(target/'q2_0-webgpu.patch').write_text(patch,encoding='utf8',newline='\n')
manifest={'hashEncoding':'UTF-8 normalized LF','scope':'Experimental source patch; not built or enabled in the app runtime','llamaCppRevision':pin,'patchSha256':hashlib.sha256(patch.encode()).hexdigest(),'files':[{'path':(relative/name).as_posix(),'beforeSha256':hashlib.sha256(old.encode()).hexdigest(),'afterSha256':hashlib.sha256(new.encode()).hexdigest()} for name,(old,new) in changes.items()]}
(target/'patch-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
print(json.dumps(manifest))
