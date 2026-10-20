// Real SampleNextToken GPU path at the 9B vocabulary size. Controlled logits
// are numerical fixtures, not model outputs or a semantic generation pass.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const [runtimePath,output,backend='d3d12']=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use PINNED_RUNTIME_FILE OUTPUT.json [backend]');
const pin='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488',source=await readFile(runtimePath);
if(createHash('sha256').update(source).digest('hex')!==pin)throw Error('Unsupported runtime: private names require the exact inspected hash');
const instrumented=path.resolve(output+'.runtime.mjs');
await writeFile(instrumented,Buffer.concat([source,Buffer.from('\nexport {lp as qaRuntime,rl as qaOperator};\n')]));
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const pkg=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));
let gpu=create(['backend='+backend]),runtime;
Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});
globalThis.fetch=async()=>{throw Error('Network disabled for numerical probe');};
const result={schema:1,at:new Date().toISOString(),scope:'Native Dawn SampleNextToken with controlled logits at 9B vocabulary size; not generated logits, model quality, browser or phone acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,gpuModule:{package:pkg.name,version:pkg.version},browser:null,backend,runtimeRevision:'621e20782f208660f4f58283c2ce58430020f243',runtimeSha256:pin,model:null,inputTokens:null,outputTokens:null,cases:[]};
try{
 const api=await import(pathToFileURL(instrumented).href);runtime=await api.qaRuntime();const op=api.qaOperator('com.xenova.SampleNextToken');result.device={adapterInfo:runtime.device.adapterInfo,features:[...runtime.device.features],limits:runtime.device.limits};
 const vocab=248320;
 const cases=[{name:'first',winners:[0]},{name:'last',winners:[vocab-1]},{name:'block-end',winners:[2047]},{name:'block-start',winners:[2048]},{name:'negative-high-id',winners:[200003],negative:true},{name:'cross-block-tie',winners:[vocab-1,2048,127]},{name:'nan-excluded',winners:[180103],nan:true},{name:'top-k-one',winners:[vocab-1],topK:1,temperature:0.8}];
 for(const c of cases){
  const owned=[],tensor=(dtype,shape,data)=>{const t=runtime.tensorFromTypedArray(dtype,shape,data);owned.push(t);return t;};
  try{
   const values=Float32Array.from({length:vocab},(_,i)=>-20-(i*97%311)/31);for(const i of c.winners)values[i]=c.negative?-1:10;if(c.nan){values[0]=NaN;values[2048]=NaN;values[vocab-1]=NaN;}
   let expected=0;while(Number.isNaN(values[expected]))expected++;for(let i=expected+1;i<values.length;i++)if(values[i]>values[expected])expected=i;
   const logitsT=tensor('float32',[vocab],values),outT=tensor('uint32',[3],new Uint32Array([0xabcdef01,0xabcdef02,0xabcdef03]));
   const request={resources:{logitsT,outT},args:{maxTopK:64,topK:c.topK??0,temperature:c.temperature??0,topP:1,minP:0,seed:1234,position:37,outputOffset:1}};
   const selectedVariant=op.explain(runtime,request).selected;await op.run(runtime,request);await runtime.queueIdle();const got=await runtime.readTensor(outT);
   const measured={name:c.name,vocab,maxTopK:64,topK:c.topK??0,temperature:c.temperature??0,outputOffset:1,selectedVariant,expected,actual:got[1],sentinelsPreserved:got[0]===0xabcdef01&&got[2]===0xabcdef03,passed:got[1]===expected&&got[0]===0xabcdef01&&got[2]===0xabcdef03};result.cases.push(measured);console.log(JSON.stringify(measured));
  }finally{for(const t of owned)t.destroy();}
 }
 // Observe a deliberately invalid input separately. There is no correct model
 // token for an all-NaN score vector, so this must never count as semantic PASS.
 const invalid=runtime.tensorFromTypedArray('float32',[vocab],new Float32Array(vocab).fill(NaN)),invalidOut=runtime.tensorFromTypedArray('uint32',[1],new Uint32Array([0xabcdef01]));
 try{await op.run(runtime,{resources:{logitsT:invalid,outT:invalidOut},args:{maxTopK:64,topK:0,temperature:0}});await runtime.queueIdle();result.invalidLogitObservation={condition:'All logits NaN, deliberately invalid numerical fixture',vocab,returnedToken:(await runtime.readTensor(invalidOut))[0],expected:null,passed:null};}
 finally{invalid.destroy();invalidOut.destroy();}
 result.passed=result.cases.length===8&&result.cases.every(c=>c.passed);
}catch(error){result.error=String(error.stack??error);result.passed=false;}
finally{try{await runtime?.destroy();}catch(error){result.cleanupError=String(error);result.passed=false;}delete navigator.gpu;gpu=null;}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error??null,cases:result.cases.length}));process.exit(result.passed?0:1);
