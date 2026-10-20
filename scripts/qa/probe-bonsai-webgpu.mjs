// Optional Node/Dawn header compatibility probe. Never loads model weights or
// launches a browser. GPU_MODULE names an installed dawn-gpu/node-webgpu module.
import {readFile,writeFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {fileResponse} from '../../dist/ranges.js';
const [id,modelPath,runtimePath,output,descriptorPath]=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!id||!modelPath||!runtimePath||!output||!gpuModule)throw Error('Set BABELSHELF_GPU_MODULE; use MODEL_ID MODEL_FILE PINNED_RUNTIME_FILE OUTPUT.json');
const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=manifest.models.find(m=>m.id===id),bytes=await readFile(runtimePath);
if(!model||createHash('sha256').update(bytes).digest('hex')!==manifest.runtime.file.sha256)throw Error('Unverified runtime or unknown model');
const moduleFile=path.resolve(output+'.runtime.mjs');await writeFile(moduleFile,bytes);
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
let gpu=create(['backend=d3d12']);Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});
const blob=await openAsBlob(modelPath);let file=blob,format=model.format,filename=model.file.name,header=null;
if(descriptorPath){
 header=JSON.parse(await readFile(descriptorPath,'utf8'));
 if(header.repository!==model.repository||header.revision!==model.revision||!['PQ2_0','Q2_0'].includes(header.format)||header.file!==`Ternary-Bonsai-2-${id}-${header.format}.gguf`||!Number.isSafeInteger(header.bytes)||header.bytes<blob.size||blob.size!==header.headerBytes||blob.size>16*1024*1024||createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex')!==header.headerSha256)throw Error('Invalid bounded header descriptor');
 format=header.format;filename=header.file;
 file={size:header.bytes,slice(start,end){if(start<0||end>blob.size)throw Error('Read exceeds retained header');return blob.slice(start,end);}};
}else if(file.size!==model.file.bytes)throw Error('Model size mismatch');
const localURL='https://local-model.invalid/'+filename,requests=[];
const fetchLocal=async(url,options={})=>{
 if(String(url)!==localURL)throw Error('Unexpected resource');
 const range=new Headers(options.headers).get('Range');
 if(options.method!=='HEAD'&&(!range||!/^bytes=\d+-\d+$/.test(range)))throw Error('Unbounded compatibility read refused');
 if(range){const [start,end]=range.slice(6).split('-').map(Number);if(end-start+1>16*1024*1024)throw Error('Compatibility read budget exceeded');}
 requests.push({method:options.method??'GET',range});return fileResponse(file,options);
};
globalThis.fetch=async()=>{throw Error('No network in compatibility probe');};
const result={schema:1,scope:'Node/Dawn header and adapter check only; not model loading, generation or browser/phone acceptance',at:new Date().toISOString(),os:{platform:os.platform(),release:os.release(),arch:os.arch()},runtime:process.version,browser:null,model:id,revision:model.revision,quantization:format,runtimeRevision:manifest.runtime.revision,runtimeSha256:manifest.runtime.file.sha256,backend:'d3d12',inputTokens:null,outputTokens:null,weightsVerified:false,headerOnly:!!header,...(header?{header}:{}),requests};
try{const api=await import(pathToFileURL(moduleFile).href),started=performance.now();result.compatibility=await api.Qwen3_5ForConditionalGeneration.checkAvailability(localURL,{mmproj:null,fetch:fetchLocal});result.elapsedMs=performance.now()-started;}catch(error){result.error=String(error.stack??error);}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));delete globalThis.navigator.gpu;gpu=null;process.exit(result.compatibility?.ok?0:1);
