import { assertMutableFolder } from './memory-paths.ts';

export function deletionContents<T extends {id:string;path:string;protected?:boolean;managed?:boolean}>(target:{kind:'file'|'folder';value:string},notes:T[],folders:string[]){
 if(target.kind==='file'){
  const selected=notes.filter(n=>n.id===target.value);
  if(selected.some(n=>n.protected||n.managed))throw Error('Built-in definition is protected');
  return {notes:selected,folders:[] as string[]};
 }
 assertMutableFolder(target.value);
 const inside=(path:string)=>path===target.value||path.startsWith(target.value+'/');
 const selected=notes.filter(n=>inside(n.path));
 if(selected.some(n=>n.protected||n.managed))throw Error('Built-in definition is protected');
 return {notes:selected,folders:folders.filter(inside)};
}

export function canRestore<T extends {id:string;path:string}>(batch:{notes:T[];folders:string[]},notes:T[],folders:string[]){
 const occupied=[...notes.map(n=>n.path),...folders].map(p=>p.toLowerCase());
 return !batch.notes.some(n=>notes.some(active=>active.id===n.id)||occupied.includes(n.path.toLowerCase()))
  && !batch.folders.some(p=>occupied.includes(p.toLowerCase()));
}
