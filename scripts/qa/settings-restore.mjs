import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const [sourceProfile,targetProfile,output]=process.argv.slice(2);
for(const path of [sourceProfile,targetProfile,output]){assert.ok(path&&isAbsolute(path));try{await stat(path);throw Error('New path required: '+path);}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(output,{recursive:true});const evidence={scope:'PC Chrome native settings recovery, independent profiles, stale second-tab review and offline process restart. No inference or phone acceptance.',phases:[]};let source,before,raced,after;
async function go(p,name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function panel(p,name){await go(p,'Settings');await p.getByRole('button',{name,exact:true}).click();}
async function backup(p,name){await panel(p,'Local files');const event=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(output,name);await(await event).saveAs(path);return JSON.parse(await readFile(path,'utf8')).payload;}
async function phase(profile,offline,run){const c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,offline,viewport:{width:360,height:780},acceptDownloads:true});try{c.setDefaultTimeout(15000);const p=c.pages()[0];const external=[];c.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4180/')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});await p.goto('http://127.0.0.1:4180/');await p.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:30000});if(!offline)await c.setOffline(true);const info={offline,external,build:await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}))};evidence.phases.push(info);await run(p,info,c);assert.deepEqual(external,[]);}finally{await c.close();await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));}}
const note=(state,id)=>state.notes.find(n=>n.id===id);
const value=(state,group)=>JSON.parse(note(state,'settings-'+group).revisions.at(-1).body.split('```json\n')[1].split('\n```')[0]);
try{
 await phase(sourceProfile,false,async(p,info)=>{
  await panel(p,'Appearance');for(const name of ['Dark','Sage','Frosted'])await p.getByRole('button',{name,exact:true}).click();
  await panel(p,'Models');await p.getByRole('button',{name:'Add text model',exact:true}).click();await p.getByRole('dialog').getByRole('button',{name:/Qwen2.5/}).click();await p.waitForFunction(()=>document.querySelector('button[aria-label="Text model"]')?.textContent?.includes('Qwen'));
  await panel(p,'Connection');await p.getByRole('switch').click();await p.waitForFunction(()=>document.querySelector('input[role=switch]')?.checked===true);
  source=await backup(p,'source.brainpack');assert.equal(value(source,'connection').downloads,true);info.sourcePrepared=false;
 });
 await phase(targetProfile,false,async(p,info,c)=>{
  before=await backup(p,'before.brainpack');
  async function review(){await p.locator('input[type=file][accept=".brainpack,application/json"]').setInputFiles(join(output,'source.brainpack'));await p.getByRole('button',{name:'Review settings',exact:true}).click();await p.getByRole('button',{name:'Apply settings',exact:true}).waitFor();}
  await review();info.review=await p.getByRole('dialog').innerText();assert.match(info.review,/Appearance/);assert.match(info.review,/Models/);assert.match(info.review,/Downloads off/);await p.screenshot({path:join(output,'review.png')});
  const other=await c.newPage();await other.goto('http://127.0.0.1:4180/');await panel(other,'Appearance');await other.getByRole('button',{name:'Sand',exact:true}).click();raced=await backup(other,'raced.brainpack');await other.close();
  await p.getByRole('button',{name:'Apply settings',exact:true}).click();await p.getByText('Local data changed · review backup again',{exact:true}).waitFor();assert.equal(await p.getByRole('dialog').isVisible(),true);info.staleRefused=true;await p.screenshot({path:join(output,'stale.png')});
  await p.getByRole('button',{name:'Back',exact:true}).click();await p.getByRole('button',{name:'Cancel',exact:true}).click();await p.reload();
  const retained=await backup(p,'stale-retained.brainpack');assert.deepEqual(retained.notes,raced.notes);assert.deepEqual(retained.runs,raced.runs);assert.deepEqual(retained.settings,raced.settings);
  await review();await p.getByRole('button',{name:'Apply settings',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});after=await backup(p,'after.brainpack');
  assert.deepEqual(value(after,'appearance'),value(source,'appearance'));assert.deepEqual(value(after,'models'),value(source,'models'));assert.equal(value(after,'connection').downloads,false);
  for(const old of raced.notes){const next=note(after,old.id);assert.ok(next);if(['settings-appearance','settings-models'].includes(old.id)){assert.deepEqual(next.revisions.slice(0,-1),old.revisions);assert.equal(next.revisions.length,old.revisions.length+1);}else assert.deepEqual(next,old);}
  assert.deepEqual(after.settings,raced.settings);for(const old of raced.runs)assert.deepEqual(after.runs.find(r=>r.key===old.key),old);
  const added=after.runs.filter(r=>!raced.runs.some(old=>old.key===r.key));assert.equal(added.length,1);assert.equal(added[0].value.type,'settings-restore');assert.equal(added[0].value.backupHash,JSON.parse(await readFile(join(output,'source.brainpack'),'utf8')).sha256);for(const change of added[0].value.changes)assert.deepEqual(change.source,note(source,change.noteId));
  info.atomicPreservation=true;info.receiptChanges=added[0].value.changes.map(c=>c.group);
 });
 await phase(targetProfile,true,async(p,info)=>{
  await panel(p,'Appearance');for(const name of ['Dark','Sage','Frosted'])assert.equal(await p.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
  await panel(p,'Models');assert.match(await p.getByRole('button',{name:'Text model',exact:true}).innerText(),/Qwen/);assert.equal(await p.getByRole('button',{name:'Unload',exact:true}).count(),0);await p.screenshot({path:join(output,'models.png')});
  await p.getByRole('button',{name:'Open settings file',exact:true}).click();assert.match(await p.locator('.file-body').innerText(),/qwen25-05b-instruct/);await p.screenshot({path:join(output,'memory.png')});
  await p.getByRole('button',{name:'History',exact:true}).click();await p.getByText('Backup history · 2 versions',{exact:true}).click();await p.getByText('Backup v1',{exact:true}).click();const history=await p.getByRole('dialog').innerText();assert.match(history,/"textModel": "4B"/);assert.doesNotMatch(history,/qwen25-05b-instruct/);info.backupOriginalReadable=true;await p.screenshot({path:join(output,'history.png')});await p.getByRole('button',{name:'Close',exact:true}).click();
  const final=await backup(p,'restart.brainpack');assert.deepEqual(final.notes,after.notes);assert.deepEqual(final.runs,after.runs);info.restartRetained=true;
  info.opfsFiles=await p.evaluate(async()=>{const found=[];async function walk(dir,prefix=''){for await(const [name,item]of dir.entries())if(item.kind==='file')found.push(prefix+name);else await walk(item,prefix+name+'/');}await walk(await navigator.storage.getDirectory());return found;});assert.deepEqual(info.opfsFiles,[]);
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);throw e;}finally{await writeFile(join(output,'evidence.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));}
