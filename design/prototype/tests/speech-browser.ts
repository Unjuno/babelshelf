import {KnowledgeStore} from '../src/knowledge-store';
import {prepareOriginal,originalKey,originalRef,readOriginal} from '../src/original-assets';
import {makeTranscript} from '../src/speech-transcript';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const name='babelshelf-speech-qa-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name),restored=new KnowledgeStore(name+'-restore'),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 try{
  await a.initialize([]);await restored.initialize([]);const asset=await prepareOriginal(new File(['Storage fixture bytes only'],'storage.wav',{type:'audio/wav'})),t=makeTranscript(asset,1000,{text:'Storage fixture text only',chunks:[{text:'Storage fixture text only',timestamp:[0,1]}]});
  await a.saveTranscript('transcript1',t,asset);a.close();check((await b.all()).length===2&&new TextDecoder().decode(readOriginal(await b.original(originalRef(asset))))==='Storage fixture bytes only','fresh raw original, empty projection and reviewed derived note commit together and survive reopen');
  let duplicate=false;try{await b.saveTranscript('transcript1',t);}catch{duplicate=true;}check(duplicate&&(await b.all()).length===2,'duplicate approval cannot create a second note');
  const competing=await Promise.allSettled([a.saveTranscript('transcript2',t),b.saveTranscript('transcript2',t)]);check(competing.filter(r=>r.status==='fulfilled').length===1&&(await a.all()).length===3,'concurrent save of one review commits once');
  const pack=JSON.stringify(await a.backup()),review=await restored.reviewBackup(pack);await restored.restore(pack,review.expected);restored.close();const records=await restored.all();check(records.find(n=>n.id==='transcript1').transcription.segments[0].endMs===1000&&readOriginal(await restored.original(originalRef(asset))).length===asset.bytes,'brainpack preserves exact transcript, time coverage, source identity and raw bytes');
  const bad=await prepareOriginal(new File(['bad bytes'],'bad.wav',{type:'audio/wav'}));let mismatch=false;try{await a.saveTranscript('badTranscript',t,bad);}catch{mismatch=true;}check(mismatch&&!(await a.snapshot()).runs.some(r=>r.key===originalKey(bad.id))&&(await a.all()).length===3,'mismatched original aborts all raw/projection/transcript writes');
  const views=await a.views();await a.commit(views,views.filter(n=>n.id!==asset.id));let withdrawn=false;try{await b.saveTranscript('withdrawnTranscript',t);}catch{withdrawn=true;}check(withdrawn&&(await b.all()).length===3,'withdrawn original cannot receive a new transcription');
  lines.push('DONE · 6 real IndexedDB checks; databases retained. No ASR quality claim.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();restored.close();}
});
