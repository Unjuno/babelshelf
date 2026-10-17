import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join,basename,isAbsolute} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [profile,output,source]=process.argv.slice(2);for(const p of [profile,output,source])assert.ok(p&&isAbsolute(p));
for(const p of [profile,output]){try{await stat(p);throw Error('Use new QA paths');}catch(e){if(e.code!=='ENOENT')throw e;}}await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile('design/prototype/src/onnx-text-manifest.json','utf8')),evidence={scope:'PC native product UI engine lifecycle: registration/import/offline load/Stop/reload. Normal Send outcome recorded separately; lifecycle PASS does not prove harness model suitability. No phone claim.',phases:[]};
async function go(p,name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function models(p){await go(p,'Settings');await p.getByRole('button',{name:'Models',exact:true}).click();}
async function input(p){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('button',{name:'Input',exact:true}).click();}
async function backup(p,name){await go(p,'Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();const event=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(output,name);await(await event).saveAs(path);return JSON.parse(await readFile(path,'utf8')).payload;}
async function phase(offline,run){const c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,offline,viewport:{width:390,height:844},acceptDownloads:true});try{c.setDefaultTimeout(15000);const p=c.pages()[0];await p.goto('http://127.0.0.1:4180/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});const info={offline,chrome:c.browser().version(),build:await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}))};evidence.phases.push(info);console.log('phase',info);await run(p,info,c);}finally{await c.close();await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));}}
try{
 await phase(false,async(p,info,c)=>{
  const before=await backup(p,'before.brainpack');info.beforeNotes=before.notes.length;
  await models(p);await p.getByRole('button',{name:'Add text model',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:/SmolLM2/}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
  await p.locator('input[type=file][accept=".gguf,.js,.json,.onnx"]').setInputFiles(manifest.files.map(f=>join(source,basename(f.path))));
  await p.getByRole('button',{name:'Load',exact:true}).waitFor({timeout:120000});await c.setOffline(true);await p.getByRole('button',{name:'Load',exact:true}).click();await p.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:180000});info.loaded=true;
  await p.getByRole('button',{name:'Unload',exact:true}).click();await p.getByRole('button',{name:'Load',exact:true}).waitFor();
  const after=await backup(p,'prepared.brainpack');info.preparedNotes=after.notes.length;assert.equal(after.notes.length,before.notes.length);for(const n of before.notes){const current=after.notes.find(x=>x.id===n.id);if(n.id==='settings-models')assert.deepEqual(current.revisions.slice(0,n.revisions.length),n.revisions);else assert.deepEqual(current,n);}
 });
 await phase(true,async(p,info)=>{
  await models(p);await p.getByRole('button',{name:'Load',exact:true}).waitFor({timeout:30000});await p.getByRole('button',{name:'Load',exact:true}).click();await p.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:180000});await p.screenshot({path:join(output,'loaded.png')});
  await input(p);const box=p.getByRole('textbox',{name:'Message',exact:true});await box.fill('Hello. Please introduce yourself in one short sentence.');await p.getByRole('button',{name:'Send',exact:true}).click();
  await p.getByRole('button',{name:'Stop',exact:true}).waitFor({timeout:15000});await p.getByRole('button',{name:'Stop',exact:true}).click();await p.getByRole('button',{name:'Send',exact:true}).waitFor({timeout:30000});info.stopped=await p.locator('.conversation').innerText().catch(()=>p.locator('body').innerText());
  await models(p);await p.getByRole('button',{name:'Load',exact:true}).waitFor();await p.getByRole('button',{name:'Load',exact:true}).click();await p.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:180000});info.reloaded=true;
  await input(p);await box.fill('Hello.');await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByRole('button',{name:'Send',exact:true}).waitFor({timeout:180000});await p.waitForFunction(()=>!document.querySelector('button[aria-label=Send]')?.disabled,null,{timeout:180000});info.result=await p.locator('body').innerText();info.harnessReplyAvailable=!info.result.includes('Invalid model JSON');await p.screenshot({path:join(output,'result.png')});await backup(p,'restart.brainpack');
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);throw e;}finally{await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
