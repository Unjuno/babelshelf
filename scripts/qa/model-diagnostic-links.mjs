import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

const out=process.argv[2],url=process.argv[3]??'http://127.0.0.1:4184/';
if(!out)throw Error('Usage: node scripts/qa/model-diagnostic-links.mjs OUTPUT_DIR [URL]');
await mkdir(out,{recursive:false});
const evidence={scope:'Isolated PC Chrome, unprepared local text model; no model inference',steps:[],errors:[]};
let context,page;
try{
 context=await chromium.launchPersistentContext(join(out,'profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844}});context.setDefaultTimeout(15000);page=context.pages()[0];page.on('pageerror',e=>evidence.errors.push(String(e)));
 evidence.build=(await (await fetch(new URL('build.json',url))).json()).build;
 await page.goto(url);await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('Check local model setup');await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByRole('button',{name:'Open Text model settings',exact:true}).waitFor();
 await page.getByRole('button',{name:'Open Text model settings',exact:true}).click();
 const section=page.locator('[data-model-role="text"]');await section.waitFor();
 await page.waitForFunction(()=>{const el=document.querySelector('[data-model-role="text"]');return !!el&&Math.abs(el.getBoundingClientRect().top-250)<12&&document.activeElement===el;});
 const selection=await page.locator('button[aria-label="Text model"]').innerText();
 assert.equal(selection.trim(),'Bonsai 2 · 4B','diagnostic navigation must preserve the default selected model');
 await page.screenshot({path:join(out,'text-model-target.png')});
 evidence.steps.push('A real Send without prepared text weights reports the named cause and a Text model settings action');
 evidence.steps.push('The action focuses and scrolls the Text section into view while preserving Bonsai 2 · 4B');
 assert.deepEqual(evidence.errors,[]);evidence.pass=true;
}catch(error){evidence.pass=false;evidence.error=String(error);if(page){evidence.page=(await page.locator('body').innerText()).slice(0,4000);await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});}}
finally{await writeFile(join(out,'evidence.json'),JSON.stringify(evidence,null,2));await context?.close();}
console.log(JSON.stringify(evidence,null,2));if(!evidence.pass)process.exitCode=1;
