// Controlled browser fixtures only; no model, network inference or public data.
import {KnowledgeStore} from '../../design/prototype/src/knowledge-store.ts';
import {emptyDialogue,appendTurn} from '../../design/prototype/src/conversation.ts';
import {makeDialogueCopyReview,selectDialogueCopy,reviewedDialogueCopy} from '../../design/prototype/src/dialogue-copy.ts';
import {parseStateBackup,stateHash} from '../../design/prototype/src/backup-state.ts';
import {exportMarkdownRevision} from '../../design/prototype/src/markdown-export.ts';

const fixture=()=>appendTurn(appendTurn(emptyDialogue(),{id:'qa-copy-first',user:'QA first human message',answer:'QA first assistant answer\r\n日本語 🌳'}),{id:'qa-copy-last',user:'QA latest human message',answer:'QA latest assistant answer'});
export async function prepareReviewFixture(){
 const store=new KnowledgeStore();if(await store.getState('dialogue')!==undefined)throw Error('Existing dialogue retained · fixture refused');
 await store.compareState('dialogue',undefined,fixture());return {prepared:true,scope:'Controlled originals, no model inference',url:'/'};
}
export async function verifyTransactions(){
 const store=new KnowledgeStore('babelshelf-copy-qa-'+crypto.randomUUID()),state=fixture();await store.compareState('dialogue',undefined,state);
 const review=selectDialogueCopy(state,makeDialogueCopyReview(state,{target:'history',historyIndex:0,historyPart:'user'}),0,'assistant');
 const data=reviewedDialogueCopy(state,review,review.source.quote),view={id:'qa-saved',path:'Inbox/qa-copy.md',version:1,history:[],...data};
 await store.commit([],[view]);const [saved]=await store.all();
 if(saved.revisions[0].body!==review.source.quote||saved.dialogueCopy.speaker!=='assistant')throw Error('Saved original mismatch');
 const pack=await store.backup(),restored=await parseStateBackup(JSON.stringify(pack));
 if(JSON.stringify(restored.notes[0].dialogueCopy)!==JSON.stringify(saved.dialogueCopy))throw Error('Backup mismatch');
 const fresh=new KnowledgeStore('babelshelf-copy-restored-'+crypto.randomUUID()),text=JSON.stringify(pack),backupReview=await fresh.reviewBackup(text),restoration=await fresh.restore(text,backupReview.expected);
 const [restoredNote]=await fresh.all();
 if(!restoration.restored||restoredNote.revisions[0].body!==saved.revisions[0].body||JSON.stringify(restoredNote.dialogueCopy)!==JSON.stringify(saved.dialogueCopy))throw Error('Actual restore mismatch');
 fresh.close();
 if(!exportMarkdownRevision(saved,1).text.includes('dialogueCopy'))throw Error('Markdown origin missing');
 const changed=structuredClone(state);changed.revision++;changed.turns[0].answer='Changed in another writer';await store.compareState('dialogue',state,changed);
 const before=stateHash(await store.snapshot());let staleError='';
 try{await store.commit(await store.views(),[...await store.views(),{...view,id:'qa-refused',path:'Inbox/refused.md'}]);}catch(error){staleError=(error as Error).message;}
 if(!staleError.includes('source changed')||stateHash(await store.snapshot())!==before)throw Error('Stale commit was not atomic');
 const current=reviewedDialogueCopy(changed,makeDialogueCopyReview(changed,{target:'history',historyIndex:0,historyPart:'assistant'}),changed.turns[0].answer!);let forgedError='';
 try{await store.commit(await store.views(),[...await store.views(),{id:'qa-forged',path:'Inbox/forged.md',version:1,history:[],...current,dialogueCopy:{...current.dialogueCopy,edited:true}}]);}catch(error){forgedError=(error as Error).message;}
 if(!forgedError.includes('copy origin')||stateHash(await store.snapshot())!==before)throw Error('Forged label was not refused atomically');
 return {passed:true,scope:'Actual IndexedDB, controlled fixtures, no inference',database:(store as any).name,saved,staleError,forgedError,unchangedSnapshotHash:before,backupRoundTrip:true,freshDatabaseRestore:restoration,markdownOrigin:true};
}
export async function inspectSavedReview(){
 const store=new KnowledgeStore(),notes=(await store.all()).filter(note=>note.dialogueCopy),dialogue=await store.getState('dialogue');
 return {scope:'Actual local UI-created copies',notes,dialogue};
}
