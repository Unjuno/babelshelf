// Native browser regression: static hosts redirect /index.html to /.
import {createServer} from 'node:http';
import {mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {productWorker} from '../product-worker.mjs';
const out=process.argv[2];
await mkdir(out,{recursive:false});
const html='<!doctype html><title>Redirected shell</title><h1>Local shell</h1><script>navigator.serviceWorker.register("/sw.js")</script>';
const worker=productWorker({build:'1951951951951951',files:[{path:'./index.html',bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')}],remote:[]});
const evidence={scope:'Native PC Chrome, real HTTP redirect and production worker; no model or personal records',requests:[]};
const server=createServer((req,res)=>{evidence.requests.push(req.url);res.setHeader('Cache-Control','no-store');if(req.url==='/index.html'){res.writeHead(302,{Location:'/'});res.end();return;}res.setHeader('Content-Type',req.url==='/sw.js'?'text/javascript':'text/html');res.end(req.url==='/sw.js'?worker:html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let c,closed=false;
try {
 c=await chromium.launchPersistentContext(out+'/profile',{channel:'chrome',headless:true});
 let p=c.pages()[0];await p.goto(origin);await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 evidence.cached=await p.evaluate(async()=>{const r=await(await caches.open('babelshelf-product-1951951951951951')).match(location.origin+'/index.html');return {redirected:r.redirected,body:await r.text()};});
 assert.equal(evidence.cached.redirected,true);assert.equal(evidence.cached.body,html);
 await c.close();c=null;await new Promise(r=>server.close(r));closed=true;
 c=await chromium.launchPersistentContext(out+'/profile',{channel:'chrome',headless:true,offline:true});p=c.pages()[0];
 await p.goto(origin,{timeout:15000});assert.equal(await p.locator('h1').innerText(),'Local shell');
 evidence.offlineColdLaunch=true;evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}
finally {await c?.close();if(!closed)await new Promise(r=>server.close(r));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
