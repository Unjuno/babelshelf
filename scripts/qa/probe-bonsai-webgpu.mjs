// Optional Node/Dawn header compatibility probe. Never loads model weights or
// launches a browser. GPU_MODULE names an installed dawn-gpu/node-webgpu module.
import {readFile,writeFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {fileResponse} from '../../dist/ranges.js';
const [id,modelPath,runtimePath,output,descriptorPath]=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE,inspectPlan=process.env.BABELSHELF_NUMERICAL_PLAN==='1';
if(!id||!modelPath||!runtimePath||!output||!gpuModule)throw Error('Set BABELSHELF_GPU_MODULE; use MODEL_ID MODEL_FILE PINNED_RUNTIME_FILE OUTPUT.json');
const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=manifest.models.find(m=>m.id===id),bytes=await readFile(runtimePath);
if(!model||createHash('sha256').update(bytes).digest('hex')!==manifest.runtime.file.sha256)throw Error('Unverified runtime or unknown model');
if(inspectPlan&&manifest.runtime.file.sha256!=='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488')throw Error('Allocation-plan internals require the exact inspected runtime');
const moduleFile=path.resolve(output+'.runtime.mjs');await writeFile(moduleFile,inspectPlan?Buffer.concat([bytes,Buffer.from('\nexport {lp as qaRuntime,bg as qaReader,AD as qaModel};\n')]):bytes);
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const gpuPackage=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));
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
const result={schema:1,scope:'Node/Dawn header and adapter check only; not model loading, generation or browser/phone acceptance',at:new Date().toISOString(),os:{platform:os.platform(),release:os.release(),arch:os.arch()},runtime:process.version,gpuModule:{package:gpuPackage.name,version:gpuPackage.version},browser:null,model:id,revision:model.revision,quantization:format,runtimeRevision:manifest.runtime.revision,runtimeSha256:manifest.runtime.file.sha256,backend:'d3d12',inputTokens:null,outputTokens:null,weightsVerified:false,headerOnly:!!header,...(header?{header}:{}),requests};
try{const api=await import(pathToFileURL(moduleFile).href),started=performance.now();result.compatibility=await api.Qwen3_5ForConditionalGeneration.checkAvailability(localURL,{mmproj:null,fetch:fetchLocal});result.elapsedMs=performance.now()-started;
 if(inspectPlan){let runtime,reader;try{runtime=await api.qaRuntime();reader=await api.qaReader.open(localURL,{fetch:fetchLocal,cache:false});const support=await api.qaModel.checkHeaderSupport({model:reader,mmproj:null},runtime.device);result.allocationPlan={scope:'Static header-based runtime support plan, not actual residency or peak memory; generation cache/activation lifetimes require separate verification',ok:support.ok,reason:support.reason,footprint:support.footprint,opIds:support.opIds,selectableVariants:support.selectableVariants};result.device={adapterInfo:runtime.device.adapterInfo,features:[...runtime.device.features],limits:runtime.device.limits};}finally{try{await reader?.close();}finally{await runtime?.destroy();}}}
}catch(error){result.error=String(error.stack??error);}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));delete globalThis.navigator.gpu;gpu=null;process.exit(!result.error&&result.compatibility?.ok&&(!inspectPlan||result.allocationPlan?.ok)?0:1);
