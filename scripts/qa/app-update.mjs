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
function generation(number){
 const build=String(number).repeat(16);
 const html=`<!doctype html><title>Update fixture ${number}</title><p id="version">${build}</p><script type="module">
 import {refreshAppVersion,activeAppBuild} from './refresh.js';
 window.update=async()=>refreshAppVersion(await navigator.serviceWorker.getRegistration(),navigator.serviceWorker,5000);
 window.activeBuild=()=>activeAppBuild(navigator.serviceWorker);
 window.events=[];
 const reg=await navigator.serviceWorker.getRegistration()??await navigator.serviceWorker.register('./sw.js');
 let workerId=0;
 reg.addEventListener('updatefound',()=>{const worker=reg.installing,id=++workerId;window.events.push({worker:id,event:'found',state:worker?.state});worker?.addEventListener('statechange',()=>window.events.push({worker:id,event:'state',state:worker.state}));});
 </script>`;
 const files=new Map([['/index.html',html],['/refresh.js',helper],['/payload.txt',`verified generation ${number}`]]);
 const worker=productWorker({build,files:[...files].map(([path,body])=>({path:'.'+path,bytes:Buffer.byteLength(body),sha256:hash(body)})),remote:[]});
 return {build,files,worker};
}

test('one explicit refresh installs, activates and reopens a verified generation without losing local data',async()=>{
 const versions=[generation(1),generation(2),generation(3)];
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
  await page.evaluate(async()=>{
   localStorage.setItem('retained-draft','synthetic unsent draft');
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('update-fixture',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put({id:'fixture',versions:['original','correction']},'fixture');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
   // Synthetic canonical permission in this disposable context. The production
   // worker must still require Online before acquiring a replacement shell.
   const settings=await new Promise((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   await new Promise((resolve,reject)=>{const tx=settings.transaction('notes','readwrite');tx.objectStore('notes').put({id:'settings-connection',state:'active',ui:{managed:true},revisions:[{path:'Settings/connection.md',body:'# Connection\n\n```json\n{"downloads":true,"diagnosticLogs":false}\n```\n'}]});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});settings.close();
  });
  assert.equal(await page.evaluate(()=>window.update()),'Up to date');
  await page.evaluate(()=>{window.events=[];window.fixtureDraft='unsaved in memory';});
  current=1;delayPayload=true;
  assert.equal(await page.evaluate(()=>window.update()),'Updated');
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[1].build);
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
  assert.equal(await page.evaluate(()=>window.update()),'Updated');
  assert.equal(await page.evaluate(()=>window.activeBuild()),versions[2].build);
  await context.setOffline(true);await page.reload();
  assert.equal(await page.locator('#version').textContent(),versions[2].build);
  const retained=await page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('update-fixture');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const record=await new Promise((resolve,reject)=>{const r=db.transaction('records').objectStore('records').get('fixture');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
   return {draft:localStorage.getItem('retained-draft'),record};
  });
  assert.deepEqual(retained,{draft:'synthetic unsent draft',record:{id:'fixture',versions:['original','correction']}});
  console.log(JSON.stringify({scope:'PC Chromium, actual product worker and refresh helper; synthetic shell, no model/device acceptance',browser:browser.version(),firstEvents,workerChecks:requests.filter(r=>r.path==='/sw.js').map(r=>r.build),offlineReload:true,retained:true}));
  await context.close();
 }catch(error){
  console.error(JSON.stringify({scope:'Update fixture failure; request paths and synthetic builds only',requests}));
  throw error;
 }finally{
  await browser?.close();
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
});
