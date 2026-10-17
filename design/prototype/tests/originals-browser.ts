import {KnowledgeStore} from '../src/knowledge-store';
import {prepareOriginal,readOriginal,originalRef,originalNote,originalKey} from '../src/original-assets';
import {emptyDialogue,appendTurn,type Dialogue} from '../src/conversation';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const name='babelshelf-originals-qa-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name),restored=new KnowledgeStore(name+'-restore'),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 const turn=(prior:Dialogue,assets:any[])=>appendTurn(prior,{id:crypto.randomUUID(),user:'Submitted originals',attachments:assets.map(asset=>({id:asset.id,name:asset.name,kind:asset.kind,status:'Not prepared',size:asset.bytes,asset:originalRef(asset)}))});
 try{
  await a.initialize([]);await restored.initialize([]);const text=await prepareOriginal(new File(['水 Water 原本\n'],'water.txt',{type:'text/plain'}),'samepref-A'),image=await prepareOriginal(new File([new Uint8Array([137,80,78,71,13,10,26,10])],'image.png',{type:'image/png'}));
  let current=turn(emptyDialogue(),[text,image]);await a.submitInput(undefined,current,[text,image]);a.close();
  check((await b.all()).length===2&&(await b.getState<Dialogue>('dialogue'))?.turns[0].attachments?.length===2,'submitted originals, canonical projections and dialogue survive reopen together');
  check(new TextDecoder().decode(readOriginal(await b.original(originalRef(text))))==='水 Water 原本\n'&&readOriginal(await b.original(originalRef(image)))[0]===137,'reopened original bytes match exact size/hash/revision');
  check((await b.search('水')).some((r:any)=>r.noteId===text.id)&&!(await b.search('image')).some((r:any)=>r.noteId===image.id),'decoded text is searchable while unread image contributes no invented evidence');
  const later=appendTurn(current,{id:'another-tab',user:'Changed elsewhere'});await b.compareState('dialogue',current,later);const pending=await prepareOriginal(new File(['new'],'pending.txt',{type:'text/plain'}));let stale=false;
  try{await a.submitInput(current,turn(current,[pending]),[pending]);}catch{stale=true;}
  check(stale&&(await a.all()).length===2&&!(await a.snapshot()).runs.some(r=>r.key===originalKey(pending.id)),'stale dialogue aborts both original and note writes');current=later;
  const collision=await prepareOriginal(new File(['collision'],'water.txt',{type:'text/plain'}),'samepref-B');let refused=false;try{await a.submitInput(current,turn(current,[collision]),[collision]);}catch{refused=true;}
  check(refused&&(await a.all()).length===2&&!(await a.snapshot()).runs.some(r=>r.key===originalKey(collision.id)),'canonical path collision cannot leave an orphan original or input turn');
  const first=await prepareOriginal(new File(['one'],'one.txt',{type:'text/plain'})),second=await prepareOriginal(new File(['two'],'two.txt',{type:'text/plain'}));const competing=await Promise.allSettled([a.submitInput(current,turn(current,[first]),[first]),b.submitInput(current,turn(current,[second]),[second])]);
  check(competing.filter(r=>r.status==='fulfilled').length===1&&(await a.all()).length===3,'two clients submit from one expected dialogue only once');current=(await a.getState<Dialogue>('dialogue'))!;
  const pack=JSON.stringify(await a.backup()),review=await restored.reviewBackup(pack);await restored.restore(pack,review.expected);restored.close();
  check(readOriginal(await restored.original(originalRef(image)))[0]===137&&(await restored.getState<Dialogue>('dialogue'))?.turns.length===current.turns.length,'brainpack transfers original bytes and dialogue identities into a separate retained DB');
  const views=await a.views();await a.commit(views,views.filter(n=>n.id!==image.id));
  check((await a.all()).find(n=>n.id===image.id).state==='withdrawn'&&readOriginal(await a.original(originalRef(image)))[0]===137,'withdrawal retains the original for historical inspection and recovery');
  const bad=await prepareOriginal(new File(['bad'],'bad.txt',{type:'text/plain'})),other=await prepareOriginal(new File(['other'],'other.txt',{type:'text/plain'})),malformed=turn(current,[bad,other]);malformed.turns.at(-1)!.attachments![1]=malformed.turns.at(-1)!.attachments![0];let duplicate=false;
  try{await a.submitInput(current,malformed,[bad,other]);}catch{duplicate=true;}
  check(duplicate&&!(await a.snapshot()).runs.some(r=>r.key===originalKey(other.id)),'duplicate attachment descriptors refuse an inconsistent submission');
  lines.push('DONE · 9 real IndexedDB checks; databases retained. No inference/codec success claimed.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();restored.close();}
});
