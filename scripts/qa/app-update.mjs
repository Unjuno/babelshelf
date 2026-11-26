// Isolated browser protocol regression. Uses production refresh/worker code,
// synthetic shell assets and disposable browser storage; never user profiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {productWorker} from '../product-worker.mjs';

const helper=stripTypeScriptTypes(await readFile(new URL('../../design/prototype/src/offline-shell.ts',import.meta.url),'utf8'));
const hash=value=>createHash('sha256').update(value).digest('hex');
function generation(number,feedbackEndpoint,remote=[]){
 const build=String(number).repeat(16);
 const html=`<!doctype html><title>Update fixture ${number}</title><p id="version">${build}</p><script type="module">
 import {refreshAppVersion,activeAppBuild} from './refresh.js';
 window.update=async()=>refreshAppVersion(await navigator.serviceWorker.getRegistration(),navigator.serviceWorker,5000);
 window.activeBuild=()=>activeAppBuild(navigator.serviceWorker);
 window.events=[];
 // A first install now checks the same explicit Online preference as an
 // update. This disposable fixture must establish it before registration.
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put({id:'settings-connection',state:'active',ui:{managed:true},revisions:[{path:'Settings/connection.md',body:'# Connection\\n\\n\`\`\`json\\n{"downloads":true,"diagnosticLogs":false}\\n\`\`\`\\n'}]});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 const reg=await navigator.serviceWorker.getRegistration()??await navigator.serviceWorker.register('./sw.js');
 let workerId=0;
 reg.addEventListener('updatefound',()=>{const worker=reg.installing,id=++workerId;window.events.push({worker:id,event:'found',state:worker?.state});worker?.addEventListener('statechange',()=>window.events.push({worker:id,event:'state',state:worker.state}));});
 </script>`;
 const files=new Map([['/index.html',html],['/refresh.js',helper],['/payload.txt',`verified generation ${number}`]]);
 const worker=productWorker({build,feedbackEndpoint,files:[...files].map(([path,body])=>({path:'.'+path,bytes:Buffer.byteLength(body),sha256:hash(body)})),remote});
 // Model an already-installed predecessor that routes its own script through
 // the app cache and therefore blocks direct update diagnostics.
 const legacyWorker=number===1?worker.replace(/\s*\/\/ Keep the registration script[\s\S]*?return;\n/,''):worker;
 if(number===1&&legacyWorker===worker)throw Error('Legacy service-worker fixture was not created');
 return {build,files,worker:legacyWorker};
}

