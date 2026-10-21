import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {runQwen3Q2CpuProbe} from './qwen3-q2-cpu-cases.mjs';
const [directory,output]=process.argv.slice(2);if(!directory||!output)throw Error('Use PROBE_DIRECTORY OUTPUT.json');
const root=resolve(directory),build=JSON.parse(await readFile(join(root,'build.json'),'utf8'));
for(const pin of build.files){const raw=await readFile(join(root,pin.path));assert.equal(raw.length,pin.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),pin.sha256);}
const create=(await import(pathToFileURL(join(root,'probe.mjs')))).default,api=await create({wasmBinary:await readFile(join(root,'probe.wasm'))});
const measured=runQwen3Q2CpuProbe(api);
const result={scope:'Node WebAssembly SIMD, fixed-source compat CPU archive Q2_0 group64 traits and real ggml MUL_MAT graph, no model load or browser/iPhone inference',at:new Date().toISOString(),platform:process.platform,arch:process.arch,node:process.version,build,...measured};
await writeFile(resolve(output),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,cases:measured.cases.length,matrices:measured.matrices.length,elapsedMs:result.elapsedMs}));
