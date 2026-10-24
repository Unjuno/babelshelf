import type {MemorySearchResult} from '../memory-search-types.ts';
export interface ToolNote {id:string;path:string;version:number;body:string}
/** A tool receives only search results or records explicitly resolved by ID/path/name. */
export interface ToolHost {search(query:string,signal?:AbortSignal):Promise<MemorySearchResult[]>;resolve(query:string,signal?:AbortSignal):Promise<ToolNote[]>;check():void;signal?:AbortSignal}
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
