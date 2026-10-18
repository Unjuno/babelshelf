import type {SourceRef} from './conversation';
// Presentation only: retain ranked source objects and durable passage results unchanged.
export function searchResultRows<T extends Pick<SourceRef,'noteId'|'revision'>>(results:readonly T[]|undefined):T[]{
 const seen=new Map<string,Set<number>>();return (results??[]).filter(ref=>{let versions=seen.get(ref.noteId);if(!versions){versions=new Set();seen.set(ref.noteId,versions);}if(versions.has(ref.revision))return false;versions.add(ref.revision);return true;});
}
export function searchDisplayStatus(status:string|undefined,results:readonly Pick<SourceRef,'noteId'|'revision'>[]|undefined,files:readonly unknown[]|undefined){return status?.startsWith('Found · ')?'Found · '+(searchResultRows(results).length+(files?.length??0)):status;}
