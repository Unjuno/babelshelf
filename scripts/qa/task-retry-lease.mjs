import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=process.argv[2],root=process.cwd();await mkdir(out,{recursive:false});
const evidence={scope:'Real Chrome IndexedDB same-owner explicit retry after expired heartbeat, controlled times and failed completion; not inference, ordinary UI or real timer evidence.',sources:{}};
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
  const {KnowledgeStore}=await import('/design/prototype/src/knowledge-store.ts'),{taskRunView}=await import('/design/prototype/src/task-records.ts'),{localDate}=await import('/design/prototype/src/schedule-time.ts');
  const assert=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),name='qa-retry-lease-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name);
  await a.initialize([]);const now=new Date(),id=crypto.randomUUID(),owner='same-page';
  await a.putTask({repeat:'once',time:'12:00',days:[],date:localDate(new Date(+now+86400000)),monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:true,prompt:'Controlled retry fixture; no inference.'},undefined,undefined,id);
  const claim=await a.claimRun(id,owner,{manual:true},now);await a.heartbeat(claim.run.id,owner);
  const interruptedAt=new Date(+now+180000),interrupted=await a.claimRun(id,owner,{manual:true},interruptedAt);
  assert(!interrupted.execute&&taskRunView(interrupted.run).status==='interrupted','Expired execution did not require explicit retry');
  const retryAt=new Date(+interruptedAt+1000),retry=await a.claimRun(id,owner,{manual:true,retry:true},retryAt);
  assert(retry.execute&&taskRunView(retry.run).attempt===2,'Retry attempt missing');assert(retry.run.id===claim.run.id,'Retry duplicated occurrence');
  const before=await a.snapshot();let rejected='';try{await b.claimRun(id,'other-page',{manual:true,retry:true},retryAt);}catch(e){rejected=e.message;}
  assert(/already running/.test(rejected),'Competing page did not respect fresh retry lease');assert(same(await a.snapshot(),before),'Competing claim changed records');
  const finished=await a.finishRun(retry.run.id,owner,{status:'failed',error:'Controlled completion after explicit retry'},retryAt);
  assert(finished.recordType==='execution','No committed execution');const after=await a.snapshot(),runs=after.notes.filter(n=>n.ui?.recordType==='execution');
  assert(runs.length===1&&runs[0].id===claim.run.id,'Duplicate execution');assert(taskRunView(runs[0]).status==='failed'&&taskRunView(runs[0]).attempt===2,'Retried completion lost');
  assert(runs[0].runLease===undefined,'Terminal lease retained');assert(same(runs[0].revisions.slice(0,claim.run.revisions.length),claim.run.revisions),'Original attempt overwritten');
  const task=after.notes.find(n=>n.id===id),prior=before.notes.find(n=>n.id===id);assert(same(task,prior),'Failed retry consumed task occurrence');
  (await a.open()).close();(await b.open()).close();return {sameExecutionId:true,attempt:2,competingClaimRejected:rejected,failedCompletionCommitted:true,priorHistoryRetained:true,failedOccurrenceStillPending:true};
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
