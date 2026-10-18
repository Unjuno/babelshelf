import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';
const [installationDir,out,expectedBuild]=process.argv.slice(2);assert.match(expectedBuild,/^[a-f0-9]{16}$/);await mkdir(out,{recursive:false});
const prior=JSON.parse(await readFile(join(installationDir,'evidence.json'),'utf8'));assert.equal(prior.pass,true);const installation={profileDir:join(installationDir,'profile'),url:'https://babelshelf.com/'};
const evidence={scope:'Public explicit update with retained data, then cold browser-offline app restart; no inference/device claim',external:[]};
let c=await chromium.launchPersistentContext(installation.profileDir,{channel:'chrome',headless:true,offline:false,viewport:{width:390,height:844},acceptDownloads:true});c.setDefaultTimeout(30000);let p=c.pages()[0];
c.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(installation.url))evidence.external.push(new URL(r.url()).origin);});
async function go(name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function backup(name){await go('Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();const download=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=join(out,name+'.brainpack');await(await download).saveAs(path);return parseStateBackup(await readFile(path,'utf8'));}
try{
 await p.goto(installation.url);await p.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 const before=await backup('before');await go('Settings');await p.getByRole('button',{name:'Connection',exact:true}).click();if(!await p.getByRole('switch').isChecked())await p.getByRole('switch').click();await p.getByRole('button',{name:'Check for updates',exact:true}).click();await p.getByRole('button',{name:'Apply update',exact:true}).waitFor({timeout:120000});await p.getByRole('button',{name:'Apply update',exact:true}).click();await go('Settings');await p.getByRole('button',{name:'Connection',exact:true}).click();if(await p.getByRole('switch').isChecked())await p.getByRole('switch').click();await c.close();c=await chromium.launchPersistentContext(installation.profileDir,{channel:'chrome',headless:true,offline:true,viewport:{width:390,height:844},acceptDownloads:true});c.setDefaultTimeout(30000);p=c.pages()[0];c.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(installation.url))evidence.external.push(new URL(r.url()).origin);});await p.goto(installation.url);await p.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 evidence.build=await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));assert.equal(evidence.build.build,expectedBuild);
 await p.screenshot({path:join(out,'cold-restart.png')});
 const after=await backup('after');for(const n of before.notes.filter(n=>n.id!=='settings-connection'))assert.deepEqual(after.notes.find(v=>v.id===n.id),n);assert.deepEqual(after.settings,before.settings);for(const r of before.runs)assert.deepEqual(after.runs.find(v=>v.key===r.key),r);assert.equal(evidence.external.length,0);evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}
finally{await c.close();await writeFile(join(out,'evidence.json'),JSON.stringify(evidence,null,2));console.log(evidence);}
