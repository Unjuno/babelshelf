// QA-only instrumentation. Never import this module into the product bundle.
import {createHash} from 'node:crypto';
export const runtimePin='00c1a72a962a84fee17000a6b1d18b24d75033e56d59996fc504b7c57cfc6488';
export const hookName='__babelShelfPrismTraceCompiled';
export function instrumentRuntime(bytes){
 if(createHash('sha256').update(bytes).digest('hex')!==runtimePin)throw Error('Activation trace requires the exact inspected runtime');
 let source=bytes.toString('utf8');
 const replace=(before,after)=>{if(source.split(before).length!==2)throw Error('Activation trace instrumentation boundary changed');source=source.replace(before,after);};
 // Retaining outputs changes allocation/lifetimes: diagnostic runs are not benchmarks.
 replace('return e.op(`com.xenova.SampleNextToken`,{logitsT:e.view(a,0,`float32`,[t.vocabSize],`${r}.scores`)',
  'e.output(t.hidden,`__babelTrace.${r}.hidden`);e.output(i,`__babelTrace.${r}.rotated`);e.output(a,`__babelTrace.${r}.logits`);return e.op(`com.xenova.SampleNextToken`,{logitsT:e.view(a,0,`float32`,[t.vocabSize],`${r}.scores`)');
 replace('this.onCompiled()}catch(e){this.steps=[],this.prefillSteps=null',
  `this.onCompiled();globalThis.${hookName}?.(this.runtime,s,r)}catch(e){this.steps=[],this.prefillSteps=null`);
 replace('this.onCompiled()}catch(e){this.steps=[],this.bodySteps=null',
  `this.onCompiled();globalThis.${hookName}?.(this.runtime,n,e.graph)}catch(e){this.steps=[],this.bodySteps=null`);
 return source+'\nexport {lp as qaRuntime,LC as qaGraph,_b as qaCompile,rl as qaOperator};\n';
}
function half(bits){const e=(bits>>10)&31,m=bits&1023,s=bits&32768?-1:1;return e===31?m?NaN:s*Infinity:s*(e?2**(e-15)*(1+m/1024):2**-14*m/1024);}
export function summarize(values,dtype){
 if(!['float32','float16'].includes(dtype))throw Error('Unsupported trace dtype');
 let finite=0,nan=0,infinity=0,zeros=0,min=null,max=null,mean=0,m2=0,firstNonfinite=null,argmax=null;
 for(let i=0;i<values.length;i++){
  const v=dtype==='float16'?half(values[i]):values[i];
  if(!Number.isFinite(v)){if(Number.isNaN(v))nan++;else infinity++;firstNonfinite??=i;continue;}
  finite++;if(v===0)zeros++;if(min===null||v<min)min=v;if(max===null||v>max){max=v;argmax=i;}const delta=v-mean;mean+=delta/finite;m2+=delta*(v-mean);
 }
 return {elements:values.length,finite,nan,infinity,zeros,firstNonfinite,min,max,mean:finite?mean:null,variance:finite?m2/finite:null,argmax};
}
export function createActivationTracer({onSnapshot,maxSnapshots=4,maxReadBytes=2*1024*1024}={}){
 if(typeof onSnapshot!=='function'||!Number.isSafeInteger(maxSnapshots)||maxSnapshots<1||maxSnapshots>16||!Number.isSafeInteger(maxReadBytes)||maxReadBytes<1||maxReadBytes>8*1024*1024)throw Error('Invalid trace bounds');
 const runtimes=new Map;let snapshots=0;
 const compiled=(runtime,program,graph)=>{
  const observed=graph.tensors.filter(t=>t.kind==='output'&&t.name.startsWith('__babelTrace.'));
  if(!observed.length)return;
  const bytes=observed.reduce((n,t)=>n+t.shape.reduce((a,b)=>a*b,1)*(t.dtype==='float16'?2:4),0);
  if(bytes>maxReadBytes)throw Error('Activation trace readback budget exceeded');
  const next=program.tensor('next_token');let state=runtimes.get(runtime);
  if(!state){
   const original=runtime.readTensor,read=original.bind(runtime);state={original,read,entries:new Map};runtimes.set(runtime,state);
   runtime.readTensor=async tensor=>{
    const entry=state.entries.get(tensor.buffer);
    if(entry&&tensor.dtype===entry.next.dtype&&tensor.byteOffset===entry.next.byteOffset&&tensor.byteLength===entry.next.byteLength&&snapshots<maxSnapshots){
     snapshots++;const tensors=[];
     for(const descriptor of entry.observed){const value=entry.program.tensor(descriptor.name);tensors.push({name:descriptor.name,dtype:value.dtype,shape:descriptor.shape,...summarize(await read(value),value.dtype)});}
     await onSnapshot({sequence:snapshots,graph:entry.graph,readbackBytes:entry.bytes,tensors});
    }
    return read(tensor);
   };
  }
  state.entries.set(next.buffer,{program,graph:graph.name,observed,next,bytes});
 };
 return {compiled,get snapshots(){return snapshots;},dispose(){for(const [runtime,state]of runtimes)runtime.readTensor=state.original;runtimes.clear();}};
}
