import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {parseStateBackup} from '../../design/prototype/src/backup-state.ts';
const [profile,url,out,expectedBuild]=process.argv.slice(2);assert.match(expectedBuild,/^[a-f0-9]{16}$/);await mkdir(out,{recursive:false});
const evidence={scope:'PC Chrome, prepared actual Bonsai4B, browser offline; one natural new-note request, review and Cancel, no planner override or generated output substitution',external:[]};
const c=await chromium.launchPersistentContext(profile,{channel:'chrome',headless:true,offline:true,viewport:{width:390,height:844},acceptDownloads:true});const p=c.pages()[0];p.setDefaultTimeout(15000);
c.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==new URL(url).origin)evidence.external.push(new URL(r.url()).origin);});
async function go(name){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('menuitem',{name,exact:true}).click();}
async function input(){await p.getByRole('button',{name:'Input',exact:true}).click();await p.getByRole('button',{name:'Input',exact:true}).click();}
async function backup(name){await go('Settings');await p.getByRole('button',{name:'Local files',exact:true}).click();const dl=p.waitForEvent('download');await p.getByRole('button',{name:'Export backup',exact:true}).click();const path=out+'/'+name+'.brainpack';await(await dl).saveAs(path);return parseStateBackup(await readFile(path,'utf8'));}
try{
 await p.goto(url);await p.getByRole('textbox',{name:'Message',exact:true}).waitFor();
 evidence.build=await p.evaluate(()=>new Promise(resolve=>{const ch=new MessageChannel();ch.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('build',[ch.port2]);}));
 assert.equal(evidence.build.build,expectedBuild);const before=await backup('before');
 await go('Settings');await p.getByRole('button',{name:'Models',exact:true}).click();assert.match(await p.getByRole('button',{name:'Text model',exact:true}).innerText(),/Bonsai 2.*4B/);await p.getByRole('button',{name:'Load',exact:true}).click();await p.getByRole('button',{name:'Unload',exact:true}).waitFor({timeout:240000});
 await input();const request='次の内容を新しいメモとして残してください。QA227の図書返却は金曜日の16時。持ち物は図書カード。';
 await p.getByRole('textbox',{name:'Message',exact:true}).fill(request);await p.getByRole('button',{name:'Send',exact:true}).click();
 await p.waitForFunction(()=>!!document.querySelector('[role="dialog"]')||!document.querySelector('button[aria-label="Send"]')?.disabled,{},{timeout:240000});
 evidence.rendered=await p.locator('body').innerText();const review=p.getByRole('dialog',{name:'New file',exact:true});evidence.review=await review.isVisible();
 if(evidence.review){evidence.proposal=await p.getByRole('textbox',{name:'New file content',exact:true}).inputValue();await p.screenshot({path:out+'/review.png'});await review.getByRole('button',{name:'Cancel',exact:true}).click();}
 const after=await backup('after');evidence.turn=after.settings.find(x=>x.key==='ui-v1-dialogue').value.turns.at(-1);
 assert.deepEqual(after.notes,before.notes);for(const r of before.runs)assert.deepEqual(after.runs.find(v=>v.key===r.key),r);evidence.notesUnchanged=true;
 assert.ok(evidence.review,'Natural request did not open capture review');for(const text of ['QA227','金曜日','16時','図書カード'])assert.ok(evidence.proposal.includes(text),'Proposal omitted '+text);
 assert.ok(evidence.turn.activity.some(a=>a.tool==='dialogue.plan'&&a.status==='succeeded'&&a.output?.action==='capture'&&typeof a.output.body==='string'));
 assert.deepEqual(evidence.external,[]);evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;await p.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{try{await go('Settings');await p.getByRole('button',{name:'Models',exact:true}).click();if(await p.getByRole('button',{name:'Unload',exact:true}).count())await p.getByRole('button',{name:'Unload',exact:true}).click();}catch{}await c.close();await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log({pass:evidence.pass,error:evidence.error,review:evidence.review,build:evidence.build});}
