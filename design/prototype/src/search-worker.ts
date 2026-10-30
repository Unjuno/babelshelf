import {createStoredSearchCache,SearchSnapshotChangedError} from './file-discovery.ts';

const cache=createStoredSearchCache();
self.onmessage=(event:MessageEvent)=>{
 const {id,notes,query,options}=event.data??{};
 if(!Number.isSafeInteger(id))return;
 try{const value=cache.search(notes,query,options);self.postMessage({id,ok:true,value});}
 catch(error){self.postMessage({id,ok:false,code:error instanceof SearchSnapshotChangedError?'snapshot_changed':'search_failed'});}
};
