// Native local diagnostic only. Offers one inert tool schema; executes no tools.
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream,openAsBlob} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import os from 'node:os';
import {fileResponse} from '../../dist/ranges.js';
const [id,modelPath,runtimePath,output,backend='d3d12']=process.argv.slice(2),gpuModule=process.env.BABELSHELF_GPU_MODULE;
if(!id||!modelPath||!runtimePath||!output||!gpuModule||!['d3d12','metal','vulkan'].includes(backend))throw Error('Set BABELSHELF_GPU_MODULE; use MODEL_ID PINNED_MODEL PINNED_RUNTIME OUTPUT.json [backend]');
const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8')),model=manifest.models.find(m=>m.id===id);
if(!model)throw Error('Unknown pinned model');
const result={schema:1,at:new Date().toISOString(),scope:'Native Dawn real model plain-JSON/native-tool-format probe; no tool execution, product harness, browser, phone or broad quality acceptance',os:{platform:os.platform(),release:os.release(),arch:os.arch()},node:process.version,browser:null,backend,model:id,revision:model.revision,quantization:model.format,runtimeRevision:manifest.runtime.revision,freeMemoryBytes:os.freemem(),minimumFreeMemoryBytes:id==='2B'?768*1024**2:4*1024**3,contextTokens:512,decodePipelineDepth:1,profile:'greedy',cases:[],status:'starting'};
const save=()=>writeFile(output,JSON.stringify(result,null,2));
if(result.freeMemoryBytes<result.minimumFreeMemoryBytes){result.status='not-run';result.reason='Insufficient free system memory for intentional diagnostic';await save();console.log(JSON.stringify({status:result.status}));process.exit(2);}
const file=await openAsBlob(modelPath),runtime=await readFile(runtimePath),hash=createHash('sha256');
if(file.size!==model.file.bytes)throw Error('Model size mismatch');
for await(const part of createReadStream(modelPath,{highWaterMark:1024*1024}))hash.update(part);
result.modelSha256=hash.digest('hex');result.runtimeSha256=createHash('sha256').update(runtime).digest('hex');
if(result.modelSha256!==model.file.sha256||runtime.length!==manifest.runtime.file.bytes||result.runtimeSha256!==manifest.runtime.file.sha256)throw Error('Unverified local asset');
const modulePath=path.resolve(output+'.runtime.mjs');await writeFile(modulePath,runtime);
const {create,globals}=await import(pathToFileURL(path.resolve(gpuModule)).href);Object.assign(globalThis,globals);
const pkg=JSON.parse(await readFile(path.join(path.dirname(path.resolve(gpuModule)),'package.json'),'utf8'));result.gpuModule={package:pkg.name,version:pkg.version};
let gpu=create(['backend='+backend]),loaded,session,timer;Object.defineProperty(globalThis,'navigator',{value:{gpu},configurable:true});globalThis.fetch=async()=>{throw Error('Network disabled for native tool-format probe');};
const tool={type:'function',function:{name:'calculate',description:'Calculate a mathematical expression.',parameters:{type:'object',properties:{expression:{type:'string'}},required:['expression'],additionalProperties:false}}};
try{
 const api=await import(pathToFileURL(modulePath).href),url='https://local-model.invalid/'+model.file.name,controller=new AbortController;timer=setTimeout(()=>controller.abort(new DOMException('Diagnostic time limit','AbortError')),180000);
 result.status='loading';await save();
 loaded=await api.Qwen3_5ForConditionalGeneration.from_pretrained(url,{mmproj:null,fetch:async(input,options={})=>{if(String(input)!==url)throw Error('Unapproved resource');return fileResponse(file,options);},cache:false,maxLength:512,prefixSnapshotStore:null,decodePipelineDepth:1,signal:controller.signal,chatTemplateArgs:{enable_thinking:false}});
 result.device=loaded.deviceInfo();result.memory=loaded.memoryStats();session=loaded.create_session();
 for(const test of [{name:'plain-json',prompt:'Return only a JSON object with operation set to calculate and expression set to 7*8. Do not include Markdown or explanations.'},{name:'native-tool',prompt:'Use the calculate tool to compute 7*8.',tools:[tool]}]){
  session.reset();const messages=[{role:'user',content:test.prompt}],options={enable_thinking:false,...(test.tools?{tools:test.tools}:{})},count=session.count_tokens(messages,options);
  if(count.prompt_tokens+96>512)throw Error('Diagnostic context overflow');
  result.status='generating';await save();const events=[],stream=session.generate(messages,{...options,max_new_tokens:96,do_sample:false,decode_pipeline_depth:1,signal:controller.signal});let text='';
  for await(const event of stream){if(event.type==='text')text+=event.text;if(event.type==='tool_call')events.push(event.tool_call);}
  const raw=await stream.result,item={...test,inputTokens:count.prompt_tokens,outputTokens:raw.usage?.completion_tokens??null,text,message:raw.message,toolEvents:events,finishReason:raw.finish_reason,timings:raw.timings};
  if(test.name==='plain-json'){try{const p=JSON.parse(text);item.singleExpectedObject=p.operation==='calculate'&&p.expression==='7*8';}catch{item.singleExpectedObject=false;}}
  else{const calls=raw.message?.tool_calls??[],call=calls[0];let args=call?.function?.arguments;if(typeof args==='string')try{args=JSON.parse(args);}catch{}item.singleExpectedTool=calls.length===1&&events.length===1&&call.function?.name==='calculate'&&!call.errors?.length&&args&&Object.keys(args).length===1&&typeof args.expression==='string'&&args.expression.replace(/\s/g,'')==='7*8';}
  result.cases.push(item);await save();
 }
 result.status='recorded';
}catch(error){result.status='failed';result.error=String(error.stack??error);}
finally{clearTimeout(timer);const errors=[];for(const resource of [session,loaded])try{await resource?.dispose();}catch(error){errors.push(String(error));}if(errors.length){result.cleanupErrors=errors;result.status='failed';}delete navigator.gpu;gpu=null;}
await save();console.log(JSON.stringify({status:result.status,cases:result.cases.map(c=>({name:c.name,text:c.text,message:c.message,singleExpectedObject:c.singleExpectedObject,singleExpectedTool:c.singleExpectedTool})),error:result.error??null}));process.exit(result.status==='recorded'?0:1);
