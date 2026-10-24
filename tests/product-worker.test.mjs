import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {webcrypto,createHash} from 'node:crypto';
import {productWorker} from '../scripts/product-worker.mjs';
const origin='http://localhost:4180',current='2222222222222222',previous='1111111111111111';

test('cached dedicated and shared workers keep isolation across current, shared and historical assets without fetching',async()=>{
 const path='/assets/tool-RUNTIM12.js',body='self.onmessage=()=>self.postMessage(42)';
 for(const source of ['current','shared','historical']){
  const h=await harness(body,{files:[pinned('.'+path,body)]});
  if(source==='shared')await install(h);
  else await h.put('babelshelf-product-'+(source==='current'?current:previous),path,body);
  h.network.length=0;
  for(const destination of ['worker','sharedworker']){
   let result;
   h.handlers.fetch({request:{url:origin+path,method:'GET',mode:'same-origin',destination},respondWith:promise=>{result=promise;}});
   const response=await result;
   assert.equal(response.status,200,source+' '+destination);
   assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'),'require-corp',source+' '+destination);
   assert.equal(await response.text(),body);
  }
  assert.deepEqual(h.network,[]);
 }
});
function connectionDatabase(online=true){
 let enabled=online;
 return {set(value){enabled=value;},open(){const request={};queueMicrotask(()=>{const tx={objectStore(){return {get(){const result={};queueMicrotask(()=>{result.result={id:'settings-connection',state:'active',ui:{managed:true},revisions:[{path:'Settings/connection.md',body:'# Connection\n\n```json\n'+JSON.stringify({downloads:enabled,diagnosticLogs:false})+'\n```\n'}]};result.onsuccess();tx.oncomplete();});return result;}};}};request.result={objectStoreNames:{contains:()=>true},transaction:()=>tx,close(){}};request.onsuccess();});return request;}};
}
function storage(){const entries=new Map();return {entries,keys:async()=>[...entries.keys()],open:async name=>{if(!entries.has(name))entries.set(name,new Map());const data=entries.get(name);return {match:async url=>data.get(typeof url==='string'?url:url.url)?.clone(),put:async(url,r)=>data.set(typeof url==='string'?url:url.url,r.clone())};}};}
async function harness(responseBytes='NEW',options={}){const caches=options.caches??storage(),handlers={},network=[];const self={registration:{scope:options.scope??origin+'/'},location:{origin},clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn};const bytes='NEW',files=options.files??[{path:'./assets/main-NEWabc12.js',bytes:3,sha256:createHash('sha256').update(bytes).digest('hex')}];vm.runInNewContext(productWorker({build:options.build??current,files,remote:['https://assets.example/model']}),{self,caches,URL,Response,Headers,setTimeout,clearTimeout,AbortController,ReadableStream,indexedDB:options.connection??connectionDatabase(),...(options.now?{Date:{now:options.now}}:{}),crypto:webcrypto,fetch:async (url,init)=>{network.push(typeof url==='string'?url:url.url);return options.fetcher?options.fetcher(url,init):new Response(typeof responseBytes==='function'?responseBytes(url):responseBytes);}});return {self,caches,network,handlers,async put(name,path,body){await (await caches.open(name)).put(origin+path,new Response(body));},async request(path,mode='cors',method='GET',clientId='',range=''){let result;handlers.fetch({clientId,request:{url:path.startsWith('https://')?path:origin+path,mode,method,credentials:'omit',headers:new Headers(range?{Range:range}:{})},respondWith:p=>result=p});return await result;}};}
test('controlled app navigations receive COOP/COEP while local assets retain their existing response',async()=>{const h=await harness();await h.put('babelshelf-product-'+current,'/index.html','NEW index');await h.put('babelshelf-product-'+previous,'/index.html','OLD index');const navigation=await h.request('/','navigate');assert.equal(await navigation.text(),'NEW index');assert.equal(navigation.headers.get('Cross-Origin-Opener-Policy'),'same-origin');assert.equal(navigation.headers.get('Cross-Origin-Embedder-Policy'),'require-corp');await h.put('babelshelf-product-'+current,'/assets/shared-AAAAAAAA.js','CURRENT');await h.put('babelshelf-product-'+previous,'/assets/shared-AAAAAAAA.js','OLD');const asset=await h.request('/assets/shared-AAAAAAAA.js');assert.equal(await asset.text(),'CURRENT');assert.equal(asset.headers.get('Cross-Origin-Embedder-Policy'),null);assert.equal((await h.request('/missing.js')).status,503);assert.deepEqual(h.network,[]);});
test('an old open page can read a missing hashed lazy module from its verified historical app cache after update',async()=>{const h=await harness();await h.put('babelshelf-product-'+previous,'/assets/pdf-engine-OLDabc12.js','OLD reader');const result=await h.request('/assets/pdf-engine-OLDabc12.js');assert.equal(result.status,200);assert.equal(await result.text(),'OLD reader');assert.deepEqual(h.network,[]);});
test('historical fallback cannot use arbitrary cache namespaces or old documents and never acquires missing resources',async()=>{const h=await harness();for(const name of ['foreign-data','babelshelf-product-not-a-build'])await h.put(name,'/assets/reader-OLDabc12.js','foreign');await h.put('babelshelf-product-'+previous,'/private.json','old private');assert.equal((await h.request('/assets/reader-OLDabc12.js')).status,503);assert.equal((await h.request('/private.json')).status,503);assert.equal((await h.request('/assets/absent-NONEabcd.js')).status,503);assert.equal((await h.request('/assets/reader-OLDabc12.js','cors','POST')).status,405);assert.deepEqual(h.network,[]);assert.equal((await h.request('https://unapproved.example/model')).status,503);assert.deepEqual(h.network,[]);assert.equal((await h.request('https://assets.example/model')).status,200);assert.deepEqual(h.network,['https://assets.example/model']);});
test('installation verifies every saved asset before completion and refuses corrupt bytes',async()=>{const h=await harness();let work;h.handlers.install({waitUntil:p=>work=p});await work;assert.equal(await (await h.request('/assets/main-NEWabc12.js')).text(),'NEW');assert.equal(h.network.length,1);const bad=await harness('BAD');let failed;bad.handlers.install({waitUntil:p=>failed=p});await assert.rejects(failed,/verification/);assert.equal((await bad.request('/assets/main-NEWabc12.js')).status,503);});

