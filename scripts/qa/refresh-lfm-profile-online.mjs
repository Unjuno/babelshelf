// Refresh an isolated QA PWA without clearing its origin storage. App and
// browser networking must both be Online while the replacement shell installs.
import assert from 'node:assert/strict';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';

const [profileDir,outputDir,url='http://127.0.0.1:4184/']=process.argv.slice(2);
assert.ok(isAbsolute(profileDir)&&isAbsolute(outputDir),'Provide absolute isolated QA profile and fresh output paths');
assert.equal(new URL(url).hostname,'127.0.0.1');await stat(profileDir);
try{await stat(outputDir);assert.fail('Refusing to overwrite evidence');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(outputDir,{recursive:true});
const product=JSON.parse(await readFile('design/prototype/dist/app/build.json','utf8')),expected=product.build,expectedScript=product.files.find(file=>file.path.startsWith('./assets/index-')&&file.path.endsWith('.js')).path.slice(1);
const evidence={scope:'Isolated Windows PC Chrome QA profile; app setting and Chromium both Online for verified update; data checked before/after; no storage clearing',expectedBuild:expected,steps:[],pass:false};
let context,page;
async function backup(label){
 await go('Settings');await page.getByRole('button',{name:'Local files',exact:true}).click();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();
 const path=join(outputDir,label+'.brainpack');await(await download).saveAs(path);return parseStateBackup(await readFile(path,'utf8'));
}
async function go(destination){const input=page.getByRole('button',{name:'Input',exact:true});await input.click();if(destination==='Input'){await input.click();return;}await page.getByRole('menuitem',{name:destination,exact:true}).click();}
async function appBuild(){return page.evaluate(()=>new Promise((resolve,reject)=>{const ch=new MessageChannel(),timer=setTimeout(()=>reject(Error('No build response')),5000);ch.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data.build);};navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));}
async function setConnection(mode){
 await go('Settings');await page.getByRole('button',{name:'Connection',exact:true}).click();
 const control=page.getByRole('button',{name:mode,exact:true});if(await control.getAttribute('aria-pressed')!=='true')await control.click();
 await page.waitForFunction(mode=>[...document.querySelectorAll('button')].some(button=>button.textContent.trim()===mode&&button.getAttribute('aria-pressed')==='true'),mode);
 await page.waitForFunction(()=>!document.body.innerText.includes('Saving…'));
}
try{
 context=await chromium.launchPersistentContext(profileDir,{channel:'chrome',headless:true,offline:false,viewport:{width:390,height:844},acceptDownloads:true});
 context.setDefaultTimeout(30000);page=context.pages()[0]??await context.newPage();
 context.on('serviceworker',worker=>worker.on('console',message=>evidence.workerConsole??=message.text()));
 await page.goto(url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 evidence.browserVersion=context.browser().version();evidence.beforeBuild=await appBuild();
 const before=await backup('before');const note=before.notes.find(n=>n.id==='629d3e6c-6123-494d-9585-cedf365d455b');
 assert.ok(note,'This is not the isolated profile containing the unique LFM QA note; refusing any mutation');
 evidence.beforeNote={id:note.id,path:note.revisions.at(-1).path,version:note.revisions.length};
 const connection=before.notes.find(n=>n.id==='settings-connection');evidence.beforeConnectionVersion=connection?.revisions.length;
 await setConnection('Online');
 const online=await page.getByRole('button',{name:'Online',exact:true}).getAttribute('aria-pressed');assert.equal(online,'true');
 evidence.appOnline=true;evidence.browserOnline=await page.evaluate(()=>navigator.onLine);assert.equal(evidence.browserOnline,true);
 if(evidence.beforeBuild!==expected){
  await go('Input');
  const refresh=page.getByRole('button',{name:'Update app',exact:true});await refresh.waitFor();await refresh.click();
  await page.waitForFunction(expected=>new Promise(resolve=>{const worker=navigator.serviceWorker.controller;if(!worker)return resolve(false);const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(false);},1000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data.build===expected);};worker.postMessage('build',[channel.port2]);}),expected,{timeout:180000,polling:1000});
  evidence.updateStatus=await page.locator('[role="status"]').allInnerTexts().catch(()=>[]);
  await page.waitForFunction(expected=>[...document.scripts].some(script=>new URL(script.src,location.href).pathname===expected),expectedScript,{timeout:30000});
 }else evidence.updateStatus='Already current before explicit refresh';
 evidence.afterBuild=await appBuild();
 const after=await backup('after');const noteAfter=after.notes.find(n=>n.id==='629d3e6c-6123-494d-9585-cedf365d455b');
 assert.deepEqual(noteAfter,note,'The update must retain original QA note and revision');
 assert.equal(evidence.afterBuild,expected,'The refreshed controller must serve current product build');
 await setConnection('Offline');const offline=await page.getByRole('button',{name:'Offline',exact:true}).getAttribute('aria-pressed');assert.equal(offline,'true');
 evidence.appOffline=true;await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);evidence.offlineRestartBuild=await appBuild();assert.equal(evidence.offlineRestartBuild,expected);
 evidence.pass=true;
}catch(error){evidence.error=String(error);if(page&&!page.isClosed())evidence.screen=await page.locator('body').innerText().catch(()=>null);process.exitCode=1;}
finally{await context?.close();await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
