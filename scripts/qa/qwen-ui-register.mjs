import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [profile,output]=process.argv.slice(2);assert.ok(profile&&output);await mkdir(output,{recursive:false});
const evidence={scope:'PC Chrome native model registration, explicit app update; no phone acceptance',pass:false};
const c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}});
try{
 const p=c.pages()[0];c.setDefaultTimeout(20000);await p.goto('http://127.0.0.1:4180/');
 async function settings(){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name:'Settings',exact:true}).click();}
 await settings();await p.getByRole('button',{name:'Connection',exact:true}).click();
 if(!await p.getByRole('switch').isChecked())await p.getByRole('switch').click();
 await p.waitForFunction(()=>document.querySelector('input[role=switch]')?.checked===true);
 if(!process.argv.includes('--no-update')){await p.getByRole('button',{name:'Check for updates',exact:true}).click();
 await p.getByRole('button',{name:'Apply update',exact:true}).waitFor({timeout:60000});await p.getByRole('button',{name:'Apply update',exact:true}).click();}
 await settings();await p.getByRole('button',{name:'Connection',exact:true}).click();
 if(await p.getByRole('switch').isChecked())await p.getByRole('switch').click();
 await p.waitForFunction(()=>document.querySelector('input[role=switch]')?.checked===false);
 await p.reload();await settings();await p.getByRole('button',{name:'Models',exact:true}).click();
 await p.getByRole('button',{name:'Add text model',exact:true}).click();
 evidence.options=await p.getByRole('dialog').innerText();
 await p.getByRole('dialog').getByRole('button',{name:/Qwen2.5/}).click();
 await p.waitForFunction(()=>document.querySelector('button[aria-label="Text model"]')?.textContent?.includes('Qwen'));
 evidence.selection=await p.getByRole('button',{name:'Text model',exact:true}).innerText();
 assert.match(evidence.selection,/Qwen/);
 await p.getByRole('button',{name:'Load',exact:true}).click();await p.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:180000});
 await p.screenshot({path:join(output,'models.png')});await p.getByRole('button',{name:'Unload',exact:true}).click();
 evidence.pass=true;
}catch(e){evidence.error=String(e);throw e;}finally{await c.close();await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(evidence);}
