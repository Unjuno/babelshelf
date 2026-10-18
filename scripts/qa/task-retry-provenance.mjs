import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {chromium} from '../../design/prototype/node_modules/playwright-core/index.mjs';
const out=process.argv[2],root=process.cwd();await mkdir(out,{recursive:false});
const evidence={scope:'Real Chrome IndexedDB retry model provenance and pinned notifications; controlled failed/stopped results, not inference or ordinary UI acceptance.',sources:{}};
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
  const {KnowledgeStore}=await import('/design/prototype/src/knowledge-store.ts'),{taskRunView,validateNoticeLinks}=await import('/design/prototype/src/task-records.ts'),{localDate}=await import('/design/prototype/src/schedule-time.ts');
  const assert=(v,m)=>{if(!v)throw Error(m);},same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),name='qa-retry-lease-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name);
  await a.initialize([]);const now=new Date(),id=crypto.randomUUID(),owner='same-page';
  await a.putTask({repeat:'once',time:'12:00',days:[],date:localDate(new Date(+now+86400000)),monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:true,prompt:'Controlled retry fixture; no inference.'},undefined,undefined,id);
  const claim=await a.claimRun(id,owner,{manual:true},now);
  await a.finishRun(claim.run.id,owner,{status:'failed',error:'Controlled first failure',model:{id:'prior-model',revision:'prior-revision',runtime:'prior-runtime'}},now);
  const before=await a.snapshot(),old=before.notes.find(n=>n.id===claim.run.id),notices=before.notes.filter(n=>n.ui?.recordType==='notification');
  assert(notices.length===1,'First notification missing');assert(taskRunView(old).model.id==='prior-model','Fixture provenance not committed');
  const retry=await b.claimRun(id,'second-page',{manual:true,retry:true},new Date(+now+1000));
  assert(taskRunView(retry.run).model===undefined,'Prior model leaked into retry');
  assert(same(retry.run.revisions.slice(0,-1),old.revisions),'Prior history changed');
  await b.finishRun(retry.run.id,'second-page',{status:'stopped',error:'Stopped'},new Date(+now+2000));
  (await a.open()).close();(await b.open()).close();
  const reopened=new KnowledgeStore(name),after=await reopened.snapshot(),run=after.notes.find(n=>n.id===claim.run.id);
  assert(taskRunView(run).model===undefined&&taskRunView(run).attempt===2,'Reopened attempt has stale model');
  assert(same(run.revisions.slice(0,old.revisions.length),old.revisions),'History changed after reopening');
  for(const notice of notices)assert(same(after.notes.find(n=>n.id===notice.id),notice),'Old notification changed');
  const allNotices=after.notes.filter(n=>n.ui?.recordType==='notification');assert(allNotices.length===2,'New attempt notification missing');for(const notice of allNotices)validateNoticeLinks(after.notes,notice);
  assert(same(after.notes.find(n=>n.id===id),before.notes.find(n=>n.id===id)),'Failed retry consumed occurrence');
  (await reopened.open()).close();return {sameExecutionId:true,attempt:2,reopenedModelAbsent:true,priorHistoryRetained:true,oldNotificationUnchanged:true,notifications:allNotices.length,failedOccurrenceStillPending:true};
 });evidence.pass=true;
}catch(e){evidence.pass=false;evidence.error=String(e);process.exitCode=1;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));await writeFile(out+'/evidence.json',JSON.stringify(evidence,null,2));console.log(evidence);}
