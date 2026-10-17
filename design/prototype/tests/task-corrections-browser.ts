import {KnowledgeStore,prepareCorrection} from '../src/knowledge-store';
import {parseTask,type Task} from '../src/task-records';
import {stateHash} from '../src/backup-state';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const db='babelshelf-task-correction-qa-'+crypto.randomUUID(),a=new KnowledgeStore(db),b=new KnowledgeStore(db),restored=new KnowledgeStore(db+'-restored'),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 const patch=(changes:object)=>JSON.stringify({action:'patch',changes});
 try{
  await a.initialize([]);await restored.initialize([]);
  const task:Task={repeat:'once',time:'09:00',days:[],date:'2026-11-01',monthDay:1,interval:1,unit:'days',timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,enabled:false,notify:false,prompt:'Fixture: check stock.'};
  const view=await a.putTask(task),original=(await a.all()).find(n=>n.id===view.id)!,p=prepareCorrection(original,'Move to ten',patch({time:'10:00'}));
  check(stateHash((await b.all()).find(n=>n.id===view.id))===stateHash(original)&&(await b.corrections(view.id)).length===0,'proposal changes neither canonical task nor receipt');
  const concurrent=await Promise.allSettled([a.approveCorrection(p),b.approveCorrection(p)]);
  check(concurrent.filter(r=>r.status==='fulfilled').length===1,'concurrent approvals commit exactly once');
  a.close();const changed=(await b.all()).find(n=>n.id===view.id)!,receipts=await b.corrections(view.id);
  check(changed.revisions.length===2&&changed.revisions[0].body===original.revisions[0].body&&parseTask(changed.revisions[1].body).time==='10:00'&&!parseTask(changed.revisions[1].body).enabled&&receipts.length===1&&receipts[0].operation.name==='schedule.patch','reopen retains original, paused task revision and atomic typed receipt');
  const pending=prepareCorrection(changed,'Move to eleven',patch({time:'11:00'}));
  await b.putTask({...parseTask(changed.revisions.at(-1).body),prompt:'Other client changed prompt.'},view.id,2);
  let stale=false;try{await a.approveCorrection(pending);}catch{stale=true;}
  let staleUndo=false;try{await a.revertCorrection(receipts[0].id);}catch{staleUndo=true;}
  check(stale&&staleUndo&&(await b.corrections(view.id)).length===1&&(await b.all()).find(n=>n.id===view.id)!.revisions.length===3,'stale approval and Undo do not overwrite another client or add receipts');
  const current=(await b.all()).find(n=>n.id===view.id)!,p2=prepareCorrection(current,'Move to noon',patch({time:'12:00'}));await a.approveCorrection(p2);await b.revertCorrection(p2.id);a.close();
  const final=(await a.all()).find(n=>n.id===view.id)!,rows=await a.corrections(view.id);
  check(final.revisions.length===5&&final.revisions[4].body===current.revisions[2].body&&rows.find(r=>r.id===p2.id)?.status==='undone','Undo appends v5 and retains both approved revisions');
  const pack=await a.backup(),text=JSON.stringify(pack),review=await restored.reviewBackup(text);await restored.restore(text,review.expected);restored.close();
  const copy=(await restored.all()).find(n=>n.id===view.id)!;
  check(stateHash(copy.revisions)===stateHash(final.revisions)&&stateHash(await restored.corrections(view.id))===stateHash(rows)&&copy.ui.requiresReview===true,'empty-database restore retains task history and receipts, quarantines execution');
  let quarantine=false;try{await restored.approveCorrection(prepareCorrection(copy,'Move to one',patch({time:'13:00'})));}catch{quarantine=true;}
  check(quarantine&&stateHash((await restored.all()).find(n=>n.id===view.id))===stateHash(copy),'restored task cannot be implicitly activated or reviewed by a model patch');
  const bad=structuredClone(pack);bad.payload.runs.find(r=>r.key==='ui-v1-correction-'+p2.id)!.value.operation.arguments.changesSha256='0'.repeat(64);bad.sha256=stateHash(bad.payload);
  let forged=false;try{await restored.reviewBackup(JSON.stringify(bad));}catch{forged=true;}
  check(forged,'rehashing cannot authorize forged typed changes');
  lines.push('DONE · 8 real IndexedDB checks; databases retained. No inference claim.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();restored.close();}
});
