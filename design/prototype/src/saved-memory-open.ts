import {resolveReadIntent,type ReadIntentResolution} from './read-intent.ts';

export type MemorySearchHit={noteId:string;revision:number;[key:string]:unknown};
export type MemoryOpenSnapshot={id:string;path:string;body:string;version:number};
export type SavedMemoryOpenResult<Note extends MemoryOpenSnapshot,Hit extends MemorySearchHit>=
 |{kind:'opened';note:Note;resolution:Extract<ReadIntentResolution,{kind:'open'}>}
 |{kind:'results';results:Hit[]};

/** Resolve an explicit natural-language Memory open without model inference.
 * Search results nominate candidates; a fresh revision check authorizes opening. */
export async function openUniqueSavedMemory<Note extends MemoryOpenSnapshot,Hit extends MemorySearchHit>(input:{
 question:string;
 query:string;
 search:(query:string)=>Promise<Hit[]>;
 snapshot:()=>Promise<Note[]>;
 check?:()=>void;
}):Promise<SavedMemoryOpenResult<Note,Hit>>{
 if(!input||typeof input.question!=='string'||!input.question.trim()||typeof input.query!=='string'||!input.query.trim()||input.query.length>2000||typeof input.search!=='function'||typeof input.snapshot!=='function')throw Error('Invalid saved Memory open request');
 const check=input.check??(()=>{});check();
 const results=await input.search(input.query);check();
 if(!Array.isArray(results)||results.length>20||results.some(hit=>!hit||typeof hit.noteId!=='string'||!hit.noteId||!Number.isSafeInteger(hit.revision)||hit.revision<1))throw Error('Invalid saved Memory search results');
 const candidates=new Map<string,{noteId:string;revision:number}>();
 for(const hit of results)candidates.set(hit.noteId+'@'+hit.revision,{noteId:hit.noteId,revision:hit.revision});
 if(candidates.size!==1)return {kind:'results',results};
 const target=[...candidates.values()][0],notes=await input.snapshot();check();
 if(!Array.isArray(notes))throw Error('Invalid saved Memory snapshot');
 const note=notes.find(value=>value.id===target.noteId);
 if(!note||note.version!==target.revision||typeof note.path!=='string'||typeof note.body!=='string')throw Error('Saved file changed or unavailable · search again');
 const resolution=resolveReadIntent(input.question,'open',{noteId:note.id,path:note.path,revision:note.version,body:note.body});
 if(resolution.kind!=='open')throw Error('Saved file could not be opened');
 return {kind:'opened',note,resolution};
}
