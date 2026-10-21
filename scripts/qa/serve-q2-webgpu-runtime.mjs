// Actual sidebar-only whole-runtime check; all resources are loopback/private.
import http from 'node:http';
import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve, join} from 'node:path';
import {createHash} from 'node:crypto';
const [runtimeArg, modelArg, port = '4269', backend = 'gpu'] = process.argv.slice(2);
assert.ok(runtimeArg && modelArg && /^\d{4,5}$/.test(port) && ['gpu','cpu'].includes(backend), 'Usage: serve-q2-webgpu-runtime PRIVATE_RUNTIME QWEN3_06B_FILE [PORT] [gpu|cpu]');
const runtime = resolve(runtimeArg), model = resolve(modelArg), hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(await readFile(join(runtime, 'bundle.json'), 'utf8'));
assert.equal(receipt.compiled, true);
const compat = receipt.compat === true;
assert.equal(receipt.variant, compat ? 'Asyncify wasm32 experimental WebGPU + CPU fallback' : 'JSPI memory64 experimental WebGPU + CPU fallback');
assert.equal(receipt.gpuPatchSha256, '7b49cfe6875ce35341158d396508ff47057a81e184bf5a6beb1b9ebe006245e9');
const routes = new Map();
for (const pin of [...receipt.assets, receipt.bundle]) {
  const path = join(runtime, pin.name), bytes = await readFile(path);
  assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256);
  routes.set('/' + pin.name, path);
}
const modelPin = {repository: 'ggml-org/Qwen3-0.6B-GGUF', revision: '13ac06624948e4d8589cb4b6f90100837342fcb8', bytes: 428970080, sha256: 'da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4', quantization: 'Q4_0'};
assert.equal((await stat(model)).size, modelPin.bytes);
const digest = createHash('sha256'); for await (const chunk of createReadStream(model)) digest.update(chunk);
assert.equal(digest.digest('hex'), modelPin.sha256);
routes.set('/model.gguf', model);
const page = `<!doctype html><meta charset="utf-8"><title>GPU runtime check</title><style>body{font:18px system-ui;margin:2em;color:#142d25;background:#f4faf7}button,a{font:inherit;padding:14px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Linked GPU runtime</h1><p>Qwen3 0.6B Q4_0 - runtime integration only - not 8B/9B acceptance.</p><button id="run">Run ${backend.toUpperCase()} load and generation</button><pre id="state">Not run</pre><pre id="result"></pre><a id="save" hidden>Save result</a><script type="module">
import {Wllama} from '/wllama-count-q2-webgpu.js';
const backend=${JSON.stringify(backend)},receipt=${JSON.stringify(receipt)},model=${JSON.stringify(modelPin)},state=document.querySelector('#state'),view=document.querySelector('#result');
document.querySelector('#run').onclick=async()=>{document.querySelector('#run').disabled=true;let llm,timer,stopping;
 const compat=${JSON.stringify(compat)};
 const result={scope:'Actual sidebar linked '+(compat?'Asyncify wasm32':'JSPI memory64')+' GPU runtime; Q4_0 integration, not Q2_0 full-model/8B/9B/Safari/phone acceptance',at:new Date().toISOString(),userAgent:navigator.userAgent,crossOriginIsolated,backend,compat,settings:{n_ctx:2048,n_batch:128,n_ubatch:128,n_threads:1,n_gpu_layers:backend==='gpu'?99999:0,temperature:0,seed:0,cache_prompt:false,max_tokens:48,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object'}},receipt,model,logs:[],cases:[],passed:false};
 result.nativeErrors=[];
 const show=()=>view.textContent=JSON.stringify(result,null,2), log=(...args)=>{const line=args.map(String).join(' ');result.logs.push(line);if(['Device error!','Aborted(','ValidationError','Assertion failed'].some(marker=>line.includes(marker)))result.nativeErrors.push(line);if(result.logs.length>250)result.logs.shift();};
 const save=()=>{show();const a=document.querySelector('#save');if(a.href)URL.revokeObjectURL(a.href);a.href=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));a.download=backend==='gpu'?'q2-webgpu-runtime-browser.json':'q2-webgpu-runtime-cpu-browser.json';a.hidden=false;};
 // Force the explicitly selected local ABI on Chrome too. No UA spoofing or CDN resources.
 class QaWllama extends Wllama {getWorkerResources(){const resources=super.getWorkerResources();return compat?{...resources,compat:true,jsPath:location.origin+'/wllama.js'}:resources;}}
 const create=()=>new QaWllama({default:location.origin+'/wllama.wasm'},{logger:{debug:log,log,info:log,warn:log,error:log}});
 try{const adapter=await navigator.gpu?.requestAdapter();if(!adapter&&backend==='gpu')throw Error('No WebGPU adapter');result.adapter=Object.fromEntries(['vendor','architecture','device','description'].map(k=>[k,adapter?.info?.[k]??null]));result.features=[...(adapter?.features??[])];
 state.textContent='Reading verified local QA model';const file=new File([await(await fetch('/model.gguf')).blob()],'qwen3-0.6b-q4-0.gguf');
 // Bound hangs by terminating this QA runtime only; no app Worker is used.
 timer=setTimeout(()=>{result.watchdog=true;result.passed=false;stopping?.abort();llm?.exit().catch(log);state.textContent='Deadline reached';save();},240000);
 const load=async()=>{state.textContent='Loading '+backend+' model';llm=create();const start=performance.now();await llm.loadModel([file],{n_gpu_layers:backend==='gpu'?99999:0,n_threads:1,n_ctx:2048,n_batch:128,n_ubatch:128});return {elapsedMs:performance.now()-start,context:llm.getLoadedContextInfo(),version:Wllama.getLibllamaVersion(),resources:llm.getWorkerResources()};};
 result.load=await load();show();
 const run=async(name,stop=false)=>{state.textContent=name;stopping=new AbortController();const messages=[{role:'system',content:'Return only a JSON object with an answer string.'},{role:'user',content:stop?'List numbers from 1 to 100.':'What is 6 plus 7?'}],options={messages,chat_template_kwargs:{enable_thinking:false},response_format:{type:'json_object'}};
 const count=await llm.countChatTokens(options),start=performance.now();let text='',first=null,usage,timings,requested=false,stopAt=null,contentAfterStop=0,abortError=null;
 try{for await(const chunk of await llm.createChatCompletion({...options,max_tokens:stop?128:48,temperature:0,seed:0,cache_prompt:false,stream:true,return_tokens:true,abortSignal:stopping.signal})){const part=chunk.choices?.[0]?.delta?.content;if(part){if(requested)contentAfterStop++;text+=part;if(first===null)first=performance.now();if(stop&&!requested){requested=true;stopAt=performance.now();stopping.abort();}}if(chunk.usage)usage=chunk.usage;if(chunk.timings)timings=chunk.timings;}}
 catch(error){if(!requested||error.name!=='AbortError')throw error;abortError={name:error.name,message:error.message};}
 const entry={name,count,text,usage,timings,firstContentMs:first===null?null:first-start,totalMs:performance.now()-start,requested,aborted:stopping.signal.aborted,abortError,contentAfterStop,cancellationMs:stopAt===null?null:performance.now()-stopAt};
 if(!stop){entry.countAfter=await llm.countChatTokens(options);entry.generatedPromptTokens=usage?.prompt_tokens??timings?.prompt_n??null;let parsed;try{parsed=JSON.parse(text);}catch{}entry.passed=parsed?.answer==='13'&&Object.keys(parsed).join(',')==='answer'&&count===entry.countAfter&&count===entry.generatedPromptTokens;}
 else entry.passed=requested&&entry.aborted&&abortError?.name==='AbortError'&&contentAfterStop===0&&entry.cancellationMs<3000;
 result.cases.push(entry);show();return entry;};
 await run('Structured answer');await run('Stop after first content',true);await llm.exit();result.exited=true;result.reload=await load();await run('Fresh Worker after Stop');
 result.gpuEvidence=result.logs.filter(line=>/offload|WebGPU|webgpu|GPU buffer/.test(line));
 result.passed=result.cases.length===3&&result.cases.every(c=>c.passed)&&result.exited&&!result.watchdog&&result.nativeErrors.length===0&&result.load.resources.compat===compat&&result.reload.resources.compat===compat&&(backend==='gpu'?result.gpuEvidence.some(line=>/offloaded [1-9][0-9]*[/]/.test(line)):!result.logs.some(line=>/offloaded [1-9][0-9]*[/]/.test(line))&&result.logs.some(line=>/CPU.*model buffer size/.test(line)));
 }catch(error){result.error=error.stack??error.message;}finally{clearTimeout(timer);try{await llm?.exit();}catch(error){result.cleanupError=error.message;result.passed=false;}state.textContent=result.passed?'Passed bounded runtime integration':'Check results';save();}
};</script>`;
http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://127.0.0.1').pathname;res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method))throw Error();if(path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?undefined:page);return;}const file=routes.get(path);if(!file)throw Error();const info=await stat(file);res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.wasm')?'application/wasm':'application/octet-stream');res.setHeader('Content-Length',info.size);if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}).listen(Number(port),'127.0.0.1',()=>console.log('QA-only linked GPU runtime http://127.0.0.1:'+port));
