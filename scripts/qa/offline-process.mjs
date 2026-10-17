import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// Pass a Playwright BrowserType from the caller. No bundled browser/dependency,
// inference stub, database access, process kill or existing profile reuse.
export async function runOfflineProcessCheck(browserType,{profileDir,outputDir,url='http://127.0.0.1:4180/',channel='chrome'}){
 assert.ok(isAbsolute(profileDir)&&isAbsolute(outputDir),'Use absolute QA paths');
 assert.equal(new URL(url).hostname,'127.0.0.1','QA uses the local product server');
 for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(exists,false,'QA path must not already exist: '+path);}
 await mkdir(outputDir,{recursive:true});
 const marker='LARCH-5738',original='Process restart '+marker+'\n飲料水は18リットル。',edited=original.replace('18','24');
 const inputs=[{name:'process-import.txt',body:'Local import FIR-5263\n飲料水の保管場所は玄関です。'},{name:'process-import.md',body:'# HAZEL-3197\n\n充電器は青い箱にあります。'}];
 for(const input of inputs)await writeFile(join(outputDir,input.name),input.body,'utf8');
 const evidence={scope:'PC headless Chrome persistent profile, Playwright context offline before navigation; not installed/mobile/physical-network acceptance',profileDir,url,phases:[]};
 async function go(p,name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
 async function input(p){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('button',{name:'Input',exact:true}).click();}
 async function search(p,query,expected){
  const count=await p.locator('.sent-message').count(),request='Search '+query;
  await p.getByRole('textbox',{name:'Message',exact:true}).fill(request);await p.getByRole('button',{name:'Send',exact:true}).click();
  await p.waitForFunction(({count,request})=>{const turns=document.querySelectorAll('.sent-message'),last=turns[turns.length-1];return turns.length>count&&last?.querySelector('.user-bubble')?.textContent===request&&last.querySelector('.turn-status')?.textContent==='Found · 1';},{count,request});
  const text=await p.locator('.sent-message').last().innerText();assert.ok(text.includes(expected),text);return text;
 }
 async function backup(p,name,alreadyLocal=false){if(!alreadyLocal){await go(p,'Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();}const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(outputDir,name);await(await pending).saveAs(path);return JSON.parse(await readFile(path,'utf8')).payload;}
 async function phase(offline,work){
  const c=await browserType.launchPersistentContext(profileDir,{channel,headless:true,offline,viewport:{width:360,height:780},acceptDownloads:true});
  try{c.setDefaultTimeout(7000);const p=c.pages()[0]??await c.newPage();await p.goto(url,{timeout:15000});await p.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:30000});
   const session=await c.browser().newBrowserCDPSession(),info=await session.send('SystemInfo.getProcessInfo');await session.detach();
   const pid=info.processInfo.find(v=>v.type==='browser')?.id;assert.ok(pid);assert.ok(evidence.phases.every(v=>v.pid!==pid),'Each phase uses a different browser process');
   const build=await p.evaluate(()=>new Promise((resolve,reject)=>{const ch=new MessageChannel(),timer=setTimeout(()=>reject(Error('No worker build reply')),3000);ch.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));
   const entry={pid,offline,version:c.browser().version(),script:await p.locator('script[src]').getAttribute('src'),build};
   assert.equal(await p.evaluate(()=>!navigator.onLine),offline);if(evidence.phases.length)assert.deepEqual(build,evidence.phases[0].build);
   evidence.phases.push(entry);await work(p,entry);
  }finally{await c.close();}
 }
 let before,afterEdit,afterRestart;
 try{
  await phase(false,async(p,entry)=>{
   await p.getByRole('textbox',{name:'Message',exact:true}).fill('Remember '+original);await p.getByRole('button',{name:'Send',exact:true}).click();
   assert.equal(await p.getByRole('textbox',{name:'New file content'}).inputValue(),original);await p.getByRole('button',{name:'Save',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).waitFor();
   await input(p);await p.locator('input[type=file][multiple][accept*=".txt"]').setInputFiles(inputs.map(v=>join(outputDir,v.name)));
   await p.getByRole('button',{name:/Text process-import.md.*Text available/}).waitFor();await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByText('Text imported',{exact:true}).waitFor();
   before=await backup(p,'before.brainpack');entry.savedNote=true;entry.importedOriginals=2;
  });
  await phase(true,async(p,entry)=>{
   entry.search=await search(p,marker,original);assert.ok(entry.search.includes('18リットル'));
   await p.getByRole('button',{name:'View source',exact:true}).last().click();entry.source=await p.getByRole('dialog').innerText();assert.ok(entry.source.includes('v1 · Original'));
   await p.getByRole('button',{name:'Open file',exact:true}).click();await p.getByRole('button',{name:'Edit',exact:true}).click();await p.getByRole('textbox',{name:'Markdown content'}).fill(edited);await p.getByRole('button',{name:'Save',exact:true}).click();
   await p.getByRole('button',{name:'History',exact:true}).click();for(const version of ['v1','v2'])await p.getByRole('dialog').getByText(version,{exact:true}).click();entry.history=await p.getByRole('dialog').innerText();assert.ok(entry.history.includes('18リットル')&&entry.history.includes('24リットル'));await p.screenshot({path:join(outputDir,'history.png')});
   await p.getByRole('button',{name:'Close',exact:true}).click();await go(p,'Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();await p.getByRole('button',{name:'Rebuild index',exact:true}).click();await input(p);
   entry.attachmentSearch=await search(p,'充電器','充電器は青い箱にあります。');assert.ok(entry.attachmentSearch.includes('青い箱'));afterEdit=await backup(p,'after-edit.brainpack');
  });
  await phase(true,async(p,entry)=>{
   entry.search=await search(p,marker,edited);assert.ok(entry.search.includes('24リットル'));entry.attachmentSearch=await search(p,'FIR-5263',inputs[0].body);afterRestart=await backup(p,'after-restart.brainpack');
   const restore=p.locator('input[type=file][accept=".brainpack,application/json"]');await restore.setInputFiles(join(outputDir,'before.brainpack'));await p.getByRole('dialog').waitFor();assert.ok((await p.getByRole('dialog').innerText()).includes('conflicts'));assert.ok(await p.getByRole('button',{name:'Restore',exact:true}).isDisabled());await p.getByRole('button',{name:'Cancel',exact:true}).click();entry.conflictRefused=true;
   await restore.setInputFiles(join(outputDir,'after-restart.brainpack'));await p.getByRole('dialog').waitFor();await p.getByRole('button',{name:'Restore',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});const final=await backup(p,'after-restore.brainpack',true);
   for(const key of ['notes','settings','runs'])assert.deepEqual(final[key],afterRestart[key],key+' changed during identical restore');entry.identicalRestore=true;
  });
  function retainedSettings(previous,next){
   for(const entry of previous.settings){const value=next.settings.find(v=>v.key===entry.key)?.value;assert.notEqual(value,undefined,entry.key+' lost');
    if(entry.key==='ui-v1-dialogue'){assert.equal(value.schema,entry.value.schema);assert.ok(value.revision>=entry.value.revision);assert.deepEqual(value.turns.slice(0,entry.value.turns.length),entry.value.turns,'Prior original dialogue changed');assert.deepEqual(value.compaction,entry.value.compaction);}
    else assert.deepEqual(value,entry.value,entry.key+' changed');
   }
  }
  retainedSettings(before,afterEdit);retainedSettings(afterEdit,afterRestart);
  const originalNote=before.notes.find(n=>n.revisions.at(-1).body===original);assert.ok(originalNote);const current=afterEdit.notes.find(n=>n.id===originalNote.id);assert.deepEqual({...current,revisions:[]},{...originalNote,revisions:[]});assert.equal(current.revisions.length,2);assert.deepEqual(current.revisions[0],originalNote.revisions[0]);assert.equal(current.revisions[1].body,edited);
  for(const n of before.notes)if(n.id!==originalNote.id)assert.deepEqual(afterEdit.notes.find(v=>v.id===n.id),n);
  assert.deepEqual(afterEdit.notes,afterRestart.notes);assert.deepEqual(before.runs,afterEdit.runs);assert.deepEqual(afterEdit.runs,afterRestart.runs);
  for(const file of inputs){const raw=before.runs.find(v=>v.value.name===file.name)?.value;assert.ok(raw);const bytes=Buffer.from(raw.data,'base64');assert.equal(bytes.toString('utf8'),file.body);assert.equal(createHash('sha256').update(bytes).digest('hex'),raw.sha256);assert.equal(before.notes.find(n=>n.id===raw.id).revisions[0].body,file.body);}
  evidence.pass=true;await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));return evidence;
 }catch(e){evidence.pass=false;evidence.error=String(e);await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));throw e;}
}

// Reuses the repository-pinned Playwright dependency; never downloads a browser.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [profileDir,outputDir]=process.argv.slice(2);
 if(!profileDir||!outputDir)throw Error('Usage: node scripts/qa/offline-process.mjs <new absolute profile directory> <new absolute output directory>');
 const {chromium}=await import('../../design/prototype/node_modules/playwright-core/index.mjs');
 console.log(JSON.stringify(await runOfflineProcessCheck(chromium,{profileDir,outputDir}),null,2));
}
