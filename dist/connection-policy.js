// Read the one canonical Connection record. No mirrored permission store,
// database creation, migration, permission grants or user-content enumeration.
export function readAppNetworkAccess(factory,timeout=3000){
 return new Promise(resolve=>{
  let settled=false,database,timer;
  const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);database?.close();resolve(value===true);};
  timer=setTimeout(()=>finish(false),timeout);
  try{
   if(!factory)return finish(false);
   const request=factory.open('mlb-memory-v1',1);
   request.onupgradeneeded=()=>{request.transaction.abort();finish(false);};
   request.onerror=request.onblocked=()=>finish(false);
   request.onsuccess=()=>{
    database=request.result;if(settled){database.close();return;}
    try{
     if(!database.objectStoreNames.contains('notes'))return finish(false);
     const tx=database.transaction('notes','readonly'),get=tx.objectStore('notes').get('settings-connection');let allowed=false;
     tx.oncomplete=()=>finish(allowed);tx.onabort=tx.onerror=()=>finish(false);
     get.onsuccess=()=>{
      try{
       const note=get.result,revision=note?.revisions?.at(-1);
       if(note?.id!=='settings-connection'||note.state!=='active'||note.ui?.managed!==true||revision?.path!=='Settings/connection.md')return;
       const block=revision.body.match(/^# [^\n]+\n\n```json\n([\s\S]+)\n```\n?$/);if(!block)return;
       const value=JSON.parse(block[1]);
       if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).some(key=>!['schemaVersion','downloads','diagnosticLogs'].includes(key))||value.schemaVersion!==undefined&&![1,2].includes(value.schemaVersion)||typeof value.downloads!=='boolean'||value.diagnosticLogs!==undefined&&typeof value.diagnosticLogs!=='boolean')return;
       allowed=value.downloads;
      }catch{}
     };
    }catch{finish(false);}
   };
  }catch{finish(false);}
 });
}
