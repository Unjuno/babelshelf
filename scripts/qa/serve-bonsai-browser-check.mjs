// Explicit loopback-only QA. Uses the built product Worker and real local assets.
// Never deploy this server, its page or model/runtime files.
import http from 'node:http';
import {createHash} from 'node:crypto';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),[output,modelFile,runtimeFile,port='4219',mode='baseline']=process.argv.slice(2);
if(!['baseline','harness'].includes(mode))throw Error('Unknown QA mode');
if(!output||!modelFile||!runtimeFile||!/^\d{4,5}$/.test(port))throw Error('Use NEW_OUTPUT PINNED_2B_GGUF PINNED_RUNTIME [PORT]');
const out=path.resolve(output),app=path.join(root,'design/prototype/dist/app'),build=JSON.parse(await readFile(path.join(app,'build.json'),'utf8')),manifest=JSON.parse(await readFile(path.join(root,'dist/model-manifest.json'),'utf8'));
const model=manifest.models.find(m=>m.id==='2B'),worker=build.files.find(f=>/^\.\/assets\/bonsai-worker-[\w-]+\.js$/.test(f.path));
if(!worker||!model||(await stat(modelFile)).size!==model.file.bytes||(await stat(runtimeFile)).size!==manifest.runtime.file.bytes)throw Error('Missing current Worker or pinned-size local assets');
await mkdir(out,{recursive:false});
const {build:bundle}=await import(pathToFileURL(path.join(root,'design/prototype/node_modules/vite/dist/node/index.js')).href);
await bundle({configFile:false,build:{lib:{entry:path.join(root,'design/prototype/src/text-engine-router.ts'),formats:['es'],fileName:()=> 'router.js'},outDir:path.join(out,'router'),minify:false,emptyOutDir:false}});
if(mode==='harness')await bundle({configFile:false,build:{lib:{entry:path.join(root,'scripts/qa/native-harness-entry.ts'),formats:['es'],fileName:()=> 'harness.js'},outDir:path.join(out,'harness'),minify:false,emptyOutDir:false}});
const config={...manifest,models:[model],contextTokens:2048},identity={build:build.build,worker:worker.path,workerSha256:worker.sha256,routerSha256:createHash('sha256').update(await readFile(path.join(out,'router/router.js'))).digest('hex'),...(mode==='harness'?{harnessSha256:createHash('sha256').update(await readFile(path.join(out,'harness/harness.js'))).digest('hex')}:{})};
const page=`<!doctype html><meta charset="utf-8"><title>Bonsai browser check</title><style>body{font:18px system-ui;max-width:52em;margin:2em;color:#142d25;background:#f4faf7}button{font:inherit;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><h1>Bonsai browser check</h1><p>Real 2B, product Worker, isolated loopback origin. No knowledge or tools are modified. This is not the full product/PWA/phone acceptance.</p><button id="run">Run real model check</button><pre id="state">Not run</pre><pre id="result"></pre><script type="module">
import {Engine} from '/engine.js';
import {TextEngineRouter} from '/router.js';
const manifest=${JSON.stringify(config)},identity=${JSON.stringify(identity)},view=document.querySelector('#result'),state=document.querySelector('#state'),button=document.querySelector('#run');
button.onclick=async()=>{
 button.disabled=true;const result={schema:1,scope:'Actual sidebar browser product-Worker local2B prepare/generate/Stop/reload; no full harness/PWA/phone acceptance',at:new Date().toISOString(),userAgent:navigator.userAgent,identity,model:manifest.models[0],runtimeRevision:manifest.runtime.revision,mode:${JSON.stringify(mode)},contextTokens:2048,cases:[],passed:false};let engine,timer;
 const show=()=>{view.textContent=JSON.stringify(result,null,2);};
 const create=()=>new Engine(manifest,message=>{state.textContent=message;},new Worker('/app/'+identity.worker.slice(2),{type:'module'}));
 const events=(type,value)=>{if(type==='progress')state.textContent=String(value);};
 async function generated(name,prompt,maxTokens){state.textContent=name;const value=await engine.call('generate',{messages:[{role:'user',content:prompt}],maxTokens,resetSession:true},events);result.cases.push({name,prompt,...value});show();return value;}
 try{
  timer=setTimeout(()=>engine?.abort(),${mode==='harness'?360000:180000});state.textContent='Reading local QA assets';
  const [mb,rb]=await Promise.all(['/qa-model','/qa-runtime'].map(async url=>{const r=await fetch(url);if(!r.ok)throw Error('Local QA asset unavailable');return r.blob();}));
  engine=create();await engine.init();await engine.call('prepare',{model:'2B',allowNetwork:false,localFiles:[new File([mb],manifest.models[0].file.name),new File([rb],manifest.runtime.file.name)]},events);result.prepared=true;if(${JSON.stringify(mode)}==='baseline')result.load=await engine.load('2B',events);show();
  if(${JSON.stringify(mode)}==='harness'){const {checkNativeHarness}=await import('/harness.js');result.harness=await checkNativeHarness(engine,item=>{state.textContent=item.name;result.currentHarnessCase=item;show();});result.load=result.harness.load;result.passed=result.harness.passed;}else{
  const prose=await generated('English','Write one short sentence about a quiet garden.',64);result.englishNonempty=prose.text.trim().length>0&&!/^([!?.])\\1{15,}$/.test(prose.text.trim());
  const japanese=await generated('Japanese','日本語で、静かな庭について短い一文を書いてください。',64);result.japaneseScript=/[ぁ-んァ-ン一-龯]/.test(japanese.text);
  const structured=await generated('Structured request','Return only a JSON object with operation set to calculate and expression set to 7*8. Do not include Markdown or explanations.',96);try{const parsed=JSON.parse(structured.text);result.structuredExact=parsed.operation==='calculate'&&parsed.expression==='7*8';}catch{result.structuredExact=false;}
  const router=new TextEngineRouter(engine,()=>{throw Error('Optional engine must remain idle');},[],undefined,true);await router.load('2B');
  result.nativeCases=[];
  for(const [name,prompt,format]of [['Native answer','What is 6 plus 7? Answer only the number.','dialogue-answer'],['Native plan','Find notes about the meeting.',{type:'dialogue-plan',scope:{inputs:false,file:false,current:false,historyCount:0,assistantIndices:[]}}]]){
   const messages=[{role:'user',content:prompt}],count=await router.call('count',{messages,format});
   try{const value=await router.generate(messages,events,128,format);result.nativeCases.push({name,prompt,format,count,...value});}catch(error){result.nativeCases.push({name,prompt,format,count,error:error.message,diagnostic:error.diagnostic});}show();
  }
  result.nativeExact=result.nativeCases.every(c=>{try{const p=JSON.parse(c.text);return c.name==='Native answer'?p.answer==='13':p.action==='search'&&typeof p.query==='string';}catch{return false;}});
  let requested=false;try{const stopped=await engine.call('generate',{messages:[{role:'user',content:'Count from 1 to 200, writing every number.'}],maxTokens:384,resetSession:true},(type,value)=>{events(type,value);if(type==='text'&&!requested){requested=true;engine.abort();}});result.stop={requested,stopped:stopped.stopped===true};}catch(error){result.stop={requested,error:String(error.message),stopped:requested&&error.message==='Stopped'};}
  await engine.unload();result.sameWorkerReload=await engine.load('2B',events);
  const same=await generated('Same Worker after Unload','What is 6 plus 7? Reply with only the number.',32);result.moduleReuseVerified=result.load.timings.runtimeModuleReused===false&&result.sameWorkerReload.timings.runtimeModuleReused===true&&same.text.trim()==='13';
  await engine.unload();engine.worker.terminate();engine=create();await engine.init();result.reload=await engine.load('2B',events);
  const after=await generated('After Stop and fresh Worker','What is 6 plus 7? Reply with only the number.',32);result.afterReloadCorrect=after.text.trim()==='13';
  result.passed=result.englishNonempty&&result.japaneseScript&&result.structuredExact&&result.stop.stopped&&result.afterReloadCorrect;
  }
 }catch(error){result.error=String(error.stack??error);}
 finally{clearTimeout(timer);try{await engine?.unload();}catch(error){result.cleanupError=String(error.message);}engine?.worker.terminate();state.textContent=result.passed?'Passed bounded check':'Check results';show();button.disabled=false;}
 const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),a=document.createElement('a');a.textContent='Save result';a.download='bonsai-2b-browser.json';a.href=URL.createObjectURL(blob);view.after(a);
};</script>`;
await writeFile(path.join(out,'index.html'),page);
const allowed=new Map(build.files.map(f=>['/app/'+f.path.slice(2),path.join(app,f.path.slice(2))]));
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://127.0.0.1'),file=url.pathname==='/'?path.join(out,'index.html'):url.pathname==='/engine.js'?path.join(root,'dist/engine.js'):url.pathname==='/harness.js'&&mode==='harness'?path.join(out,'harness/harness.js'):url.pathname==='/router.js'?path.join(out,'router/router.js'):url.pathname==='/qa-model'?path.resolve(modelFile):url.pathname==='/qa-runtime'?path.resolve(runtimeFile):allowed.get(url.pathname);
  if(!file||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end();return;}
  const info=await stat(file),type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Content-Length':info.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
 }catch{res.writeHead(500);res.end('QA server error');}
});
server.listen(Number(port),'127.0.0.1',()=>console.log('Loopback QA http://127.0.0.1:'+port+' / build '+build.build));
