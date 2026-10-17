import {KnowledgeStore} from '../src/knowledge-store';
const output=document.querySelector('#results')!,button=document.querySelector('#run') as HTMLButtonElement;
button.addEventListener('click',async()=>{button.disabled=true;const lines:string[]=[],prefix='babelshelf-folder-qa-'+crypto.randomUUID();
 const check=(ok:boolean,label:string)=>{if(!ok)throw Error(label);lines.push('PASS · '+label);output.textContent=lines.join('\n');};
 const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const setup=async(suffix:string)=>{const store=new KnowledgeStore(prefix+'-'+suffix);await store.initialize([{id:crypto.randomUUID(),path:'Notes/Trip/original.md',body:'Exact 水 MAPLE-6428',version:1,history:[]}]);await store.setState('folders',['Notes/Trip/Empty','Notes/Trip/Empty/Deep']);return store;};
 const refused=async(work:()=>Promise<unknown>)=>{try{await work();return false;}catch{return true;}};
 const stores:KnowledgeStore[]=[];
 try{
  const store=await setup('success');stores.push(store);const old=await store.all(),views=await store.views(),folders=await store.getState<string[]>('folders');
  const moved=await store.renameFolder('Notes/Trip','Travel',views,folders);store.close();const reopened=new KnowledgeStore(prefix+'-success');stores.push(reopened);const saved=await reopened.all();
  check(saved[0].id===old[0].id&&equal(saved[0].revisions[0],old[0].revisions[0])&&saved[0].revisions[1].body===old[0].revisions[0].body&&saved[0].revisions[1].path==='Notes/Travel/original.md'&&equal(await reopened.getState('folders'),moved.folders)&&moved.folders.includes('Notes/Travel/Empty/Deep'),'native commit/reopen preserves original and empty descendants together');
  const changed=await setup('changed');stores.push(changed);const stale=await changed.views(),expected=await changed.getState<string[]>('folders');await changed.commit(stale,stale.map(n=>({...n,body:'Other tab',version:2,history:[n.body]})));const before=await changed.snapshot();
  check(await refused(()=>changed.renameFolder('Notes/Trip','Travel',stale,expected))&&equal(await changed.snapshot(),before),'stale file refuses every write');
  const metadata=await setup('metadata');stores.push(metadata);const mv=await metadata.views(),mf=await metadata.getState<string[]>('folders');await metadata.setState('folders',[...mf!,'Notes/Other']);const mb=await metadata.snapshot();
  check(await refused(()=>metadata.renameFolder('Notes/Trip','Travel',mv,mf))&&equal(await metadata.snapshot(),mb),'stale folder metadata refuses every write');
  const collision=await setup('collision');stores.push(collision);await collision.setState('folders',['Notes/Trip/Empty','Notes/Travel']);const cb=await collision.snapshot();
  check(await refused(async()=>collision.renameFolder('Notes/Trip','Travel',await collision.views(),await collision.getState('folders')))&&equal(await collision.snapshot(),cb),'collision refuses notes and metadata together');
  const fault=await setup('fault');stores.push(fault);const fv=await fault.views(),ff=await fault.getState<string[]>('folders'),fb=await fault.snapshot(),raw=await fault.open(),originalOpen=fault.open.bind(fault);
  // Fault injection is limited to this isolated database. Reads and note writes
  // are native IDB; a synchronous settings write failure aborts that transaction.
  fault.open=async()=>({transaction(names:string[],mode:IDBTransactionMode){const tx=raw.transaction(names,mode);return new Proxy(tx,{get(target,key){if(key==='objectStore')return(name:string)=>{const object=target.objectStore(name);if(name!=='settings')return object;return new Proxy(object,{get(value,k){if(k==='put')return()=>{throw Error('Injected folder write failure');};const v=Reflect.get(value,k,value);return typeof v==='function'?v.bind(value):v;}});};const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});}} as IDBDatabase);
  const rejected=await refused(()=>fault.renameFolder('Notes/Trip','Travel',fv,ff));fault.open=originalOpen;
  check(rejected&&equal(await fault.snapshot(),fb),'native transaction abort rolls back earlier note put when folder write fails');
  lines.push('Complete · 5 checks · isolated databases retained');output.textContent=lines.join('\n');
 }catch(e){output.textContent=lines.join('\n')+'\nFAIL · '+(e as Error).message;}finally{stores.forEach(s=>s.close());button.disabled=false;}
});
