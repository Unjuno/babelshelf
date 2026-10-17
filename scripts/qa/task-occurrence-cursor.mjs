import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=process.argv[2],root=process.cwd();await mkdir(out,{recursive:false});
const evidence={scope:'Real Chrome IndexedDB transactions over actual application source modules in an isolated fixture database. Controlled completion payload is not inference or product UI evidence.',sources:{}};
for(const file of ['design/prototype/src/knowledge-store.ts','design/prototype/src/task-records.ts','dist/core.js'])evidence.sources[file]=createHash('sha256').update(await readFile(file)).digest('hex');
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><title>Isolated task transaction check</title>');return;}
 let file=resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+sep))throw Error('Outside fixture root');
 if(!extname(file))file+='.ts';const extension=extname(file);if(!['.ts','.js','.json'].includes(extension))throw Error('Unsupported fixture resource');
 const source=await readFile(file,'utf8');res.setHeader('cache-control','no-store');res.setHeader('content-type',extension==='.json'?'application/json':'text/javascript');res.end(extension==='.ts'?stripTypeScriptTypes(source):source);
 }catch(e){res.statusCode=404;res.end(String(e));}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
try{browser=await chromium.launch({channel:'chrome',headless:true});const p=await browser.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/');
 evidence.result=await p.evaluate(async()=>{
  const {KnowledgeStore}=await import('/design/prototype/src/knowledge-store.ts'),{taskRunView}=await import('/design/prototype/src/task-records.ts'),{createNote,latest,searchNotes,validateRefs}=await import('/dist/core.js'),{localDate}=await import('/design/prototype/src/schedule-time.ts');
  const assert=(value,message)=>{if(!value)throw Error(message);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),now=new Date(),name='qa-task-transaction-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name);
  const source=createNote({path:'Notes/source101.md',body:'Controlled transaction source CEDAR-101.'}),parent=createNote({path:'Notes/summary101.md',body:'Controlled summary CEDAR-101.',kind:'generated',sources:searchNotes([source],'CEDAR-101')});
  const definition={repeat:'once',time:'09:00',days:[1],date:localDate(new Date(+now+86400000)),monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:true,prompt:'Controlled transaction fixture; no inference.'},taskId=crypto.randomUUID();
  const db=await a.open();await new Promise((resolve,reject)=>{const tx=db.transaction('notes','readwrite');for(const n of [source,parent])tx.objectStore('notes').add(n);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});await a.putTask(definition,undefined,undefined,taskId);const task=(await a.all()).find(n=>n.id===taskId);await b.open();
  const claim=await a.claimRun(task.id,'owner-a',{manual:true},now),run=claim.run,pending=new Date(+new Date(task.taskCursor.nextAt)+86400000).toISOString();
  // Controlled concurrent cursor change in the isolated DB; not a product UI action.
  const second=await b.open();await new Promise((resolve,reject)=>{const tx=second.transaction('notes','readwrite'),store=tx.objectStore('notes'),q=store.get(task.id);q.onsuccess=()=>store.put({...q.result,taskCursor:{...q.result.taskCursor,nextAt:pending}});tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error);});
  const current=(await a.all()).find(n=>n.id===task.id),refs=searchNotes([source],'CEDAR-101');
  await a.finishRun(run.id,'owner-a',{status:'succeeded',answer:'CONTROLLED HISTORICAL COMPLETION — NOT INFERENCE',sources:refs},now);
  const final=await b.snapshot(),kept=final.notes.find(n=>n.id===task.id),completed=final.notes.find(n=>n.id===run.id);
  assert(same(kept,current),'Old completion consumed the replacement pending occurrence');assert(kept.taskCursor.nextAt===pending,'Replacement cursor lost');assert(taskRunView(completed).status==='succeeded','Historical completion lost');assert(taskRunView(completed).dueAt===task.taskCursor.nextAt,'Run rebound to another occurrence');assert(final.notes.filter(n=>n.ui?.recordType==='notification').length===1,'Historical completion notice missing');
  return {database:name,oldCompletionRetained:true,replacementCursorUntouched:true,originalDueAt:task.taskCursor.nextAt,pending,final};
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log({pass:evidence.pass,error:evidence.error});}
