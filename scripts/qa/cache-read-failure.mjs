import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {productWorker} from '../product-worker.mjs';
const out=process.argv[2];await mkdir(out,{recursive:false});
const html='<!doctype html><title>Local shell</title><h1>Local shell</h1><script>navigator.serviceWorker.register("/sw.js")</script>';
const bytes=Buffer.from(html),fault=`let failRead=false;const actualOpen=caches.open.bind(caches);caches.open=(...args)=>failRead?Promise.reject(new DOMException('Controlled cache read failure','UnknownError')):actualOpen(...args);self.addEventListener('message',e=>{if(typeof e.data?.cacheReadFailure==='boolean'){failRead=e.data.cacheReadFailure;e.ports[0]?.postMessage('ack');}});`;
const worker=fault+productWorker({build:'2262262262262262',files:[{path:'./index.html',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}],remote:[]});
const evidence={scope:'PC Chrome with actual production Service Worker. Controlled CacheStorage read rejection after successful install; not proof of the cause in the user embedded browser.',requests:[]};
const server=createServer((req,res)=>{evidence.requests.push(req.url);res.setHeader('Content-Type',req.url==='/sw.js'?'text/javascript':'text/html');res.end(req.url==='/sw.js'?worker:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;let c;
try{
 c=await chromium.launchPersistentContext(out+'/profile',{channel:'chrome',headless:true});const p=c.pages()[0];await p.goto(origin);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await p.evaluate(()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();navigator.serviceWorker.controller.postMessage({cacheReadFailure:true},[c.port2]);}));
 const count=evidence.requests.length;let response;try{response=await p.reload();}catch(e){evidence.navigationError=String(e);throw e;}
 assert.equal(response.status(),503);evidence.errorText=await p.locator('body').innerText();assert.match(evidence.errorText,/Local app unavailable/);assert.equal(evidence.requests.length,count,'No network repair may occur');
 // Same registration and cache, no clearing or data reset: retry after the read
 // failure ends must render the original verified shell.
 await p.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();registration.active.postMessage({cacheReadFailure:false},[c.port2]);});});
 await p.reload();assert.equal(await p.locator('h1').innerText(),'Local shell');assert.equal(evidence.requests.length,count);evidence.recovered=true;evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}
finally{await c?.close();await new Promise(r=>server.close(r));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
