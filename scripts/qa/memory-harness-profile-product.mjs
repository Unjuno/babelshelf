import assert from 'node:assert/strict';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

const url=process.argv[2]??'http://127.0.0.1:43047/';
const profile={id:'profile-evidence-small',label:'Evidence small',enabledTools:['memory.search'],maxToolCalls:1,maxResultChars:1000};
const evidence={scope:'Isolated Windows PC Chromium context against the locally built product PWA; add harness profile in Memory, review activation, reload; no model inference or external service',url,steps:[],externalRequests:[],pageErrors:[]};
let browser,context,page;
async function openAssistant(){
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 const assistant=page.getByRole('button',{name:'Assistant',exact:true});
 if(!(await assistant.isVisible()))await page.locator('.settings-more > summary').click();
 await assistant.click();
}
async function readHarness(){return page.evaluate(()=>new Promise((resolve,reject)=>{
 const request=indexedDB.open('mlb-memory-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{
  const database=request.result;
  if(!database.objectStoreNames.contains('notes')){database.close();reject(new Error('Canonical notes store unavailable'));return;}
  const tx=database.transaction('notes','readonly'),read=tx.objectStore('notes').get('settings-harness');
  read.onsuccess=()=>resolve(read.result);read.onerror=()=>reject(read.error);tx.oncomplete=()=>database.close();tx.onabort=()=>{database.close();reject(tx.error);};
 };
}));}
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 context=await browser.newContext({viewport:{width:390,height:844}});context.setDefaultTimeout(20000);
 page=await context.newPage();page.on('pageerror',error=>evidence.pageErrors.push(String(error)));
 page.on('request',request=>{if(new URL(request.url()).origin!==new URL(url).origin)evidence.externalRequests.push(request.url());});
 await page.goto(url);await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 await openAssistant();
 await page.getByRole('button',{name:'Edit harness file',exact:true}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Markdown content'}),body=await editor.inputValue(),match=body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);
 assert.ok(match,'Harness editor must contain the canonical JSON block');
 const settings=JSON.parse(match[1]);settings.profiles.push(profile);
 await editor.fill(`# Harness\n\n\`\`\`json\n${JSON.stringify(settings,null,2)}\n\`\`\`\n`);
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await openAssistant();
 const profileButton=page.getByRole('button',{name:'Harness profile',exact:true});
 await profileButton.click();await page.getByRole('button',{name:profile.label,exact:true}).click();
 await page.getByRole('heading',{name:'Review changes',exact:true}).waitFor();
 await page.getByRole('button',{name:'Save',exact:true}).click();
 await assert.doesNotReject(page.getByRole('button',{name:'Harness profile',exact:true}).getByText(profile.label,{exact:true}).waitFor());
 await page.reload();await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 await openAssistant();
 await assert.doesNotReject(page.getByRole('button',{name:'Harness profile',exact:true}).getByText(profile.label,{exact:true}).waitFor());
 const record=await readHarness(),latest=record?.revisions?.at(-1),saved=JSON.parse(latest?.body?.match(/```json\n([\s\S]+)\n```/)?.[1]??'null');
 assert.equal(record.id,'settings-harness');assert.equal(record.revisions.length,3);
 assert.ok(saved.profiles.some(item=>JSON.stringify(item)===JSON.stringify(profile)));
 assert.equal(saved.activeProfileId,profile.id);
 assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.externalRequests,[]);
 evidence.steps.push('Added a bounded profile by editing Settings/harness.md in Memory');
 evidence.steps.push('Activated it only after the app presented the review, then reloaded and confirmed the selected profile persists');
 evidence.revisionCount=record.revisions.length;evidence.pass=true;
}catch(error){evidence.pass=false;evidence.error=String(error);}
finally{await context?.close();await browser?.close();console.log(JSON.stringify(evidence,null,2));}
if(!evidence.pass)process.exitCode=1;
