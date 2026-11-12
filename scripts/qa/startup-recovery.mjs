// Disposable browser regression for a retained worker with lost/corrupt caches.
// No user profile, model download or storage reset is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {productWorker} from '../product-worker.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const build='1111111111111111';
const html='<!doctype html><title>Startup fixture</title><h1>App ready</h1><script src="./assets/main-START123.js"></script>';
const script='window.appReady=true;';
const files=[{path:'./index.html',bytes:Buffer.byteLength(html),sha256:hash(html)},
 {path:'./assets/main-START123.js',bytes:Buffer.byteLength(script),sha256:hash(script)}];

test('missing shell and boot assets expose offline-safe recovery and preserve local data',async()=>{
 const requests=[];let corrupt=false,currentHtml=html;
 let worker=productWorker({build,files,remote:[]});
 const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://localhost').pathname;requests.push(path);
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Cross-Origin-Opener-Policy','same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy','require-corp');
  response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
  const body=path==='/sw.js'?worker:path==='/assets/main-START123.js'?(corrupt?'incorrect bytes':script):currentHtml;
  response.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:700}}),page=await context.newPage();
  const scriptErrors=[];page.on('pageerror',error=>scriptErrors.push(error.message));
  page.setDefaultTimeout(10000);
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(()=>window.appReady);
  assert.equal(await page.evaluate(()=>navigator.serviceWorker.controller),null);
  await page.evaluate(async()=>{
   // Canonical app networking is Offline throughout recovery.
   const request=indexedDB.open('mlb-memory-v1',1);
   const db=await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('notes',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('notes','readwrite');
    tx.objectStore('notes').put({id:'settings-connection',state:'active',ui:{managed:true},revisions:[{path:'Settings/connection.md',body:'# Connection\n\n```json\n{"downloads":false,"diagnosticLogs":false}\n```\n'}]});
    tx.objectStore('notes').put({id:'retained-note',revisions:[{body:'original'},{body:'correction'}]});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });db.close();localStorage.setItem('retained-draft','unsent text');
   await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  const preserved=()=>page.evaluate(async()=>{
   const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('mlb-memory-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const notes=await new Promise((resolve,reject)=>{const r=db.transaction('notes').objectStore('notes').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
   return {notes,draft:localStorage.getItem('retained-draft')};
  });
  const original=await preserved();
  // Simulate the browser losing CacheStorage while retaining its registration.
  await page.evaluate(async()=>{for(const name of await caches.keys())await caches.delete(name);});
  await context.setOffline(true);requests.length=0;
  const missing=await page.reload();
  assert.equal(missing.status(),503);
  await page.getByRole('heading',{name:'Repair app'}).waitFor();
  const repair=page.getByRole('button',{name:'Repair app online',exact:true});
  assert.equal(await page.evaluate(()=>navigator.onLine),false);
  await repair.click();
  await page.getByRole('status').filter({hasText:'Connect to the internet'}).waitFor();
  assert.equal(await repair.isEnabled(),true);assert.deepEqual(requests,[]);
  // Every action remains reachable on a narrow viewport.
  const dimensions=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dimensions.scroll<=dimensions.width);
  await context.setOffline(false);
  await repair.click();
  await page.getByRole('heading',{name:'App ready',exact:true}).waitFor();
  await page.waitForFunction(()=>window.appReady);
  assert.deepEqual(requests.sort(),['/assets/main-START123.js','/index.html'].sort());
  assert.deepEqual(await preserved(),original);
  // HTML alone is insufficient: a missing or corrupt entry must also recover.
  await page.evaluate(async sha=>{const pool=await caches.open('babelshelf-product-assets-v1');await pool.put(new URL('./.babelshelf-app-assets/'+sha,location.href).href,new Response('broken'));},files[1].sha256);
  requests.length=0;corrupt=true;
  await page.reload();await page.getByRole('heading',{name:'Repair app'}).waitFor();
  assert.deepEqual(requests.filter(path=>path!=='/sw.js'),[],'rendering recovery never downloads app assets');
  await page.getByRole('button',{name:'Repair app online',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Repair failed'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Repair app online',exact:true}).isEnabled(),true);
  corrupt=false;requests.length=0;
  await page.getByRole('button',{name:'Repair app online',exact:true}).click();
  await page.getByRole('heading',{name:'App ready',exact:true}).waitFor();
  assert.deepEqual(requests.filter(path=>path!=='/sw.js'),['/assets/main-START123.js']);
  await context.setOffline(true);await page.reload();await page.waitForFunction(()=>window.appReady);
  assert.deepEqual(await preserved(),original);
  // The fallback Update control can fetch and activate a newer release even
  // while canonical model/data networking remains Offline.
  await context.setOffline(false);
  await page.evaluate(async()=>{for(const name of await caches.keys())await caches.delete(name);});
  await page.reload();await page.getByRole('heading',{name:'Repair app'}).waitFor();
  currentHtml=html.replace('App ready','Updated app ready');
  const nextFiles=[{...files[0],bytes:Buffer.byteLength(currentHtml),sha256:hash(currentHtml)},files[1]];
  worker=productWorker({build:'3333333333333333',files:nextFiles,remote:[]})
   .replace("event.waitUntil(self.clients.claim())","event.waitUntil(new Promise(resolve=>setTimeout(resolve,2500)).then(()=>self.clients.claim()))");
  // Stage a real update at the awkward point where it has left installing/
  // waiting, but the old worker still controls this recovery document.
  await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration();await registration.update();
   const worker=registration.installing??registration.waiting??registration.active;
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Activation fixture timed out')),10000);const check=()=>{if(worker.state==='activating'){clearTimeout(timer);worker.removeEventListener('statechange',check);resolve();}};worker.addEventListener('statechange',check);check();});
   if(registration.installing||registration.waiting||registration.active===navigator.serviceWorker.controller)throw Error('Expected an activating successor with its predecessor still controlling');
  });
  await page.getByRole('button',{name:'Update app online',exact:true}).click();
  await page.getByRole('heading',{name:'Updated app ready',exact:true}).waitFor();await page.waitForFunction(()=>window.appReady);
  const activeBuild=await page.evaluate(()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=event=>{channel.port1.close();resolve(event.data.build);};navigator.serviceWorker.controller.postMessage('build',[channel.port2]);}));
  assert.equal(activeBuild,'3333333333333333');assert.deepEqual(await preserved(),original);assert.deepEqual(scriptErrors,[]);
  console.log(JSON.stringify({scope:'PC Chromium, real worker/recovery UI; synthetic shell, no model/device acceptance',browser:browser.version(),missingShell:true,corruptEntry:true,offlineRecovery:true,updateControl:true,dataRetained:true}));
  await context.close();
 }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('an updated worker escapes a legacy missing-shell dead end without reloading live drafts',async()=>{
 const nextBuild='2222222222222222',next=productWorker({build:nextBuild,files,remote:[]});
 // The legacy contract returns a plain 503 with no script or activation UI.
 // Its build reply/cache layout match the previously released product worker.
 const legacy=`const CACHE='babelshelf-product-${build}';
 self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.put(new URL('./index.html',self.registration.scope),new Response(${JSON.stringify(html)},{headers:{'Content-Type':'text/html'}}));})()));
 self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
 self.addEventListener('message',e=>{if(e.data==='build')e.ports[0].postMessage({build:'${build}'});});
 self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith((async()=>{const c=await caches.open(CACHE);return await c.match(new URL('./index.html',self.registration.scope))??new Response('Local app asset missing. Prepare or update explicitly.',{status:503});})());});`;
 let published=false;
 const server=createServer((request,response)=>{
  const path=new URL(request.url,'http://localhost').pathname;
  response.setHeader('Cache-Control','no-store');
  response.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/html; charset=utf-8');
  response.end(path==='/sw.js'?(published?next:legacy):path==='/assets/main-START123.js'?script:html);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true});
  for(const lostCache of [false,true]){
   published=false;
   const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(10000);
   await page.goto(`http://127.0.0.1:${server.address().port}/`);
   await page.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
   await page.waitForFunction(()=>navigator.serviceWorker.controller);
   await page.evaluate(()=>{window.unsavedDraft='live tab text';localStorage.setItem('retained-draft','saved text');});
   if(lostCache){
    await page.evaluate(async()=>{for(const name of await caches.keys())await caches.delete(name);});
    published=true;
    const deadEnd=await page.reload();assert.equal(deadEnd.status(),503);
    assert.equal(await page.locator('button').count(),0);
   }
   published=true;
   if(!lostCache)await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.getRegistration();await registration.update();
    const worker=registration.installing??registration.waiting;
    if(!worker)return;
    await new Promise((resolve,reject)=>{
     const timer=setTimeout(()=>reject(Error('Migration install timed out')),10000);
     const check=()=>{if(worker.state==='installed'||worker.state==='activated'){clearTimeout(timer);worker.removeEventListener('statechange',check);resolve();}else if(worker.state==='redundant'){clearTimeout(timer);reject(Error('Migration install failed'));}};
     worker.addEventListener('statechange',check);check();
    });
   });
   if(lostCache){
    await page.evaluate(()=>new Promise((resolve,reject)=>{
     const container=navigator.serviceWorker;
     const finish=error=>{clearTimeout(timer);container.removeEventListener('controllerchange',check);error?reject(error):resolve();};
     const check=()=>{const worker=container.controller,channel=new MessageChannel();channel.port1.onmessage=e=>{channel.port1.close();if(e.data.build==='2222222222222222')finish();};worker.postMessage('build',[channel.port2]);};
     const timer=setTimeout(()=>finish(Error('Broken predecessor did not activate the repair update')),10000);
     container.addEventListener('controllerchange',check);check();
    }));
    await page.reload();await page.getByRole('heading',{name:'App ready',exact:true}).waitFor();await page.waitForFunction(()=>window.appReady);
   }else{
    assert.equal(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),true);
    assert.equal(await page.evaluate(()=>window.unsavedDraft),'live tab text');
   }
   assert.equal(await page.evaluate(()=>localStorage.getItem('retained-draft')),'saved text');await context.close();
  }
  console.log(JSON.stringify({scope:'Legacy registration upgrade in isolated Chromium',brokenPredecessorActivated:true,healthyPredecessorWaits:true}));
 }finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
