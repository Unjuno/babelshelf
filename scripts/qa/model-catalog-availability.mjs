import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {isAbsolute,join} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

const url=process.argv[2]??'http://127.0.0.1:4182/';
const outputDir=process.argv[3];
assert.equal(new URL(url).hostname,'127.0.0.1','Use only the local product server');
assert.ok(outputDir&&isAbsolute(outputDir),'Supply a fresh absolute output directory');await mkdir(outputDir,{recursive:true});
const expected=JSON.parse(await readFile('design/prototype/dist/app/build.json','utf8')).build;
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
context.setDefaultTimeout(15000);
const page=await context.newPage(),external=[];
page.on('request',request=>{if(!request.url().startsWith(url)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external.push(request.url());});
try{
 await page.goto(url);await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('menuitem',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Models',exact:true}).click();
 await page.getByRole('button',{name:'Add decision model',exact:true}).click();
 const decisionAdd=page.getByRole('button',{name:'Add Open d1 · Omni 600M',exact:true}),decisionBlocked=page.getByRole('button',{name:'Unavailable · Open d1 · 3B',exact:true});
 const decisionAddable=await decisionAdd.isEnabled(),decisionUnavailable=await decisionBlocked.innerText();assert.equal(decisionAddable,true);assert.equal(await decisionBlocked.isDisabled(),true);assert.match(decisionUnavailable,/Runtime not connected/);await page.screenshot({path:join(outputDir,'decision.png')});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Add transcription model',exact:true}).click();
 const speechAdd=page.getByRole('button',{name:'Add Whisper tiny',exact:true}),speechBlocked=page.getByRole('button',{name:'Unavailable · Whisper base',exact:true});
 const speechAddable=await speechAdd.isEnabled(),speechUnavailable=await speechBlocked.innerText();assert.equal(speechAddable,true);assert.equal(await speechBlocked.isDisabled(),true);assert.match(speechUnavailable,/Runtime not connected/);await page.screenshot({path:join(outputDir,'speech.png')});
 assert.deepEqual(external,[]);console.log(JSON.stringify({pass:true,build:expected,viewport:{width:390,height:844},decision:{d1_600m_addable:decisionAddable,d1_3b_status:decisionUnavailable},speech:{whisper_tiny_addable:speechAddable,whisper_base_status:speechUnavailable},externalRequests:external},null,2));
}catch(error){await page.screenshot({path:join(outputDir,'failure.png')}).catch(()=>{});console.error(error);process.exitCode=1;}finally{await context.close();await browser.close();}
