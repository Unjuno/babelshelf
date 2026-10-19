import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm,writeFile,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {tmpdir} from 'node:os';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

const [profileDir,outputDir,modelFile,url='http://127.0.0.1:4182/',question='What is 2 + 2? Reply briefly.']=process.argv.slice(2);
for(const path of [profileDir,outputDir,modelFile])assert.ok(path&&isAbsolute(path));
for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(exists,false,'Use new QA paths');}
await mkdir(outputDir,{recursive:true});
const evidence={scope:'Native PC Chrome product UI; user-selected local LFM2 GGUF through app-owned CPU runtime',question,phases:[],pass:false};
const context=await chromium.launchPersistentContext(profileDir,{channel:'chrome',headless:true,viewport:{width:390,height:844},acceptDownloads:true});let page;
try{
 context.setDefaultTimeout(30000);page=context.pages()[0];page.on('pageerror',e=>evidence.pageError=e.message);page.on('console',m=>{if(m.type()==='error')(evidence.consoleErrors??=[]).push(m.text());});
 await page.goto(url);await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:45000});
 const build=await page.evaluate(()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[channel.port2]);}));evidence.build=build;
 await context.setOffline(true);evidence.offlineAfterShell=true;
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Models',exact:true}).click();
 const picker=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Add custom text model',exact:true}).click();const chooser=await picker;await chooser.setFiles(modelFile);
 const review=page.getByRole('dialog',{name:'Add model',exact:true});await review.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent.trim()==='Add'&&!b.disabled),null,{timeout:180000});
 evidence.review=await review.innerText();await page.screenshot({path:join(outputDir,'review.png')});assert.match(evidence.review,/LFM2/);assert.match(evidence.review,/Execution not tested/);
 await page.getByRole('button',{name:'Add',exact:true}).click();try{await review.waitFor({state:'hidden',timeout:120000});}catch(error){evidence.afterAddDialog=await review.innerText().catch(()=>null);await page.screenshot({path:join(outputDir,'add-stalled.png')});throw error;}
 evidence.registered=await page.getByRole('button',{name:'Text model',exact:true}).innerText();await page.getByRole('button',{name:'Load',exact:true}).waitFor();await page.screenshot({path:join(outputDir,'registered.png')});evidence.phases.push('local import and canonical registration');
 await page.getByRole('button',{name:'Load',exact:true}).click();
 await page.getByText('Loaded',{exact:false}).first().waitFor({timeout:240000});evidence.loadedStatus=await page.locator('.model-preparation').first().innerText();await page.screenshot({path:join(outputDir,'loaded.png')});evidence.phases.push('normal UI model load');
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.waitForFunction(()=>{const send=document.querySelector('button[aria-label="Send"]');return !send||!send.disabled;},null,{timeout:180000});evidence.sendBody=await page.locator('.sent-message').last().innerText();evidence.completedReply=!!await page.locator('.sent-message:last-child .reply-text').count();await page.screenshot({path:join(outputDir,'generated.png')});evidence.phases.push(evidence.completedReply?'real model generation through the chat harness':'normal Send completed with a recorded model/harness error');if(!evidence.completedReply)throw Error('Normal Send completed without an answer');evidence.generatedReply=evidence.sendBody;evidence.pass=true;
}catch(error){evidence.error=String(error);try{evidence.body=await page.locator('body').innerText();evidence.turns=await page.locator('[class*=turn]').allInnerTexts();evidence.chatProgress=await page.locator('[role=status]').allInnerTexts();await page.screenshot({path:join(outputDir,'failure.png')});}catch{}throw error;}finally{await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));await context.close();console.log(JSON.stringify(evidence,null,2));}
