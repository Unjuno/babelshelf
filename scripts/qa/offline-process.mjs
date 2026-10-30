import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join,isAbsolute,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {createDevServer} from '../serve.mjs';

// Pass a Playwright BrowserType from the caller. No bundled browser/dependency,
// inference stub, database access, process kill or existing profile reuse.
export async function runOfflineProcessCheck(browserType,{profileDir,outputDir,url='http://127.0.0.1:4180/',channel,installedPwa=false,afterBootstrap}){
 const engine=browserType.name();assert.ok(['chromium','webkit'].includes(engine),'Unsupported QA browser');assert.ok(!installedPwa||engine==='chromium','Installed PWA diagnostics require Chromium');if(installedPwa)channel??='chrome';
 assert.ok(isAbsolute(profileDir)&&isAbsolute(outputDir),'Use absolute QA paths');
 assert.equal(new URL(url).hostname,'127.0.0.1','QA uses the local product server');
 const productBuild=JSON.parse(await readFile(resolve('design/prototype/dist/app/build.json'),'utf8'));
 const hashAsset=productBuild.files.find(file=>/^\.\/assets\/sha256\.umd\.min-[A-Za-z0-9_-]+\.js$/.test(file.path));
 assert.ok(hashAsset,'Production offline shell must include the pinned SHA-256 module');
 assert.deepEqual(hashAsset.roles??[],[],'SHA-256 module must be installed as a core app asset');
 for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(exists,false,'QA path must not already exist: '+path);}
 await mkdir(outputDir,{recursive:true});
 const marker='LARCH-5738',original='Process restart '+marker+'\n飲料水は18リットル。',edited=original.replace('18','24');
 const inputs=[{name:'process-import.txt',body:'Local import FIR-5263\n飲料水の保管場所は玄関です。'},{name:'process-import.md',body:'# HAZEL-3197\n\n充電器は青い箱にあります。'}];
 const offlineInputs=[{name:'offline-import.txt',body:'Offline import IRIS-1901\n連絡先メモは青い封筒。'},{name:'offline-import.md',body:'# Offline HARBOR-8602\n\n防災用電池は台所の棚。'}];
 for(const input of [...inputs,...offlineInputs])await writeFile(join(outputDir,input.name),input.body,'utf8');
  const probeServer=createServer((request,response)=>{response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','text/plain; charset=utf-8');response.writeHead(200);response.end('reachable');});
  await new Promise((resolve,reject)=>{probeServer.once('error',reject);probeServer.listen(0,'127.0.0.1',resolve);});
  const probeUrl=`http://127.0.0.1:${probeServer.address().port}/reachability`;
 const evidence={engine,...(channel?{channel}:{}),scope:installedPwa?'PC headless Chromium CDP-installed PWA with required standalone display; not physical OS/mobile acceptance':`PC headless ${engine} persistent profile, Playwright context offline before navigation; not installed/mobile/physical-network acceptance`,profileDir,url,phases:[]};
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
  const c=await browserType.launchPersistentContext(profileDir,{channel,headless:true,offline,viewport:{width:360,height:780},acceptDownloads:true});await c.setOffline(offline);
  const events=[];c.on('close',()=>events.push({event:'context-close'}));c.browser().on('disconnected',()=>events.push({event:'browser-disconnected'}));c.on('page',page=>observe(page));function observe(page){page.on('crash',()=>events.push({event:'page-crash'}));page.on('pageerror',error=>events.push({event:'pageerror',message:String(error)}));}for(const page of c.pages())observe(page);
  try{c.setDefaultTimeout(7000);let p=c.pages()[0]??await c.newPage();const session=engine==='chromium'?await c.browser().newBrowserCDPSession():null;let installation,launch;
   if(!installedPwa||!offline){await p.goto(url,{timeout:15000});if(!offline){await p.getByRole('button',{name:'Offline · Tap to switch Online',exact:true}).click();}await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:180000});if(!offline){await p.getByRole('button',{name:'Online · Tap to switch Offline',exact:true}).click();}}
   if(installedPwa){if(!offline){installation=await session.send('PWA.install',{manifestId:url,installUrlOrBundleUrl:url});await session.send('PWA.changeAppUserSettings',{manifestId:url,displayMode:'standalone'});}const result=await Promise.all([c.waitForEvent('page',{timeout:30000}),session.send('PWA.launch',{manifestId:url})]);p=result[0];launch=result[1];await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:180000});const display=await p.evaluate(()=>({url:location.href,standalone:matchMedia('(display-mode: standalone)').matches,browser:matchMedia('(display-mode: browser)').matches}));(evidence.launchAttempts??=[]).push({offline,installation,launch,display});assert.equal(display.standalone,true,'Expected actual standalone display mode');}
   let pid;if(session){const info=await session.send('SystemInfo.getProcessInfo');await session.detach();pid=info.processInfo.find(v=>v.type==='browser')?.id;assert.ok(pid);assert.ok(evidence.phases.every(v=>v.pid!==pid),'Each phase uses a different browser process');}
   const build=await p.evaluate(()=>new Promise((resolve,reject)=>{const ch=new MessageChannel(),timer=setTimeout(()=>reject(Error('No worker build reply')),3000);ch.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));
    const onlineSignal=await p.evaluate(()=>navigator.onLine),probePage=await c.newPage();let networkProbe;
    try{const response=await probePage.goto(probeUrl,{timeout:5000});networkProbe={reachable:!!response?.ok(),status:response?.status()??0};}catch(error){networkProbe={reachable:false,error:error instanceof Error?error.message:'NetworkError'};}finally{await probePage.close();}
    const sha256Result=await p.evaluate(async path=>{const module=await import(new URL(path,location.href).href),create=module.default?.createSHA256??module.createSHA256;if(typeof create!=='function')throw Error('SHA-256 module export unavailable');const hash=await create();hash.update(new TextEncoder().encode('abc'));return hash.digest('hex');},hashAsset.path);
    assert.equal(sha256Result,'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const entry={...(pid?{pid}:{}),engine,offline,onlineSignal,networkProbe,...(installedPwa?{standalone:true,installation,launch}:{}),version:c.browser().version(),script:await p.locator('script[src]').getAttribute('src'),build,sha256Module:{path:hashAsset.path,bytes:hashAsset.bytes,verifiedDigest:sha256Result}};
    assert.equal(networkProbe.reachable,!offline,`Network probe mismatch: requested offline=${offline}, probe=${JSON.stringify(networkProbe)}`);if(evidence.phases.length)assert.deepEqual(build,evidence.phases[0].build);
   evidence.phases.push(entry);await work(p,entry);
  }catch(error){(evidence.failures??=[]).push({offline,events:[...events],error:String(error)});throw error;}finally{await c.close();}
 }
 let before,afterEdit,afterRestart;
 try{
  await phase(false,async(p,entry)=>{
   // Explicit model-free capture is available without preparing an inference model.
   await p.getByRole('textbox',{name:'Message',exact:true}).fill(original+'メモして');await p.getByRole('button',{name:'Send',exact:true}).click();
   await p.locator('.turn-status').filter({hasText:'Saved · Inbox/Process restart '+marker+'.md'}).waitFor();
   // Exercise the current file-creation sheet separately and keep the double-submit regression.
   await go(p,'BabelShelf');await p.getByRole('button',{name:'New file',exact:true}).click();await p.getByRole('textbox',{name:'File name',exact:true}).fill('Double submit check');await p.getByRole('textbox',{name:'New file content',exact:true}).fill('Duplicate form test only');await p.getByRole('dialog',{name:'New file'}).locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await p.getByRole('button',{name:'History',exact:true}).waitFor();
   await input(p);await p.locator('input[type=file][multiple][accept*=".txt"]').setInputFiles(inputs.map(v=>join(outputDir,v.name)));
   await p.getByRole('button',{name:/Text process-import.md.*Text available/}).waitFor();await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByText('Text imported',{exact:true}).waitFor();
   before=await backup(p,'before.brainpack');assert.equal(before.notes.filter(n=>n.revisions.at(-1).body===original).length,1,'Capture did not create exactly one note');assert.equal(before.notes.filter(n=>n.revisions.at(-1).body==='Duplicate form test only').length,1,'Double submit created duplicate notes');entry.savedNote=true;entry.duplicateSubmitControl=true;entry.importedOriginals=2;
  });
  await afterBootstrap?.();
  await phase(true,async(p,entry)=>{
   entry.search=await search(p,marker,original);assert.ok(entry.search.includes('18リットル'));
   await p.getByRole('button',{name:'View source',exact:true}).last().click();entry.source=await p.getByRole('dialog').innerText();assert.match(entry.source,/\bv1\b/);assert.ok(entry.source.includes(original),'Source must contain the saved original');
   await p.getByRole('button',{name:'Open file',exact:true}).click();await p.getByRole('button',{name:'Edit',exact:true}).click();await p.getByRole('textbox',{name:'Markdown content'}).fill(edited);await p.getByRole('button',{name:'Save',exact:true}).click();
   await p.getByRole('button',{name:'History',exact:true}).click();for(const version of ['v1','v2'])await p.getByRole('dialog').getByText(version,{exact:true}).click();entry.history=await p.getByRole('dialog').innerText();assert.ok(entry.history.includes('18リットル')&&entry.history.includes('24リットル'));await p.screenshot({path:join(outputDir,'history.png')});
   await p.getByRole('button',{name:'Close',exact:true}).click();/* Search scans canonical records; there is currently no separate index to rebuild. */await input(p);
   entry.attachmentSearch=await search(p,'充電器','充電器は青い箱にあります。');assert.ok(entry.attachmentSearch.includes('青い箱'));
   await input(p);await p.locator('input[type=file][multiple][accept*=".txt"]').setInputFiles(offlineInputs.map(v=>join(outputDir,v.name)));
   await p.getByRole('button',{name:/Text offline-import.md.*Text available/}).waitFor();await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByText('Text imported',{exact:true}).waitFor();entry.offlineImportedOriginals=2;
   await input(p);entry.offlineMarkdownSearch=await search(p,'防災用電池','防災用電池は台所の棚。');assert.ok(entry.offlineMarkdownSearch.includes('台所の棚'));
   await go(p,'Settings');await p.getByText('More',{exact:true}).click();await p.getByRole('button',{name:'Developer',exact:true}).click();await p.getByRole('heading',{name:'Device test'}).waitFor();await p.getByRole('button',{name:'Run tests',exact:true}).waitFor();entry.offlineDiagnosticsChunkLoaded=true;
   afterEdit=await backup(p,'after-edit.brainpack');
  });
  await phase(true,async(p,entry)=>{
   entry.search=await search(p,marker,edited);assert.ok(entry.search.includes('24リットル'));entry.attachmentSearch=await search(p,'FIR-5263',inputs[0].body);entry.offlineImportSearch=await search(p,'IRIS-1901',offlineInputs[0].body);afterRestart=await backup(p,'after-restart.brainpack');
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
  assert.deepEqual(afterEdit.notes,afterRestart.notes);for(const run of before.runs)assert.deepEqual(afterEdit.runs.find(v=>v.key===run.key),run,'Prior run changed');assert.deepEqual(afterEdit.runs,afterRestart.runs);
  for(const file of [...inputs,...offlineInputs]){const pack=offlineInputs.includes(file)?afterEdit:before;const raw=pack.runs.find(v=>v.value.name===file.name)?.value;assert.ok(raw);const bytes=Buffer.from(raw.data,'base64');assert.equal(bytes.toString('utf8'),file.body);assert.equal(createHash('sha256').update(bytes).digest('hex'),raw.sha256);assert.equal(pack.notes.find(n=>n.id===raw.id).revisions[0].body,file.body);}
  evidence.pass=true;await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));return evidence;
  }catch(e){evidence.pass=false;evidence.error=String(e);await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));throw e;}finally{await new Promise(resolve=>probeServer.close(()=>resolve(undefined)));}
}

// Reuses the repository-pinned Playwright dependency; never downloads a browser.
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [profileArg,outputArg,engine='chromium',urlArg]=process.argv.slice(2);assert.ok(['chromium','webkit'].includes(engine),'Choose chromium or webkit');
 const runId=`${Date.now()}-${randomUUID()}`,profileDir=profileArg??join(tmpdir(),`babelshelf-offline-${runId}-profile`),outputDir=outputArg??join(tmpdir(),`babelshelf-offline-${runId}-results`);
 let server,url=urlArg;
 if(!url){server=createDevServer(fileURLToPath(new URL('../../design/prototype/dist/app/',import.meta.url)));await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});url=`http://127.0.0.1:${server.address().port}/`;}
 try{const browsers=await import('../../design/prototype/node_modules/playwright-core/index.mjs');console.log(JSON.stringify(await runOfflineProcessCheck(browsers[engine],{profileDir,outputDir,url}),null,2));}
 finally{if(server)await new Promise(resolve=>server.close(()=>resolve(undefined)));}
}
