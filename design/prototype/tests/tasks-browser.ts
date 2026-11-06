import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {formatTask,parseTask,taskRunView,noticeView} from '../src/task-records.ts';
import {localDate} from '../src/schedule-time.ts';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const name='babelshelf-task-qa-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name),lines:string[]=[];let restored:KnowledgeStore|undefined;
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 try{
  await a.initialize([]);const future=new Date(Date.now()+86400000);
  const definition={repeat:'once',time:'09:00',days:[1],date:localDate(future),monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:true,notify:true,prompt:'Ledger fixture only\nThis page does not test inference.\n'};
  const task=await a.putTask(definition);a.close();const before=await b.views();
  check(before.find(n=>n.id===task.id)?.body===formatTask(definition),'registered task and exact prompt survive DB close/reopen');
  const edited=before.map(n=>n.id===task.id?{...n,body:formatTask({...definition,time:'10:00'}),version:n.version+1,history:[...n.history,n.body]}:n);
  await b.commit(before,edited);const current=(await a.views()).find(n=>n.id===task.id)!;
  check(parseTask(current.body).time==='10:00'&&current.history[0]===before[0].body,'Memory edit changes canonical schedule with retained history');
  const claims=await Promise.allSettled([a.claimRun(task.id,'a',{manual:true}),b.claimRun(task.id,'b',{manual:true})]);
  check(claims.filter(c=>c.status==='fulfilled').length===1,'two real IDB clients cannot claim the same occurrence twice');
  const winner=claims.find(c=>c.status==='fulfilled') as PromiseFulfilledResult<any>,claimed=winner.value.run,owner=taskRunView(claimed).owner;
  await a.finishRun(claimed.id,owner,{status:'failed',error:'Ledger failure fixture; no inference'});
  let raw=await a.all(),run=raw.find(n=>n.id===claimed.id);
  check(taskRunView(run).status==='failed'&&run.revisions.length===2,'actual transaction retains failed attempt and original claim');
  const notice=raw.find(n=>n.ui?.recordType==='notification');await b.readNotification(notice.id);
  check(noticeView((await a.all()).find(n=>n.id===notice.id)).read,'notification read state is canonical and versioned');
  const retry=await b.claimRun(task.id,'retry',{manual:true,retry:true});
  check(taskRunView(retry.run).attempt===2&&retry.run.id===claimed.id,'explicit retry appends to same occurrence identity');
  await a.finishRun(claimed.id,'retry',{status:'stopped',error:'Stopped fixture'});
  await b.skipRun(task.id,'user');raw=await a.all();
  check(raw.find(n=>n.id===task.id).taskCursor.nextAt===null&&taskRunView(raw.find(n=>n.id===claimed.id)).attempt===2,'skip consumes occurrence without another inference attempt');
  const views=await a.views();await a.commit(views,views.filter(n=>n.id!==notice.id));
  check((await a.all()).find(n=>n.id===task.id).state==='active'&&(await a.all()).find(n=>n.id===claimed.id).state==='active','deleting notification does not delete task or execution');
  const backup=JSON.stringify(await a.backup());restored=new KnowledgeStore(name+'-restore');await restored.initialize([]);await restored.restore(backup);
  const restoredTask=(await restored.views()).find(n=>n.id===task.id)!;
  check(restoredTask.requiresReview===true&&parseTask(restoredTask.body).prompt===definition.prompt,'restored tasks preserve bytes but require explicit review');
  let rejected=false;try{await restored.claimRun(task.id,'intruder',{manual:true});}catch{rejected=true;}check(rejected,'restoring a backup cannot grant execution authorization');
  const same=await a.restore(backup);check(same.conflicts.length===0,'identical task backup restore remains a no-op');
  lines.push('COMPLETE · real IndexedDB state transitions; no model inference claimed');output.textContent=lines.join('\n');
 }catch(e){output.textContent=lines.concat('FAIL · '+(e as Error).message).join('\n');}finally{
  a.close();b.close();restored?.close();
  let cleaned=true;for(const database of [name,name+'-restore'])await new Promise<void>(resolve=>{const request=indexedDB.deleteDatabase(database);request.onsuccess=()=>resolve();request.onerror=request.onblocked=()=>{cleaned=false;output.textContent+='\nCleanup pending · '+database;resolve();};});
  if(cleaned)output.textContent+='\nCleanup complete · temporary databases deleted';
 }
});