async function install(h){let work;h.handlers.install({waitUntil:p=>work=p});await work;}
const pinned=(path,body)=>({path,bytes:Buffer.byteLength(body),sha256:createHash('sha256').update(body).digest('hex')});
test('installation treats an exact concurrent cache write as success but rejects conflicting bytes',async()=>{
 const files=[pinned('./index.html','INDEX'),pinned('./assets/main-NEWabc12.js','NEW')],body=url=>String(url).endsWith('index.html')?'INDEX':'NEW';
 for(const target of ['asset','manifest']){
  const caches=storage(),originalOpen=caches.open;let injected=false;
  caches.open=async name=>{const cache=await originalOpen(name);return {...cache,put:async(key,response)=>{await cache.put(key,response);if(!injected&&(target==='asset'?name==='babelshelf-product-assets-v1'&&String(key).includes('/.babelshelf-app-assets/'):name==='babelshelf-product-'+current&&String(key).endsWith('/.babelshelf-app-manifest-v1'))){injected=true;throw new DOMException('Entry already exists','InvalidAccessError');}}};};
  const h=await harness(body,{caches,files});await install(h);assert.equal(injected,true,target);assert.equal(await(await h.request('/assets/main-NEWabc12.js')).text(),'NEW');
 }
 const caches=storage(),originalOpen=caches.open;let injected=false;
 caches.open=async name=>{const cache=await originalOpen(name);return {...cache,put:async(key,response)=>{if(!injected&&name==='babelshelf-product-assets-v1'&&String(key).includes('/.babelshelf-app-assets/')){injected=true;await cache.put(key,new Response('BAD'));throw new DOMException('Entry already exists','InvalidAccessError');}return cache.put(key,response);}};};
 const invalid=await harness(body,{caches,files});await assert.rejects(install(invalid),/Entry already exists/);assert.equal(injected,true);
});
let roleOperation=0;
async function prepareRole(h,role,clientId='tab-a',acquire=true){
 let result,work;
 h.handlers.message({source:{id:clientId,url:origin+'/',type:'window'},data:{type:'prepare-product-assets',role,operationId:'test-op-'+String(++roleOperation).padStart(4,'0'),acquire},ports:[{postMessage:value=>{result=value;}}],waitUntil:value=>{work=value;}});
 if(work)await work;
 return result;
}

