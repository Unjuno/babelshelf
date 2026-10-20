// Bounded pinned-runtime embedding/rotation checks. Constructed inputs by default;
// Optional real checkpoint rows/signs remain bounded; no full-model allocation,
// language answers, browser launch or network.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {checkpointFixtures} from './bonsai-checkpoint-fixtures.mjs';
import {openAsBlob} from 'node:fs';
import {fileResponse} from '../../dist/ranges.js';
const [runtimePath,output,backend='d3d12',checkpointPath]=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use PINNED_RUNTIME_FILE OUTPUT.json [backend] [PINNED_LOCAL_9B]');
const pin='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488',source=await readFile(runtimePath);
if(createHash('sha256').update(source).digest('hex')!==pin)throw Error('Unsupported runtime: private names require the exact inspected hash');
const checkpoint=checkpointPath?await checkpointFixtures(checkpointPath):null;
const instrumented=path.resolve(output+'.runtime.mjs');
await writeFile(instrumented,Buffer.concat([source,Buffer.from('\nexport {lp as qaRuntime,rl as qaOperator,bg as qaReader,E_ as qaRotation};\n')]));
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const pkg=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));
let gpu=create(['backend='+backend]),runtime;
Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});
globalThis.fetch=async()=>{throw Error('Network disabled for numerical probe');};
const result={schema:1,at:new Date().toISOString(),scope:checkpoint?'Native Dawn sampled real checkpoint embeddings and stored explicit signs, independent scalar inverse rotation; no full loader/layer graph/generation/browser/phone acceptance':'Native Dawn bounded LUT2 embedding and fused inverse rotation; not checkpoint mapping, model generation, browser or phone acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,gpuModule:{package:pkg.name,version:pkg.version},browser:null,backend,runtimeRevision:'621e20782f208660f4f58283c2ce58430020f243',runtimeSha256:pin,model:checkpoint?.identity??null,inputTokens:null,outputTokens:null,cases:[]};
const width=4096,vocab=checkpoint?256:5;
function half(bits){const e=(bits>>10)&31,m=bits&1023;return (bits&32768?-1:1)*(e?2**(e-15)*(1+m/1024):2**-14*m/1024);}
function fixture(lut){
 const values=new Float64Array(width*vocab),blocks=values.length/32,bits=new Uint32Array(blocks*2),meta=new Uint32Array(blocks/8*(lut===9?1:3)),group=lut===9?128:64;
 const scales=[0x0001,0x03ff,0x0400,0x2449,0x3449,0x3800,0x3c00];
 for(let i=0;i<values.length;i++){
  const block=Math.floor(i/32),lane=i%32,code=((i*17+Math.floor(i/width)*13+Math.floor(i/127)*7)>>>0)%(lut===9?3:4),scale=scales[Math.floor(i/group)%scales.length];
  bits[block*2+(lane>>4)]|=code<<((lane&15)*2);values[i]=(code-1)*half(scale);
  if(i%group===0){const word=lut===9?block>>3:(block>>3)*3+((block&7)>>2),shift=lut===9?((block>>2)&1)*16:((block>>1)&1)*16;meta[word]|=scale<<shift;}
 }
 return {values,bits,meta};
}
function packedCheckpoint(f){
 const values=new Float64Array(f.values.length),blocks=f.values.length/32,bits=new Uint32Array(blocks*2),meta=new Uint32Array(blocks/8);
 for(let i=0;i<values.length;i++){
  const block=Math.floor(i/32),lane=i%32,scale=f.scales[Math.floor(i/128)];
  bits[block*2+(lane>>4)]|=(f.values[i]+1)<<((lane&15)*2);values[i]=f.values[i]*half(scale);
  if(i%128===0)meta[block>>3]|=scale<<(((block>>2)&1)*16);
 }
 return {values,bits,meta};
}
function inverse(row,signs){const out=Float64Array.from(row);for(let step=1;step<width;step*=2)for(let base=0;base<width;base+=2*step)for(let j=0;j<step;j++){const a=out[base+j],b=out[base+j+step];out[base+j]=a+b;out[base+j+step]=a-b;}for(let i=0;i<width;i++)out[i]*=signs[i]/Math.sqrt(width);return out;}
try{
 const api=await import(pathToFileURL(instrumented).href);
 if(checkpoint){
  const file=await openAsBlob(checkpointPath),url='https://local-model.invalid/pinned.gguf';let reader;
  try{
   reader=await api.qaReader.open(url,{cache:false,fetch:async(input,options={})=>{if(String(input)!==url)throw Error('Unknown checkpoint resource');const range=new Headers(options.headers).get('Range');if(options.method!=='HEAD'&&(!range||!/^bytes=\d+-\d+$/.test(range)||Number(range.split('-')[1])-Number(range.slice(6).split('-')[0])+1>16*1024*1024))throw Error('Unbounded checkpoint metadata read');return fileResponse(file,options);}});
   const parsed=api.qaRotation(reader);let compared=0;
   if(parsed.blockSize!==checkpoint.rotation.blockSize||!parsed.inverseWeights.includes('token_embd.weight'))throw Error('Runtime rotation mapping mismatch');
   for(const [width,expected]of checkpoint.rotation.signsByWidth){const actual=parsed.signs[width];if(actual?.length!==expected.length||expected.some((v,i)=>actual[i]!==v))throw Error('Runtime explicit sign mismatch');compared+=expected.length;}
   result.rotationMapping={blockSize:parsed.blockSize,comparedSigns:compared,widths:[...checkpoint.rotation.signsByWidth.keys()],inverseEmbedding:true,passed:true};
  }finally{await reader?.close();}
 }
 runtime=await api.qaRuntime();const op=api.qaOperator('com.xenova.LlamaEmbed');result.device={adapterInfo:runtime.device.adapterInfo,features:[...runtime.device.features],limits:runtime.device.limits};
 const plans=checkpoint?checkpoint.fixtures.filter(f=>f.source.tensor==='token_embd.weight').map(f=>({lut:9,checkpointFixture:f})):[{lut:9},{lut:8}];
 for(const {lut,checkpointFixture}of plans){
  const owned=[],tensor=(dtype,shape,data)=>{const t=runtime.tensorFromTypedArray(dtype,shape,data);owned.push(t);return t;};
  try{
   const f=checkpointFixture?packedCheckpoint(checkpointFixture):fixture(lut),signs=checkpoint?checkpoint.rotation.signsByWidth.get(width):Float32Array.from({length:width},(_,i)=>(i*13%19)<8?-1:1),bitsT=tensor('uint32',[f.bits.length],f.bits),scalesT=tensor('uint32',[f.meta.length],f.meta),signsT=tensor('float32',[width],signs);
   for(const token of [0,1,vocab-1])for(const variant of [undefined,'lut2_inverse_rotation']){
    // A decoy token at index0 also checks explicit tokenOffset handling.
    const inputT=tensor('uint32',[2],new Uint32Array([(token+1)%vocab,token])),hiddenT=tensor('float32',[width],new Float32Array(width)),request={resources:{inputT,bitsT,scalesT,signsT,hiddenT},args:{hiddenSize:width,vocabSize:vocab,tokenOffset:1,format:'lut2_32',lut,rotationBlockSize:width}};
    const selectedVariant=op.explain(runtime,request,{variant}).selected;await op.run(runtime,request,{variant});await runtime.queueIdle();const got=await runtime.readTensor(hiddenT),expected=inverse(f.values.subarray(token*width,(token+1)*width),signs);
    let maxAbsError=0,finite=true,nonzero=0;for(let i=0;i<width;i++){maxAbsError=Math.max(maxAbsError,Math.abs(got[i]-expected[i]));finite&&=Number.isFinite(got[i]);if(expected[i]!==0)nonzero++;}
    const check={...(checkpointFixture?{checkpointRows:checkpointFixture.source,checkpointToken:checkpointFixture.source.rowStart+token,negativeSigns:signs.filter(x=>x===-1).length}:{}),lut,width,vocab,token,tokenOffset:1,rotationBlock:width,inputDtype:'uint32',outputDtype:'float32',requestedVariant:variant??'auto',selectedVariant,finite,nonzero,maxAbsError,tolerance:0.0001,passed:finite&&nonzero>width/2&&maxAbsError<=0.0001};result.cases.push(check);console.log(JSON.stringify(check));
   }
   const tokens=[vocab-1,0,1],inputT=tensor('uint32',[3],new Uint32Array(tokens)),hiddenT=tensor('float32',[3,width],new Float32Array(3*width)),request={resources:{inputT,bitsT,scalesT,hiddenT},args:{hiddenSize:width,vocabSize:vocab,seqLen:3,format:'lut2_32',lut}};
   const selectedVariant=op.explain(runtime,request).selected;await op.run(runtime,request);await runtime.queueIdle();const got=await runtime.readTensor(hiddenT);let mismatches=0;for(let i=0;i<got.length;i++)if(got[i]!==f.values[tokens[Math.floor(i/width)]*width+i%width])mismatches++;
   const check={...(checkpointFixture?{checkpointRows:checkpointFixture.source,checkpointTokens:tokens.map(t=>checkpointFixture.source.rowStart+t)}:{}),lut,width,vocab,tokens,rotationBlock:null,outputDtype:'float32',selectedVariant,mismatches,passed:mismatches===0};result.cases.push(check);console.log(JSON.stringify(check));
  }finally{for(const t of owned)t.destroy();}
 }
 result.passed=result.cases.length===(checkpoint?21:14)&&result.cases.every(c=>c.passed);
}catch(error){result.error=String(error.stack??error);result.passed=false;}
finally{try{await runtime?.destroy();}catch(error){result.cleanupError=String(error);result.passed=false;}delete navigator.gpu;gpu=null;}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error??null,cases:result.cases.length}));process.exit(result.passed?0:1);
