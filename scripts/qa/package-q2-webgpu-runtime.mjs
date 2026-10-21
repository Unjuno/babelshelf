// QA-only packaging of the separately linked, pinned GPU/count build.
// Does not overwrite or register any product runtime.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {resolve, join, relative, isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {build} from '../../design/prototype/node_modules/vite/dist/node/index.js';

const [sourceArg, outArg] = process.argv.slice(2);
assert.ok(sourceArg && outArg, 'Usage: package-q2-webgpu-runtime SOURCE NEW_PRIVATE_OUTPUT');
const source = resolve(sourceArg), out = resolve(outArg);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8'}).trim();
const inside = (parent, child) => {const path = relative(parent, child); return !path || (!path.startsWith('..') && !isAbsolute(path));};
assert.ok(!inside(process.cwd(), source), 'Use an isolated source outside the product repository');
assert.ok(!inside(process.cwd(), out) && !inside(source, out), 'Use a private output outside source/product');
await assert.rejects(stat(out), {code: 'ENOENT'}, 'Output must not exist');
const pins = JSON.parse(await readFile('research/runtime/wllama-count/source-pins.json', 'utf8'));
const gpu = JSON.parse(await readFile('research/evaluations/inference-optimization-2026-10-21/q2-webgpu-patch-manifest.json', 'utf8'));
const streamAbort = JSON.parse(await readFile('research/runtime/wllama-count/stream-abort-pins.json', 'utf8'));
const registry = JSON.parse(await readFile('research/runtime/wllama-count/webgpu-registry-pins.json', 'utf8'));
const llama = join(source, 'llama.cpp');
assert.equal(git(source, 'rev-parse', 'HEAD'), pins.wllamaRevision);
assert.equal(git(llama, 'rev-parse', 'HEAD'), pins.llamaCppRevision);
assert.equal(hash(await readFile('research/runtime/wllama-count/count.patch')), pins.patchSha256);
assert.equal(hash(await readFile('patches/llama-cpp-q2_0-webgpu.patch')), gpu.patchSha256);
assert.equal(hash(await readFile('patches/wllama-stream-abort.patch')), streamAbort.patchSha256);
assert.equal(streamAbort.wllamaRevision, pins.wllamaRevision);
assert.equal(streamAbort.requiresCountPatchSha256, pins.patchSha256);
assert.equal(registry.requiresGpuPatchSha256, gpu.patchSha256);
assert.equal(hash(await readFile('patches/llama-cpp-webgpu-registry.patch')), registry.patchSha256);
assert.equal(hash(await readFile(join(source, 'LICENCE'))), pins.license.sha256);
for (const file of pins.files) {
  assert.equal(hash(execFileSync('git', ['show', 'HEAD:' + file.path], {cwd: source})), file.baseSha256);
  const extra = streamAbort.files.find(pin => pin.path === file.path);
  if (extra) assert.equal(extra.beforeSha256, file.patchedLfSha256);
  assert.equal(hash((await readFile(join(source, file.path), 'utf8')).replace(/\r\n/g, '\n')), extra?.afterSha256 ?? file.patchedLfSha256);
}
for (const file of gpu.files) {
  assert.equal(hash(execFileSync('git', ['show', 'HEAD:' + file.path], {cwd: llama})), file.beforeSha256);
  const extra = registry.files.find(pin => pin.path === file.path);
  if (extra) assert.equal(extra.beforeSha256, file.afterSha256);
  assert.equal(hash((await readFile(join(llama, file.path), 'utf8')).replace(/\r\n/g, '\n')), extra?.afterSha256 ?? file.afterSha256);
}
// Reject additional tracked edits: recorded source provenance must be complete.
for (const [root, allowed] of [[source, [...pins.files.map(f => f.path), 'src/workers-code/generated.ts', 'llama.cpp']], [llama, gpu.files.map(f => f.path)]]) {
  const actual = git(root, 'diff', '--name-only', 'HEAD').split(/\r?\n/).filter(Boolean);
  for (const name of actual) assert.ok(allowed.includes(name), 'Unexpected source edit: ' + name);
}
const nativeDir = join(source, 'build-count-q2-webgpu');
const gpuArchivePath = join(nativeDir, 'llama.cpp/ggml/src/ggml-webgpu/libggml-webgpu.a');
assert.ok((await stat(join(nativeDir, 'wllama.wasm'))).mtimeMs >= (await stat(gpuArchivePath)).mtimeMs, 'Relink the native runtime after rebuilding the GPU archive');
const gpuArchiveSha256 = hash(await readFile(gpuArchivePath));
const cache = await readFile(join(nativeDir, 'CMakeCache.txt'), 'utf8');
for (const setting of ['GGML_WEBGPU:BOOL=ON', 'GGML_WEBGPU_JSPI:BOOL=ON', 'LLAMA_WASM_MEM64:BOOL=ON', 'BUILD_SHARED_LIBS:BOOL=OFF', 'WLLAMA_TEST_BACKEND:BOOL=OFF']) assert.ok(cache.split(/\r?\n/).includes(setting), 'Wrong build setting: ' + setting);
assert.ok(!/^WLLAMA_COMPAT:[^=]*=(ON|1|TRUE)$/m.test(cache), 'This packager requires the JSPI/memory64 build');
const assets = [];
for (const name of ['wllama.js', 'wllama.wasm']) {
  const bytes = await readFile(join(nativeDir, name));
  assert.ok(bytes.length > 1000, 'Native artifact incomplete: ' + name);
  if (name.endsWith('.wasm')) assert.deepEqual([...bytes.subarray(0, 4)], [0, 97, 115, 109]);
  assets.push({name, bytes: bytes.length, sha256: hash(bytes)});
}
// Distinct identity prevents accidental reuse as the shipped CPU runtime.
let generated = "// Isolated experimental Q2_0 GPU/count build.\nexport const LIBLLAMA_VERSION = 'b11364-46ca246+babelshelf-count1-q2-webgpu-stream2-registry1-experimental';\n";
for (const [file, name] of [['src/workers-code/llama-cpp.js', 'LLAMA_CPP_WORKER_CODE'], ['src/workers-code/opfs-utils.js', 'OPFS_UTILS_WORKER_CODE'], ['build-count-q2-webgpu/wllama.js', 'WLLAMA_EMSCRIPTEN_CODE']]) generated += 'export const ' + name + ' = ' + JSON.stringify(await readFile(join(source, file), 'utf8')) + ';\n';
await writeFile(join(source, 'src/workers-code/generated.ts'), generated);
await mkdir(out, {recursive: false});
await build({configFile: false, root: source, logLevel: 'warn', build: {outDir: out, emptyOutDir: false, lib: {entry: join(source, 'index.ts'), formats: ['es'], fileName: () => 'wllama-count-q2-webgpu.js'}, minify: false}});
for (const asset of assets) await writeFile(join(out, asset.name), await readFile(join(nativeDir, asset.name)));
const bundle = await readFile(join(out, 'wllama-count-q2-webgpu.js'));
const receipt = {scope: 'QA-only linked GPU/count runtime; not product registration, execution, numerical or phone acceptance', at: new Date().toISOString(), compiled: true, browserExecuted: false, variant: 'JSPI memory64 experimental WebGPU + CPU fallback', wllamaRevision: pins.wllamaRevision, llamaCppRevision: pins.llamaCppRevision, countPatchSha256: pins.patchSha256, gpuPatchSha256: gpu.patchSha256, streamAbortPatchSha256: streamAbort.patchSha256, registryPatchSha256: registry.patchSha256, gpuArchiveSha256, cacheSha256: hash(cache), generatedWorkerSha256: hash(generated), assets, bundle: {name: 'wllama-count-q2-webgpu.js', bytes: bundle.length, sha256: hash(bundle)}};
await writeFile(join(out, 'bundle.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(receipt, null, 2));