test('custom tool QuickJS assets are excluded from first-install shell and acquired only on explicit preparation',async()=>{
 const files=[pinned('./index.html','INDEX'),{...pinned('./assets/custom-tool-worker-ABCDEFGH.js','TOOL-WORKER'),roles:['custom-tools']},{...pinned('./assets/emscripten-module-ABCDEFGH.wasm','QUICKJS-WASM'),roles:['custom-tools']}],body=url=>String(url).endsWith('index.html')?'INDEX':String(url).includes('custom-tool-worker-')?'TOOL-WORKER':'QUICKJS-WASM',h=await harness(body,{files});
 await install(h);assert.deepEqual(h.network,[origin+'/index.html']);assert.equal((await h.request('/assets/custom-tool-worker-ABCDEFGH.js')).status,503);
 const prepared=await prepareRole(h,'custom-tools');assert.equal(prepared.status,'prepared');assert.equal(prepared.assets,2);assert.equal(await(await h.request('/assets/custom-tool-worker-ABCDEFGH.js')).text(),'TOOL-WORKER');assert.equal(await(await h.request('/assets/emscripten-module-ABCDEFGH.wasm')).text(),'QUICKJS-WASM');
 assert.equal((await prepareRole(h,'custom-tools','tab-a',false)).status,'prepared');
});
test('inference and PDF worker bundles are fetched only when their exact feature runtime is prepared',async()=>{
 const features=[
  ['decision-worker-ABCDEFGH.js','decision'],['speech-worker-ABCDEFGH.js','speech'],['vision-worker-ABCDEFGH.js','vision'],
  ['onnx-text-worker-ABCDEFGH.js','text-onnx'],['lfm-text-worker-ABCDEFGH.js','text-wllama'],
  ['qwen3-text-worker-ABCDEFGH.js','text-wllama'],['pdf-engine-ABCDEFGH.js','pdf'],['pdf-ABCDEFGH.js','pdf']
 ];
 const files=[pinned('./index.html','INDEX'),...features.map(([name,role])=>({...pinned('./assets/'+name,name),roles:[role]}))];
 const h=await harness(url=>url.endsWith('/index.html')?'INDEX':features.find(([name])=>url.endsWith('/'+name))?.[0]??'UNKNOWN',{files});
 await install(h);assert.deepEqual(h.network,[origin+'/index.html']);
 for(const [name] of features)assert.equal((await h.request('/assets/'+name)).status,503,name+' is optional before preparation');
 const groups=new Map();for(const feature of features){const [name,role]=feature,group=groups.get(role)??[];group.push(name);groups.set(role,group);}
 for(const [role,names] of groups){
  const prepared=await prepareRole(h,role);assert.equal(prepared.status,'prepared',role+' prepares its feature bundles');
  for(const name of names)assert.equal(await(await h.request('/assets/'+name)).text(),name);
 }
 assert.deepEqual(h.network,[origin+'/index.html',...features.map(([name])=>origin+'/assets/'+name)]);
});

