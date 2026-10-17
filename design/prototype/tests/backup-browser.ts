import {KnowledgeStore,prepareCorrection} from '../src/knowledge-store';
import {appendTurn,emptyDialogue} from '../src/conversation';
import {createNote,makeBackup} from '../../../dist/core.js';
import {formatPreference,parsePreference} from '../src/preference-records';
import {MetadataWriter} from '../src/metadata-writer';
const output=document.querySelector('#results')!;
document.querySelector('#run')!.addEventListener('click',async()=>{
 const name='babelshelf-backup-qa-'+crypto.randomUUID(),a=new KnowledgeStore(name),b=new KnowledgeStore(name+'-restored'),other=new KnowledgeStore(name+'-restored'),lines:string[]=[];
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 try{
  await a.initialize([]);await b.initialize([]);await a.commit([],[{id:'source',path:'Notes/水.md',body:'Water 3L 🌳',version:1,history:[]}]);
  await a.approveCorrection(prepareCorrection((await a.all())[0],'Replace 3L with 4L','{"action":"replace","find":"3L","with":"4L"}'));
  const dialogue=appendTurn(emptyDialogue(),{id:'turn',user:'日本語 original',answer:'Water 4L 🌳',refs:[{noteId:'source',revision:1,start:0,end:5,quote:'Water'}]});
  await a.compareState('dialogue',undefined,dialogue);await a.setState('folders',['Notes/Empty']);await a.setState('trash',[]);
  const pack=JSON.stringify(await a.backup()),review=await b.reviewBackup(pack);
  check(review.schema===2&&review.total.settings===3&&review.total.runs===1&&review.conflicts.length===0,'backup includes original dialogue, folders and correction receipt');
  const result=await b.restore(pack,review.expected);b.close();
  check(result.restored&&(await b.all())[0].revisions[0].body==='Water 3L 🌳'&&(await b.getState<any>('dialogue'))?.turns[0].user==='日本語 original'&&(await b.corrections()).length===1,'all stores restore atomically and survive close/reopen');
  await b.revertCorrection((await b.corrections())[0].id);
  check((await b.all())[0].revisions.length===3&&(await b.all())[0].revisions.at(-1).body==='Water 3L 🌳','restored correction receipt supports explicit append-only Undo');
  const conflicting=await b.reviewBackup(pack),before=await b.snapshot(),conflictResult=await b.restore(pack,conflicting.expected);
  check(conflicting.conflicts.length===2&&!conflictResult.restored&&JSON.stringify(before)===JSON.stringify(await b.snapshot()),'divergent record and receipt refuse the whole restore with zero writes');
  const currentPack=JSON.stringify(await b.backup()),sameReview=await b.reviewBackup(currentPack),same=await b.restore(currentPack,sameReview.expected);
  check(same.restored&&Object.values(same.added).every(n=>n===0),'identical full-state restore is a no-op');
  const pending=await b.reviewBackup(currentPack);await other.setState('folders',['Notes/Newer']);let stale=false;try{await b.restore(currentPack,pending.expected);}catch(e){stale=/changed/.test((e as Error).message);}
  check(stale&&(await b.getState<string[]>('folders'))?.[0]==='Notes/Newer','another tab changing local state invalidates the reviewed snapshot');
  const broken=JSON.parse(currentPack);broken.payload.settings[0].value='tampered';let rejected=false;try{await b.restore(JSON.stringify(broken));}catch{rejected=true;}
  check(rejected&&(await b.all())[0].revisions.length===3,'checksum failure cannot partially restore a store');
  const tx=(await b.open()).transaction('settings','readwrite');tx.objectStore('settings').put(new Date(),'unsupported');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});let unsupported=false;try{await b.backup();}catch(e){unsupported=/JSON/.test((e as Error).message);}
  check(unsupported,'unsupported clone-only values fail export rather than being silently lost');
  const legacy=new KnowledgeStore(name+'-legacy'),connection=createNote({path:'Settings/connection.md',body:formatPreference('connection',{downloads:true})});connection.id='settings-connection';connection.ui={managed:true};
  await legacy.initialize([]);await legacy.restore(JSON.stringify(await makeBackup([connection])));const restoredConnection=(await legacy.all())[0];
  check(restoredConnection.revisions.length===2&&!parsePreference('connection',restoredConnection.revisions.at(-1).body).downloads&&restoredConnection.revisions[0].body===connection.revisions[0].body,'legacy schema1 restore also retains ON original and appends downloads OFF');legacy.close();
  const hydrated=await b.getState<string[]>('folders'),displayed=[...(hydrated??[]),'Notes/Recovered'],writer=new MetadataWriter<string[]>((before,next)=>b.compareState('folders',before,next));writer.hydrate(hydrated,displayed);
  await other.setState('folders',['Notes/Remote']);await writer.save(displayed);
  check((await b.getState<string[]>('folders'))?.[0]==='Notes/Remote','hydrating restored and recovered metadata cannot overwrite a newer tab');
  let metadataConflict=false;try{await writer.save([...displayed,'Notes/Explicit']);}catch{metadataConflict=true;}
  check(metadataConflict&&(await b.getState<string[]>('folders'))?.[0]==='Notes/Remote','explicit metadata edit rejects a changed expected state');
  lines.push('DONE · 11 real IndexedDB checks; databases retained. No inference tested.');output.textContent=lines.join('\n');
 }catch(e){output.textContent+='\nFAIL · '+(e as Error).message;}finally{a.close();b.close();other.close();}
});
