import assert from 'node:assert/strict';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

const url=process.argv[2]??'http://127.0.0.1:43046/';
const evidence={scope:'Isolated Windows PC Chromium context against the locally built product PWA; Memory palette edit/select/default/reload; no model inference or external service',url,steps:[],externalRequests:[],pageErrors:[]};
let browser,context,page;
async function openSettingsSection(name){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 if(name){await page.getByRole('button',{name,exact:true}).click();}
}
async function readAppearance(){return page.evaluate(()=>new Promise((resolve,reject)=>{
 const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{
  const database=request.result;
  if(!database.objectStoreNames.contains('notes')){database.close();reject(new Error('Canonical notes store unavailable'));return;}
  const tx=database.transaction('notes','readonly'),read=tx.objectStore('notes').get('settings-appearance');
  read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>database.close();tx.onabort=()=>{database.close();reject(tx.error);};
 };
}));}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 context=await browser.newContext({viewport:{width:390,height:844}});context.setDefaultTimeout(20000);
 page=await context.newPage();page.on('pageerror',error=>evidence.pageErrors.push(String(error)));
 page.on('request',request=>{const requestUrl=new URL(request.url());if(requestUrl.origin!==new URL(url).origin)evidence.externalRequests.push(request.url());});
 await page.goto(url);await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 await openSettingsSection('Appearance');
 await page.getByRole('button',{name:'Edit appearance file',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'}),body=await editor.inputValue(),match=body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);
 assert.ok(match,'Appearance editor must contain the canonical JSON block');
 const settings=JSON.parse(match[1]);
 const palette={id:'palette-night-garden',name:'Night garden',canvas:'#101820',text:'#f2f5f7',surface:'#203040',surfaceText:'#f2f5f7',accent:'#76e3c1',accentText:'#102018',muted:'#d1dae1',border:'#506070'};
 settings.paletteRegistry=[palette];settings.activePaletteId=palette.id;
 await editor.fill(`# Appearance\n\n\`\`\`json\n${JSON.stringify(settings,null,2)}\n\`\`\`\n`);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await openSettingsSection('Appearance');
 await page.getByRole('button',{name:palette.name,exact:true}).waitFor();
 await page.getByRole('button',{name:'Default',exact:true}).click();
 await page.getByRole('button',{name:'Default',exact:true}).waitFor({state:'visible'});
 await page.reload();await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 await openSettingsSection('Appearance');
 await assert.doesNotReject(page.getByRole('button',{name:palette.name,exact:true}).waitFor());
 await page.getByRole('button',{name:'Default',exact:true}).waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Default'&&button.getAttribute('aria-pressed')==='true'));
 const record=await readAppearance(),latest=record?.revisions?.at(-1),saved=JSON.parse(latest?.body?.match(/```json\n([\s\S]+)\n```/)?.[1]??'null');
 assert.equal(record.id,'settings-appearance');assert.equal(record.revisions.length,3);
 assert.deepEqual(saved.paletteRegistry,[palette]);assert.equal(saved.activePaletteId,'');
 assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.externalRequests,[]);
 evidence.steps.push('Edited the canonical Settings/appearance.md Memory record and saved a revision');
 evidence.steps.push('Selected the named palette, returned to Default, reloaded and confirmed the saved choice and palette definition persist');
 evidence.revisionCount=record.revisions.length;evidence.pass=true;
}catch(error){evidence.pass=false;evidence.error=String(error);}
finally{await context?.close();await browser?.close();console.log(JSON.stringify(evidence,null,2));}
if(!evidence.pass)process.exitCode=1;
