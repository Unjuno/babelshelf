// Pinned-runtime GatedDeltaNet state/output parity at the 9B head geometry.
// Native arithmetic test vectors only; never generates a model answer.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const [runtimePath,output,backend='d3d12']=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use PINNED_RUNTIME_FILE OUTPUT.json [d3d12|metal|vulkan]');
const pin='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488',source=await readFile(runtimePath);
if(createHash('sha256').update(source).digest('hex')!==pin)throw Error('Unsupported runtime: QA internal names require the exact inspected hash');
const instrumented=path.resolve(output+'.runtime.mjs');await writeFile(instrumented,Buffer.concat([source,Buffer.from('\nexport {lp as qaRuntime,rl as qaOperator};\n')]));
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const pkg=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));
let gpu=create(['backend='+backend]),runtime;
Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});globalThis.fetch=async()=>{throw Error('Network disabled for numerical probe');};
const result={schema:1,at:new Date().toISOString(),scope:'Native float32 recurrent operator and tiled/grouped permutation vectors; not checkpoint projection layout, full model, browser or phone acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,gpuModule:{package:pkg.name,version:pkg.version},browser:null,backend,runtimeRevision:'621e20782f208660f4f58283c2ce58430020f243',runtimeSha256:pin,model:null,inputTokens:null,outputTokens:null,cases:[],layoutCases:[]};
const H=32,KH=16,D=128,V=128,L=17,keyWidth=KH*D,valueWidth=H*V,scale=1/Math.sqrt(D);
const q=Float32Array.from({length:L*keyWidth},(_,i)=>Math.sin(i*.017)),k=Float32Array.from({length:L*keyWidth},(_,i)=>Math.cos(i*.023)),v=Float32Array.from({length:L*valueWidth},(_,i)=>Math.sin(i*.031)/2),gate=Float32Array.from({length:L*2*H},(_,i)=>i%(2*H)<H?0.2+(i%11)/20:-0.1-(i%7)/50),initial=Float32Array.from({length:H*V*D},(_,i)=>Math.sin(i*.003)/100);
function reference(){
 const state=Float64Array.from(initial),out=new Float64Array(L*valueWidth);
 for(let token=0;token<L;token++)for(let head=0;head<H;head++){
  // The operator's GGUF-internal interleaved value-head order. Checkpoint
  // projection reordering is a separate contract, not proved by this reference.
  const kh=head%KH,base=token*keyWidth+kh*D;let qn=0,kn=0;
  for(let d=0;d<D;d++){qn+=q[base+d]**2;kn+=k[base+d]**2;}
  qn=1/Math.sqrt(qn+1e-6);kn=1/Math.sqrt(kn+1e-6);
  const decay=Math.exp(gate[token*2*H+H+head]),beta=gate[token*2*H+head];
  for(let channel=0;channel<V;channel++){
   const start=(head*V+channel)*D;let retrieved=0;
   for(let d=0;d<D;d++){state[start+d]*=decay;retrieved+=state[start+d]*k[base+d]*kn;}
   const delta=(v[token*valueWidth+head*V+channel]-retrieved)*beta;let y=0;
   for(let d=0;d<D;d++){state[start+d]+=k[base+d]*kn*delta;y+=state[start+d]*q[base+d]*qn;}
   out[token*valueWidth+head*V+channel]=y*scale;
  }
 }
 return {state,out};
}
function compare(actual,expected){let maxAbsError=0,finite=true;for(let i=0;i<expected.length;i++){finite&&=Number.isFinite(actual[i]);maxAbsError=Math.max(maxAbsError,Math.abs(actual[i]-expected[i]));}return {finite,maxAbsError,tolerance:0.00001,passed:finite&&maxAbsError<=0.00001};}
try{
 const api=await import(pathToFileURL(instrumented).href);runtime=await api.qaRuntime();const op=api.qaOperator('com.xenova.Qwen35LinearAttention'),d=runtime.device;result.device={adapterInfo:d.adapterInfo,features:[...d.features],limits:d.limits};const expected=reference();
 const transpose=api.qaOperator('ai.onnx.Transpose');
 for(const rows of [1,L]){
  const repeat=H/KH,data=Float32Array.from({length:rows*valueWidth},(_,i)=>i),input=runtime.tensorFromTypedArray('float32',[rows,repeat,KH,V],data),output=runtime.tensorFromTypedArray('float32',[rows,KH,repeat,V],new Float32Array(data.length));
  try{
   const request={resources:{x:input,y:output},attrs:{perm:[0,2,1,3]}},selectedVariant=transpose.explain(runtime,request).selected;await transpose.run(runtime,request);const actual=await runtime.readTensor(output);let mismatches=0;
   for(let row=0;row<rows;row++)for(let kh=0;kh<KH;kh++)for(let r=0;r<repeat;r++)for(let v=0;v<V;v++)if(actual[row*valueWidth+(kh*repeat+r)*V+v]!==data[row*valueWidth+(r*KH+kh)*V+v])mismatches++;
   const measured={rows,from:[rows,repeat,KH,V],to:[rows,KH,repeat,V],selectedVariant,mismatches,passed:mismatches===0};result.layoutCases.push(measured);console.log(JSON.stringify(measured));
  }finally{input.destroy();output.destroy();}
 }
 for(const mode of ['prefill','decode']){
  const owned=[],tensor=(shape,data)=>{const t=runtime.tensorFromTypedArray('float32',shape,data);owned.push(t);return t;},stateT=tensor([initial.length],initial),prefill=mode==='prefill',qT=tensor(prefill?[L,keyWidth]:[keyWidth],prefill?q:new Float32Array(keyWidth)),kT=tensor(prefill?[L,keyWidth]:[keyWidth],prefill?k:new Float32Array(keyWidth)),vT=tensor(prefill?[L,valueWidth]:[valueWidth],prefill?v:new Float32Array(valueWidth)),gateT=tensor(prefill?[L,2*H]:[2*H],prefill?gate:new Float32Array(2*H)),outT=tensor(prefill?[L,valueWidth]:[valueWidth],new Float32Array(prefill?L*valueWidth:valueWidth));
  try{
   const request={resources:{stateT,qT,kT,vT,gateT,outT},args:{numHeads:H,numKeyHeads:KH,headDimK:D,headDimV:V,scale,...prefill?{seqLen:L,realLen:L,workgroupSize:128,l2WorkgroupSize:128}:{workgroupSizeVec4:32,workgroupSizeScalar:128}}},selectedVariant=op.explain(runtime,request).selected;let actual;
   if(prefill){await op.run(runtime,request);actual=await runtime.readTensor(outT);}
   else{
    actual=new Float32Array(L*valueWidth);
    for(let token=0;token<L;token++){
     for(const [t,data,width]of [[qT,q,keyWidth],[kT,k,keyWidth],[vT,v,valueWidth],[gateT,gate,2*H]])runtime.host.device.queue.writeBuffer(t.buffer,0,data.subarray(token*width,(token+1)*width));
     await op.run(runtime,request);actual.set(await runtime.readTensor(outT),token*valueWidth);
    }
   }
   const outputCheck=compare(actual,expected.out),stateCheck=compare(await runtime.readTensor(stateT),expected.state),measured={mode,seqLen:L,numHeads:H,numKeyHeads:KH,headDimK:D,headDimV:V,stateDtype:'float32',selectedVariant,output:outputCheck,state:stateCheck,passed:outputCheck.passed&&stateCheck.passed};result.cases.push(measured);console.log(JSON.stringify(measured));
  }finally{for(const t of owned)t.destroy();}
 }
 result.passed=result.cases.length===2&&result.cases.every(c=>c.passed)&&result.layoutCases.length===2&&result.layoutCases.every(c=>c.passed);
}catch(error){result.error=String(error.stack??error);result.passed=false;}
finally{try{await runtime?.destroy();}catch(error){result.cleanupError=String(error);result.passed=false;}delete navigator.gpu;gpu=null;}
await writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,error:result.error??null,cases:result.cases.length}));process.exit(result.passed?0:1);
