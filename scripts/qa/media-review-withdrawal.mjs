import assert from 'node:assert/strict';
import {mkdir,stat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [out,profile,pdf]=process.argv.slice(2);
assert.ok(out&&profile&&pdf,'OUTPUT NEW_PROFILE PUBLIC_PDF required');
await mkdir(out,{recursive:false});
try{await stat(profile);throw Error('Dedicated profile must be new');}catch(e){if(e.code!=='ENOENT')throw e;}
const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}});
const page=context.pages()[0],evidence={scope:'PC native two-tab PDF review versus original withdrawal; actual PDF extraction and normal UI writes, no injected failure or inference',steps:[]};
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
 await review.getByRole('button',{name:'Save note',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).waitFor();
 const saved=await snapshot(),original=saved.notes.find(n=>n.originalAsset);assert.ok(original);
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.locator('.pending-attachments .media-open').click();await page.getByRole('button',{name:'Read text',exact:true}).click();
 await review.getByRole('button',{name:'Save note',exact:true}).waitFor();evidence.extracted=await review.locator('.file-body').allTextContents();
 const other=await context.newPage();await other.goto('http://127.0.0.1:4180/');await other.getByRole('textbox',{name:'Message',exact:true}).fill('Read: '+original.revisions.at(-1).path);
 await other.getByRole('button',{name:'Send',exact:true}).click();await other.getByRole('button',{name:'History',exact:true}).waitFor();
 await other.getByRole('button',{name:'File actions',exact:true}).click();await other.getByRole('dialog').getByRole('button',{name:'Delete',exact:true}).click();
 await other.getByRole('dialog',{name:'Delete?',exact:true}).getByRole('button',{name:'Delete',exact:true}).click();await other.getByRole('dialog').waitFor({state:'hidden'});
 const withdrawn=await snapshot();assert.equal(withdrawn.notes.find(n=>n.id===original.id).state,'withdrawn');evidence.steps.push('other-tab-normal-original-delete');
 await review.getByRole('button',{name:'Save note',exact:true}).click();await review.getByRole('alert').filter({hasText:'Original withdrawn'}).waitFor();
 assert.deepEqual(await snapshot(),withdrawn);assert.deepEqual(await review.locator('.file-body').allTextContents(),evidence.extracted);
 const layout=await review.evaluate(el=>{const a=el.querySelector('[role=alert]').getBoundingClientRect(),b=el.querySelector('.schedule-form--task').getBoundingClientRect();return {error:{x:a.x,y:a.y,width:a.width,bottom:a.bottom},content:{x:b.x,y:b.y,width:b.width}};});
 evidence.errorLayout=layout;assert.ok(layout.error.bottom<=layout.content.y+2,'Error is beside review instead of above it');assert.ok(Math.abs(layout.error.width-layout.content.width)<=2,'Error shrinks review into columns');
 evidence.steps.push('stale-extraction-save-refused-inline-with-no-writes');await page.screenshot({path:out+'/withdrawn-review.png'});
 await review.getByRole('button',{name:'Cancel',exact:true}).click();await review.waitFor({state:'hidden'});evidence.steps.push('explicit-cancel-works');evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);evidence.screen=(await page.locator('body').innerText()).slice(-2000);await page.screenshot({path:out+'/failure.png'});process.exitCode=1;}
finally{await context.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
