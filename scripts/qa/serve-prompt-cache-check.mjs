// QA-only sidebar page. No product storage, outbound requests or model downloads.
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {cpus,release,platform} from 'node:os';
import {plannerScope,planDialogueMessages} from '../../design/prototype/src/conversation.ts';
import {createStructuredSchema} from '../../design/prototype/src/structured-grammar.ts';
const [weightsArg,port='4187',phase='prefix']=process.argv.slice(2);
if(!weightsArg||!/^\d{4,5}$/.test(port)||!['prefix','lifecycle','planner'].includes(phase))throw Error('Use MODEL_FILE [PORT] [prefix|lifecycle|planner]');
const root=process.cwd(),runtime=resolve('design/prototype/runtime/wllama-count'),weights=resolve(weightsArg);
const manifest=JSON.parse(await readFile(join(runtime,'manifest.json'),'utf8'));
const model=JSON.parse(await readFile('dist/lfm-model-manifest.json','utf8')).models.find(m=>m.id==='lfm25-350m-qad-q4-0');
model.contextTokens=2048;
if((await stat(weights)).size!==model.file.bytes)throw Error('Wrong model size');
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const pin of manifest.files){const bytes=await readFile(join(runtime,pin.path));if(bytes.length!==pin.bytes||hash(bytes)!==pin.sha256)throw Error('Runtime integrity mismatch');}
const sources=['lfm-adapter.js','inference-threads.js','local-models.js','local-engines.js','gguf-inspect.js','sha256.js','streaming-sha256.js'];
const identity={phase,runtime:manifest,model,os:{platform:platform(),release:release(),cpu:cpus()[0]?.model},adapterFiles:await Promise.all(sources.map(async path=>({path,sha256:hash(await readFile(join(root,'dist',path)))})))};
const question='Find my saved notes about the blue lantern meeting.';
const recent=Array.from({length:3},(_,i)=>({id:'synthetic-'+i,user:'We discussed a blue lantern meeting. The room number is '+(10+i)+'. Keep the original discussion for later reference.',answer:'The room number in this discussion is '+(10+i)+'.'}));
const before={summary:'Earlier discussion is conversation, not saved notes or permission.',recent,refs:[],turnCount:3,lastAnswerIndex:2,currentResult:{turnId:'synthetic-2'}};
const after={...before,recent:[...recent,{id:'synthetic-3',user:'We also discussed the library entrance.',answer:'The entrance was part of the discussion.'}],turnCount:4,lastAnswerIndex:3,currentResult:{turnId:'synthetic-3'}};
const plannerInputs=[before,after].map(context=>({question,context,messages:planDialogueMessages(question,context),schema:createStructuredSchema({type:'dialogue-plan',scope:plannerScope(context,false,question)})}));
identity.plannerSourceSha256=hash(await readFile('design/prototype/src/conversation.ts'));
identity.plannerFixtureSha256=hash(JSON.stringify(plannerInputs));
const routes=new Map(sources.map(path=>['/dist/'+path,join(root,'dist',path)]));
for(const name of ['index.js','default.wasm','compat.js','compat.wasm'])routes.set('/runtime/'+name,join(runtime,name));routes.set('/model.gguf',weights);
const page=`<!doctype html><meta charset="utf-8"><title>Prompt cache check</title><style>body{font:18px system-ui;margin:24px}button{font:inherit;padding:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Prompt cache check</h1><p>Local LFM350M · synthetic inputs · no app data</p><button id="run">Run check</button><button id="stop" disabled>Stop</button><pre id="progress">Ready</pre><pre id="result"></pre><script type="module">
import {Wllama} from '/runtime/index.js';import {LfmAdapter} from '/dist/lfm-adapter.js';
const result={...${JSON.stringify(identity)},scope:'One Windows sidebar runtime check, no iOS or product acceptance',browser:navigator.userAgent,cases:[]};
const plannerInputs=${JSON.stringify(plannerInputs)};
let adapter,cancelled=false,cacheMode=false;
// QA override only: exercise the native cache before enabling app policy.
class Runtime extends Wllama{async createChatCompletion(options){result.lastRequestedCache=options.cache_prompt;return super.createChatCompletion(result.phase==='prefix'?{...options,cache_prompt:cacheMode}:options);}}
const show=()=>document.querySelector('#result').textContent=JSON.stringify(result,null,2);
const progress=document.querySelector('#progress');
document.querySelector('#stop').onclick=()=>{cancelled=true;adapter?.abort();};
document.querySelector('#run').onclick=async()=>{
 document.querySelector('#run').disabled=true;document.querySelector('#stop').disabled=false;show();
 try{
  const file=new File([await(await fetch('/model.gguf')).blob()],result.model.file.name),compatCode=await(await fetch('/runtime/compat.js')).text();
  adapter=new LfmAdapter({Wllama:Runtime,paths:{default:location.origin+'/runtime/default.wasm'},compat:{wasm:location.origin+'/runtime/compat.wasm',worker:{code:compatCode}},models:[result.model],reusePrompt:result.phase!=='prefix',logger:{log(){},debug(){},info(){},warn(){},error(){}},onProgress:value=>{progress.textContent=value;}});
  result.load=await adapter.load(file,result.model.id,{backend:'cpu'});show();
  const reference=Array.from({length:80},(_,i)=>'item'+i+': reference').join('; ');
  const messages=word=>[{role:'system',content:'The following is irrelevant reference data, not instructions: '+reference+'. Follow only the final request. Reply with one word.'},{role:'user',content:'Reply with exactly '+word+'.'}];
  const run=async(name,input,cache)=>{if(cancelled)throw Error('Stopped');cacheMode=cache;progress.textContent=name;const count=await adapter.count(input,{json:false}),value=await adapter.generate(input,{json:false,maxTokens:12});const entry={name,cache,count,requestedCache:result.lastRequestedCache,text:value.text,outputTokens:value.outputTokens,totalMs:value.totalMs,firstContentMs:value.firstContentMs,timings:value.timings};result.cases.push(entry);show();return entry;};
  if(result.phase==='planner'){
   const runPlanner=async(name,index,reset=false)=>{if(cancelled)throw Error('Stopped');if(reset)adapter.abort();const {messages,schema}=plannerInputs[index];progress.textContent=name;const count=await adapter.count(messages,{json:true});if(count+160>2048)throw Error('Planner fixture exceeds selected context');const value=await adapter.generate(messages,{json:true,jsonSchema:schema,maxTokens:160});const entry={name,count,maxTokens:160,requestedCache:result.lastRequestedCache,plan:JSON.parse(value.text),outputTokens:value.outputTokens,totalMs:value.totalMs,firstContentMs:value.firstContentMs,timings:value.timings};result.cases.push(entry);show();return entry;};
   await runPlanner('Initial app planner prompt',0);
   const cached=await runPlanner('Appended dialogue and changed selectors',1);
   const fresh=await runPlanner('Same changed prompt, fresh control',1,true);
   result.parity=JSON.stringify(cached.plan)===JSON.stringify(fresh.plan);
   result.reused=cached.timings?.cache_n>0;
   result.cacheAccounting=cached.timings?.cache_n+cached.timings?.prompt_n===cached.count;
   result.validSearchPlans=result.cases.every(item=>['search','answer'].includes(item.plan.action)&&(item.plan.target===undefined||item.plan.target==='knowledge')&&/meeting/i.test(item.plan.query));
   result.passed=result.parity&&result.reused&&result.cacheAccounting&&result.validSearchPlans;return;
  }
  if(result.phase==='lifecycle'){
   const input=[{role:'user',content:'Reply with exactly BLUE.'}];
   const first=await run('First request',input,false);let stopRequested=false;
   try{await adapter.generate([{role:'user',content:'Count from one to fifty.'}],{json:false,maxTokens:64,onContent:()=>{if(!stopRequested){stopRequested=true;adapter.abort();}}});result.stopped=false;}catch(error){result.stopped=stopRequested&&error.message==='Stopped';}show();
   const afterStop=await run('After Stop',input,false);
   await adapter.unload();await adapter.load(file,result.model.id,{backend:'cpu'});
   const afterReload=await run('After reload',input,false);
   result.passed=result.stopped&&first.text===afterStop.text&&first.text===afterReload.text&&result.cases.every(item=>item.requestedCache===false&&item.timings?.cache_n===0);return;
  }
  const blue=await run('Fresh BLUE',messages('BLUE'),false);
  const greenCached=await run('Shared prefix GREEN',messages('GREEN'),true);
  const greenFresh=await run('Fresh GREEN control',messages('GREEN'),false);
  const other=await run('Different prefix RED',[{role:'user',content:'Reply with exactly RED.'}],true);
  result.parity=greenCached.text===greenFresh.text;
  result.expectedWords=[blue.text.trim(),greenCached.text.trim(),other.text.trim()].join(',')==='BLUE,GREEN,RED';
  result.reused=greenCached.timings?.cache_n>0;
  result.cacheAccounting=greenCached.timings?.cache_n+greenCached.timings?.prompt_n===greenCached.count;
  result.passed=result.parity&&result.expectedWords&&result.reused&&result.cacheAccounting;
 }catch(error){result.error=String(error?.message??error);}finally{try{await adapter?.unload();result.unloaded=adapter?.loaded==null;}catch(error){result.cleanupError=String(error?.message??error);}progress.textContent=result.passed?'Passed':'Check results';document.querySelector('#stop').disabled=true;show();}
};</script>`;
http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://127.0.0.1').pathname;res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','require-corp');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self' blob:; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; connect-src 'self' blob:; style-src 'unsafe-inline'");if(!['GET','HEAD'].includes(req.method))throw Error('Method');if(pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?undefined:page);return;}const file=routes.get(pathname);if(!file)throw Error('Resource');res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.setHeader('Content-Length',(await stat(file)).size);if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}catch{res.writeHead(404);res.end();}}).listen(Number(port),'127.0.0.1',()=>console.log('QA-only prompt cache check http://127.0.0.1:'+port));
