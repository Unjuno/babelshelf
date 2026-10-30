// Generated offline app worker; model/data stores are outside this module.
import {readAppNetworkAccess} from '../dist/connection-policy.js';
export function productWorker({build,files,remote}){return `const BUILD=${JSON.stringify(build)},CACHE='babelshelf-product-'+BUILD,FILES=${JSON.stringify(files)},REMOTE=${JSON.stringify(remote)};
const readAppNetworkAccess=${readAppNetworkAccess.toString()};
`+String.raw`
const SHARED='babelshelf-product-assets-v1',META='./.babelshelf-app-manifest-v1',INSTALL_FILES=FILES.filter(file=>file.shell===true||!Array.isArray(file.roles)||file.roles.length===0);
const hfGrants=new Map(),productAssetJobs=new Map();let shellRepair=null;
const networkRequests=new Set();let networkEpoch=0;
const disabledNetwork=()=>new Response('App is offline',{status:503,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
function isolatedResponse(response){
 const headers=new Headers(response.headers);
 headers.set('Cross-Origin-Opener-Policy','same-origin');
 headers.set('Cross-Origin-Embedder-Policy','require-corp');
 headers.delete('Content-Encoding');headers.delete('Content-Length');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
async function externalRequest(event){
 const approved=REMOTE.includes(event.request.url)||consumeHF(event),epoch=networkEpoch;
 if(!approved||!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB)||epoch!==networkEpoch)return disabledNetwork();
 const controller=new AbortController(),request=event.request,abort=()=>controller.abort();
 networkRequests.add(controller);request.signal?.addEventListener('abort',abort,{once:true});
 const cleanup=()=>{networkRequests.delete(controller);request.signal?.removeEventListener('abort',abort);};
 try{
  if(request.signal?.aborted)controller.abort();
  const response=await fetch(request,{signal:controller.signal});
  if(controller.signal.aborted||epoch!==networkEpoch){cleanup();void response.body?.cancel().catch(()=>{});return disabledNetwork();}
  if(!response.body){cleanup();return response;}
  const reader=response.body.getReader();
  const stream=new ReadableStream({
   async pull(target){try{const value=await reader.read();if(controller.signal.aborted||epoch!==networkEpoch)throw Error('App is offline');if(value.done){cleanup();target.close();}else target.enqueue(value.value);}catch(error){cleanup();void reader.cancel(error).catch(()=>{});target.error(error);}},
   cancel(reason){cleanup();controller.abort();return reader.cancel(reason);}
  });
  const headers=new Headers(response.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');
  return new Response(stream,{status:response.status,statusText:response.statusText,headers});
 }catch{cleanup();return disabledNetwork();}
}
function hfRequestAllowed(raw,range){
 if(raw.length>1024||range.length>32)return false;
 try{const url=new URL(raw);if(url.href!==raw||url.origin!=='https://huggingface.co'||url.username||url.password||url.hash)return false;
  const repo='[A-Za-z0-9][A-Za-z0-9._-]{0,63}/[A-Za-z0-9][A-Za-z0-9._-]{0,95}';
  if(new RegExp('^/api/models/'+repo+'$').test(url.pathname))return url.search==='?blobs=true'&&range==='';
  if(!new RegExp('^/'+repo+'/resolve/[a-f0-9]{40}/(?:[A-Za-z0-9_.-]+/)*[A-Za-z0-9_.-]+$').test(url.pathname))return false;
  if(url.pathname.endsWith('/config.json'))return url.search===''&&range==='';
  const match=/^bytes=(\d+)-(\d+)$/.exec(range),start=match?Number(match[1]):NaN,end=match?Number(match[2]):NaN;
  const boundedRange=range===''||!!match&&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>=start&&end-start+1<=16777216;
  return url.pathname.toLowerCase().endsWith('.gguf')&&url.search==='?download=true'&&boundedRange;
 }catch{return false;}
}
function hfKey(client,url,range){return JSON.stringify([client,url,range]);}
function consumeHF(event){const request=event.request,key=hfKey(event.clientId,request.url,request.headers?.get('Range')??''),expires=hfGrants.get(key);hfGrants.delete(key);return typeof expires==='number'&&expires>Date.now()&&request.credentials==='omit';}
const absolute=path=>new URL(path,self.registration.scope).href;
const immutable=path=>/^\.\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/.test(path);
const poolKey=file=>absolute('./.babelshelf-app-assets/'+file.sha256);
async function verified(response,file,onBytes){
 if(!response?.ok)return false;
 let copy=response.clone();
 if(onBytes&&copy.body){let read=0;const reader=copy.body.getReader();copy=new Response(new ReadableStream({async pull(target){try{const part=await reader.read();if(part.done){target.close();return;}read+=part.value.byteLength;onBytes(read);target.enqueue(part.value);}catch(error){target.error(error);}},cancel(reason){return reader.cancel(reason);}}));}
 const bytes=await copy.arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 return bytes.byteLength===file.bytes&&digest===file.sha256;
}
async function putVerified(cache,key,response,file){
 try{await cache.put(key,response);}catch(error){if(await verified(await cache.match(key),file))return;throw error;}
 if(!await verified(await cache.match(key),file))throw Error('App asset storage verification failed');
}
async function putManifest(cache,key,manifest){
 try{await cache.put(key,new Response(manifest,{headers:{'Content-Type':'application/json'}}));}catch(error){const saved=await cache.match(key);if(saved?.ok&&await saved.text()===manifest)return;throw error;}
 const saved=await cache.match(key);if(!saved?.ok||await saved.text()!==manifest)throw Error('App asset storage verification failed');
}
async function historicalManifest(cache,name){
 try{const response=await cache.match(absolute(META));if(!response)return null;const value=await response.json();
  if(value?.schema!==1||value.build!==name.slice('babelshelf-product-'.length)||!Array.isArray(value.assets)||value.assets.length>10000)return null;
  const paths=new Set();for(const file of value.assets){if(!file||typeof file.path!=='string'||!immutable(file.path)||paths.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||typeof file.sha256!=='string'||! /^[a-f0-9]{64}$/.test(file.sha256))return null;paths.add(file.path);}return value.assets;
 }catch{return null;}
}
// An old HTML shell is usable only when it is byte-for-byte identical to the
// current build's pinned shell. Never fetch or rewrite caches during recovery.
async function historicalShell(file){
 if(file?.path!=='./index.html')return null;
 for(const name of (await caches.keys()).reverse()){
  if(name===CACHE||! /^babelshelf-product-[a-f0-9]{16}$/.test(name))continue;
  const saved=await(await caches.open(name)).match(absolute(file.path));
  if(await verified(saved,file))return saved;
 }
 return null;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Installation is only started by explicit app preparation/update. It may
 // fetch the build-pinned, same-origin shell even while user data/model
 // network access is Offline; all cross-origin requests remain gated below.
 const cache=await caches.open(CACHE),pool=await caches.open(SHARED),assets=[];
 for(const file of INSTALL_FILES){
  if(immutable(file.path)){const saved=await pool.match(poolKey(file));if(saved&&await verified(saved,file)){assets.push(file);continue;}}
  const controller=new AbortController();networkRequests.add(controller);
  try{
   const source=new URL(file.downloadPath??file.path,self.registration.scope);
   if(source.origin!==self.location.origin||!source.href.startsWith(self.registration.scope))throw Error('App asset outside scope');
   let response=await fetch(source.href,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
   if(!response.ok)throw Error('App asset missing');if(!await verified(response,file))throw Error('App asset verification failed');
   if(controller.signal.aborted)throw Error('App preparation was cancelled');
   if(file.path==='./index.html'&&file.downloadPath){
    const headers=new Headers(response.headers);headers.set('Content-Type','text/html; charset=utf-8');
    headers.delete('Content-Encoding');headers.delete('Content-Length');
    response=new Response(response.body,{status:200,headers});
   }
   const store=immutable(file.path)?pool:cache,key=immutable(file.path)?poolKey(file):absolute(file.path);
   await putVerified(store,key,response,file);
  }finally{networkRequests.delete(controller);}
  if(immutable(file.path))assets.push(file);
 }
 // Publish references only after all shell/shared responses verify. Older caches
 // and failed-install pool entries remain intact; no implicit pruning occurs.
  const manifest=JSON.stringify({schema:1,build:BUILD,assets,optional:FILES.length-assets.length});
  await putManifest(cache,absolute(META),manifest);
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'){event.respondWith(new Response('Method unavailable',{status:405}));return;}
 if(url.origin!==self.location.origin){event.respondWith(externalRequest(event));return;}
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),path=request.mode==='navigate'?'./index.html':'.'+url.pathname.slice(new URL(self.registration.scope).pathname.length-1);
  const missing=()=>new Response('Local app asset missing. Prepare or update explicitly.',{status:503,headers:{'Content-Type':'text/plain'}});
  if(path===META||path.startsWith('./.babelshelf-app-assets/'))return missing();
  const current=FILES.find(file=>file.path===path),hit=await cache.match(absolute(path));
  if(hit&&(!current||await verified(hit,current)))return hit;
  if(path==='./index.html'&&current){const old=await historicalShell(current);if(old)return old;}
  if(immutable(path)){
   const pool=await caches.open(SHARED);
   if(current){const saved=await pool.match(poolKey(current));if(saved&&await verified(saved,current))return saved;}
   for(const name of (await caches.keys()).reverse()){
    if(name===CACHE||! /^babelshelf-product-[a-f0-9]{16}$/.test(name))continue;
    const previous=await caches.open(name),old=await previous.match(absolute(path));if(old&&(!current||await verified(old,current)))return old;
    const manifest=await historicalManifest(previous,name),file=manifest?.find(file=>file.path===path);
    if(file&&(!current||file.sha256===current.sha256&&file.bytes===current.bytes)){const saved=await pool.match(poolKey(file));if(saved&&await verified(saved,file))return saved;}
   }
  }
  return missing();
 })().then(response=>{
  // Controlled navigation opts into isolation. Worker entry responses must
  // carry the same COEP, including assets in shared/previous caches whose
  // original server headers lack it. Rewrap verified bytes at delivery only;
  // do not download, rewrite stored assets or weaken the page's isolation.
  // Rewrapping also removes redirected-index metadata for manual navigation.
  return request.mode==='navigate'||request.destination==='worker'||request.destination==='sharedworker'?isolatedResponse(response):response;
 }).catch(()=>new Response('Local app unavailable. Reload to retry.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='repair-app-shell'){
  const source=event.source,port=event.ports?.[0],operationId=event.data.operationId;
  let valid=false;try{valid=source?.type==='window'&&!!source.id&&new URL(source.url).origin===self.location.origin&&typeof operationId==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(operationId)&&(event.data.localOnly===undefined||typeof event.data.localOnly==='boolean');}catch{}
  if(!valid||shellRepair){port?.postMessage({status:'failed'});return;}
  const job={clientId:source.id,operationId,stopped:false,controller:null,epoch:networkEpoch};shellRepair=job;
  const check=()=>{if(job.stopped||job.epoch!==networkEpoch)throw Error('Stopped');};
  const work=(async()=>{
   const cache=await caches.open(CACHE),pool=await caches.open(SHARED),assets=[];
   for(const file of INSTALL_FILES){
    check();const direct=await cache.match(absolute(file.path)),shared=immutable(file.path)?await pool.match(poolKey(file)):null;
    if(direct&&await verified(direct,file)){if(immutable(file.path))assets.push(file);continue;}
    if(!direct&&shared&&await verified(shared,file)){assets.push(file);continue;}
    let response=shared&&await verified(shared,file)?shared:null;
    if(!response){
     if(event.data.localOnly===true)throw Error('Browser offline');
     if(!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB))throw Error('Downloads are off');check();
     const sourceUrl=new URL(file.downloadPath??file.path,self.registration.scope);
     if(sourceUrl.origin!==self.location.origin||!sourceUrl.href.startsWith(self.registration.scope))throw Error('App asset outside scope');
     const controller=new AbortController();job.controller=controller;networkRequests.add(controller);
     try{response=await fetch(sourceUrl.href,{cache:'no-store',credentials:'same-origin',signal:controller.signal});check();if(!await verified(response,file))throw Error('App asset verification failed');check();}
     finally{networkRequests.delete(controller);job.controller=null;}
    }
    check();
    if(file.path==='./index.html'&&file.downloadPath){const headers=new Headers(response.headers);headers.set('Content-Type','text/html; charset=utf-8');headers.delete('Content-Encoding');headers.delete('Content-Length');response=new Response(response.body,{status:200,headers});}
    const store=direct||!immutable(file.path)?cache:pool,key=store===cache?absolute(file.path):poolKey(file);
    await putVerified(store,key,response,file);check();if(immutable(file.path))assets.push(file);
   }
   await putManifest(cache,absolute(META),JSON.stringify({schema:1,build:BUILD,assets,optional:FILES.length-assets.length}));check();return 'ready';
  })().catch(error=>error?.message==='Downloads are off'?'offline':error?.message==='Browser offline'?'disconnected':'failed').then(status=>{try{port?.postMessage({status});}catch{}}).finally(()=>{if(shellRepair===job)shellRepair=null;});
  event.waitUntil?.(work);return;
 }
 if(event.data?.type==='cancel-app-shell-repair'){
  const source=event.source,job=shellRepair;if(source?.type==='window'&&job?.clientId===source.id&&job.operationId===event.data.operationId){job.stopped=true;job.controller?.abort();}return;
 }
 if(event.data?.type==='check-app-shell'){
  const source=event.source,port=event.ports?.[0];
  let valid=false;try{valid=source?.type==='window'&&!!source.id&&new URL(source.url).origin===self.location.origin;}catch{}
  if(!valid){port?.postMessage({status:'unavailable'});return;}
  const work=(async()=>{
   const names=await caches.keys();if(!names.includes(CACHE))return 'missing';
   const cache=await caches.open(CACHE),pool=names.includes(SHARED)?await caches.open(SHARED):null;
   for(const file of INSTALL_FILES){
    const direct=await cache.match(absolute(file.path));
    if(await verified(direct,file))continue;
    if(file.path==='./index.html'&&await historicalShell(file))continue;
    const shared=immutable(file.path)&&pool?await pool.match(poolKey(file)):null;
    if(!await verified(shared,file))return 'missing';
   }
   return 'ready';
  })().catch(()=> 'unavailable').then(status=>{try{port?.postMessage({status,build:BUILD});}catch{}});
  event.waitUntil?.(work);return;
 }
 if(event.data?.type==='prepare-product-assets'){
  const source=event.source,port=event.ports?.[0],role=event.data.role,operationId=event.data.operationId,acquire=event.data.acquire;
  const reply=value=>{try{port?.postMessage(value);}catch{}};
  let valid=false;try{valid=source?.type==='window'&&!!source.id&&new URL(source.url).origin===self.location.origin&&typeof role==='string'&&role.length<=64&&typeof operationId==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(operationId)&&typeof acquire==='boolean'&&!productAssetJobs.has(operationId);}catch{}
  const selected=valid?FILES.filter(file=>Array.isArray(file.roles)&&file.roles.includes(role)):[];
  if(!selected.length){reply({status:'failed',error:valid?'Runtime assets unavailable for this feature':'Invalid app asset request'});return;}
  const job={clientId:source.id,stopped:false,controllers:new Set()};productAssetJobs.set(operationId,job);
  const work=(async()=>{
   const pool=await caches.open(SHARED),epoch=networkEpoch;let bytes=0;
   for(let index=0;index<selected.length;index++){
    if(job.stopped)throw Error('Stopped');
    const file=selected[index],key=poolKey(file),saved=await pool.match(key),onBytes=read=>{if(!job.stopped&&epoch===networkEpoch)reply({status:'progress',role,completed:index,total:selected.length,bytes:bytes+read});};
    if(saved&&await verified(saved,file,onBytes)){if(job.stopped||epoch!==networkEpoch)throw Error('Stopped');bytes+=file.bytes;reply({status:'progress',role,completed:index+1,total:selected.length,bytes});continue;}
    if(job.stopped||epoch!==networkEpoch)throw Error('Stopped');
    if(!acquire)throw Error('Runtime not prepared · switch Online to prepare');
    if(!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB)||epoch!==networkEpoch)throw Error('Downloads are off');
    const controller=new AbortController();networkRequests.add(controller);job.controllers.add(controller);let response;
    try{
     response=await fetch(absolute(file.downloadPath??file.path),{cache:'no-store',credentials:'same-origin',signal:controller.signal});
     if(epoch!==networkEpoch||!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB))throw Error('Downloads are off');
     if(!response.ok||!await verified(response,file,onBytes))throw Error('App asset verification failed');
     if(job.stopped||controller.signal.aborted||epoch!==networkEpoch)throw Error('Stopped');
     await pool.put(key,response);if(!await verified(await pool.match(key),file))throw Error('App asset storage verification failed');
     if(job.stopped||controller.signal.aborted||epoch!==networkEpoch)throw Error('Stopped');
    }finally{networkRequests.delete(controller);job.controllers.delete(controller);}
    bytes+=file.bytes;reply({status:'progress',role,completed:index+1,total:selected.length,bytes});
   }
   reply({status:'prepared',role,assets:selected.length,bytes});
  })().catch(error=>reply({status:'failed',error:error instanceof Error?error.message:'App runtime preparation failed'})).finally(()=>productAssetJobs.delete(operationId));
  event.waitUntil?.(work);return;
 }
 if(event.data?.type==='cancel-product-assets'){
  const source=event.source,job=productAssetJobs.get(event.data.operationId);if(source?.type==='window'&&job?.clientId===source.id){job.stopped=true;for(const controller of job.controllers)controller.abort();}return;
 }
 if(event.data?.type==='network-offline'){
  const source=event.source;
  if(source?.type!=='window'||!source.id||new URL(source.url).origin!==self.location.origin){event.ports[0]?.postMessage({offline:false});return;}
  const work=(async()=>{
   if(await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB)){event.ports[0]?.postMessage({offline:false});return;}
   networkEpoch++;hfGrants.clear();for(const controller of networkRequests)controller.abort();networkRequests.clear();
   event.ports[0]?.postMessage({offline:true});
  })();event.waitUntil?.(work);return;
 }
 if(event.data?.type==='allow-huggingface-request'){
  const {url,range}=event.data,source=event.source;let allowed=false;
  try{allowed=source?.type==='window'&&!!source.id&&new URL(source.url).origin===self.location.origin&&typeof url==='string'&&typeof range==='string'&&hfRequestAllowed(url,range);}catch{}
  for(const [key,expires]of hfGrants)if(expires<=Date.now())hfGrants.delete(key);
  if(allowed){const key=hfKey(source.id,url,range);if(hfGrants.size>=32&&!hfGrants.has(key))allowed=false;else hfGrants.set(key,Date.now()+30000);}
  event.ports[0]?.postMessage({allowed});return;
 }
 if(event.data?.type==='activate-update')self.skipWaiting();if(event.data==='build')event.ports[0]?.postMessage({build:BUILD,cache:CACHE,assets:FILES.length});
});
`;}
