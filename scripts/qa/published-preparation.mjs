import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import assert from 'node:assert/strict';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';
const out=process.argv[2];assert.ok(isAbsolute(out));await mkdir(out,{recursive:false});
const url='https://babelshelf.com/',evidence={scope:'Public HTTPS first-time standard-set download and cold browser-offline verification in fresh PC Chrome; no inference or phone/OS-isolation claim',phases:[],steps:[]};
let c,p;
const safeUrl=value=>{try{const u=new URL(value);return u.origin+u.pathname;}catch{return 'Invalid URL';}};
async function checkpoint(step){evidence.steps.push(step);await writeFile(join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(step);}
async function go(name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function models(){await go('Settings');await p.getByRole('button',{name:'Models',exact:true}).click();}
async function backup(name){await go('Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();const event=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(out,name+'.brainpack');await(await event).saveAs(path);return parseStateBackup(await readFile(path,'utf8'));}
async function launch(offline){
 c=await chromium.launchPersistentContext(join(out,'profile'),{channel:'chrome',headless:true,offline,viewport:{width:390,height:844},acceptDownloads:true});c.setDefaultTimeout(30000);p=c.pages()[0];
 const phase={offline,external:[],failures:[]};evidence.phases.push(phase);
 c.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url))phase.external.push(safeUrl(r.url()));});
 c.on('requestfailed',r=>phase.failures.push({url:safeUrl(r.url()),error:r.failure()?.errorText}));
 await p.goto(url);await p.getByRole('textbox',{name:'Message',exact:true}).waitFor();await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:120000});
 phase.build=await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));assert.equal(phase.build.build,'984769124c99c80b');
 const session=await c.browser().newBrowserCDPSession();phase.pid=(await session.send('SystemInfo.getProcessInfo')).processInfo.find(p=>p.type==='browser').id;
}
try {
 await launch(false);const before=await backup('before');await models();await p.getByRole('button',{name:'Initial preparation',exact:true}).click();const dialog=p.getByRole('dialog');const prepare=dialog.getByRole('button',{name:'Prepare',exact:true});await prepare.waitFor();assert.equal(await prepare.isDisabled(),true);evidence.review=await dialog.innerText();await p.screenshot({path:join(out,'review.png')});await checkpoint('unprepared-review-downloads-off');
 await dialog.getByRole('switch',{name:'Allow model downloads',exact:true}).click();await prepare.click();await checkpoint('explicit-standard-set-download-started');
 // Poll the actual operation, never repeat or replay preparation automatically.
 const deadline=Date.now()+12*60*1000;let last='';
 while(await dialog.count()){
  const status=await dialog.locator('[role=status]').allTextContents();const text=status.join(' | ');
  if(text!==last){last=text;await checkpoint(text||'Preparing');}
  const stop=dialog.getByRole('button',{name:'Stop',exact:true});
  if(!await stop.count()&&text&&!/Checking local files/.test(text))throw Error('Preparation stopped: '+text);
  if(Date.now()>deadline){if(await stop.count())await stop.click();throw Error('Preparation exceeded 12-minute observation bound; Stop requested');}
  await p.waitForTimeout(1000);
 }
 await checkpoint('standard-set-prepared');await go('Settings');await p.getByRole('button',{name:'Connection',exact:true}).click();const toggle=p.getByRole('switch');if(await toggle.isChecked())await toggle.click();await p.waitForFunction(()=>document.querySelector('input[role=switch]')?.checked===false);
 const prepared=await backup('prepared');for(const n of before.notes.filter(n=>!['settings-models','settings-connection'].includes(n.id)))assert.deepEqual(prepared.notes.find(v=>v.id===n.id),n);
 await c.close();c=null;await launch(true);assert.notEqual(evidence.phases[0].pid,evidence.phases[1].pid);await models();await p.getByRole('button',{name:'Initial preparation',exact:true}).click();const ready=p.getByRole('dialog');await ready.getByRole('button',{name:'Use models',exact:true}).waitFor();evidence.offlineReview=await ready.innerText();assert.equal(await ready.getByRole('switch',{name:'Allow model downloads',exact:true}).isChecked(),false);await ready.getByRole('button',{name:'Use models',exact:true}).click();await ready.waitFor({state:'hidden',timeout:240000});
 const final=await backup('cold-verified');for(const n of prepared.notes)assert.deepEqual(final.notes.find(v=>v.id===n.id),n);assert.equal(evidence.phases[1].external.length,0);evidence.pass=true;await checkpoint('cold-offline-standard-set-verified');
}catch(e){evidence.pass=false;evidence.error=String(e);if(p&&!p.isClosed()){evidence.screen=await p.locator('body').innerText().catch(()=>null);await p.screenshot({path:join(out,'failure.png')}).catch(()=>{});}process.exitCode=1;}
finally {await c?.close();await writeFile(join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log({pass:evidence.pass,error:evidence.error});}