test('one explicit refresh installs, activates and reopens a verified generation without losing local data',async()=>{
 const versions=[generation(1),generation(2),generation(3),generation(4)];
 let current=0,corrupt=false,delayPayload=false;
 const requests=[];
 const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  const selected=versions[current];requests.push({path,build:selected.build});
  response.setHeader('Cache-Control','public, must-revalidate, max-age=0');
  response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path==='/'||path==='/index.html'?'text/html':'text/plain');
  const body=path==='/sw.js'?selected.worker:selected.files.get(path==='/'?'/index.html':path);
  if(body===undefined){response.writeHead(404);response.end();return;}
  if(path==='/payload.txt'&&delayPayload){setTimeout(()=>response.end(corrupt?'incorrect bytes':body),150);return;}
  response.end(path==='/payload.txt'&&corrupt?'incorrect bytes':body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext(),page=await context.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>navigator.serviceWorker.controller&&window.update);
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[0].build);
  const blockedScript=await page.evaluate(async()=>{const response=await fetch('./sw.js',{cache:'no-store'});return {status:response.status,body:await response.text()};});
  assert.equal(blockedScript.status,503,'legacy worker must reproduce its blocked direct script request');
  await page.evaluate(async()=>{
   localStorage.setItem('retained-draft','synthetic unsent draft');
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('update-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put({id:'fixture',versions:['original','correction']},'fixture');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
   // Synthetic canonical permission in this disposable context. The production
   // worker must still require Online before acquiring a replacement shell.
   const settings=await new Promise((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=settings.transaction('notes','readwrite');tx.objectStore('notes').put({id:'settings-connection',state:'active',ui:{managed:true},revisions:[{path:'Settings/connection.md',body:'# Connection\n\n```json\n{"downloads":true,"diagnosticLogs":false}\n```\n'}]});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});settings.close();
  });
  await page.evaluate(async()=>{
   // A model-like OPFS sentinel stands in for already prepared weights.
   const root=await navigator.storage.getDirectory(),models=await root.getDirectoryHandle('babelshelf-text-lfm-v1',{create:true});
   const model=await models.getFileHandle('update-retention-fixture.gguf',{create:true}),writer=await model.createWritable();
   await writer.write(new TextEncoder().encode('synthetic prepared model bytes'));await writer.close();
  });
  assert.equal(await page.evaluate(()=>window.update()),'Up to date');
  await page.evaluate(()=>{window.events=[];window.fixtureDraft='unsaved in memory';});
  current=1;delayPayload=true;
  assert.equal(await page.evaluate(()=>window.update()),'Updated');
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[1].build);
  const reachableScript=await page.evaluate(async()=>{const response=await fetch('./sw.js',{cache:'no-store'}),body=await response.text();return {status:response.status,build:body.match(/^const BUILD=\"([a-f0-9]{16})\"/)?.[1]??null};});
  assert.deepEqual(reachableScript,{status:200,build:versions[1].build},'updated worker must leave the server registration script reachable');
  // Activation must not reload a page or erase its unsaved in-memory work.
  assert.equal(await page.locator('#version').textContent(),versions[0].build);
  assert.equal(await page.evaluate(()=>window.fixtureDraft),'unsaved in memory');
  const firstEvents=await page.evaluate(()=>window.events);
  await page.reload();
  assert.equal(await page.locator('#version').textContent(),versions[1].build);
  await page.waitForFunction(()=>window.update);

  // A corrupt new generation must fail, leaving the last verified app usable.
  current=2;corrupt=true;
  const failed=await page.evaluate(()=>window.update().then(value=>({value}),error=>({error:error.message})));
  assert.match(failed.error,/verification failed/);
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[1].build);
  assert.equal(await page.locator('#version').textContent(),versions[1].build);
  corrupt=false;
  // Stage generation 3 without applying it, then publish generation 4.
  // One refresh must not stop at the already-waiting generation.
  await page.evaluate(async()=>{await (await navigator.serviceWorker.getRegistration()).update();});
  // The pinned Playwright poller treats a Promise as a truthy predicate. Await
  // the actual worker lifecycle in evaluate instead of an async waitForFunction.
  await page.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration(),worker=reg.installing??reg.waiting;
   if(!worker)throw Error('Staged worker missing');
   await new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve();};
    const check=()=>{if(worker.state==='installed')finish();else if(worker.state==='redundant')finish(Error('Staged worker installation failed'));};
    const timer=setTimeout(()=>finish(Error('Staged worker installation timed out')),5000);
    worker.addEventListener('statechange',check);check();
   });
   if(reg.waiting!==worker)throw Error('Staged worker is not waiting');
  });
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[1].build);
  const staged=await page.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration(),worker=reg.waiting;
   const request=type=>new Promise((resolve,reject)=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();reject(Error('Staged worker observation timed out'));},2000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage(type,[channel.port2]);});
   return {installing:reg.installing?.state??null,waiting:worker?.state,build:await request('build'),shell:await request({type:'check-app-shell'}),events:window.events};
  });
  console.log(JSON.stringify({scope:'Staged worker before server publication',staged}));
  assert.equal(staged.installing,null);assert.equal(staged.waiting,'installed');assert.equal(staged.build.build,versions[2].build);assert.equal(staged.shell.status,'ready');
  current=3;
  assert.equal(await page.evaluate(()=>window.update()),'Updated');
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[3].build);
  await context.setOffline(true);await page.reload();
  assert.equal(await page.locator('#version').textContent(),versions[3].build);
  const retained=await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('update-fixture');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const record=await new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get('fixture');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
   const root=await navigator.storage.getDirectory(),models=await root.getDirectoryHandle('babelshelf-text-lfm-v1');
   const model=await(await models.getFileHandle('update-retention-fixture.gguf')).getFile();
   return {draft:localStorage.getItem('retained-draft'),record,model:new TextDecoder().decode(await model.arrayBuffer())};
  });
  assert.deepEqual(retained,{draft:'synthetic unsent draft',record:{id:'fixture',versions:['original','correction']},model:'synthetic prepared model bytes'});
  const modelAssetRequests=requests.filter(r=>/\.gguf$|\/models?\//i.test(r.path));
  assert.deepEqual(modelAssetRequests,[]);
  console.log(JSON.stringify({scope:'PC Chromium, actual product worker and refresh helper; synthetic shell and OPFS model sentinel, no real-model/device acceptance',browser:browser.version(),firstEvents,workerChecks:requests.filter(r=>r.path==='/sw.js').map(r=>r.build),offlineReload:true,retained:true,modelAssetRequests:modelAssetRequests.length}));
  await context.close();
 }catch(error){
  console.error(JSON.stringify({scope:'Update fixture failure; request paths and synthetic builds only',requests}));
  throw error;
 }finally{
  await browser?.close();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
});