test('binary shell transport retains exact verified HTML and refuses modified transport bytes',async()=>{
 const html='<!doctype html><title>Verified shell</title>',file={...pinned('./index.html',html),downloadPath:'./offline-shell-pinned.bin'};
 const h=await harness(url=>String(url).endsWith('.bin')?html:html+'<script>injected()</script>',{files:[file]});await install(h);
 assert.deepEqual(h.network,[origin+'/offline-shell-pinned.bin']);
 const response=await h.request('/','navigate');assert.equal(await response.text(),html);assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8');assert.equal(response.redirected,false);
 h.network.length=0;assert.equal((await h.request('/offline-shell-pinned.bin')).status,503);assert.deepEqual(h.network,[]);
 const bad=await harness(html+'<script>injected()</script>',{files:[file]});await assert.rejects(install(bad),/verification/);assert.equal((await bad.request('/','navigate')).status,503);
});
test('new generations share identical verified binaries while each keeps its own shell',async()=>{const files=[pinned('./index.html','INDEX'),pinned('./assets/reader-SHARED12.wasm','BINARY')],body=url=>String(url).endsWith('index.html')?'INDEX':'BINARY',first=await harness(body,{files});await install(first);const second=await harness(body,{files,caches:first.caches,build:'3333333333333333'});await install(second);assert.deepEqual(second.network,[origin+'/index.html']);assert.equal(await (await second.request('/assets/reader-SHARED12.wasm')).text(),'BINARY');assert.equal(first.caches.entries.get('babelshelf-product-'+current).has(origin+'/assets/reader-SHARED12.wasm'),false);assert.equal(await (await second.request('/','navigate')).text(),'INDEX');});
test('feature runtime assets are not installed until their exact feature is explicitly prepared',async()=>{
 const files=[pinned('./index.html','INDEX'),{...pinned('./assets/ort-RUNTIM12.wasm','RUNTIME'),roles:['speech']}],body=url=>String(url).endsWith('index.html')?'INDEX':'RUNTIME',h=await harness(body,{files});await install(h);
 assert.deepEqual(h.network,[origin+'/index.html']);assert.equal((await h.request('/assets/ort-RUNTIM12.wasm')).status,503);
 const prepared=await prepareRole(h,'speech');assert.equal(prepared.status,'prepared');assert.equal(prepared.assets,1);assert.deepEqual(h.network,[origin+'/index.html',origin+'/assets/ort-RUNTIM12.wasm']);
 assert.equal(await(await h.request('/assets/ort-RUNTIM12.wasm')).text(),'RUNTIME');
});
test('feature preparation fails closed for unknown roles, unauthorized contexts, corrupt bytes and disabled downloads',async()=>{
 const files=[pinned('./index.html','INDEX'),{...pinned('./assets/ort-RUNTIM12.wasm','RUNTIME'),roles:['speech']}],body=url=>String(url).endsWith('index.html')?'INDEX':'CORRUPT',h=await harness(body,{files});await install(h);
 assert.equal((await prepareRole(h,'unknown')).status,'failed');assert.deepEqual(h.network,[origin+'/index.html']);
 let unauthorized;h.handlers.message({source:{id:'foreign',url:'https://evil.example/',type:'window'},data:{type:'prepare-product-assets',role:'speech'},ports:[{postMessage:value=>{unauthorized=value;}}],waitUntil(){}});assert.equal(unauthorized.status,'failed');assert.deepEqual(h.network,[origin+'/index.html']);
 const corrupt=await prepareRole(h,'speech');assert.equal(corrupt.status,'failed');assert.match(corrupt.error,/verification/);assert.equal((await h.request('/assets/ort-RUNTIME12.wasm')).status,503);
});
test('cached feature runtimes remain usable offline; missing pieces are never acquired after Offline',async()=>{
 const files=[pinned('./index.html','INDEX'),{...pinned('./assets/ort-RUNTIM12.wasm','RUNTIME'),roles:['speech']},{...pinned('./assets/ort-MISSIN12.wasm','MISSING'),roles:['speech']}],body=url=>String(url).endsWith('index.html')?'INDEX':String(url).includes('RUNTIM')?'RUNTIME':'MISSING',connection=connectionDatabase(true),h=await harness(body,{files,connection});await install(h);
 const partial=await prepareRole(h,'speech');assert.equal(partial.status,'prepared');connection.set(false);const pool=h.caches.entries.get('babelshelf-product-assets-v1');pool.delete(origin+'/.babelshelf-app-assets/'+files[2].sha256);
 assert.equal(await(await h.request('/assets/ort-RUNTIM12.wasm')).text(),'RUNTIME');const failed=await prepareRole(h,'speech');assert.equal(failed.status,'failed');assert.match(failed.error,/Downloads are off/);assert.deepEqual(h.network,[origin+'/index.html',origin+'/assets/ort-RUNTIM12.wasm',origin+'/assets/ort-MISSIN12.wasm']);
});
test('old shared-aware lazy modules remain available after a new build removes them',async()=>{const old=await harness('OLD',{files:[pinned('./assets/reader-OLDabc12.js','OLD')]});await install(old);const next=await harness('NEW',{caches:old.caches,build:'3333333333333333'});await install(next);next.network.length=0;assert.equal(await (await next.request('/assets/reader-OLDabc12.js')).text(),'OLD');assert.deepEqual(next.network,[]);});

