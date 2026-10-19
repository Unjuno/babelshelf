import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';

const profile=await mkdtemp(join(tmpdir(),'babelshelf-custom-model-'));
const output=process.argv[2]??join(process.cwd(),'../../outputs/unit234-custom-model-affordance');
await mkdir(output,{recursive:true});
const context=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,viewport:{width:390,height:844}});
try{
 const page=context.pages()[0];
 await page.goto(process.argv[3]??'http://127.0.0.1:4182/');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});
 await page.getByRole('button',{name:'Input',exact:true}).click();
 await page.getByRole('menuitem',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Models',exact:true}).click();
 const add=page.getByRole('button',{name:'Add custom text model',exact:true});
 await add.waitFor({state:'visible'});
 assert.equal((await add.innerText()).trim(),'Add custom text model');
 await page.screenshot({path:join(output,'models.png'),fullPage:true});
 const chooser=page.waitForEvent('filechooser');
 await add.click();
 const fileChooser=await chooser;
 assert.match((await fileChooser.element().getAttribute('accept'))??'',/\.gguf/);
 await fileChooser.setFiles([]);
 console.log(`Custom model affordance: Settings > Models > Text model exposes a direct custom text model picker; no file imported. Screenshot: ${join(output,'models.png')} PASS`);
}finally{
 await context.close();
 await rm(profile,{recursive:true,force:true});
}
