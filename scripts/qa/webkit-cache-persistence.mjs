import {webkit} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {stat,writeFile} from 'node:fs/promises';
import {isAbsolute} from 'node:path';
import assert from 'node:assert/strict';
const [profileDir,output]=process.argv.slice(2);assert.ok(isAbsolute(profileDir)&&isAbsolute(output));let exists=false;try{await stat(profileDir);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(exists,false,'Use a new isolated profile');
const evidence={scope:'Windows WebKit native Cache API persistence across owned browser launches; no product data or SW modification',profileDir,phases:[]};
for(const first of [true,false]){const c=await webkit.launchPersistentContext(profileDir,{headless:true});try{const p=c.pages()[0];await p.goto('http://127.0.0.1:4180/qa-cache-isolation.txt');evidence.phases.push(await p.evaluate(async(first)=>{const name='qa-cache-persistence',key=location.origin+'/qa-native-sentinel',expected='Native Cache persistence 日本語';if(first){const cache=await caches.open(name);await cache.put(key,new Response(expected,{headers:{'Content-Type':'text/plain'}}));}const names=await caches.keys(),cache=await caches.open(name),keys=await cache.keys(),hit=await cache.match(key);return {first,names,count:keys.length,body:hit?await hit.text():null,expected};},first));}finally{await c.close();}}
evidence.pass=evidence.phases.every(p=>p.count===1&&p.body===p.expected);await writeFile(output,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));if(!evidence.pass)process.exitCode=1;
