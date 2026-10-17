import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [profileDir,outputDir,modelFile,runtimeFile]=process.argv.slice(2);
for(const path of [profileDir,outputDir,modelFile,runtimeFile])assert.ok(path&&isAbsolute(path));
for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(exists,false,'Use new QA paths');}await mkdir(outputDir,{recursive:true});
const evidence={scope:'Native PC Chrome product UI, actual local model; official4B as custom identity, not a fine-tuned compatibility benchmark',phases:[]};
async function go(p,name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function input(p){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('button',{name:'Input',exact:true}).click();}
async function backup(p,name){await go(p,'Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(outputDir,name);await(await pending).saveAs(path);return JSON.parse(await readFile(path,'utf8')).payload;}
const models=pack=>JSON.parse(pack.notes.find(n=>n.id==='settings-models').revisions.at(-1).body.match(/```json\n([\s\S]+)\n```/)[1]);
async function phase(offline,run){const c=await chromium.launchPersistentContext(profileDir,{channel:'chrome',headless:true,offline,viewport:{width:360,height:780},acceptDownloads:true});try{c.setDefaultTimeout(15000);const p=c.pages()[0];p.on('pageerror',e=>console.log('PAGEERROR',e.message));await p.goto('http://127.0.0.1:4180/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
 const build=await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));const info={offline,build};evidence.phases.push(info);console.log('Phase',offline,build);await run(p,info,c);
 }finally{await c.close();await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));}}
let selected;
try{
 await phase(false,async(p,info,c)=>{
  await go(p,'Settings');await p.getByRole('button',{name:'Models',exact:true}).click();await p.getByRole('button',{name:'Add text model',exact:true}).click();
  const chooser=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Choose local model',exact:true}).click();await(await chooser).setFiles([modelFile,runtimeFile]);
  await c.setOffline(true);await p.getByRole('dialog',{name:'Add model',exact:true}).waitFor();await p.getByRole('button',{name:'Stop',exact:true}).click();await p.getByRole('button',{name:'Cancel',exact:true}).waitFor();assert.ok((await p.getByRole('dialog').innerText()).includes('Stopped'));await p.getByRole('button',{name:'Cancel',exact:true}).click();info.cancelledInspection=true;
  const before=await backup(p,'before.brainpack');assert.deepEqual(models(before).customModels??[],[]);await p.getByRole('button',{name:'Back to Settings',exact:true}).click();await p.getByRole('button',{name:'Models',exact:true}).click();await p.getByRole('button',{name:'Add text model',exact:true}).click();
  const next=p.waitForEvent('filechooser');await p.getByRole('button',{name:'Choose local model',exact:true}).click();await(await next).setFiles([modelFile,runtimeFile]);await p.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent==='Add'&&!b.disabled),null,{timeout:180000});
  info.review=await p.getByRole('dialog').innerText();await p.screenshot({path:join(outputDir,'review.png')});assert.ok(info.review.includes('Execution not tested'));await p.getByRole('button',{name:'Add',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden',timeout:240000});
  info.selected=await p.getByRole('button',{name:'Text model',exact:true}).innerText();await p.getByRole('button',{name:'Load',exact:true}).waitFor();await p.screenshot({path:join(outputDir,'registered.png')});const after=await backup(p,'registered.brainpack');selected=models(after).textModel;assert.ok(selected.startsWith('local-'));assert.equal(models(after).customModels.length,1);info.modelId=selected;
  await input(p);await p.getByRole('textbox',{name:'Message',exact:true}).fill('Remember KESTREL-4286 water reserve: 17 liters.');await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByRole('dialog',{name:'New file',exact:true}).getByRole('button',{name:'Save',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).waitFor();info.savedKnowledge=true;
 });
 await phase(true,async(p,info)=>{
  await go(p,'Settings');await p.getByRole('button',{name:'Models',exact:true}).click();info.selected=await p.getByRole('button',{name:'Text model',exact:true}).innerText();await p.getByRole('button',{name:'Load',exact:true}).waitFor({timeout:30000});
  await input(p);await p.getByRole('textbox',{name:'Message',exact:true}).fill('Answer: How many liters of water are in KESTREL-4286?');await p.getByRole('button',{name:'Send',exact:true}).click();
  await p.waitForFunction(()=>{const last=document.querySelector('.sent-message:last-child');return !!last?.querySelector('.reply-text')&&!!last.querySelector('button[aria-label^="View source"]')&&!document.querySelector('textarea[aria-label="Message"]')?.disabled;},null,{timeout:240000});info.answer=await p.locator('.sent-message').last().innerText();assert.ok(info.answer.includes('17'));await p.screenshot({path:join(outputDir,'answer.png')});
  const pack=await backup(p,'answer.brainpack');assert.equal(models(pack).textModel,selected);assert.equal(models(pack).customModels.length,1);info.registryRetained=true;
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);throw e;}finally{await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
