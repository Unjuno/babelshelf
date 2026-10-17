import {KnowledgeStore,projectNote} from '../src/knowledge-store.ts';
import {createNote} from '../../../dist/core.js';
import {parseStateBackup} from '../src/backup-state.ts';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const store=new KnowledgeStore('babelshelf-storage-qa-'+crypto.randomUUID()),lines:string[]=[];
 const check=(ok:boolean,name:string)=>{if(!ok)throw Error(name);lines.push('PASS · '+name);output.textContent=lines.join('\n');};
 try{
  await store.initialize([]);
  const original=createNote({title:'旧メモ',body:'旧原文 🌳',aliases:['legacy']});original.importedFrom={name:'old.txt'};
  const db=await store.open();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('notes','readwrite');tx.objectStore('notes').add(original);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  const legacy=await store.views();check(legacy[0].id===original.id,'legacy database read without rewriting');
  let view={id:crypto.randomUUID(),path:'Notes/記録.md',body:'水 Water 물 QA1036',version:1,history:[]};
  await store.commit(legacy,[...legacy,view]);store.close();
  let current=await store.views();check(current.some(n=>n.id===view.id&&n.body===view.body),'close/reopen retains exact Unicode bytes');
  check((await store.search('水')).some((r:any)=>r.noteId===view.id),'rebuilt multilingual search finds persisted note');
  const before=current,next=current.map(n=>n.id===view.id?{...n,body:'訂正 Water 4L',version:2,history:[n.body]}:n);
  await store.commit(before,next);let rejected=false;
  try{await store.commit(before,before.map(n=>n.id===view.id?{...n,body:'stale',version:2,history:[n.body]}:n));}catch{rejected=true;}
  check(rejected&&(await store.views()).find(n=>n.id===view.id)?.body==='訂正 Water 4L','stale-tab edit rejected without overwrite');
  const raw=await store.all(),saved=raw.find((n:any)=>n.id===view.id);
  check(saved.revisions.length===2&&saved.revisions[0].body===view.body,'correction appends and retains original');
  check(JSON.stringify(raw.find((n:any)=>n.id===original.id))===JSON.stringify(original),'legacy metadata/ID/revision/aliases unchanged');
  const backup=JSON.stringify(await store.backup()),parsed=await parseStateBackup(backup);
  check(parsed.notes.length===2,'backup verifies full revision records');
  current=await store.views();await store.commit(current,current.filter(n=>n.id!==view.id));
  check((await store.all()).find((n:any)=>n.id===view.id).state==='withdrawn','delete retains canonical withdrawn record');
  await store.commit(await store.views(),[...(await store.views()),projectNote(saved)]);
  check((await store.all()).find((n:any)=>n.id===view.id).revisions.length===4,'restore appends revision without deleting history');
  const result=await store.restore(backup);check(result.conflicts.length===1,'restore reports conflicting ID and keeps local revision');
  const fresh=new KnowledgeStore('babelshelf-restore-qa-'+crypto.randomUUID());await fresh.initialize([]);await fresh.restore(backup);
  check((await fresh.all()).find((n:any)=>n.id===view.id).revisions.length===2,'backup restores exact old revisions into a separate local DB');fresh.close();
  const conflict={id:crypto.randomUUID(),path:'Notes/記録.md',body:'collision',version:1,history:[]};rejected=false;
  try{await store.commit(await store.views(),[...(await store.views()),conflict]);}catch{rejected=true;}
  check(rejected&&(await store.all()).length===2,'path collision aborts entire IndexedDB transaction');
  lines.push('COMPLETE · real IndexedDB; no model inference tested');output.textContent=lines.join('\n');
 }catch(e){output.textContent=lines.concat('FAIL · '+(e as Error).message).join('\n');}finally{store.close();}
});
