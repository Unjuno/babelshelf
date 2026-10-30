import type {MemorySearchResult} from '../memory-search-types.ts';
import {MAX_FOLDER_DEPTH} from '../memory-paths.ts';
export interface ToolNote {id:string;path:string;version:number;body:string;start?:number;totalChars?:number}
/** A tool receives only search results or records explicitly resolved by ID/path/name. */
export interface ToolHost {search(query:string,signal?:AbortSignal):Promise<MemorySearchResult[]>;searchPage?(query:string,options:{offset:number;limit:number;snapshot?:string;pathPrefix?:string},signal?:AbortSignal):Promise<unknown>;resolve(query:string,signal?:AbortSignal):Promise<ToolNote[]>;list?(path:string,offset:number,limit:number,signal?:AbortSignal):Promise<unknown>;sources?(id:string,revision:number,signal?:AbortSignal):Promise<ReturnType<typeof import('../note-provenance.ts').noteSourceMetadata>>;check():void;signal?:AbortSignal}
export function resolveToolNotes(notes:ToolNote[],query:string):ToolNote[]{
 const byId=notes.filter(note=>note.id===query);
 if(byId.length>1)throw Error('Conflicting record ID');
 if(byId.length)return byId.map(projectToolNote);
 const byPath=notes.filter(note=>note.path===query);
 if(byPath.length>1)throw Error('Conflicting record path');
 if(byPath.length)return byPath.map(projectToolNote);
 const byName=notes.filter(note=>note.path.split('/').at(-1)===query);
 if(byName.length>20)throw Error('Ambiguous file name; use a full path or record ID');
 return byName.map(projectToolNote);
}
function projectToolNote(note:ToolNote):ToolNote{return {id:note.id,path:note.path,version:note.version,body:note.body};}
export function validateQuery(args:unknown):string {
 if(!args || typeof args!=='object' || Array.isArray(args) || Object.keys(args).length!==1 || !Object.hasOwn(args,'query'))throw new Error('Invalid tool arguments');
 const query=(args as {query:unknown}).query;
 if(typeof query!=='string'||!query.trim()||query.length>2000)throw new Error('Invalid tool query');
 return query;
}

export function validateMemoryListArgs(args:unknown):{path:string;offset:number;limit:number}{
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(key=>!['path','offset','limit'].includes(key)))throw new Error('Invalid folder listing arguments');
 const value=args as Record<string,unknown>,path=value.path??'';
 if(typeof path!=='string'||path.length>500||path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>part==='.'||part==='..'||/[\u0000-\u001f]/.test(part))||path.split('/').some(part=>part==='')&&path!==''||path.split('/').filter(Boolean).length>MAX_FOLDER_DEPTH)throw new Error('Invalid folder path');
 const offset=value.offset??0,limit=value.limit??25;
 if(!Number.isSafeInteger(offset)||Number(offset)<0||Number(offset)>1_000_000||!Number.isSafeInteger(limit)||Number(limit)<1||Number(limit)>25)throw new Error('Invalid folder listing page');
 return {path:path.replace(/\/$/,''),offset:Number(offset),limit:Number(limit)};
}

/** List immediate children only. This is a view over canonical notes/folder metadata, not a filesystem. */
export function listMemoryEntries(path:string,notes:readonly ToolNote[],folderPaths:readonly string[],offset=0,limit=25){
 const prefix=path?`${path}/`:'';
 const folders=new Set<string>();
 for(const candidate of [...folderPaths,...notes.map(note=>note.path.split('/').slice(0,-1).join('/'))]){
  if(typeof candidate!=='string'||!candidate)continue;
  const parts=candidate.split('/');
  if(parts.length>MAX_FOLDER_DEPTH||parts.some(part=>!part||part==='.'||part==='..'||/[\\:*?"<>|\u0000-\u001f]/.test(part)||/[. ]$/.test(part)))continue;
  for(let i=1;i<=parts.length;i++){
   const folder=parts.slice(0,i).join('/');
   if(folder.startsWith(prefix)){
    const remainder=folder.slice(prefix.length);
    if(remainder&&!remainder.includes('/'))folders.add(folder);
   }
  }
 }
 const entries=new Map<string,{kind:'folder'|'file';name:string;path:string;id?:string;version?:number}>();
 for(const folder of folders){const name=folder.slice(prefix.length);entries.set(`folder:${folder}`,{kind:'folder',name,path:folder});}
 for(const note of notes){
  if(note.path.includes('/')?note.path.slice(0,note.path.lastIndexOf('/'))!==path:path!=='')continue;
  const name=note.path.split('/').at(-1)!;
  entries.set(`file:${note.id}`,{kind:'file',name,path:note.path,id:note.id,version:note.version});
 }
 const all=[...entries.values()].sort((a,b)=>a.kind===b.kind?a.name<b.name?-1:a.name>b.name?1:0:a.kind==='folder'?-1:1);
 const page=all.slice(offset,offset+limit);
 return {path,entries:page,offset,limit,total:all.length,hasMore:offset+page.length<all.length,nextOffset:offset+page.length<all.length?offset+page.length:null};
}