test('shared entries are rehashed on install and corrupt bytes require an explicit verified fetch',async()=>{const first=await harness();await install(first);const pool=first.caches.entries.get('babelshelf-product-assets-v1'),key=[...pool.keys()][0];pool.set(key,new Response('BAD'));const next=await harness('NEW',{caches:first.caches,build:'3333333333333333'});await install(next);assert.equal(next.network.length,1);assert.equal(await (await next.request('/assets/main-NEWabc12.js')).text(),'NEW');assert.equal((await next.request('/.babelshelf-app-manifest-v1')).status,503);assert.equal((await next.request('/.babelshelf-app-assets/'+key.split('/').at(-1))).status,503);});
test('failed manifest publication leaves old generations intact and verified pool bytes reusable',async()=>{const shared=storage(),old=await harness('OLD',{caches:shared,files:[pinned('./index.html','OLD')]});await install(old);const open=shared.open;let fail=true;shared.open=async name=>{const cache=await open(name);return {...cache,put:async(url,response)=>{if(fail&&name==='babelshelf-product-3333333333333333'&&String(url).endsWith('.babelshelf-app-manifest-v1')){fail=false;throw Error('QuotaExceededError');}return cache.put(url,response);}};};const next=await harness('NEW',{caches:shared,build:'3333333333333333'});await assert.rejects(install(next),/Quota/);assert.equal(await (await old.request('/','navigate')).text(),'OLD');assert.equal(shared.entries.get('babelshelf-product-3333333333333333').has(origin+'/.babelshelf-app-manifest-v1'),false);const retry=await harness('NEW',{caches:shared,build:'4444444444444444'});await install(retry);assert.equal(retry.network.length,0);assert.equal(await (await retry.request('/assets/main-NEWabc12.js')).text(),'NEW');});
test('shared lookup respects deployment scope and rejects malformed historical metadata',async()=>{const files=[pinned('./index.html','INDEX'),pinned('./assets/main-SHARED12.js','BINARY')],body=url=>String(url).endsWith('index.html')?'INDEX':'BINARY',nested=await harness(body,{files,scope:origin+'/nested/'});await install(nested);assert.equal(await (await nested.request('/nested/','navigate')).text(),'INDEX');assert.equal(await (await nested.request('/nested/assets/main-SHARED12.js')).text(),'BINARY');assert.equal((await nested.request('/assets/main-SHARED12.js')).status,503);const invalid={schema:1,build:previous,assets:[{path:'./assets/foreign-FOREIGN1.js',bytes:3,sha256:['0'.repeat(64)]}]};await nested.put('babelshelf-product-'+previous,'/nested/.babelshelf-app-manifest-v1',JSON.stringify(invalid));assert.equal((await nested.request('/nested/assets/foreign-FOREIGN1.js')).status,503);});
test('installation refuses silently lost shell, shared and manifest writes without damaging the old app',async()=>{
 for(const target of ['shell','shared','manifest']){
  const caches=storage(),files=[pinned('./index.html','INDEX'),pinned('./assets/main-NEWabc12.js','NEW')],body=url=>String(url).endsWith('index.html')?'INDEX':'NEW';
  const old=await harness('OLD',{caches,files:[pinned('./index.html','OLD')]});await install(old);
  const open=caches.open;caches.open=async name=>{const cache=await open(name);return {...cache,put:async(key,response)=>{const path=String(key),drop=target==='shell'?name==='babelshelf-product-3333333333333333'&&path.endsWith('/index.html'):target==='shared'?name==='babelshelf-product-assets-v1':name==='babelshelf-product-3333333333333333'&&path.endsWith('.babelshelf-app-manifest-v1');if(!drop)return cache.put(key,response);}};};
  const next=await harness(body,{caches,files,build:'3333333333333333'});await assert.rejects(install(next),/App asset storage verification failed/,target);
  assert.equal(await(await old.request('/','navigate')).text(),'OLD');
 }
});

