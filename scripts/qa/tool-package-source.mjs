import assert from 'node:assert/strict';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const out='../../outputs/unit76-tool-source';await mkdir(out,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'babelshelf-tools-'));
const code=await readFile('design/prototype/src/tools/memory.search/tool.ts','utf8');
const evidence={scope:'PC Chrome; isolated retained profile; source projection/export and offline new process; no inference or phone claim',profile};
let c;
async function read(p){await p.getByRole('textbox',{name:'Message',exact:true}).fill('Read Tools/memory.search/tool.ts');await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).waitFor();assert.equal(await p.locator('.file-body').innerText(),code);assert.equal(await p.getByRole('button',{name:'Edit',exact:true}).isDisabled(),true);}
async function input(p){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('button',{name:'Input',exact:true}).click();}
try{
 c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,acceptDownloads:true});let p=c.pages()[0];p.setDefaultTimeout(20000);await p.goto('http://127.0.0.1:4180/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller);await read(p);await p.screenshot({path:out+'/source.png'});
 await p.getByRole('button',{name:'History',exact:true}).click();await p.getByRole('dialog').getByText('v1',{exact:true}).click();const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Export file',exact:true}).click();const file=await dl;await file.saveAs(out+'/tool.v1.ts');assert.equal(await readFile(out+'/tool.v1.ts','utf8'),code);evidence.rawExport=true;
 await p.getByRole('button',{name:'Close',exact:true}).click();await input(p);
 await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name:'Settings',exact:true}).click();await p.getByRole('button',{name:'Local files',exact:true}).click();
 const backup=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();await(await backup).saveAs(out+'/source.brainpack');
 const payload=JSON.parse(await readFile(out+'/source.brainpack','utf8')).payload;const projected=payload.notes.find(n=>n.id==='builtin-package-memory.search/tool.ts');assert.equal(projected.revisions.at(-1).body,code);assert.equal(projected.ui.protected,true);evidence.backupSource=true;
 await input(p);await c.close();c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,offline:true});p=c.pages()[0];p.setDefaultTimeout(20000);const external=[];c.on('request',r=>{if(!/^(http:\/\/127\.0\.0\.1:4180\/|blob:|data:)/.test(r.url()))external.push(r.url());});await p.goto('http://127.0.0.1:4180/');await read(p);assert.deepEqual(external,[]);evidence.external=external;evidence.offlineReopen=true;evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await c?.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}

