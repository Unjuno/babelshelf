// Native wasm32 file-offset boundary test; synthetic sparse file, no fake inference.
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const [sourceArg, sdkArg, outArg] = process.argv.slice(2);
if (!sourceArg || !sdkArg || !outArg) throw Error('Use WLLAMA_SOURCE EMSDK_ROOT NEW_PRIVATE_OUTPUT');
const source=resolve(sourceArg),sdk=resolve(sdkArg),out=resolve(outArg),hash=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:false});
const pre=join(out,'pre.js');
await writeFile(pre,`async function _wllama_js_file_read(path,offset,size,ptr){
 Module.requests.push({path,offset,size});
 const n=Math.max(0,Math.min(size,2310125920-offset));
 for(let i=0;i<n;i++)HEAPU8[ptr+i]=(offset+i)&255;
 return n;
}\n`);
const cpp=resolve('scripts/qa/wllama-large-file-probe.cpp');
const args=[join(sdk,'upstream/emscripten/em++.py'),cpp,'-I'+join(source,'cpp'),'-O1','-fexceptions','-sASYNCIFY=1','--no-entry','-Wl,--wrap,fopen','-Wl,--wrap,fclose','-Wl,--wrap,fread','-Wl,--wrap,fseek','-Wl,--wrap,ftell','-sMODULARIZE=1','-sEXPORT_ES6=1','-sENVIRONMENT=node','-sALLOW_MEMORY_GROWTH=1','-sMAXIMUM_MEMORY=33554432','-sEXPORTED_FUNCTIONS=["_probe_read","_probe_overflow"]','-sEXPORTED_RUNTIME_METHODS=["FS","ccall","HEAPU8"]','--pre-js',pre,'-o',join(out,'probe.mjs')];
execFileSync('python',args,{stdio:'inherit',env:{...process.env,EM_CONFIG:join(sdk,'.emscripten')}});
const {default:create}=await import(pathToFileURL(join(out,'probe.mjs')).href);
const m=await create({wasmBinary:await readFile(join(out,'probe.wasm')),requests:[]});
m.FS.writeFile('/large.gguf',new Uint8Array());
// Same virtual size-only MEMFS node contract as upstream heapfsAlloc(...,false).
m.FS.lookupPath('/large.gguf').node.usedBytes=2310125920;
const cases=[];
for(const offset of [0,2147483632,2147483644,2147483648,2147483664,2310125904])for(const requested of [8,1048592]){
 m.requests.length=0;
 const code=await m.ccall('probe_read','number',['number','number'],[offset,requested],{async:true});
 cases.push({offset,requested,code,requests:[...m.requests],passed:code===1});
}
m.requests.length=0;
try {const code=await m.ccall('probe_overflow','number',[],[],{async:true});cases.push({name:'cached range crossing wasm32 SIZE_MAX is refused',code,requests:[...m.requests],passed:code===1&&m.requests.length===1});}
catch(error){cases.push({name:'cached range crossing wasm32 SIZE_MAX is refused',error:error.message,requests:[...m.requests],passed:false});}
const receipt={scope:'Actual wasm32 async fread wrapper with synthetic sparse 2.31GB file; no full model, no GPU, no phone acceptance',at:new Date().toISOString(),sourceHeaderSha256:hash(await readFile(join(source,'cpp/wllama-fs.h'))),sourceHeaderLfSha256:hash((await readFile(join(source,'cpp/wllama-fs.h'),'utf8')).replace(/\r\n/g,'\n')),probeSha256:hash(await readFile(cpp)),wasmSha256:hash(await readFile(join(out,'probe.wasm'))),settings:{memory64:false,asyncify:true,maximumMemoryBytes:33554432,fileBytes:2310125920},cases,passed:cases.every(c=>c.passed)};
await writeFile(join(out,'result.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
if(!receipt.passed)process.exitCode=1;
