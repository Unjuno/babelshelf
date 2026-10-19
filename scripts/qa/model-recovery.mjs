import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const [url,out]=process.argv.slice(2);await mkdir(out,{recursive:false});
const context=await chromium.launchPersistentContext(out+'/profile',{channel:'chrome',headless:true,viewport:{width:390,height:844}});
const page=context.pages()[0];const evidence={url,scope:'PC Chrome, fresh profile; missing-model recovery through normal Send, no simulated inference',external:[]};
context.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)evidence.external.push(new URL(r.url()).origin);});
try{
 await page.goto(url);await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 const request='Please remember: the QA recovery meeting is Tuesday at 14:00.';
 await page.getByRole('textbox',{name:'Message',exact:true}).fill(request);await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.locator('.turn-status').filter({hasText:'Model not prepared'}).waitFor();
 evidence.before=await page.locator('body').innerText();assert.equal(await page.getByRole('textbox',{name:'Message',exact:true}).inputValue(),request);
 await page.getByRole('button',{name:'Model settings',exact:true}).click({timeout:3000});
 await page.getByRole('heading',{name:'Models',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Prepare text model',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Input',exact:true}).click();await page.getByRole('button',{name:'Input',exact:true}).click();
 assert.equal(await page.getByRole('textbox',{name:'Message',exact:true}).inputValue(),request);
 assert.equal(await page.locator('.sent-message').count(),1);assert.equal(await page.locator('.reply-text').count(),0);
 await page.screenshot({path:out+'/recovered.png'});
 const body='QA224の打ち合わせは火曜日の14時。\n持ち物は見積書。';
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('メモして：'+body);await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByRole('dialog',{name:'New file',exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'New file content',exact:true}).inputValue(),body);
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('button',{name:'History',exact:true}).waitFor();assert.equal(await page.locator('.file-body').innerText(),body);
 await page.reload();await page.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 await page.getByRole('textbox',{name:'Message',exact:true}).fill('検索：QA224');await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.locator('.sent-message').last().getByRole('button',{name:/Inbox\/QA224/}).click();assert.equal(await page.locator('.file-body').innerText(),body);
 await page.getByRole('button',{name:'History',exact:true}).click();await page.getByRole('dialog',{name:'History',exact:true}).waitFor();
 evidence.capture={body,reviewed:true,reloadSearchOpened:true,historyOpened:true};assert.deepEqual(evidence.external,[]);await page.screenshot({path:out+'/history.png'});evidence.pass=true;
}catch(error){evidence.pass=false;evidence.error=String(error);await page.screenshot({path:out+'/failure.png'});process.exitCode=1;}
finally{await context.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
