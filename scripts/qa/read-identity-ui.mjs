import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {createNote} from '../../dist/core.js';
import {makeStateBackup,serializeStateBackup,parseStateBackup} from '../../design/prototype/src/backup-state.ts';
import {mkdir,writeFile,readFile} from 'node:fs/promises';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const [folder,url='http://127.0.0.1:4180/',expectedBuild='d66f4f72a37333a8']=process.argv.slice(2),out=resolve(folder);await mkdir(out,{recursive:false});
const fixtures=[{...createNote({path:'Inbox/identity-original.md',body:'ID target: MAPLE-2091'}),id:'archive.md'},{...createNote({path:'Inbox/archive.md',body:'Filename target: FIR-2092'}),id:'filename-target'}];
const archive=join(out,'fixture.brainpack');await writeFile(archive,serializeStateBackup(await makeStateBackup({notes:fixtures,settings:[],runs:[]})));
const evidence={scope:'Normal product backup restore and explicit read input in fresh PC Chrome; no model inference or physical device claim',url,external:[]};
const c=await chromium.launchPersistentContext(join(out,'profile'),{channel:'chrome',headless:true,viewport:{width:390,height:844},acceptDownloads:true});c.setDefaultTimeout(15000);const p=c.pages()[0];c.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(new URL(url).origin))evidence.external.push(r.url());});
async function go(name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function input(){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('button',{name:'Input',exact:true}).click();}
async function read(query,body){await input();await p.getByRole('textbox',{name:'Message',exact:true}).fill('Read: '+query);await p.getByRole('button',{name:'Send',exact:true}).click();await p.getByRole('button',{name:'History',exact:true}).waitFor();assert.equal(await p.locator('.file-body').innerText(),body);}
try{
 await p.goto(url);await p.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 const manifest=await(await c.request.get(new URL('build.json',url).href)).json();assert.equal(manifest.build,expectedBuild);evidence.build=manifest.build;
 await go('Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();await p.locator('input[type=file][accept=".brainpack,application/json"]').setInputFiles(archive);await p.getByRole('button',{name:'Restore',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
 await read('archive.md','ID target: MAPLE-2091');await p.screenshot({path:join(out,'exact-id.png')});
 await read('Inbox/archive.md','Filename target: FIR-2092');
 await go('Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const saved=join(out,'after.brainpack');await(await dl).saveAs(saved);const after=await parseStateBackup(await readFile(saved,'utf8'));for(const fixture of fixtures)assert.deepEqual(after.notes.find(n=>n.id===fixture.id),fixture);
 const turns=after.settings.find(s=>s.key==='ui-v1-dialogue').value.turns;for(const [i,fixture] of fixtures.entries()){const activity=turns[i].activity.find(a=>a.tool==='memory.read');assert.equal(activity.input.packageVersion,2);assert.equal(activity.output.length,1);assert.equal(activity.output[0].id,fixture.id);assert.equal(turns[i].refs[0].noteId,fixture.id);}
 assert.equal(evidence.external.length,0);evidence.pass=true;evidence.originalsUnchanged=true;
}catch(e){evidence.pass=false;evidence.error=String(e);evidence.text=await p.locator('body').innerText().catch(()=>null);await p.screenshot({path:join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}finally{await c.close();await writeFile(join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(evidence);}
