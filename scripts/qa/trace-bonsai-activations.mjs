// Explicit native QA runner. Never an app/PC/LAN inference backend.
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream,openAsBlob} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {fileResponse} from '../../dist/ranges.js';
import {instrumentRuntime,createActivationTracer,hookName,runtimePin} from './bonsai-activation-trace.mjs';
const [id,modelPath,runtimePath,output,backend='d3d12']=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!id||!modelPath||!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use MODEL_ID|self-check LOCAL_MODEL_OR_DASH PINNED_RUNTIME OUTPUT.json [backend]');
const selfCheck=id==='self-check',manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=selfCheck?null:manifest.models.find(m=>m.id===id);
if(manifest.runtime.file.sha256!==runtimePin)throw Error('Manifest runtime pin changed; re-audit the private trace boundaries');
if(!selfCheck&&!model)throw Error('Unknown pinned model');
const minimumFreeMemoryBytes=id==='2B'?768*1024**2:4*1024**3;
const result={schema:1,at:new Date().toISOString(),scope:selfCheck?'Real GPU compiled-graph trace plumbing with arithmetic fixtures; no model generation':'Native diagnostic generation with retained head activations and synchronous readback; not a performance benchmark/browser/phone result',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,browser:null,backend,model:id,modelRevision:model?.revision??null,quantization:model?.format??null,runtimeRevision:manifest.runtime.revision,runtimeSha256:runtimePin,freeMemoryBytes:os.freemem(),minimumFreeMemoryBytes,contextTokens:512,inputTokens:null,outputTokens:null,snapshots:[],status:'starting'};
const save=()=>writeFile(output,JSON.stringify(result,null,2));
// Operational QA floors, not compatibility/peak-memory estimates. Pinned2B has
// a506,313,984-byte static weight plan; reserve another~285MiB for this bounded
// context512 run. Keep9B's existing4GiB floor and never tune this in product UI.
if(!selfCheck&&result.freeMemoryBytes<result.minimumFreeMemoryBytes){result.status='not-run';result.reason='Insufficient free system memory for an intentional full-model diagnostic run';await save();console.log(JSON.stringify({status:result.status,freeMemoryBytes:result.freeMemoryBytes,minimumFreeMemoryBytes:result.minimumFreeMemoryBytes}));process.exit(2);}
const source=instrumentRuntime(await readFile(runtimePath)),instrumented=path.resolve(output+'.runtime.mjs');await writeFile(instrumented,source);
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const pkg=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));result.gpuModule={package:pkg.name,version:pkg.version};
let gpu=create(['backend='+backend]),runtime,loaded,session,compiled;const owned=[];
Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});globalThis.fetch=async()=>{throw Error('Network disabled for native activation trace');};
let traceArmed=selfCheck;
const tracer=createActivationTracer({maxSnapshots:selfCheck?2:4,shouldObserve:()=>traceArmed,onSnapshot:async snapshot=>{result.snapshots.push({phase:result.status,...snapshot});await save();}});globalThis[hookName]=tracer.compiled;
try{
 const api=await import(pathToFileURL(instrumented).href);
 if(selfCheck){
  runtime=await api.qaRuntime();result.device={adapterInfo:runtime.device.adapterInfo,features:[...runtime.device.features],limits:runtime.device.limits};
  const g=new api.qaGraph,src=g.weight('source','float32',[32]),scores=g.weight('scores','float32',[32]),outputs=[];
  for(const [name,input]of [['hidden',src],['rotated',src],['logits',scores]]){const dst=g.scratch('trace.'+name,'float32',[32]);g.op('com.xenova.StridedCopy',{srcT:input,dstT:dst},{args:{rows:1,srcStride:32,srcStart:0,dstStride:32,dstStart:0,copyCols:32}});outputs.push(g.output(dst,'__babelTrace.fixture.'+name));}
  const next=g.scratch('token','uint32',[1]);g.op('com.xenova.SampleNextToken',{logitsT:outputs[2],outT:next},{args:{maxTopK:64,topK:0,temperature:0}});g.output(next,'next_token');
  const graph=g.finish({name:'activation-trace-self-check'}),hidden=runtime.tensorFromTypedArray('float32',[32],Float32Array.from({length:32},(_,i)=>(i-16)/4)),logits=runtime.tensorFromTypedArray('float32',[32],Float32Array.from({length:32},(_,i)=>i===27?10:-20));owned.push(hidden,logits);
  compiled=api.qaCompile(graph,runtime,{weights:{source:hidden,scores:logits}});const steps=await compiled.buildSteps();tracer.compiled(runtime,compiled,graph);
  compiled.collector.enqueue(steps);const finiteToken=(await runtime.readTensor(compiled.tensor('next_token')))[0];
  runtime.host.writeBuffer(logits.buffer,0,new Float32Array(32).fill(NaN));compiled.collector.enqueue(steps);const invalidToken=(await runtime.readTensor(compiled.tensor('next_token')))[0];
  // A third read must not exceed the diagnostic snapshot bound.
  await runtime.readTensor(compiled.tensor('next_token'));
  const first=result.snapshots[0]?.tensors.find(t=>t.name.endsWith('.logits')),second=result.snapshots[1]?.tensors.find(t=>t.name.endsWith('.logits'));
  result.selfCheck={finiteToken,invalidToken,invalidTokenSemanticPass:null,finiteSummary:first,invalidSummary:second,snapshotCount:tracer.snapshots,passed:finiteToken===27&&first?.finite===32&&first.nan===0&&first.argmax===27&&second?.nan===32&&second.finite===0&&second.argmax===null&&tracer.snapshots===2};
  result.status=result.selfCheck.passed?'diagnostic-self-check-passed':'diagnostic-self-check-failed';
 }else{
  const file=await openAsBlob(modelPath);if(file.size!==model.file.bytes)throw Error('Model size mismatch');const hash=createHash('sha256');for await(const part of createReadStream(modelPath,{highWaterMark:1024*1024}))hash.update(part);result.modelSha256=hash.digest('hex');if(result.modelSha256!==model.file.sha256)throw Error('Model SHA256 mismatch');
  const url='https://local-model.invalid/'+model.file.name,fetchLocal=async(input,options={})=>{if(String(input)!==url)throw Error('Unapproved inference resource');return fileResponse(file,options);};
  result.status='loading';await save();
  const controller=new AbortController,timer=setTimeout(()=>controller.abort(new DOMException('Diagnostic time limit','AbortError')),180000);
  try{
   loaded=await api.Qwen3_5ForConditionalGeneration.from_pretrained(url,{mmproj:null,fetch:fetchLocal,cache:false,maxLength:512,prefixSnapshotStore:null,decodePipelineDepth:1,signal:controller.signal,chatTemplateArgs:{enable_thinking:false}});result.device=loaded.deviceInfo();result.memory=loaded.memoryStats();session=loaded.create_session();
   const messages=[{role:'user',content:'Write one short sentence about a quiet garden.'}];result.prompt=messages;result.inputTokens=session.count_tokens(messages,{enable_thinking:false}).prompt_tokens;result.status='generating';await save();
   traceArmed=true;
   const stream=session.generate(messages,{max_new_tokens:8,enable_thinking:false,do_sample:false,decode_pipeline_depth:1,signal:controller.signal});let text='';for await(const event of stream)if(event.type==='text')text+=event.text;
   const raw=await stream.result;result.generatedText=text;result.outputTokens=raw?.usage?.completion_tokens??null;result.finishReason=raw?.finish_reason??null;result.status=tracer.snapshots?'trace-recorded':'trace-missing';
  }finally{traceArmed=false;clearTimeout(timer);}
 }
}catch(error){result.status='failed';result.error=String(error.stack??error);}
finally{tracer.dispose();delete globalThis[hookName];try{compiled?.dispose();for(const tensor of owned)tensor.destroy();await session?.dispose();await loaded?.dispose();await runtime?.destroy();}catch(error){result.cleanupError=String(error);result.status='failed';}delete navigator.gpu;gpu=null;}
await save();console.log(JSON.stringify({status:result.status,snapshots:result.snapshots.length,error:result.error??null}));process.exit(['trace-recorded','diagnostic-self-check-passed'].includes(result.status)?0:1);
