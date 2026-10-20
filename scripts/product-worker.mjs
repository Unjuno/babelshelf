// Generated offline app worker; model/data stores are outside this module.
import {readAppNetworkAccess} from '../dist/connection-policy.js';
export function productWorker({build,files,remote}){return `const BUILD=${JSON.stringify(build)},CACHE='babelshelf-product-'+BUILD,FILES=${JSON.stringify(files)},REMOTE=${JSON.stringify(remote)};
const readAppNetworkAccess=${readAppNetworkAccess.toString()};
`+String.raw`
const SHARED='babelshelf-product-assets-v1',META='./.babelshelf-app-manifest-v1';
const hfGrants=new Map();
const networkRequests=new Set();let networkEpoch=0;
const disabledNetwork=()=>new Response('App is offline',{status:503,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}});
async function externalRequest(event){
 const approved=REMOTE.includes(event.request.url)||consumeHF(event),epoch=networkEpoch;
 if(!approved||!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB)||epoch!==networkEpoch)return disabledNetwork();
 const controller=new AbortController(),request=event.request,abort=()=>controller.abort();
 networkRequests.add(controller);request.signal?.addEventListener('abort',abort,{once:true});
 const cleanup=()=>{networkRequests.delete(controller);request.signal?.removeEventListener('abort',abort);};
 try{
  if(request.signal?.aborted)controller.abort();
  const response=await fetch(request,{signal:controller.signal});
  if(!response.body){cleanup();return response;}
  const reader=response.body.getReader();
  const stream=new ReadableStream({
   async pull(target){try{const value=await reader.read();if(value.done){cleanup();target.close();}else target.enqueue(value.value);}catch(error){cleanup();target.error(error);}},
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
  return url.pathname.toLowerCase().endsWith('.gguf')&&url.search==='?download=true'&&(range===''||/^bytes=0-\d+$/.test(range)&&Number(range.slice(8))<16777216);
 }catch{return false;}
}
function hfKey(client,url,range){return JSON.stringify([client,url,range]);}
function consumeHF(event){const request=event.request,key=hfKey(event.clientId,request.url,request.headers?.get('Range')??''),expires=hfGrants.get(key);hfGrants.delete(key);return typeof expires==='number'&&expires>Date.now()&&request.credentials==='omit';}
const absolute=path=>new URL(path,self.registration.scope).href;
const immutable=path=>/^\.\/assets\/[^/]+-[A-Za-z0-9_-]{8}\.[A-Za-z0-9]+$/.test(path);
const poolKey=file=>absolute('./.babelshelf-app-assets/'+file.sha256);
async function verified(response,file){
 if(!response?.ok)return false;
 const bytes=await response.clone().arrayBuffer(),digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 return bytes.byteLength===file.bytes&&digest===file.sha256;
}
async function historicalManifest(cache,name){
 try{const response=await cache.match(absolute(META));if(!response)return null;const value=await response.json();
  if(value?.schema!==1||value.build!==name.slice('babelshelf-product-'.length)||!Array.isArray(value.assets)||value.assets.length>10000)return null;
  const paths=new Set();for(const file of value.assets){if(!file||typeof file.path!=='string'||!immutable(file.path)||paths.has(file.path)||!Number.isSafeInteger(file.bytes)||file.bytes<0||typeof file.sha256!=='string'||! /^[a-f0-9]{64}$/.test(file.sha256))return null;paths.add(file.path);}return value.assets;
 }catch{return null;}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 if(self.registration.active&&!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB))throw Error('App is offline');
 const cache=await caches.open(CACHE),pool=await caches.open(SHARED),assets=[];
 for(const file of FILES){
  if(immutable(file.path)){const saved=await pool.match(poolKey(file));if(saved&&await verified(saved,file)){assets.push(file);continue;}}
  if(self.registration.active&&!await readAppNetworkAccess(typeof indexedDB==='undefined'?undefined:indexedDB))throw Error('App is offline');
  let response=await fetch(absolute(file.downloadPath??file.path),{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw Error('App asset missing');if(!await verified(response,file))throw Error('App asset verification failed');
  if(file.path==='./index.html'&&file.downloadPath){
   const headers=new Headers(response.headers);headers.set('Content-Type','text/html; charset=utf-8');
   headers.delete('Content-Encoding');headers.delete('Content-Length');
   response=new Response(response.body,{status:200,headers});
  }
  const store=immutable(file.path)?pool:cache,key=immutable(file.path)?poolKey(file):absolute(file.path);
  await store.put(key,response);
  if(!await verified(await store.match(key),file))throw Error('App asset storage verification failed');
  if(immutable(file.path))assets.push(file);
 }
 // Publish references only after all shell/shared responses verify. Older caches
 // and failed-install pool entries remain intact; no implicit pruning occurs.
 const manifest=JSON.stringify({schema:1,build:BUILD,assets});
 await cache.put(absolute(META),new Response(manifest,{headers:{'Content-Type':'application/json'}}));
 const savedManifest=await cache.match(absolute(META));
 if(!savedManifest?.ok||await savedManifest.text()!==manifest)throw Error('App asset storage verification failed');
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
  const hit=await cache.match(absolute(path));if(hit){
   // Static hosts may redirect index.html to /. A cached redirected response
   // cannot satisfy a navigation whose redirect mode is manual. Serve the
   // already verified body without its network redirect metadata, including
   // for existing caches. No acquisition or cache/data migration is needed.
   if(request.mode==='navigate'&&hit.redirected){
    const headers=new Headers(hit.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');
    return new Response(hit.body,{status:hit.status,statusText:hit.statusText,headers});
   }
   return hit;
  }
  if(immutable(path)){
   const pool=await caches.open(SHARED),current=FILES.find(file=>file.path===path);
   if(current){const saved=await pool.match(poolKey(current));if(saved)return saved;}
   for(const name of (await caches.keys()).reverse()){
    if(name===CACHE||! /^babelshelf-product-[a-f0-9]{16}$/.test(name))continue;
    const previous=await caches.open(name),old=await previous.match(absolute(path));if(old&&(!current||await verified(old,current)))return old;
    const manifest=await historicalManifest(previous,name),file=manifest?.find(file=>file.path===path);
    if(file&&(!current||file.sha256===current.sha256&&file.bytes===current.bytes)){const saved=await pool.match(poolKey(file));if(saved)return saved;}
   }
  }
  return missing();
 })().catch(()=>new Response('Local app unavailable. Reload to retry.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})));
});
self.addEventListener('message',event=>{
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
