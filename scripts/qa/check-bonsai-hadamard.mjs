// Actual pinned-runtime GPU kernels vs an independent CPU reference. No model
// generation, weights, browser launch or network. Instrumented bundle stays local.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const [runtimePath,output,backend='d3d12']=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use PINNED_RUNTIME_FILE OUTPUT.json [d3d12|metal|vulkan]');
const pin='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488',source=await readFile(runtimePath);
if(createHash('sha256').update(source).digest('hex')!==pin)throw Error('Unsupported runtime: QA internal names are valid only for the exact inspected hash');
const instrumented=path.resolve(output+'.runtime.mjs');
await writeFile(instrumented,Buffer.concat([source,Buffer.from('\nexport {lp as qaRuntime,rl as qaOperator,Hb as qaPacks};\n')]));
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const gpuPackage=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));
let gpu=create(['backend='+backend]),runtime;
Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});
globalThis.fetch=async()=>{throw Error('Network disabled for numerical probe');};
const result={schema:1,at:new Date().toISOString(),scope:'Native Dawn pinned BlockHadamard and exact-Q4 transcode numerical parity; not LUT2/matmul/full-model generation or browser/phone acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,gpuModule:{package:gpuPackage.name,version:gpuPackage.version},browser:null,backend,runtimeRevision:'621e20782f208660f4f58283c2ce58430020f243',runtimeSha256:pin,model:null,inputTokens:null,outputTokens:null,cases:[],packingCases:[]};
function packedFixture(format){
 const group=format==='Q2_0'?64:128,bytes=format==='Q2_0'?18:format==='PRISM_PQ2_0'?34:28,blocks=16,packed=new Uint8Array(blocks*bytes),view=new DataView(packed.buffer),values=new Int8Array(blocks*group),scales=new Uint16Array(blocks);
 for(let block=0;block<blocks;block++){
  const base=block*bytes,scale=block%2?0x3800:0x3c00;scales[block]=scale;
  for(let i=0;i<group;i++)values[block*group+i]=(i*7+block*11)%(format==='PRISM_PTQ1_0'?3:4)-1;
  view.setUint16(base+(format==='PRISM_PTQ1_0'?26:0),scale,true);
  if(format==='PRISM_PTQ1_0'){
   for(const [start,lanes,digits,offset]of [[0,16,5,0],[80,8,5,16],[120,2,4,24]])for(let lane=0;lane<lanes;lane++){
    let code=0;for(let digit=0;digit<digits;digit++)code=code*3+values[block*group+start+lane+digit*lanes]+1;
    packed[base+offset+lane]=Math.ceil(code*256/3**digits);
   }
  }else for(let i=0;i<group;i++)packed[base+2+(i>>2)]|=(values[block*group+i]+1)<<((i&3)*2);
 }
 return {packed,values,scales,group};
}
async function checkPacking(api,format,f16Scales){
 const {packed,values,scales,group}=packedFixture(format),numBlocks=values.length/32,owned=[];
 const tensor=(dtype,shape,data)=>{const t=runtime.tensorFromTypedArray(dtype,shape,data);owned.push(t);return t;};
 const device=runtime.host.device;let uniform;
 try{
  const src=tensor('uint32',[packed.length/4],new Uint32Array(packed.buffer)),bits=tensor('uint32',[numBlocks*4],new Uint32Array(numBlocks*4)),scale=tensor(f16Scales?'float16':'float32',[numBlocks],f16Scales?new Uint16Array(numBlocks):new Float32Array(numBlocks));
  const spec=api.qaPacks[format+'Q4'],module=device.createShaderModule({code:spec.buildWgsl({f16Scales})}),pipeline=await device.createComputePipelineAsync({layout:'auto',compute:{module,entryPoint:'main'}});
  uniform=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(uniform,0,new Uint32Array([numBlocks,0,0,0]));
  const bindGroup=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[src.buffer,bits.buffer,scale.buffer,uniform].map((buffer,binding)=>({binding,resource:{buffer}}))}),encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
  pass.setPipeline(pipeline);pass.setBindGroup(0,bindGroup);pass.dispatchWorkgroups(Math.ceil(numBlocks/spec.workgroupSize));pass.end();device.queue.submit([encoder.finish()]);await runtime.queueIdle();
  const gotBits=await runtime.readTensor(bits),gotScales=await runtime.readTensor(scale);let wrongValues=0,wrongScales=0;
  for(let i=0;i<values.length;i++){const b=Math.floor(i/32),e=i%32,byte=e%16,code=(gotBits[b*4+(byte>>2)]>>>((byte%4)*8+(e>>4)*4))&15;if(code-8!==values[i])wrongValues++;}
  for(let block=0;block<numBlocks;block++){const expected=scales[Math.floor(block*32/group)];if(gotScales[block]!== (f16Scales?expected:expected===0x3800?0.5:1))wrongScales++;}
  return {format,target:'exact-Q4',f16Scales,values:values.length,wrongValues,wrongScales,passed:wrongValues===0&&wrongScales===0};
 }finally{uniform?.destroy();for(const t of owned)t.destroy();}
}
function reference(input,signs,width,rows,{inverse=false,norm=false,gated=false,permuted=false}={}){
 const out=new Float64Array(input.length),group=128;
 const sourceIndex=column=>permuted?((Math.floor(column/group)%2)*16+Math.floor(Math.floor(column/group)/2))*group+column%group:column;
 for(let row=0;row<rows;row++){
  let square=0;for(let col=0;col<width;col++)square+=input[row*width+col]**2;
  for(let col=0;col<width;col++){
   const src=sourceIndex(col),v=input[row*width+src];let scaled=v;
   if(gated){let sum=0;const start=Math.floor(col/group)*group;for(let j=0;j<group;j++)sum+=input[row*width+sourceIndex(start+j)]**2;
    const gate=(src%17-8)/9;scaled=v/Math.sqrt(sum/group+1e-6)*(1+(col%group)/1000)*gate/(1+Math.exp(-gate));
   }else if(norm)scaled=v/Math.sqrt(square/width+1e-6)*(1+col/10000);
   out[row*width+col]=inverse?scaled:scaled*signs[col];
  }
  for(let base=row*width;base<(row+1)*width;base+=4096){
   for(let span=1;span<4096;span*=2)for(let pair=base;pair<base+4096;pair+=span*2)for(let j=0;j<span;j++){const a=out[pair+j],b=out[pair+span+j];out[pair+j]=a+b;out[pair+span+j]=a-b;}
   for(let j=0;j<4096;j++)out[base+j]=out[base+j]/64*(inverse?signs[(base-row*width)+j]:1);
  }
 }
 return out;
}
try{
 const api=await import(pathToFileURL(instrumented).href);runtime=await api.qaRuntime();const op=api.qaOperator('com.xenova.BlockHadamard');
 const d=runtime.device;result.device={adapterInfo:d.adapterInfo,features:[...d.features],limits:d.limits};
 const cases=[{name:'decode-forward',width:4096,rows:1},{name:'mlp-forward',width:12288,rows:1},{name:'prefill-forward',width:4096,rows:3},{name:'embedding-inverse',width:4096,rows:1,inverse:true},{name:'rms-forward',width:4096,rows:1,norm:true},{name:'gated-rms-forward',width:4096,rows:1,gated:true},{name:'grouped-gated-rms-forward',width:4096,rows:1,gated:true,permuted:true}];
 for(const c of cases){
  const {width,rows}=c,x=Float32Array.from({length:width*rows},(_,i)=>(i%37-18)/19),signs=Float32Array.from({length:width},(_,i)=>i%3===0?-1:1),expected=reference(x,signs,width,rows,c),owned=[];
  const tensor=(shape,data)=>{const t=runtime.tensorFromTypedArray('float32',shape,data);owned.push(t);return t;};
  try{
   const resources={xT:tensor([rows,width],x),signsT:tensor([width],signs),yT:tensor([rows,width],new Float32Array(width*rows))},args={width,blockSize:4096,inverse:!!c.inverse};
   if(c.norm||c.gated){resources.normWeightsT=tensor([c.gated?128:width],Float32Array.from({length:c.gated?128:width},(_,i)=>1+i/(c.gated?1000:10000)));Object.assign(args,{rmsEps:1e-6,normOffset:0});}
   if(c.gated){resources.gateT=tensor([rows,width],Float32Array.from({length:rows*width},(_,i)=>(i%width%17-8)/9));args.normGroupSize=128;}
   if(c.permuted)Object.assign(args,{inputGroupCount:16,inputGroupSize:128});
   const request={resources,args},portable=c.gated?(c.permuted?'fused_grouped_gated_norm':'fused_gated_norm'):c.norm?'fused_norm':'workgroup';
   for(const variant of [undefined,portable]){
    const selected=op.explain(runtime,request,{variant}).selected;
    await op.run(runtime,request,{variant});await runtime.queueIdle();const actual=await runtime.readTensor(resources.yT);
    let maxAbsError=0,sumError=0,finite=true;for(let i=0;i<actual.length;i++){const error=Math.abs(actual[i]-expected[i]);maxAbsError=Math.max(maxAbsError,error);sumError+=error*error;finite&&=Number.isFinite(actual[i]);}
    const measured={name:c.name,width,rows,requestedVariant:variant??'auto',selectedVariant:selected,finite,maxAbsError,rmsError:Math.sqrt(sumError/actual.length),tolerance:0.0001,passed:finite&&maxAbsError<=0.0001};result.cases.push(measured);console.log(JSON.stringify(measured));
   }
  }finally{for(const t of owned)t.destroy();}
 }
 for(const format of ['PRISM_PTQ1_0','PRISM_PQ2_0','Q2_0'])for(const f16Scales of [false,true]){const c=await checkPacking(api,format,f16Scales);result.packingCases.push(c);console.log(JSON.stringify(c));}
 result.passed=result.cases.length===14&&result.cases.every(c=>c.passed)&&result.packingCases.length===6&&result.packingCases.every(c=>c.passed);
}catch(error){result.error=String(error.stack??error);result.passed=false;}
finally{try{await runtime?.destroy();}catch(error){result.cleanupError=String(error);result.passed=false;}delete navigator.gpu;gpu=null;}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error??null,cases:result.cases.length}));process.exit(result.passed?0:1);
