import { assertMutableFolder } from './memory-paths.ts';

/** Show a location only when the stored batch identifies one unambiguous root. */
export function trashLocation(batch:{notes:{path:string}[];folders:string[]}):string|undefined{
 if(!batch.folders.length)return batch.notes.length===1?batch.notes[0].path:undefined;
 const roots=batch.folders.filter(root=>batch.folders.every(path=>path===root||path.startsWith(root+'/'))&&batch.notes.every(note=>note.path.startsWith(root+'/')));
 return roots.length===1?roots[0]:undefined;
}

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
 const files=notes.map(n=>n.path.toLowerCase()),directories=folders.map(p=>p.toLowerCase());
 for(const note of batch.notes){if(notes.some(n=>n.id===note.id))return false;const path=note.path.toLowerCase();if(files.some(p=>p===path||p.startsWith(path+'/')||path.startsWith(p+'/'))||directories.some(p=>p===path||p.startsWith(path+'/')))return false;}
 for(const folder of batch.folders){const path=folder.toLowerCase();if(directories.includes(path)||files.some(p=>p===path||path.startsWith(p+'/')))return false;}
 return true;
}
