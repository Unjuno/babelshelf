import {KnowledgeStore,type NoteView} from './knowledge-store.ts';

export type DeviceMemorySmokeStage='setup'|'initialize'|'write'|'read'|'search'|'revise'|'backup'|'withdraw'|'cleanup';
const stageMessages:Record<DeviceMemorySmokeStage,string>={
 setup:'Temporary Memory database setup failed',initialize:'Temporary Memory initialization failed',write:'Memory create check failed',read:'Memory read check failed',search:'Memory search check failed',revise:'Memory correction-history check failed',backup:'Memory backup validation failed',withdraw:'Memory withdrawal check failed',cleanup:'Temporary Memory cleanup failed',
};
export class DeviceMemorySmokeError extends Error{
 readonly stage:DeviceMemorySmokeStage;
 constructor(stage:DeviceMemorySmokeStage){super(stageMessages[stage]);this.name='DeviceMemorySmokeError';this.stage=stage;}
}

/**
 * Exercise the production KnowledgeStore against a fresh, isolated IndexedDB
 * database. This never opens the user's canonical database and removes only
 * the database created by this exact call.
 */
export async function runDeviceMemorySmokeTest(factory:Pick<IDBFactory,'open'|'deleteDatabase'>=indexedDB){
 const cryptoApi=globalThis.crypto;
 if(!cryptoApi?.randomUUID)throw new DeviceMemorySmokeError('setup');
 const id=cryptoApi.randomUUID(),name=`babelshelf-device-smoke-${id}`;
 let created=false,store:KnowledgeStore|undefined,error:unknown,stage:DeviceMemorySmokeStage='setup';
 try{
  await new Promise<void>((resolve,reject)=>{
   const request=factory.open(name,1);
   request.onupgradeneeded=()=>{created=true;const db=request.result;db.createObjectStore('notes',{keyPath:'id'});db.createObjectStore('settings');db.createObjectStore('runs');};
   request.onerror=()=>reject(request.error??Error('Temporary Memory database open failed'));
   request.onblocked=()=>reject(Error('Temporary Memory database open blocked'));
   request.onsuccess=()=>{
    const db=request.result;
    if(!created){db.close();reject(Error('Temporary Memory database name collision'));return;}
    const complete=['notes','settings','runs'].every(table=>db.objectStoreNames.contains(table));
    db.close();
    if(!complete){reject(Error('Temporary Memory schema incomplete'));return;}
    resolve();
   };
  });
  store=new KnowledgeStore(name);
  stage='initialize';
  await store.initialize([]);
  const before:NoteView={id:`device-smoke-${id}`,path:`Notes/Device smoke ${id}.md`,body:`BABELSHELF_DEVICE_SMOKE_${id}`,version:1,history:[],kind:'original',sources:[]};
  stage='write';
  await store.commit([], [before]);
  stage='read';
  let views=await store.views();
  if(views.length!==1||views[0].id!==before.id||views[0].body!==before.body)throw Error('Temporary Memory write/read failed');
  stage='search';
  const hits=await store.search(`BABELSHELF_DEVICE_SMOKE_${id}`);
  if(!hits.some(hit=>hit.noteId===before.id&&hit.quote===before.body))throw Error('Temporary Memory search failed');
  stage='revise';
  const after:NoteView={...views[0],body:before.body+'_UPDATED',version:2,history:[before.body]};
  await store.commit(views,[after]);
  views=await store.views();
  if(views.length!==1||views[0].version!==2||views[0].history.at(-1)!==before.body||views[0].body!==after.body)throw Error('Temporary Memory revision failed');
  stage='backup';
  const backup=await store.backup(),restored=await store.checkBackup(JSON.stringify(backup));
  if(!restored.notes.some(note=>note.id===before.id&&note.revisions.at(-1)?.body===after.body))throw Error('Temporary Memory backup validation failed');
  stage='withdraw';
  await store.commit(views,[]);
  const remaining=await store.all();
  if(remaining.length!==1||remaining[0].state!=='withdrawn'||remaining[0].revisions.at(-1)?.body!==after.body)throw Error('Temporary Memory withdrawal failed');
 }catch{error=new DeviceMemorySmokeError(stage);}
 finally{
  store?.close();
  if(created){
   try{await new Promise<void>((resolve,reject)=>{const request=factory.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error??Error('Temporary Memory cleanup failed'));request.onblocked=()=>reject(Error('Temporary Memory cleanup blocked'));});}
   catch{throw new DeviceMemorySmokeError('cleanup');}
  }
 }
 if(error)throw error;
}
