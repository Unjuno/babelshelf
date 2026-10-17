// Developer-only real Service Worker fixture. No model, user data or production origin.
import http from 'node:http';
import {readFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {productWorker} from './product-worker.mjs';
const port=Number(process.argv[2]??4184),phaseFile=process.argv[3],auditFile=process.argv[4];
if(!Number.isInteger(port)||port<1024||port>65535||!phaseFile||!auditFile)throw Error('Use node scripts/serve-cache-check.mjs PORT PHASE_FILE AUDIT_FILE');
const wasm=Buffer.from([0,97,115,109,1,0,0,0]),old=Buffer.from("export const label='OLD reader';\n"),next=Buffer.from("export const label='NEW reader';\n");
const html=Buffer.from(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application cache check</title><style>body{font:18px system-ui;max-width:700px;margin:24px auto;padding:16px;background:#fff;color:#15251f}button{font:inherit;padding:14px;margin:5px;border:1px solid #667d74;border-radius:10px;background:#edf5f0}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#edf5f0}</style><h1>Application cache check</h1><button id="prepare">Prepare</button><button id="update">Check update</button><button id="apply">Apply update</button><button id="old">Read old reader</button><button id="binary">Read shared binary</button><button id="inspect">Inspect assets</button><pre id="status">Not prepared</pre><pre id="assets"></pre><script type="module">
const status=document.querySelector('#status'),assets=document.querySelector('#assets');let reg;
const show=async work=>{try{status.textContent=await work();}catch(e){status.textContent='Error: '+e.message;}};
const build=()=>new Promise((resolve,reject)=>{const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data.build);(reg.active??navigator.serviceWorker.controller)?.postMessage('build',[channel.port2]);setTimeout(()=>reject(Error('Build reply timeout')),5000);});
prepare.onclick=()=>show(async()=>{reg=await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;return 'Prepared '+await build();});
update.onclick=()=>show(async()=>{reg=await navigator.serviceWorker.getRegistration();await reg.update();const pending=reg.installing;if(pending)await new Promise((resolve,reject)=>pending.addEventListener('statechange',()=>{if(pending.state==='installed')resolve();if(pending.state==='redundant')reject(Error('Installation refused'));}));return reg.waiting?'Update ready':'No waiting update';});
apply.onclick=()=>show(async()=>{reg=await navigator.serviceWorker.getRegistration();if(!reg.waiting)throw Error('No waiting update');const changed=new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));reg.waiting.postMessage({type:'activate-update'});await changed;return 'Active '+await build();});
old.onclick=()=>show(async()=> 'Old module: '+(await import('./assets/lazy-OLDabcd1.js')).label);
binary.onclick=()=>show(async()=>{const r=await fetch('./assets/reader-SHARED12.wasm');if(!r.ok)throw Error('Binary '+r.status);const b=await r.arrayBuffer();await WebAssembly.compile(b);return 'Shared WASM compiled: '+b.byteLength+' bytes';});
inspect.onclick=()=>show(async()=>{const pool=await caches.open('babelshelf-product-assets-v1'),keys=await pool.keys(),groups=[];for(const name of await caches.keys())if(/^babelshelf-product-[a-f0-9]{16}$/.test(name))groups.push({name,responses:(await (await caches.open(name)).keys()).length});assets.textContent=JSON.stringify({sharedResponses:keys.length,builds:groups},null,2);return 'Actual CacheStorage responses';});
</script>`);
const pin=(path,body)=>({path,bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')});
const server=http.createServer(async(request,response)=>{try{const phase=(await readFile(phaseFile,'utf8')).trim()==='B'?'B':'A',path=new URL(request.url,'http://127.0.0.1').pathname;let body,type='text/plain';
 if(path==='/'||path==='/index.html'){body=html;type='text/html';}
 else if(path==='/sw.js'){const files=[pin('./index.html',html),pin('./assets/reader-SHARED12.wasm',wasm),phase==='A'?pin('./assets/lazy-OLDabcd1.js',old):pin('./assets/lazy-NEWabcd1.js',next)];body=Buffer.from(productWorker({build:phase==='A'?'aaaaaaaaaaaaaaaa':'bbbbbbbbbbbbbbbb',files,remote:[]}));type='text/javascript';}
 else if(path==='/assets/reader-SHARED12.wasm'){body=wasm;type='application/wasm';}
 else if(path==='/assets/lazy-OLDabcd1.js'&&phase==='A'){body=old;type='text/javascript';}
 else if(path==='/assets/lazy-NEWabcd1.js'&&phase==='B'){body=next;type='text/javascript';}
 else{response.writeHead(404);response.end('Missing');return;}
 await appendFile(auditFile,JSON.stringify({phase,path,method:request.method,bytes:body.length})+'\n');response.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});response.end(body);
 }catch(error){response.writeHead(500);response.end(error.message);}});
server.listen(port,'127.0.0.1',()=>console.log('Cache check PID '+process.pid+' http://127.0.0.1:'+port));
