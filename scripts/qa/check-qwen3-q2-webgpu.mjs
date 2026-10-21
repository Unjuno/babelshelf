// Native Dawn QA for actual upstream preprocessed shaders, not a model backend.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import os from 'node:os';
import {q2SyntheticFixtures,runQ2GpuCases} from './qwen3-q2-webgpu-cases.mjs';
import {createReadStream,openAsBlob} from 'node:fs';
import {bonsai8bPin} from './bonsai8b-pin.mjs';
const [sourceArg,preprocessorArg,outputArg,checkpointPath,auditPath]=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!sourceArg||!preprocessorArg||!outputArg||!gpuModule)throw Error('Set BABELSHELF_GPU_MODULE; use WEBGPU_SOURCE PREPROCESSOR_EXE NEW_OUTPUT_DIRECTORY');
const source=resolve(sourceArg),out=resolve(outputArg);await mkdir(out,{recursive:false});
const shared=['U32_DEQUANT_HELPERS','BYTE_HELPERS'];
const variants=[
 ['rows','get_rows.wgsl',[...shared,'Q2_0','Q2_0_T','SRC_TYPE=u32','DST_TYPE=f32','BLOCK_SIZE=64u','WG_SIZE=64']],
 ['vector','mul_mat_vec.wgsl',[...shared,'MUL_ACC_Q2_0','SCALAR','SRC0_INNER_TYPE=u32','SRC1_INNER_TYPE=f32','WG_SIZE=128','OUTPUTS_PER_WG=4','NUM_COLS=3','USE_WORKGROUP_REDUCTION']],
 ['vector1','mul_mat_vec.wgsl',[...shared,'MUL_ACC_Q2_0','SCALAR','SRC0_INNER_TYPE=u32','SRC1_INNER_TYPE=f32','WG_SIZE=128','OUTPUTS_PER_WG=4','NUM_COLS=1','USE_WORKGROUP_REDUCTION']],
 ['tile','mul_mat_reg_tile.wgsl',[...shared,'INIT_SRC0_SHMEM_Q2_0','INIT_SRC1_SHMEM_FLOAT','SCALAR','SRC0_INNER_TYPE=u32','SRC1_INNER_TYPE=f32','TILE_M=2u','TILE_N=2u','TILE_K=32u','WORKGROUP_SIZE_M=4u','WORKGROUP_SIZE_N=4u']],
];
const result={at:new Date().toISOString(),scope:'Actual upstream preprocessed WGSL numerical checks on Node/Dawn D3D12; not full model, browser, phone or throughput acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,backend:'d3d12',browser:null,model:null,inputTokens:null,outputTokens:null,variants:[],cases:[],passed:false};
const {create,globals}=await import(pathToFileURL(resolve(gpuModule)).href);Object.assign(globalThis,globals);let gpu=create(['backend=d3d12']),device;
globalThis.__babelShelfQaGpu=gpu;
// A native WebGPU promise may not itself keep Node's event loop alive while
// asynchronous file IO/GC occurs. Bound the run and retain the GPU owner.
const deadline=setTimeout(()=>device?.destroy(),120000),save=()=>writeFile(join(out,'result.json'),JSON.stringify(result,null,2));
const hash=b=>createHash('sha256').update(b).digest('hex');
try{
 result.status='compiling';await save();
 const adapter=await gpu.requestAdapter();if(!adapter)throw Error('No GPU adapter');if(!adapter.features.has('shader-f16'))throw Error('shader-f16 unavailable');
 result.adapter=Object.fromEntries(['vendor','architecture','device','description'].map(key=>[key,adapter.info?.[key]??null]));result.features=[...adapter.features];device=await adapter.requestDevice({requiredFeatures:['shader-f16']});const pipelines={};
 for(const [name,file,defines]of variants){
  const generated=join(out,name+'.wgsl');execFileSync(resolve(preprocessorArg),[join(source,'wgsl-shaders'),file,generated,...defines]);const code=await readFile(generated,'utf8');
  const module=device.createShaderModule({code}),info=await module.getCompilationInfo(),errors=info.messages.filter(m=>m.type==='error').map(m=>({message:m.message,line:m.lineNum}));
  result.variants.push({name,file,defines,sha256:hash(code),errors});if(errors.length)continue;
  pipelines[name]=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
 }
 if(Object.keys(pipelines).length!==variants.length)throw Error('Required Q2_0 shader variants did not compile');
 const fixtures=q2SyntheticFixtures();
 if(checkpointPath||auditPath){
  result.status='verifying-real-file';await save();
  if(!checkpointPath||!auditPath)throw Error('Real rows require checkpoint and complete audit');const blob=await openAsBlob(checkpointPath),audit=JSON.parse(await readFile(auditPath,'utf8'));
  const sha=createHash('sha256');for await(const part of createReadStream(checkpointPath,{highWaterMark:1024*1024}))sha.update(part);
  if(blob.size!==bonsai8bPin.bytes||sha.digest('hex')!==bonsai8bPin.sha256||audit.sha256!==bonsai8bPin.sha256||audit.passed!==true)throw Error('Wrong real checkpoint/audit identity');
  result.model=bonsai8bPin;
  for(const name of ['token_embd.weight','output.weight','blk.0.attn_q.weight','blk.0.ffn_down.weight']){
   const tensor=audit.tensors.find(t=>t.name===name),[k,expectedRows]=tensor?.shape??[],rowBytes=k/64*18;if(!tensor||tensor.type!==42||![4096,12288].includes(k)||!Number.isSafeInteger(expectedRows)||expectedRows<5||tensor.elements!==k*expectedRows||tensor.size!==expectedRows*rowBytes)throw Error('Real tensor geometry mismatch: '+name);
   const originalRows=[0,Math.floor(expectedRows/2),expectedRows-1,1,expectedRows-2],weights=new Uint8Array(rowBytes*5);
   for(let i=0;i<5;i++)weights.set(new Uint8Array(await blob.slice(tensor.start+originalRows[i]*rowBytes,tensor.start+(originalRows[i]+1)*rowBytes).arrayBuffer()),i*rowBytes);
   fixtures.push({name,k,weights,originalRows});
  }
 }
 await writeFile(join(out,'fixtures.json'),JSON.stringify({model:result.model,fixtures:fixtures.map(f=>({...f,sha256:hash(f.weights),weights:Array.from(f.weights)}))}));
 result.cases=await runQ2GpuCases(device,pipelines,fixtures,async fixture=>{result.status='checking '+fixture.name+' K='+fixture.k;await save();});
 result.passed=result.cases.length===fixtures.length*4&&result.cases.every(c=>c.passed);
 result.status='finished';
}catch(error){result.error=String(error.stack??error);}
finally{clearTimeout(deadline);device?.destroy();delete globalThis.__babelShelfQaGpu;gpu=null;await save();}
console.log(JSON.stringify({passed:result.passed,cases:result.cases.length,error:result.error,variants:result.variants.map(v=>({name:v.name,errors:v.errors}))}));process.exitCode=result.passed?0:1;