test('redirected cached navigation returns verified bytes without redirect metadata or a network retry',async()=>{
 const h=await harness();
 const original=new Response('Verified shell',{headers:{'Content-Type':'text/html','Content-Encoding':'gzip','Content-Length':'999'}});
 Object.defineProperty(original,'redirected',{value:true});
 const open=h.caches.open;h.caches.open=async name=>{const cache=await open(name);return {...cache,match:async url=>url===origin+'/index.html'?original:cache.match(url)};};
 const result=await h.request('/','navigate');
 assert.equal(result.redirected,false);assert.equal(await result.text(),'Verified shell');
 assert.equal(result.headers.get('content-type'),'text/html');assert.equal(result.headers.get('content-encoding'),null);assert.equal(result.headers.get('content-length'),null);assert.deepEqual(h.network,[]);
});

test('cache read rejection returns a local failure response and the same cache can recover without network acquisition',async()=>{
 const caches=storage(),originalOpen=caches.open;let failed=true;
 caches.open=async name=>{if(failed)throw Error('read unavailable');return originalOpen(name);};
 const h=await harness('NEW',{caches});
 const result=await h.request('/','navigate');assert.equal(result.status,503);assert.match(await result.text(),/Local app unavailable/);
 assert.equal((await h.request('/assets/main-NEWabc12.js')).status,503);assert.deepEqual(h.network,[]);
 failed=false;await h.put('babelshelf-product-'+current,'/index.html','Retained shell');
 assert.equal(await(await h.request('/','navigate')).text(),'Retained shell');assert.deepEqual(h.network,[]);
});

function allowHF(h,url,{client='tab-a',range='',sourceOrigin=origin}={}){let reply;h.handlers.message({source:{id:client,url:sourceOrigin+'/',type:'window'},data:{type:'allow-huggingface-request',url,range},ports:[{postMessage(value){reply=value;}}]});return reply?.allowed;}

test('Offline blocks pinned downloads and pre-issued HF grants across tabs while retaining the local shell',async()=>{
 const connection=connectionDatabase(true),h=await harness('NEW',{connection}),url='https://huggingface.co/api/models/owner/model?blobs=true';
 await h.put('babelshelf-product-'+current,'/index.html','Retained local app');
 assert.equal(allowHF(h,url),true);connection.set(false);
 assert.equal((await h.request('https://assets.example/model','cors','GET','another-tab')).status,503);
 assert.equal((await h.request(url,'cors','GET','tab-a')).status,503);
 assert.equal(await(await h.request('/','navigate')).text(),'Retained local app');assert.deepEqual(h.network,[]);
 const restarted=await harness('NEW',{connection});assert.equal((await restarted.request('https://assets.example/model')).status,503);
 connection.set(true);assert.equal((await restarted.request('https://assets.example/model')).status,200);
 assert.equal((await restarted.request('https://unapproved.example/model')).status,503);
});

