import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';

const [profileDir,outputDir,modelFile,url='http://127.0.0.1:4182/']=process.argv.slice(2);
for(const path of [profileDir,outputDir,modelFile])assert.ok(path&&isAbsolute(path),'Supply absolute fresh profile/output paths and a local model file');
assert.equal(new URL(url).hostname,'127.0.0.1','This QA must use the local product server');
for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(exists,false,'Refusing to reuse QA data: '+path);}
await mkdir(outputDir,{recursive:true});
const manifest=JSON.parse(await readFile('dist/lfm-model-manifest.json','utf8'));
const model=manifest.models.find(entry=>entry.id==='lfm25-230m-qad-q4-0');assert.ok(model,'Pinned LFM2.5-230M model absent');
const hash=createHash('sha256');let bytes=0;for await(const chunk of createReadStream(modelFile)){hash.update(chunk);bytes+=chunk.length;}
assert.equal(bytes,model.file.bytes,'Selected model size does not match manifest');assert.equal(hash.digest('hex'),model.file.sha256,'Selected model does not match manifest SHA-256');
const evidence={scope:'Native PC Chrome CDP-installed standalone PWA; local compatible LFM2 GGUF, local Wllama runtime; Playwright browser network isolation only',url,expectedBuild:JSON.parse(await readFile('design/prototype/dist/app/build.json','utf8')).build,model:{id:model.id,bytes,sha256:model.file.sha256},phases:[],pass:false};
const external=[];let context,page,processIds=[];
function observe(c){c.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());});}
async function build(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('No service-worker build reply')),3000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data);};navigator.serviceWorker.controller.postMessage('build',[channel.port2]);}));}
async function launch(offline){
 context=await chromium.launchPersistentContext(profileDir,{channel:'chrome',headless:true,offline,viewport:{width:390,height:844},acceptDownloads:true});context.setDefaultTimeout(30000);observe(context);
 const session=await context.browser().newBrowserCDPSession();const phase={offline,version:context.browser().version()};evidence.phases.push(phase);
 if(!offline){page=context.pages()[0]??await context.newPage();await page.goto(url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});await session.send('PWA.install',{manifestId:url,installUrlOrBundleUrl:url});await session.send('PWA.changeAppUserSettings',{manifestId:url,displayMode:'standalone'});}
 const [appPage,launch]=await Promise.all([context.waitForEvent('page',{timeout:30000}),session.send('PWA.launch',{manifestId:url})]);page=appPage;phase.launch=launch;await session.detach();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
 phase.build=await build(page);assert.equal(phase.build.build,evidence.expectedBuild,'Wrong cached product build');
 phase.display=await page.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,browser:matchMedia('(display-mode: browser)').matches}));assert.equal(phase.display.standalone,true);assert.equal(phase.display.browser,false);
 const pidSession=await context.browser().newBrowserCDPSession();const processInfo=await pidSession.send('SystemInfo.getProcessInfo');phase.browserPid=processInfo.processInfo.find(info=>info.type==='browser')?.id;await pidSession.detach();assert.ok(phase.browserPid);assert.ok(!processIds.includes(phase.browserPid),'Expected a separate cold browser process');processIds.push(phase.browserPid);
 if(offline)assert.deepEqual(external,[],'External requests during offline standalone launch');
 return phase;
}
async function settingsModels(){await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Models',exact:true}).click();}
async function input(){await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();}
async function send(question){const prior=await page.locator('.sent-message').count();await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(count=>{const button=document.querySelector('button[aria-label="Send"]');return document.querySelectorAll('.sent-message').length>count&&(!button||!button.disabled);},prior,{timeout:240000});const turn=page.locator('.sent-message').last();await turn.locator('.reply-text').waitFor({timeout:10000});const text=await turn.locator('.reply-text').evaluate(node=>{const answer=node.cloneNode(true);answer.querySelectorAll('button').forEach(button=>button.remove());return answer.textContent.trim();});return {turn,text};}
async function backup(name){await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Local files',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();const file=join(outputDir,name+'.brainpack');await(await download).saveAs(file);return parseStateBackup(await readFile(file,'utf8'));}
try{
 const first=await launch(false);first.installed=true;
 await context.setOffline(true);first.networkBlockedAfterShell=true;
 await settingsModels();const chooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add custom text model',exact:true}).click();await(await chooserEvent).setFiles(modelFile);
 const review=page.getByRole('dialog',{name:'Add model',exact:true});await review.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] button')].some(button=>button.textContent.trim()==='Add'&&!button.disabled),null,{timeout:180000});
 const reviewText=await review.innerText();assert.match(reviewText,/LFM2/);assert.match(reviewText,/Execution not tested/);await page.screenshot({path:join(outputDir,'review.png')});await page.getByRole('button',{name:'Add',exact:true}).click();await review.waitFor({state:'hidden',timeout:120000});
 await settingsModels();assert.match(await page.getByRole('button',{name:'Text model',exact:true}).innerText(),/LFM2/);await page.getByRole('button',{name:'Load',exact:true}).click();await page.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:240000});first.registeredAndLoaded=true;await context.close();context=null;
 first.closed=true;

 const second=await launch(true);await settingsModels();assert.match(await page.getByRole('button',{name:'Text model',exact:true}).innerText(),/LFM2/);await page.getByRole('button',{name:'Load',exact:true}).waitFor();await page.getByRole('button',{name:'Load',exact:true}).click();await page.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:240000});second.reloadedFromLocalFiles=true;
 await input();const {turn,text}=await send('What is 2 + 2? Reply briefly.');second.reply=text;assert.match(text,/4/);await page.screenshot({path:join(outputDir,'generated.png')});
 await turn.getByRole('button',{name:'Save note',exact:true}).click();const saveDialog=page.getByRole('dialog');await saveDialog.getByRole('textbox',{name:'New file content',exact:true}).waitFor();const savedBody=await saveDialog.getByRole('textbox',{name:'New file content',exact:true}).inputValue();assert.equal(savedBody,text,'Save review must preserve the generated answer without regeneration');await saveDialog.getByRole('textbox',{name:'File name',exact:true}).fill('QA-LFM2-cold-offline-answer');await saveDialog.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).waitFor();second.exactGeneratedAnswerSaved=true;
 const after=await backup('after-save');const saved=after.notes.find(note=>note.revisions.at(-1)?.path.endsWith('/QA-LFM2-cold-offline-answer.md'));assert.ok(saved);assert.equal(saved.revisions.at(-1).body,text);await context.close();context=null;

 const third=await launch(true);await input();await page.getByRole('textbox',{name:'Message',exact:true}).fill('Search QA-LFM2-cold-offline-answer');await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.sent-message:last-child .turn-status')?.textContent==='Found · 1',null,{timeout:60000});third.savedAnswerFoundAfterRestart=(await page.locator('.sent-message').last().innerText()).includes(text);assert.ok(third.savedAnswerFoundAfterRestart);third.externalRequests=[...external];assert.deepEqual(external,[]);await page.screenshot({path:join(outputDir,'cold-search.png')});await context.close();context=null;
 evidence.pass=true;
}catch(error){evidence.error=String(error);if(page&&!page.isClosed())await page.screenshot({path:join(outputDir,'failure.png')}).catch(()=>{});process.exitCode=1;}finally{await context?.close();evidence.externalRequests=external;await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
