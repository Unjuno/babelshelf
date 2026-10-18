// Generated offline app worker; model/data stores are outside this module.
export function productWorker({build,files,remote}){return `const BUILD=${JSON.stringify(build)},CACHE='babelshelf-product-'+BUILD,FILES=${JSON.stringify(files)},REMOTE=${JSON.stringify(remote)};
`+String.raw`
const SHARED='babelshelf-product-assets-v1',META='./.babelshelf-app-manifest-v1';
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
 const cache=await caches.open(CACHE),pool=await caches.open(SHARED),assets=[];
 for(const file of FILES){
  if(immutable(file.path)){const saved=await pool.match(poolKey(file));if(saved&&await verified(saved,file)){assets.push(file);continue;}}
  const response=await fetch(absolute(file.path),{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw Error('App asset missing');if(!await verified(response,file))throw Error('App asset verification failed');
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
 if(url.origin!==self.location.origin){event.respondWith(REMOTE.includes(url.href)?fetch(request):Promise.resolve(new Response('Network disabled',{status:503})));return;}
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
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='activate-update')self.skipWaiting();if(event.data==='build')event.ports[0]?.postMessage({build:BUILD,cache:CACHE,assets:FILES.length});});
`;}
