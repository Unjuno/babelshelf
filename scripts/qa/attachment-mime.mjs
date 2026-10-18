import assert from 'node:assert/strict';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';import {mkdir,writeFile,stat,readFile} from 'node:fs/promises';
let activePage;const out=process.argv[2];await mkdir(out,{recursive:false});const profile=process.argv[3];assert.ok(profile,'New dedicated persistent QA profile required');try{await stat(profile);throw Error('QA profile must not exist');}catch(e){if(e.code!=='ENOENT')throw e;}const b=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}}),evidence={scope:'Native PC File API MIME-parameter TXT/PNG imports with byte-exact canonical originals; no inference or hardware/recognition claim',screens:[]};
try{
 const p=activePage=b.pages()[0];p.setDefaultTimeout(20000);await p.goto('http://127.0.0.1:4180/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller);
 evidence.build=await p.evaluate(()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[c.port2]);}));
 const text=Buffer.from('MIME163 · 水 / Water / eau.\n'),png=await readFile(process.argv[4]);
 await p.locator('input[type=file][multiple][accept*=".txt"]').setInputFiles([{name:'mime163.txt',mimeType:'text/plain; charset=utf-8',buffer:text},{name:'mime163.png',mimeType:'image/png; name=source.png',buffer:png}]);
 await p.getByText(/KB · Text available/).waitFor();await p.locator('.pending-attachments .media-card').filter({hasText:'mime163.png'}).getByText(/Image original/).waitFor();await p.getByRole('button',{name:'Send',exact:true}).click();
 await p.waitForFunction(()=>document.querySelectorAll('.sent-message').length>0||document.body.textContent.includes('Original metadata invalid'));
 assert.equal(await p.locator('.sent-message').count(),1,'Parameterized MIME was refused before import');
 await p.waitForFunction(()=>!document.querySelector('button[aria-label="Send"]')?.disabled);
 const snapshot=await p.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('mlb-memory-v1',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction(['notes','runs'],'readonly'),notes=tx.objectStore('notes').getAll(),runs=tx.objectStore('runs').getAll();tx.oncomplete=()=>{db.close();resolve({notes:notes.result,runs:runs.result});};};}));
 const originals=snapshot.runs.filter(r=>r?.type==='original-asset');assert.equal(originals.length,2);
 const {readOriginal}=await import('../../design/prototype/src/original-assets.ts');
 for(const [name,mime,bytes] of [['mime163.txt','text/plain',text],['mime163.png','image/png',png]]){const asset=originals.find(a=>a.name===name);assert.equal(asset.mime,mime);assert.deepEqual(Buffer.from(readOriginal(asset)),bytes);}
 const textNote=snapshot.notes.find(n=>n.id===originals.find(a=>a.name==='mime163.txt').id),image=snapshot.notes.find(n=>n.id===originals.find(a=>a.name==='mime163.png').id);
 assert.equal(textNote.revisions[0].body,text.toString('utf8'));assert.equal(image.revisions[0].body,'');assert.equal(image.ocrText,undefined);assert.equal(originals.find(a=>a.name==='mime163.png').kind,'image');
 evidence.originalsByteExact=true;evidence.multilingualTextExact=true;evidence.unreadImageNotFabricated=true;evidence.pass=true;
}catch(error){evidence.pass=false;evidence.error=String(error);if(activePage){evidence.screen=(await activePage.locator('body').innerText()).slice(-2000);await activePage.screenshot({path:out+'/failure.png'});}process.exitCode=1;}finally{await b.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
