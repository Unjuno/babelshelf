import {KnowledgeStore} from '../src/knowledge-store';
import {parseTaskProposal} from '../src/task-proposals';
import {parseTask} from '../src/task-records';
import {stateHash} from '../src/backup-state';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const db='babelshelf-task-proposal-qa-'+crypto.randomUUID(),a=new KnowledgeStore(db),b=new KnowledgeStore(db),restored=new KnowledgeStore(db+'-restored'),lines:string[]=[];const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 try{
  await a.initialize([]);await restored.initialize([]);const proposal=parseTaskProposal(JSON.stringify({action:'schedule',task:{repeat:'daily',time:'09:00',date:'2026-11-01',days:[],monthDay:1,interval:1,unit:'days',prompt:'Fixture stock check.'}})),id=crypto.randomUUID();if(!proposal.task)throw Error('Task missing');
  check((await a.all()).length===0,'typed proposal does not save or register a task');
  const attempts=await Promise.allSettled([a.putTask(proposal.task,undefined,undefined,id),b.putTask(proposal.task,undefined,undefined,id)]);
  check(attempts.filter(r=>r.status==='fulfilled').length===1&&(await a.all()).length===1,'same reviewed identity can commit only once across clients');
  a.close();const saved=(await b.all())[0];check(saved.id===id&&saved.revisions.length===1&&!parseTask(saved.revisions[0].body).enabled,'reopen retains one paused canonical task with the reviewed identity');
  let retry=false;try{await a.putTask({...proposal.task,time:'10:00'},undefined,undefined,id);}catch{retry=true;}
  check(retry&&stateHash((await b.all())[0])===stateHash(saved),'a repeated Save cannot overwrite or duplicate a committed task');
  const pack=JSON.stringify(await b.backup()),review=await restored.reviewBackup(pack);await restored.restore(pack,review.expected);restored.close();const copy=(await restored.all())[0];
  check(copy.id===id&&stateHash(copy.revisions)===stateHash(saved.revisions)&&copy.ui.requiresReview,'empty-database restore retains the task and quarantines execution');
  let blocked=false;try{await restored.claimRun(id,'qa',{manual:true});}catch{blocked=true;}check(blocked,'restored task cannot execute without dedicated review');
  lines.push('DONE · 6 real IndexedDB checks; databases retained. No inference claim.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();restored.close();}
});
