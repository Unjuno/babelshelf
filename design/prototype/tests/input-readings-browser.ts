import {makeTranscript} from '../src/speech-transcript';
import {KnowledgeStore} from '../src/knowledge-store';
import {prepareOriginal,originalRef} from '../src/original-assets';
import {makeOcrText} from '../src/ocr-text';
import {readingRef,type ReviewedText} from '../src/input-readings';
import {appendTurn,emptyDialogue,type Dialogue} from '../src/conversation';
import {stateHash} from '../src/backup-state';
const out=document.querySelector('#results')!;
// Controlled extraction metadata: tests real transactions, not OCR/model accuracy.
document.querySelector('#run')!.addEventListener('click',async()=>{
 const db='babelshelf-input-reading-qa-'+crypto.randomUUID(),a=new KnowledgeStore(db),b=new KnowledgeStore(db),restored=new KnowledgeStore(db+'-restore'),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);out.textContent=lines.join('\n');};
 const image={width:100,height:100,processedWidth:100,processedHeight:100,frame:0 as const,orientation:'browser-decoded' as const};
 try{
  await a.initialize([]);await b.initialize([]);await restored.initialize([]);
  const raw=await prepareOriginal(new File(['controlled image bytes'],'input.png',{type:'image/png'})),review:ReviewedText={kind:'ocr',id:crypto.randomUUID(),value:makeOcrText(raw,'eng',image,'The code is LIME-7734.',[])};
  const turn=(prior:Dialogue,id=crypto.randomUUID(),r=review,asset=raw)=>appendTurn(prior,{id,user:'',attachments:[{id:asset.id,name:asset.name,kind:asset.kind,status:'Image text reviewed',asset:originalRef(asset),reading:readingRef(r)}]});
  const next=turn(emptyDialogue()),race=await Promise.allSettled([a.submitInput(undefined,next,[raw],[review]),b.submitInput(undefined,turn(emptyDialogue()),[raw],[review])]);
  check(race.filter(r=>r.status==='fulfilled').length===1&&(await a.all()).length===2&&(await a.snapshot()).runs.length===1,'concurrent Send atomically writes one raw/extraction/dialogue');
  const saved=race.find(r=>r.status==='fulfilled') as PromiseFulfilledResult<any[]>;check(saved.value.some(n=>n.id===review.id&&n.revisions[0].body===review.value.text),'empty Send returns extracted note for following-turn grounding');
  let current=(await a.getState<Dialogue>('dialogue'))!,before=stateHash(await a.snapshot());const wrong=await prepareOriginal(new File(['other'],'other.png',{type:'image/png'})),bad:ReviewedText={kind:'ocr',id:crypto.randomUUID(),value:{...review.value,original:{...originalRef(wrong),sha256:'0'.repeat(64)}}};
  let failed=false;try{await a.submitInput(current,turn(current,crypto.randomUUID(),bad,wrong),[wrong],[bad]);}catch{failed=true;}
  check(failed&&stateHash(await a.snapshot())===before,'forged extraction aborts original, text and dialogue together');
  failed=false;try{await b.submitInput(undefined,turn(emptyDialogue()),[],[]);}catch{failed=true;}
  check(failed&&stateHash(await a.snapshot())===before,'stale dialogue expected revision rejects without partial writes');
  const reused:ReviewedText={...review,id:crypto.randomUUID()},following=turn(current,crypto.randomUUID(),reused);await a.submitInput(current,following,[],[reused]);current=following;
  check((await a.all()).length===3&&(await a.snapshot()).runs.length===1,'existing original supports a new reviewed extraction without duplicate raw');
  const views=await a.views();await a.commit(views,views.filter(n=>n.id!==raw.id));before=stateHash(await a.snapshot());failed=false;try{const again={...review,id:crypto.randomUUID()};await b.submitInput(current,turn(current,crypto.randomUUID(),again),[],[again]);}catch{failed=true;}
  check(failed&&stateHash(await a.snapshot())===before,'withdrawn original rejects new Send without changing history');
  const audio=await prepareOriginal(new File(['controlled audio bytes'],'input.wav',{type:'audio/wav'})),speech:ReviewedText={kind:'speech',id:crypto.randomUUID(),value:makeTranscript(audio,2000,{text:'The copper code is Maple 42.',chunks:[{text:'The copper code is Maple 42.',timestamp:[0,2]}]})},spoken=turn(current,crypto.randomUUID(),speech,audio);await a.submitInput(current,spoken,[audio],[speech]);current=spoken;check((await a.all()).some(n=>n.id===speech.id&&n.transcription.text===speech.value.text),'automatic speech reading persists through the same atomic input transaction');
  const pack=JSON.stringify(await a.backup()),plan=await restored.reviewBackup(pack);await restored.restore(pack,plan.expected);restored.close();check(stateHash(await restored.snapshot())===stateHash(await a.snapshot()),'empty database restore retains exact original, extraction and reading links');
  out.textContent+='\nDONE · real IndexedDB, controlled extraction metadata, databases retained';
 }catch(e){out.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();restored.close();}
});
