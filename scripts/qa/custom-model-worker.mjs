import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,join,isAbsolute} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
// Real worker/OPFS/GPU integration, not a product Add-model UI acceptance test.
const [profileDir,outputDir,modelFile,runtimeFile,inspectionFile]=process.argv.slice(2);
for(const path of [profileDir,outputDir,modelFile,runtimeFile,inspectionFile])assert.ok(path&&isAbsolute(path),'Absolute QA paths required');
for(const path of [profileDir,outputDir]){let exists=false;try{await stat(path);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}assert.equal(exists,false,'Use a new QA path');}
await mkdir(outputDir,{recursive:true});
const manifest=JSON.parse(await readFile(new URL('../../dist/model-manifest.json',import.meta.url),'utf8'));
const record=JSON.parse(await readFile(inspectionFile,'utf8'));
const assets=await readdir(new URL('../../design/prototype/dist/app/assets/',import.meta.url));
const workerPath='/assets/'+assets.find(name=>/^bonsai-worker-.*\.js$/.test(name));assert.ok(!workerPath.endsWith('undefined'));
const evidence={scope:'PC Chrome real custom-model worker, explicit QA messages, no custom Add-model UI or fine-tuned numerical acceptance',workerPath,model:record.id,phases:[]};
async function phase(offline,run){const context=await chromium.launchPersistentContext(profileDir,{channel:'chrome',headless:true,offline,viewport:{width:360,height:780},acceptDownloads:true});
 try{context.setDefaultTimeout(15000);const page=context.pages()[0];page.on('console',m=>console.log(m.text()));await page.goto('http://127.0.0.1:4180/');await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
 const build=await page.evaluate(()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[c.port2]);}));
 const info={offline,build,chrome:context.browser().version(),events:[]};evidence.phases.push(info);
 await page.evaluate(({workerPath})=>{const w=new Worker(workerPath,{type:'module'});let seq=0,lastProgress=0;const pending=new Map();window.qaWorker=w;window.qaCall=(cmd,args={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Worker command timed out: '+cmd));},300000);pending.set(id,{resolve,reject,timer});w.postMessage({id,cmd,args});});window.qaEvents=[];w.onmessage=({data:m})=>{window.qaEvents.push(m);if(m.type==='progress'&&Date.now()-lastProgress>15000){lastProgress=Date.now();console.log(m.value);}const p=pending.get(m.id);if(!p)return;if(m.type==='done'||m.type==='error'){pending.delete(m.id);clearTimeout(p.timer);m.type==='done'?p.resolve(m.value):p.reject(Error(m.value));}};w.onerror=event=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(event.message||'Worker failed'));}pending.clear();};},{workerPath});
 await page.evaluate(({manifest,record})=>window.qaCall('init',{manifest}).then(()=>window.qaCall('configure',{models:[record]})),{manifest,record});
 await run(page,info,context);info.events=await page.evaluate(()=>window.qaEvents);await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));
 }finally{await context.close();}}
try{
 await phase(false,async(page,info,context)=>{
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.id='qa-files';document.body.append(input);});await page.locator('#qa-files').setInputFiles([modelFile,runtimeFile]);
  await context.setOffline(true);assert.equal(await page.evaluate(()=>navigator.onLine),false);
  info.prepare=await page.evaluate(({record})=>{const files=[...document.querySelector('#qa-files').files];return window.qaCall('prepare',{model:record.id,allowNetwork:false,modelFile:files.find(f=>f.name.endsWith('.gguf')),localFiles:files});},{record});
  assert.equal(info.prepare.modelHash,record.file.sha256);info.status=await page.evaluate(()=>window.qaCall('status'));assert.equal(info.status[record.id].filesPresent,true);
 });
 await phase(true,async(page,info)=>{
  info.status=await page.evaluate(()=>window.qaCall('status'));assert.equal(info.status[record.id].filesPresent,true);
  info.load=await page.evaluate(record=>window.qaCall('load',{model:record.id}),record);assert.equal(info.load.model,record.id);
  info.answer=await page.evaluate(()=>window.qaCall('generate',{messages:[{role:'user',content:'Reply with the word hello.'}],maxTokens:24}));assert.ok(info.answer.text.trim());assert.equal(info.answer.stopped,false);
  info.stop=await page.evaluate(async()=>{const pending=window.qaCall('generate',{messages:[{role:'user',content:'Write a long detailed story about a forest.'}],maxTokens:128});setTimeout(()=>window.qaWorker.postMessage({cmd:'abort'}),100);try{return await pending;}catch(e){return {error:String(e)};}});assert.ok(info.stop.stopped===true||/Stopped/.test(info.stop.error??''));
  info.unload=await page.evaluate(()=>window.qaCall('unload'));assert.equal(info.unload,true);
 });
 evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);throw e;}
finally{await writeFile(join(outputDir,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,phases:evidence.phases.map(({events,...phase})=>({...phase,eventCount:events.length}))},null,2));}
