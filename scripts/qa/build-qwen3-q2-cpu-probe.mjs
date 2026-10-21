import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const [sourceArg,sdkArg,outArg]=process.argv.slice(2);
if(!sourceArg||!sdkArg||!outArg)throw Error('Use PINNED_WLLAMA_SOURCE EMSDK_ROOT NEW_OUTPUT');
const source=resolve(sourceArg),sdk=resolve(sdkArg),out=resolve(outArg),hash=b=>createHash('sha256').update(b).digest('hex');
execFileSync(process.execPath,['scripts/check-wllama-count-source.mjs',source],{stdio:'inherit'});
const receipt=JSON.parse(await readFile('research/runtime/wllama-count/native-compat-build.json','utf8'));
for(const pin of receipt.assets){const raw=await readFile(join(source,'build-count-compat',pin.name));if(raw.length!==pin.bytes||hash(raw)!==pin.sha256)throw Error('Frozen compat artifact mismatch');}
const archives=['libggml-cpu.a','libggml-base.a'].map(name=>join(source,'build-count-compat/llama.cpp/ggml/src',name));
const archivePins=await Promise.all(archives.map(async path=>({path,sha256:hash(await readFile(path))})));
await mkdir(out,{recursive:false});
const probe=resolve('scripts/qa/qwen3-q2-cpu-probe.c'),compiler=join(sdk,'upstream/emscripten/em++.py');
const args=[compiler,probe,'-I'+join(source,'llama.cpp/ggml/include'),...archives,'-O2','-msimd128','-pthread','-fexceptions','-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=node,web,worker','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=16777216','-sMAXIMUM_MEMORY=67108864','-sPTHREAD_POOL_SIZE=0','-sEXPORTED_RUNTIME_METHODS=["HEAPU8"]','-sEXPORTED_FUNCTIONS=["_probe_init","_probe_dequant","_probe_dot","_probe_matmul","_malloc","_free"]','-o',join(out,'probe.mjs')];
execFileSync('python',args,{stdio:'inherit',env:{...process.env,EMSDK:sdk,EM_CONFIG:join(sdk,'.emscripten')}});
const files=await Promise.all(['probe.mjs','probe.wasm'].map(async path=>{const raw=await readFile(join(out,path));return {path,bytes:raw.length,sha256:hash(raw)};}));
await writeFile(join(out,'build.json'),JSON.stringify({scope:'QA-only link of frozen compat CPU archives; not the product WASM, not model loading',source:receipt,archives:archivePins,probeSha256:hash(await readFile(probe)),command:['python',...args],files},null,2));
console.log(JSON.stringify({compiled:true,files}));
