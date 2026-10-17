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
  const claims=await Promise.allSettled([a.claimRun(task.id,'owner-a',{manual:true},now),b.claimRun(task.id,'owner-b',{manual:true},now)]),won=claims.findIndex(r=>r.status==='fulfilled');assert(claims.filter(r=>r.status==='fulfilled').length===1,'Expected one successful claim: '+claims.map(r=>r.status==='rejected'?r.reason.message:'claimed').join(', '));assert(claims[1-won].reason.message==='Occurrence already running','Wrong duplicate refusal');const run=claims[won].value.run,owner=won===0?'owner-a':'owner-b';
  const beforeEdit=await a.views(),old=beforeEdit.find(n=>n.id===source.id);await b.commit(beforeEdit,beforeEdit.map(n=>n.id===old.id?{...n,body:'Corrected transaction source MAPLE-102.',version:2,history:[n.body]}:n));
  const before=await a.snapshot(),refs=[{noteId:parent.id,revision:1,start:0,end:latest(parent).body.length,quote:latest(parent).body}];assert(validateRefs(before.notes,refs,{currentOnly:true}).ok,'Immediate reference changed unexpectedly');
  let rejected='';try{await a.finishRun(run.id,owner,{status:'succeeded',answer:'CONTROLLED CONTRACT PAYLOAD — NOT INFERENCE',sources:refs},now);}catch(e){rejected=e.message;}assert(/Source changed/.test(rejected),'Stale source chain accepted');const refused=await a.snapshot();assert(same(refused,before),'Rejected completion wrote task/run/notice');
  await a.finishRun(run.id,owner,{status:'failed',error:'Source changed · controlled transaction fixture'},now);const failed=await a.snapshot(),failedRun=failed.notes.find(n=>n.id===run.id);assert(taskRunView(failedRun).status==='failed','Failure not retained');assert(same(failed.notes.find(n=>n.id===task.id).taskCursor,task.taskCursor),'Failure consumed occurrence');assert(failed.notes.filter(n=>n.ui?.recordType==='notification').length===1,'Wrong failure notice count');
  let noReplay='';try{await b.claimRun(task.id,'retry-owner',{manual:true},now);}catch(e){noReplay=e.message;}assert(/processed/.test(noReplay),'Implicit retry accepted');
  const retried=await b.claimRun(task.id,'retry-owner',{manual:true,retry:true},now);assert(taskRunView(retried.run).attempt===2,'Retry changed occurrence/attempt incorrectly');await b.finishRun(run.id,'retry-owner',{status:'stopped',error:'Controlled fixture stopped; no inference'},now);const final=await a.snapshot();assert(final.notes.filter(n=>n.ui?.recordType==='execution').length===1,'Retry created a duplicate run');assert(final.notes.find(n=>n.id===run.id).revisions.length===4,'Run history lost');assert(same(final.notes.find(n=>n.id===task.id),task),'Task mutated');
  return {database:name,oneClaim:true,staleSuccessRefused:true,atomicNoWrite:true,failureRetained:true,explicitRetryOnly:true,oneOccurrence:true,before,refused,final};
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log({pass:evidence.pass,error:evidence.error});}
