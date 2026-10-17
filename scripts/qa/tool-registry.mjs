import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const out='../../outputs/unit79-tool-registry';await mkdir(out,{recursive:true});
const c=await chromium.launch({channel:'chrome',headless:true});const p=await c.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(20000);
const evidence={scope:'PC Chrome; fresh isolated context; real canonical built-in records; no inference or device claim'};
try{
 await p.goto('http://127.0.0.1:4180/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller);evidence.build=await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));await p.getByRole('textbox',{name:'Message',exact:true}).fill('Search Tools/');await p.getByRole('button',{name:'Send',exact:true}).click();await p.locator('.sent-message').last().getByRole('button',{name:'View source',exact:true}).first().waitFor();evidence.search=await p.locator('.sent-message').last().innerText();
 await p.getByRole('textbox',{name:'Message',exact:true}).fill('Read Tools/memory.search.md');await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).waitFor();evidence.read=await p.locator('.file-body').innerText();assert.match(evidence.read,/Search local saved records/);
 evidence.databases=await p.evaluate(async()=>{const result=[];for(const meta of await indexedDB.databases()){const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(meta.name);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});if(db.objectStoreNames.contains('settings')){const rows=await new Promise((resolve,reject)=>{const q=db.transaction('settings').objectStore('settings').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});result.push({name:meta.name,settings:rows});}db.close();}return result;});
 const serialized=JSON.stringify(evidence.databases);assert.match(serialized,/packageVersion/);assert.match(serialized,/memory.search/);assert.match(serialized,/memory.read/);
 const activities=evidence.databases.flatMap(db=>db.settings.flatMap(s=>s.turns??[]).flatMap(t=>t.activity??[]));evidence.packages=[];
 for(const id of ['memory.search','memory.read']){
 const sources=[];for(const [path,file] of [['Tools/'+id+'/SKILL.md','design/prototype/src/tools/'+id+'/SKILL.md'],['Tools/'+id+'/tool.ts','design/prototype/src/tools/'+id+'/tool.ts'],['Tools/tool-host.ts','design/prototype/src/tools/tool-host.ts']])sources.push({path,body:await readFile(file,'utf8')});sources.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const entry='Tools/'+id+'/tool.ts',expected=createHash('sha256').update(JSON.stringify({id,version:1,entry,sources}),'utf8').digest('hex'),activity=activities.find(a=>a.tool===id&&a.status==='succeeded');assert.ok(activity);assert.equal(activity.input.packageSha256,expected);assert.equal(activity.input.entry,entry);evidence.packages.push({id,expected,actual:activity.input.packageSha256});
 }
 await p.screenshot({path:out+'/read.png'});evidence.pass=true;
} catch(e){evidence.body=await p.locator('body').innerText();evidence.error=String(e);evidence.pass=false;process.exitCode=1;}finally{await c.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({pass:evidence.pass,error:evidence.error}));}


