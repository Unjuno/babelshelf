// Real pinned-runtime LUT2 packing and matmul against known scalar arithmetic.
// Native Dawn only: no model generation, browser launch, network or app changes.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {checkpointFixtures} from './bonsai-checkpoint-fixtures.mjs';
const [runtimePath,output,backend='d3d12',checkpointPath]=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use PINNED_RUNTIME_FILE OUTPUT.json [d3d12|metal|vulkan] [PINNED_LOCAL_9B]');
const pin='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488',source=await readFile(runtimePath);
if(createHash('sha256').update(source).digest('hex')!==pin)throw Error('Unsupported runtime: QA internal names require the exact inspected hash');
const checkpoint=checkpointPath?await checkpointFixtures(checkpointPath):null;
const instrumented=path.resolve(output+'.runtime.mjs');
await writeFile(instrumented,Buffer.concat([source,Buffer.from('\nexport {lp as qaRuntime,rl as qaOperator,Jb as qaLut2};\n')]));
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const pkg=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));
let gpu=create(['backend='+backend]),runtime;
Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});
globalThis.fetch=async()=>{throw Error('Network disabled for numerical probe');};
const result={schema:1,at:new Date().toISOString(),scope:checkpoint?'Native Dawn real checkpoint row codec and bounded float32 products; no full model, sign reconstruction, browser or phone acceptance':'Native Dawn LUT2 codec and bounded float32 matrix products; not full model, browser or phone acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,gpuModule:{package:pkg.name,version:pkg.version},browser:null,backend,runtimeRevision:'621e20782f208660f4f58283c2ce58430020f243',runtimeSha256:pin,model:checkpoint?.identity??null,inputTokens:null,outputTokens:null,cases:[]};
function half(bits){const exponent=(bits>>10)&31,mantissa=bits&1023;return (bits&32768?-1:1)*(exponent?2**(exponent-15)*(1+mantissa/1024):2**-14*mantissa/1024);}
function fixture(format,length,scaleBoundary=false){
 const group=format==='Q2_0'?64:128,bytes=format==='Q2_0'?18:format==='PRISM_PQ2_0'?34:28,blocks=length/group,packed=new Uint8Array(blocks*bytes),view=new DataView(packed.buffer),values=new Int8Array(length),scales=new Uint16Array(blocks);let state=123456789;
 for(let block=0;block<blocks;block++){
  const base=block*bytes;scales[block]=scaleBoundary?[0x0001,0x000f,0x03ff,0x0400,0x1800,0x3000,0x3449][Math.floor(block*group/4096)%7]:(block*13+Math.floor(block/7))%3?0x3800:0x3c00;view.setUint16(base+(format==='PRISM_PTQ1_0'?26:0),scales[block],true);
  for(let i=0;i<group;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;values[block*group+i]=scaleBoundary?1:(state>>>16)%(format==='PRISM_PTQ1_0'?3:4)-1;}
  if(format==='PRISM_PTQ1_0')for(const [start,lanes,digits,offset]of [[0,16,5,0],[80,8,5,16],[120,2,4,24]])for(let lane=0;lane<lanes;lane++){
   let code=0;for(let digit=0;digit<digits;digit++)code=code*3+values[block*group+start+lane+digit*lanes]+1;packed[base+offset+lane]=Math.ceil(code*256/3**digits);
  }else for(let i=0;i<group;i++)packed[base+2+(i>>2)]|=(values[block*group+i]+1)<<((i&3)*2);
 }
 return {packed,values,scales,group};
}
try{
 const api=await import(pathToFileURL(instrumented).href);runtime=await api.qaRuntime();const op=api.qaOperator('com.xenova.LlamaPrefillMatmul'),device=runtime.host.device,d=runtime.device;result.device={adapterInfo:d.adapterInfo,features:[...d.features],limits:d.limits};
 const plans=checkpoint?checkpoint.fixtures.flatMap(f=>[{format:'PRISM_PTQ1_0',M:1,checkpointFixture:f},...(f.source.rowStart===0?[{format:'PRISM_PTQ1_0',M:3,checkpointFixture:f}]:[])]):['PRISM_PTQ1_0','PRISM_PQ2_0','Q2_0'].flatMap(format=>[{M:1},{M:3},{M:32},{M:1,scaleBoundary:true}].map(s=>({...s,format})));
 for(const scenario of plans){
  const {format}=scenario;
  const {M,scaleBoundary=false}=scenario;
  const K=4096,N=256,blockOffset=M===1?0:8,owned=[];let uniform;
  const tensor=(dtype,shape,data)=>{const t=runtime.tensorFromTypedArray(dtype,shape,data);owned.push(t);return t;};
  try{
   const {packed,values,scales,group}=(scenario.checkpointFixture??fixture(format,K*N,scaleBoundary)),blocks=values.length/32,totalBlocks=blocks+blockOffset,route=api.qaLut2[format],metadataWords=route.lutId===9?1:3;
   const src=tensor('uint32',[packed.length/4],new Uint32Array(packed.buffer)),bits=tensor('uint32',[totalBlocks*2],new Uint32Array(totalBlocks*2)),metadata=tensor('uint32',[totalBlocks/8*metadataWords],new Uint32Array(totalBlocks/8*metadataWords));
   const spec=route.spec,module=device.createShaderModule({code:spec.buildWgsl({f16Scales:false})}),pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
   uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(uniform,0,new Uint32Array([blocks,blockOffset,0,0]));
   const bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[src.buffer,bits.buffer,metadata.buffer,uniform].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
   pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.dispatchWorkgroups(Math.ceil(blocks/spec.workgroupSize));pass.end();device.queue.submit([encoder.finish()]);await runtime.queueIdle();
   const gotBits=await runtime.readTensor(bits),gotMetadata=await runtime.readTensor(metadata);let wrongValues=0,wrongScales=0;
   for(let i=0;i<values.length;i++){const b=blockOffset+Math.floor(i/32),e=i%32,q=(gotBits[b*2+(e>>4)]>>>((e&15)*2))&3;if(q-1!==values[i])wrongValues++;}
   for(let b=0;b<blocks;b+=group/32){const ob=b+blockOffset,word=route.lutId===9?ob>>3:(ob>>3)*3+((ob&7)>>2),shift=route.lutId===9?((ob>>2)&1)*16:((ob>>1)&1)*16;if(((gotMetadata[word]>>>shift)&65535)!==scales[b*32/group])wrongScales++;}
   const x=Float32Array.from({length:M*K},(_,i)=>scaleBoundary?1:Math.sin(i*.013)+((i*17)%101-50)/101),input=tensor('float32',[M,K],x),y=tensor('float32',[M,N],new Float32Array(M*N)),request={resources:{aT:input,bitsT:bits,scalesT:metadata,yT:y},args:{M,inFeatures:K,outFeatures:N,outStride:N,dstColStart:0,blockOffset,format:'lut2_32',lut:route.lutId,exact:1}};
   const selectedVariant=op.explain(runtime,request).selected;await op.run(runtime,request);await runtime.queueIdle();const actual=await runtime.readTensor(y);
   let maxAbsError=0,rms=0,finite=true,maxReference=0,maxRelativeError=0;const firstRowReferences=new Set;
   for(let row=0;row<M;row++)for(let column=0;column<N;column++){
    let expected=0;for(let k=0;k<K;k++){const index=column*K+k;expected+=x[row*K+k]*values[index]*half(scales[Math.floor(index/group)]);}
    if(row===0)firstRowReferences.add(expected);const error=Math.abs(actual[row*N+column]-expected);maxAbsError=Math.max(maxAbsError,error);if(expected!==0)maxRelativeError=Math.max(maxRelativeError,error/Math.abs(expected));rms+=error*error;finite&&=Number.isFinite(actual[row*N+column]);maxReference=Math.max(maxReference,Math.abs(expected));
   }
   const measured={...(scenario.checkpointFixture?{checkpointRows:scenario.checkpointFixture.source}:{}),format,lut:route.lutId,M,K,N,blockOffset,exact:1,scaleBoundary,inputDtype:'float32',outputDtype:'float32',packedValues:values.length,wrongValues,wrongScales,selectedVariant,finite,maxReference,distinctFirstRowReferences:firstRowReferences.size,maxAbsError,maxRelativeError,rmsError:Math.sqrt(rms/(M*N)),tolerance:0.001,relativeTolerance:scaleBoundary?0.00001:null,passed:wrongValues===0&&wrongScales===0&&finite&&(checkpoint?firstRowReferences.size>1:firstRowReferences.size===(scaleBoundary?7:N))&&maxAbsError<=0.001&&(!scaleBoundary||maxRelativeError<=0.00001)};result.cases.push(measured);console.log(JSON.stringify(measured));
  }finally{uniform?.destroy();for(const t of owned)t.destroy();}
 }
 result.passed=result.cases.length===12&&result.cases.every(c=>c.passed);
}catch(error){result.error=String(error.stack??error);result.passed=false;}
finally{try{await runtime?.destroy();}catch(error){result.cleanupError=String(error);result.passed=false;}delete navigator.gpu;gpu=null;}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error??null,cases:result.cases.length}));process.exit(result.passed?0:1);