test('controlled Chromium distinguishes a network exception, remote HTTP error and Offline',async()=>{
 const receiver=createServer((req,res)=>{if(req.url==='/broken'){req.socket.destroy();return;}res.writeHead(503,{'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'x-babelshelf-failure','x-babelshelf-failure':'network'}).end('remote error');});
 await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+receiver.address().port,version=generation(2,undefined,[base+'/broken',base+'/status']);
 const server=createServer((req,res)=>{const body=req.url==='/sw.js'?version.worker:version.files.get(req.url==='/'?'/index.html':req.url);if(body===undefined){res.writeHead(404).end();return;}res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(body);});
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch();const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const read=path=>page.evaluate(async url=>{const response=await fetch(url,{credentials:'omit'});return {status:response.status,marker:response.headers.get('x-babelshelf-failure'),body:await response.text()};},base+path);
  assert.deepEqual(await read('/broken'),{status:503,marker:'network',body:'Network request failed'});
  assert.deepEqual(await read('/status'),{status:503,marker:null,body:'remote error'});
  await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').put({id:'settings-connection',state:'active',ui:{managed:true},revisions:[{path:'Settings/connection.md',body:'# Connection\n\n```json\n{"downloads":false,"diagnosticLogs":false}\n```\n'}]});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();});
  assert.deepEqual(await read('/broken'),{status:503,marker:null,body:'App is offline'});
 }finally{await browser?.close();server.closeAllConnections();receiver.closeAllConnections();await Promise.all([new Promise(resolve=>server.close(resolve)),new Promise(resolve=>receiver.close(resolve))]);}
});

test('controlled Chromium delivers the explicit feedback body to a separate local origin',async()=>{
 const bodies=[];
 const receiver=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST');
  res.setHeader('Access-Control-Allow-Headers','content-type');
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  if(req.method!=='POST'||req.url!=='/v1/feedback'){res.writeHead(404).end();return;}
  let body='';
  for await(const chunk of req)body+=chunk;
  bodies.push(body);
  res.writeHead(201).end('accepted');
 });
 await new Promise(resolve=>receiver.listen(0,'127.0.0.1',resolve));
 const endpoint='http://127.0.0.1:'+receiver.address().port+'/v1/feedback';
 const version=generation(2,endpoint);
 const server=createServer((req,res)=>{
  const body=req.url==='/sw.js'?version.worker:version.files.get(req.url==='/'?'/index.html':req.url);
  if(body===undefined){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':req.url.endsWith('.txt')?'text/plain':'text/html');
  res.end(body);
 });
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch();
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const body=JSON.stringify({category:'bug',message:'local QA',build:version.build});
  const result=await page.evaluate(async({endpoint,body})=>{
   const response=await fetch(endpoint,{method:'POST',mode:'cors',credentials:'omit',cache:'no-store',redirect:'error',headers:{'content-type':'application/json'},body});
   return [response.status,await response.text()];
  },{endpoint,body});
  assert.deepEqual(result,[201,'accepted']);
  assert.deepEqual(bodies,[body]);
 }finally{
  await browser?.close();
  server.close();
  receiver.close();
 }
});
