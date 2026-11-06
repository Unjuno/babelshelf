import assert from 'node:assert/strict';
import {mkdir,readFile,stat,writeFile} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';
import {validateGroundingRefs} from '../../dist/core.js';

const [profileDir,outputDir,modelFile,url='http://127.0.0.1:4182/']=process.argv.slice(2);
for(const path of [profileDir,outputDir,modelFile])assert.ok(path&&isAbsolute(path),'Supply absolute QA paths and a local GGUF');
assert.equal(new URL(url).hostname,'127.0.0.1','This check must use the local product server');
for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(exists,false,'Refusing to reuse a QA profile or overwrite evidence: '+path);}
const modelStat=await stat(modelFile);assert.ok(modelStat.size>1_000_000_000,'Expected the pinned LFM3 Q4_0 GGUF');
await mkdir(outputDir,{recursive:true});
const build=JSON.parse(await readFile('design/prototype/dist/app/build.json','utf8')).build;
 const mark='LFM3-COLD-'+build.toUpperCase(),original='The emergency water reserve is exactly 24 litres. Identifier: '+mark+'.';
const evidence={scope:'Isolated PC Chrome product PWA, local LFM3 QAD Q4_0 imported from a local GGUF, actual offline browser restart and grounded chat. Not phone, Airplane Mode, quality benchmark, or sustained thermal evidence.',build,modelFile:{bytes:modelStat.size},phases:[],externalRequests:[],pass:false};
let context,page;
async function persist(){await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));}
function observe(ctx,phase){ctx.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))phase.external.push(request.url());});}
async function activeBuild(p){return p.evaluate(()=>new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('No active service worker build reply')),5000);channel.port1.onmessage=event=>{clearTimeout(timer);resolve(event.data);};navigator.serviceWorker.controller.postMessage('build',[channel.port2]);}));}
async function launch(label,offline){
 context=await chromium.launchPersistentContext(profileDir,{channel:'chrome',headless:true,offline,viewport:{width:390,height:844},acceptDownloads:true});context.setDefaultTimeout(30_000);page=context.pages()[0];
 const phase={label,offline,external:[],browserVersion:context.browser().version()};observe(context,phase);page.on('pageerror',error=>{(phase.pageErrors??=[]).push(error.message);});page.on('console',message=>{if(message.type()==='error')(phase.consoleErrors??=[]).push(message.text().slice(0,2000));});page.on('requestfailed',request=>{(phase.failedRequests??=[]).push({url:request.url(),error:request.failure()?.errorText??''});});
 await page.goto(url,{timeout:30_000});const connection=page.getByRole('button',{name:/^(Online|Offline) · Tap to switch/});await connection.waitFor({timeout:30_000});
 if(!offline&&await connection.getAttribute('aria-pressed')!=='true')await connection.click();
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60_000});phase.build=await activeBuild(page);assert.equal(phase.build.build,build,'PWA shell build changed during test');
 phase.display=await page.evaluate(()=>({standalone:matchMedia('(display-mode: standalone)').matches,onlineSignal:navigator.onLine,crossOriginIsolated}));
 if(offline)assert.deepEqual(phase.external,[],'Offline PWA launch made external requests');
 evidence.phases.push(phase);await persist();return phase;
}
async function go(name){await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
async function input(){const home=page.getByRole('button',{name:'Input',exact:true});await home.click();await home.click();}
async function backup(name){await go('Settings');await page.getByRole('button',{name:'Local files',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(outputDir,name+'.brainpack');await(await download).saveAs(path);return parseStateBackup(await readFile(path,'utf8'));}
async function send(question,timeout=300_000){const before=await page.locator('.sent-message').count();await page.getByRole('textbox',{name:'Message',exact:true}).fill(question);await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(({before})=>document.querySelectorAll('.sent-message').length>before,{before},{timeout:20_000});const index=await page.locator('.sent-message').count()-1,turn=page.locator('.sent-message').last();await page.waitForFunction(({index})=>{const row=document.querySelectorAll('.sent-message')[index],reply=row?.querySelector('.reply-text')?.textContent?.trim(),status=row?.querySelector('.turn-status')?.textContent?.trim(),stop=[...document.querySelectorAll('.preview-toast button')].some(button=>/^(?:Stop|Stopping…)$/.test(button.textContent.trim()));return !stop&&(!!reply||!!status&&status!=='Generating');},{index},{timeout});if(!await turn.locator('.reply-text').count())throw Error('No generated answer · '+await turn.locator('.turn-status').innerText().catch(()=> 'no status'));return {turn,text:await turn.locator('.reply-text').evaluate(node=>{const copy=node.cloneNode(true);copy.querySelectorAll('button').forEach(button=>button.remove());return copy.textContent.trim();})};}
try{
 const online=await launch('online-model-import-and-note-create',false);
 const connection=page.getByRole('button',{name:/^(Online|Offline) · Tap to switch/});if((await connection.getAttribute('aria-pressed'))!=='true')await connection.click();
 await go('Settings');await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.locator('details.settings-more').filter({hasText:'More text options'}).locator('summary').click();
 const [picker]=await Promise.all([page.waitForEvent('filechooser',{timeout:30_000}),page.getByRole('button',{name:'Add new text model from GGUF',exact:true}).click()]);await picker.setFiles(modelFile);
 const review=page.getByRole('dialog',{name:'Add model',exact:true});await review.waitFor({timeout:30_000});
 await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog] button')].some(button=>button.textContent.trim()==='Add'&&!button.disabled),null,{timeout:180_000});
 evidence.modelReview=await review.innerText();assert.match(evidence.modelReview,/LFM3/i);assert.match(evidence.modelReview,/Execution not tested/i);await page.screenshot({path:join(outputDir,'model-review.png')});
 await page.getByRole('button',{name:'Add',exact:true}).click();await review.waitFor({state:'hidden',timeout:180_000});evidence.registeredModel=await page.getByRole('button',{name:'Text model',exact:true}).innerText();assert.match(evidence.registeredModel,/LFM3/i);
 // A locally imported GGUF still needs the pinned product runtime. Follow the
 // product's explicit setup review before loading; import alone is not readiness.
 const setup=page.getByRole('button',{name:'Set up',exact:true});if(await setup.count()){
  await setup.click();const preparation=page.getByRole('dialog',{name:'Initial preparation',exact:true});
  await preparation.getByRole('button',{name:'Prepare',exact:true}).waitFor({timeout:60_000});
  evidence.preparationReview=await preparation.innerText();await preparation.getByRole('button',{name:'Prepare',exact:true}).click();
  await preparation.waitFor({state:'hidden',timeout:300_000});
 }
 const load=page.getByRole('button',{name:'Load',exact:true});await load.waitFor({timeout:30_000});await load.click();await page.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:300_000});evidence.loadedStatus=await page.locator('.model-preparation').first().innerText();evidence.phases.at(-1).modelLoaded=true;await persist();
 await input();const captureBefore=await page.locator('.sent-message').count();await page.getByRole('textbox',{name:'Message',exact:true}).fill('Remember: '+original);await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(({before})=>{const turns=document.querySelectorAll('.sent-message');return turns.length>before&&turns[turns.length-1]?.querySelector('.turn-status')?.textContent?.trim().startsWith('Saved · Inbox/');},{before:captureBefore},{timeout:60_000});
 let state=await backup('before-offline');const note=state.notes.find(item=>item.revisions.at(-1)?.body===original);assert.ok(note,'Direct capture did not persist its exact original');assert.equal(note.revisions.at(-1).body,original);evidence.savedOriginal={id:note.id,path:note.revisions.at(-1).path,revision:1,body:original};
 // The connection switch is only present on Input, not the Memory/backup view.
 await input();
 const offlineButton=page.locator('button[aria-label^="Online"]').first();await offlineButton.waitFor({timeout:30_000});await offlineButton.click();await page.locator('button[aria-label^="Offline"]').waitFor({timeout:10_000});evidence.phases.at(-1).offlineModeSelected=true;await persist();await context.close();context=null;page=null;

 const cold=await launch('cold-offline-restart-and-model-generation',true);assert.notEqual(cold.browserVersion,undefined);await input();
 const query='In my saved note '+mark+', exactly how many litres is the emergency water reserve?';const answer=await send(query);cold.answer=answer.text;assert.match(answer.text,/24|twenty[- ]four/i,'Generated answer did not recover the stored fact');
 // Inspect the actual answer's source while the chat is visible, then export
 // a backup for exact revision/range validation without losing the view.
 const source=answer.turn.getByRole('button',{name:/^View source(?: \d+)?$/});await source.first().click();const sourceText=await page.locator('body').innerText();assert.ok(sourceText.includes(note.revisions.at(-1).path)&&sourceText.includes(note.revisions.at(-1).body),'Source preview did not open the cited range');await page.screenshot({path:join(outputDir,'offline-source.png')});await page.getByRole('button',{name:'Close',exact:true}).click();
 state=await backup('after-grounded-answer');const dialogue=state.settings.find(item=>item.key==='ui-v1-dialogue')?.value,record=dialogue.turns.at(-1);cold.refs=record.refs;assert.ok(record.refs?.some(ref=>ref.noteId===note.id&&ref.revision===1&&ref.quote&&note.revisions.at(-1).body.slice(ref.start,ref.end)===ref.quote),'Answer omitted the exact source citation');assert.equal(validateGroundingRefs(state.notes,record.refs).ok,true);
 await input();const answerTurn=page.locator('.sent-message').last(),save=answerTurn.getByRole('button',{name:'Save note',exact:true});await save.click();const reviewAnswer=page.getByRole('dialog',{name:'New file',exact:true});assert.equal(await reviewAnswer.getByRole('textbox',{name:'New file content',exact:true}).inputValue(),answer.text,'Save review regenerated or altered the answer');await reviewAnswer.getByRole('textbox',{name:'File name',exact:true}).fill('Answer '+mark);await reviewAnswer.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).waitFor();state=await backup('after-answer-save');const saved=state.notes.find(item=>item.revisions.at(-1)?.title==='Answer '+mark);assert.ok(saved);assert.equal(saved.revisions.at(-1).body,answer.text);const savedTurn=state.settings.find(item=>item.key==='ui-v1-dialogue').value.turns.find(turn=>turn.id===record.id);assert.deepEqual(savedTurn.activity?.filter(activity=>activity.tool==='knowledge.answer')??[],record.activity?.filter(activity=>activity.tool==='knowledge.answer')??[],'Saving answer must not regenerate it');
 cold.savedAnswer={id:saved.id,path:saved.revisions.at(-1).path,exactText:true};
 // Exercise the multi-step model-planner route with the same real offline model.
 // Do not accept a search excerpt as the final answer: receipts must show the
 // search, exact-file read, grounded answer and source reference in one turn.
 await input();const compound=await send('Search local Memory for my saved emergency water reserve note, read the exact file, then tell me its exact amount and identifier.');
 assert.match(compound.text,/24|twenty[- ]four/i,'Multi-step answer did not recover the exact saved fact');
 state=await backup('after-multistep-grounded-answer');const compoundDialogue=state.settings.find(item=>item.key==='ui-v1-dialogue')?.value,compoundRecord=compoundDialogue.turns.at(-1);
 const compoundTools=(compoundRecord.activity??[]).filter(item=>item.status==='succeeded').map(item=>item.tool);
 assert.ok(compoundTools.includes('memory.search'),'Multi-step turn did not execute a successful Memory search');
 assert.ok(compoundTools.includes('memory.read'),'Multi-step turn did not read the exact search result');
 assert.ok(compoundTools.includes('knowledge.answer'),'Multi-step turn did not generate a grounded answer');
 const compoundModelLoads=(compoundRecord.activity??[]).filter(item=>item.tool==='model.load'&&item.status==='succeeded');
 assert.equal(compoundModelLoads.length,0,'Resident model was reloaded for the next same-page request');
 assert.ok(compoundRecord.refs?.some(ref=>ref.noteId===note.id&&ref.revision===1&&ref.quote&&note.revisions.at(-1).body.slice(ref.start,ref.end)===ref.quote),'Multi-step answer did not retain the exact source citation');
 cold.compoundAnswer={text:compound.text,tools:compoundTools,refs:compoundRecord.refs,modelReloads:compoundModelLoads.length};
 // Capture the real runtime's WebGPU layer observation and warm performance
 // through the same one-button Developer path users can copy from a phone.
 await go('Settings');if(!(await page.getByRole('button',{name:'Developer',exact:true}).isVisible()))await page.locator('.settings-more > summary').click();await page.getByRole('button',{name:'Developer',exact:true}).click();
 await page.getByText('Test options · Quick',{exact:true}).click();await page.getByRole('button',{name:'Performance',exact:true}).click();await page.getByRole('button',{name:'Run tests',exact:true}).click();await page.waitForFunction(()=>{const button=[...document.querySelectorAll('button')].find(node=>node.textContent?.trim()==='Copy report for Codex');return !!button&&!button.disabled;},null,{timeout:300_000});
 const reportDisclosure=page.locator('.device-test-report summary');if(await reportDisclosure.count())await reportDisclosure.click();cold.developerReport=JSON.parse(await page.locator('.diagnostic-report').textContent()??'{}');cold.performance=cold.developerReport.modelGeneration;assert.equal(cold.performance?.status,'pass','Prepared resident LFM3 did not complete the one-button performance run');await page.screenshot({path:join(outputDir,'offline-performance-report.png')});
 evidence.externalRequests=evidence.phases.flatMap(phase=>phase.external??[]);assert.deepEqual(evidence.externalRequests,[]);assert.ok(evidence.phases.every(phase=>(phase.pageErrors??[]).length===0));evidence.pass=true;await page.screenshot({path:join(outputDir,'offline-multistep-grounded-answer.png')});
}catch(error){evidence.error=String(error);evidence.stack=error?.stack?.slice(0,6000);if(page&&!page.isClosed()){evidence.failureScreen=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:join(outputDir,'failure.png')}).catch(()=>{});try{evidence.failureBackup=await backup('failure-state');const dialogue=evidence.failureBackup.settings.find(item=>item.key==='ui-v1-dialogue')?.value;evidence.failedTurn=dialogue?.turns?.at(-1);}catch(backupError){evidence.backupError=String(backupError);}}process.exitCode=1;}
finally{evidence.externalRequests=evidence.phases.flatMap(phase=>phase.external??[]);await context?.close();await persist();console.log(JSON.stringify({pass:evidence.pass,error:evidence.error,build:evidence.build,model:evidence.registeredModel,phases:evidence.phases.map(phase=>({label:phase.label,offline:phase.offline,modelLoaded:phase.modelLoaded,external:phase.external,pageErrors:phase.pageErrors})),answer:evidence.phases.at(-1)?.answer,refs:evidence.phases.at(-1)?.refs,externalRequests:evidence.externalRequests,outputDir},null,2));}
