import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out='../../outputs/unit75-tool-packages';await mkdir(out,{recursive:true});
const c=await chromium.launch({channel:'chrome',headless:true});const p=await c.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(20000);
const evidence={scope:'PC Chrome; fresh isolated context; real canonical built-in records; no inference or device claim'};
try{
 await p.goto('http://127.0.0.1:4180/');await p.getByRole('textbox',{name:'Message',exact:true}).fill('Search Tools/');await p.getByRole('button',{name:'Send',exact:true}).click();await p.locator('.sent-message').last().getByRole('button',{name:'View source',exact:true}).first().waitFor();evidence.search=await p.locator('.sent-message').last().innerText();
 await p.getByRole('textbox',{name:'Message',exact:true}).fill('Read Tools/memory.search.md');await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).waitFor();evidence.read=await p.locator('.file-body').innerText();assert.match(evidence.read,/Search local saved records/);
 evidence.databases=await p.evaluate(async()=>{const result=[];for(const meta of await indexedDB.databases()){const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(meta.name);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});if(db.objectStoreNames.contains('settings')){const rows=await new Promise((resolve,reject)=>{const q=db.transaction('settings').objectStore('settings').getAll();q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});result.push({name:meta.name,settings:rows});}db.close();}return result;});
 const serialized=JSON.stringify(evidence.databases);assert.match(serialized,/packageVersion/);assert.match(serialized,/memory.search/);assert.match(serialized,/memory.read/);
 await p.screenshot({path:out+'/read.png'});evidence.pass=true;
} catch(e){evidence.body=await p.locator('body').innerText();evidence.error=String(e);evidence.pass=false;process.exitCode=1;}finally{await c.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({pass:evidence.pass,error:evidence.error}));}


