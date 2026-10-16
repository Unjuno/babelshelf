import { assertMutableFolder } from './memory-paths.ts';

export function deletionContents<T extends {id:string;path:string}>(target:{kind:'file'|'folder';value:string},notes:T[],folders:string[]){
 if(target.kind==='file')return {notes:notes.filter(n=>n.id===target.value),folders:[] as string[]};
 assertMutableFolder(target.value);
 const inside=(path:string)=>path===target.value||path.startsWith(target.value+'/');
 return {notes:notes.filter(n=>inside(n.path)),folders:folders.filter(inside)};
}

export function canRestore<T extends {id:string;path:string}>(batch:{notes:T[];folders:string[]},notes:T[],folders:string[]){
 const occupied=[...notes.map(n=>n.path),...folders].map(p=>p.toLowerCase());
 return !batch.notes.some(n=>notes.some(active=>active.id===n.id)||occupied.includes(n.path.toLowerCase()))
  && !batch.folders.some(p=>occupied.includes(p.toLowerCase()));
}
