const CACHE='mlb-shell-9d2786a960cfbc82'; // updated by scripts/check.mjs
const base=new URL('./',self.location.href);
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const res=await fetch(new URL('asset-manifest.json',base),{cache:'no-store'});if(!res.ok)throw Error('asset manifest unavailable');const manifest=await res.clone().json();const staging=await caches.open(CACHE+'-staging');
 // Validate every byte before publishing this shell cache. Old cache is retained on failure.
 for(const e of manifest.files){const url=new URL(e.path,base),r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('asset missing '+e.path);const b=await r.clone().arrayBuffer(),h=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('');if(h!==e.sha256)throw Error('asset hash '+e.path);await staging.put(url,r);}
 await staging.put(new URL('asset-manifest.json',base),res);const cache=await caches.open(CACHE);for(const req of await staging.keys())await cache.put(req,await staging.match(req));await caches.delete(CACHE+'-staging');
})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
 const u=new URL(event.request.url);if(u.origin!==base.origin)return; // only the explicit installer may fetch pinned external assets
 if(event.request.method!=='GET')return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);let key=event.request;if(event.request.mode==='navigate')key=new URL('index.html',base);const saved=await cache.match(key,{ignoreSearch:true});return saved??new Response('Offline asset missing; explicit repair required',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});})());
});

self.addEventListener('message',e=>{if(e.data?.type==='shell-cache')e.ports[0]?.postMessage(CACHE);});