test('confirmed Offline cancels a response body already downloading in another tab and revokes unused grants',async()=>{
 const connection=connectionDatabase(true);let aborted=false;
 const h=await harness('NEW',{connection,fetcher:async(request,{signal})=>new Response(new ReadableStream({start(controller){signal.addEventListener('abort',()=>{aborted=true;controller.error(Error('Offline'));},{once:true});}}))});
 const reader=(await h.request('https://assets.example/model','cors','GET','another-tab')).body.getReader(),pending=reader.read();
 const rejected=assert.rejects(pending,/Offline/),url='https://huggingface.co/api/models/owner/model?blobs=true';assert.equal(allowHF(h,url),true);
 connection.set(false);let work,reply;
 h.handlers.message({source:{id:'tab-a',type:'window',url:origin+'/'},data:{type:'network-offline'},ports:[{postMessage(value){reply=value;}}],waitUntil:value=>work=value});
 await work;await rejected;assert.equal(reply.offline,true);assert.equal(aborted,true);
 connection.set(true);assert.equal((await h.request(url,'cors','GET','tab-a')).status,503);
});

test('Offline prevents replacement app asset acquisition while first preparation and retained caches remain distinct',async()=>{
 const connection=connectionDatabase(false),h=await harness('NEW',{connection});
 h.self.registration.active={};
 await h.put('babelshelf-product-'+previous,'/index.html','OLD');
 await assert.rejects(install(h),/App is offline/);assert.deepEqual(h.network,[]);
 assert.equal(await(await (await h.caches.open('babelshelf-product-'+previous)).match(origin+'/index.html')).text(),'OLD');
 connection.set(true);await install(h);assert.equal(h.network.length,1);
});
test('explicit HF access is one-use, exact URL/range and scoped to its initiating tab',async()=>{
 const h=await harness(),url='https://huggingface.co/api/models/owner/model?blobs=true';
 assert.equal((await h.request(url,'cors','GET','tab-a')).status,503);assert.equal(allowHF(h,url),true);
 assert.equal((await h.request(url,'cors','GET','tab-b')).status,503);assert.equal((await h.request(url,'cors','GET','tab-a')).status,200);assert.equal((await h.request(url,'cors','GET','tab-a')).status,503);
 const weights='https://huggingface.co/owner/model/resolve/'+'a'.repeat(40)+'/model.gguf?download=true';
 assert.equal(allowHF(h,weights,{range:'bytes=0-16777215'}),true);assert.equal((await h.request(weights,'cors','GET','tab-a')).status,503);assert.equal((await h.request(weights,'cors','GET','tab-a','bytes=0-16777215')).status,200);assert.equal((await h.request(weights,'cors','GET','tab-a','bytes=0-16777215')).status,503);
 assert.deepEqual(h.network,[url,weights]);
});
test('HF grants expire and cannot authorize mutable revisions, other endpoints, origins or oversized ranges',async()=>{
 let now=100;const h=await harness('NEW',{now:()=>now}),url='https://huggingface.co/api/models/owner/model?blobs=true';
 assert.equal(allowHF(h,url),true);now+=30001;assert.equal((await h.request(url,'cors','GET','tab-a')).status,503);
 for(const bad of ['https://huggingface.co/api/whoami','https://example.com/api/models/owner/model?blobs=true','https://huggingface.co/owner/model/resolve/main/model.gguf?download=true',url+'&private=data'])assert.equal(allowHF(h,bad),false);
 assert.equal(allowHF(h,url,{sourceOrigin:'https://other.example'}),false);
 const weights='https://huggingface.co/owner/model/resolve/'+'a'.repeat(40)+'/model.gguf?download=true';assert.equal(allowHF(h,weights,{range:'bytes=0-16777216'}),false);assert.deepEqual(h.network,[]);
});
