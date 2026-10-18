import assert from 'node:assert/strict';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [out,profile,pdf]=process.argv.slice(2);
assert.ok(out&&profile&&pdf,'OUTPUT NEW_PROFILE PUBLIC_PDF required');
await mkdir(out,{recursive:false});
try{await stat(profile);throw Error('Dedicated profile must be new');}catch(e){if(e.code!=='ENOENT')throw e;}
const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}});
const page=context.pages()[0],evidence={scope:'PC native PDF review with real PDF extraction; controlled actual IDB transaction hold/abort, not quota failure or inference',steps:[]};
async function snapshot(){return page.evaluate(()=>new Promise((resolve,reject)=>{
 const q=indexedDB.open('mlb-memory-v1',1);q.onerror=()=>reject(q.error);q.onsuccess=()=>{
  const db=q.result,tx=db.transaction(['notes','settings','runs'],'readonly'),data={};
  for(const store of ['notes','settings','runs']){const r=tx.objectStore(store).getAll();r.onsuccess=()=>{data[store]=r.result;};}
  tx.oncomplete=()=>{db.close();resolve(data);};tx.onabort=()=>reject(tx.error);
 };
}));}
try{
 page.setDefaultTimeout(20000);await page.goto('http://127.0.0.1:4180/');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 evidence.build=await page.evaluate(()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[c.port2]);}));
 await page.locator('input[type=file][multiple][accept*=".txt"]').setInputFiles(resolve(pdf));
 await page.locator('.pending-attachments .media-open').click();await page.getByRole('button',{name:'Read text',exact:true}).click();
 const review=page.getByRole('dialog',{name:'Review text',exact:true});await review.getByRole('button',{name:'Save note',exact:true}).waitFor();
 evidence.extracted=await review.locator('.file-body').allTextContents();assert.ok(evidence.extracted[0].trim());
 const before=await snapshot();
 await page.evaluate(()=>new Promise((resolve,reject)=>{
  const q=indexedDB.open('mlb-memory-v1',1);q.onerror=()=>reject(q.error);q.onsuccess=()=>{
   const db=q.result,tx=db.transaction(['notes','settings','runs'],'readwrite');window.qaHold=true;
   let ready=false;function loop(){const r=tx.objectStore('notes').get('__qa_read_only__');r.onsuccess=()=>{if(!ready){ready=true;resolve();}if(window.qaHold)loop();};}loop();
   tx.oncomplete=()=>{db.close();window.qaReleased=true;};
   const original=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(stores,mode,...rest){
    const value=original.call(this,stores,mode,...rest);
    if(mode==='readwrite'&&[...value.objectStoreNames].includes('notes')&&[...value.objectStoreNames].includes('runs')){
     IDBDatabase.prototype.transaction=original;
     value.objectStore('runs').get('__qa_abort_read__').onsuccess=()=>{if(window.qaAbort){window.qaAborted=true;value.abort();}};
    }return value;
   };
  };
 }));
 await review.getByRole('button',{name:'Save note',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent==='Save note'&&b.disabled));
 try{
  await page.keyboard.press('Escape');assert.equal(await review.count(),1,'Pending review dismissed by Escape');
  await page.mouse.click(350,80);assert.equal(await review.count(),1,'Pending review dismissed by backdrop');
  evidence.steps.push('pending-dismiss-refused');
 }finally{await page.evaluate(()=>{window.qaAbort=true;window.qaHold=false;});}
 await page.waitForFunction(()=>window.qaAborted===true);await review.getByRole('button',{name:'Save note',exact:true}).waitFor();
 await review.getByRole('alert').waitFor();evidence.error=await review.getByRole('alert').innerText();assert.ok(evidence.error.trim());
 assert.deepEqual(await snapshot(),before);evidence.failedSaveAllStoresUnchanged=true;
 assert.deepEqual(await review.locator('.file-body').allTextContents(),evidence.extracted);
 evidence.steps.push('actual-abort-visible-and-review-retained');
 await review.getByRole('button',{name:'Save note',exact:true}).click();await review.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'History',exact:true}).waitFor();assert.equal(await page.locator('.file-body').textContent(),evidence.extracted.map(t=>t.startsWith('No text')?'':t).join('\n\n'));
 const after=await snapshot(),created=after.notes.filter(n=>!before.notes.some(old=>old.id===n.id));
 assert.equal(created.length,2);assert.equal(created.filter(n=>n.pdfText).length,1);
 for(const n of before.notes)assert.deepEqual(after.notes.find(old=>old.id===n.id),n);
 evidence.oneOriginalAndExtractionCommitted=true;
 evidence.steps.push('explicit-retry-saved-exact-text');evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);await page.evaluate(()=>{window.qaHold=false;}).catch(()=>{});evidence.screen=(await page.locator('body').innerText()).slice(-2000);await page.screenshot({path:out+'/failure.png'});process.exitCode=1;}
finally{await context.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
