import {KnowledgeStore,prepareCorrection} from '../src/knowledge-store';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const db='babelshelf-correction-qa-'+crypto.randomUUID(),a=new KnowledgeStore(db),b=new KnowledgeStore(db),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 try{
  await a.initialize([]);await a.commit([],[{id:'source',path:'Notes/water.md',body:'Water 3L',version:1,history:[]}]);
  const original=(await a.all())[0],proposal=prepareCorrection(original,'Replace 3L with 4L','{"action":"replace","find":"3L","with":"4L"}');
  check((await a.all())[0].revisions.length===1,'preparing a proposal never changes the original');
  const concurrent=await Promise.allSettled([a.approveCorrection(proposal),b.approveCorrection(proposal)]);
  check(concurrent.filter(r=>r.status==='fulfilled').length===1,'two approvals commit only once');
  a.close();const receipts=await b.corrections('source'),changed=(await b.all())[0];
  check(receipts.length===1&&receipts[0].status==='applied'&&changed.revisions.length===2&&changed.revisions[1].body==='Water 4L','revision and exact receipt persist atomically after reopen');
  const pending=prepareCorrection(changed,'Replace 4L with 5L','{"action":"replace","find":"4L","with":"5L"}');
  const before=await b.views();await b.commit(before,[{...before[0],body:'Manual later edit',version:3,history:['Water 3L','Water 4L']}]);
  let stale=false;try{await a.approveCorrection(pending);}catch{stale=true;}
  check(stale&&(await a.corrections('source')).length===1,'stale proposal writes neither revision nor receipt');
  let staleUndo=false;try{await a.revertCorrection(receipts[0].id);}catch{staleUndo=true;}
  check(staleUndo&&(await a.all())[0].revisions.at(-1).body==='Manual later edit','undo cannot overwrite a later edit');
  const proposal2=prepareCorrection((await a.all())[0],'Replace later with approved','{"action":"replace","find":"later","with":"approved"}');await a.approveCorrection(proposal2);await a.revertCorrection(proposal2.id);a.close();
  const final=(await b.all())[0],saved=(await b.corrections('source')).find(r=>r.id===proposal2.id);
  check(final.revisions.length===5&&final.revisions.at(-1).body==='Manual later edit'&&saved?.status==='undone'&&saved.undoVersion===5,'undo appends a durable revision without removing corrected history');
  lines.push('DONE · 6 real IndexedDB checks; test database retained.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();}
});
