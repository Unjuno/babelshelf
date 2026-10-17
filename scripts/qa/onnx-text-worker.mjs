import assert from 'node:assert/strict';
import {readFile,readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,join,isAbsolute,basename} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [profile,output,source]=process.argv.slice(2);for(const p of [profile,output,source])assert.ok(p&&isAbsolute(p));
for(const p of [profile,output]){try{await stat(p);throw Error('Use a new QA path');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});const manifest=JSON.parse(await readFile('design/prototype/src/onnx-text-manifest.json','utf8'));
const paths=await readdir('design/prototype/dist/app/assets'),workerPath='/assets/'+paths.find(p=>/^onnx-text-worker-.*\.js$/.test(p));assert.ok(!workerPath.endsWith('undefined'));
const evidence={scope:'PC Chrome dedicated real ONNX text worker. Not product UI or physical-device acceptance.',workerPath,phases:[]};
async function phase(offline,run){const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,offline,viewport:{width:390,height:844}});
 try{const page=context.pages()[0];page.on('console',m=>console.log(m.text()));await page.goto('http://127.0.0.1:4180/');await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
 const info={offline,chrome:context.browser().version(),build:await page.evaluate(()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[channel.port2]);}))};evidence.phases.push(info);
 await page.evaluate(workerPath=>{const w=new Worker(workerPath,{type:'module'}),pending=new Map();let seq=0;window.qaWorker=w;window.qaEvents=[];window.qaCall=(cmd,args={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});w.postMessage({id,cmd,args});});w.onmessage=({data:m})=>{window.qaEvents.push(m);if(m.type==='progress')console.log(m.value);const p=pending.get(m.id);if(!p)return;if(m.type==='done'||m.type==='error'){pending.delete(m.id);m.type==='done'?p.resolve(m.value):p.reject(Error(m.value));}};w.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear();};},workerPath);
 await run(page,info,context);info.events=await page.evaluate(()=>window.qaEvents);await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));
 }finally{await context.close();}}
try{
 await phase(false,async(page,info,context)=>{
  await page.evaluate(()=>{const input=document.createElement('input');input.type='file';input.multiple=true;input.id='qa-files';document.body.append(input);});await page.locator('#qa-files').setInputFiles(manifest.files.map(f=>join(source,basename(f.path))));
  await context.setOffline(true);info.prepare=await page.evaluate(id=>window.qaCall('prepare',{model:id,allowNetwork:false,localFiles:[...document.querySelector('#qa-files').files]}),manifest.id);
  info.status=await page.evaluate(()=>window.qaCall('status'));assert.equal(info.status[manifest.id].filesPresent,true);
 });
 await phase(true,async(page,info)=>{
  info.status=await page.evaluate(()=>window.qaCall('status'));assert.equal(info.status[manifest.id].filesPresent,true);
  info.load=await page.evaluate(id=>window.qaCall('load',{model:id}),manifest.id);
  info.count=await page.evaluate(()=>window.qaCall('count',{messages:[{role:'user',content:'Say hello.'}]}));assert.ok(info.count.prompt_tokens>0);
  info.answer=await page.evaluate(()=>window.qaCall('generate',{messages:[{role:'user',content:'Reply with the word hello.'}],maxTokens:24}));assert.ok(info.answer.text.trim());
  info.unload=await page.evaluate(()=>window.qaCall('unload'));assert.equal(info.unload,true);
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);throw e;}
finally{await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({...evidence,phases:evidence.phases.map(({events,...p})=>({...p,eventCount:events?.length}))},null,2));}
