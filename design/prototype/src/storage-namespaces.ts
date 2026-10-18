// @ts-expect-error Shared baseline is plain JavaScript.
import {notePath} from '../../../dist/files.js';
export function assertFolderNamespace(records:any[],folders:string[]){
 if(!folders.length)return;
 const files=new Set(records.map(note=>notePath(note).toLowerCase()));
 for(const folder of folders){
  if(typeof folder!=='string')throw Error('Invalid folder data');
  let path=folder.toLowerCase();
  // Only a directory's own path or one of its parents can be a conflicting file.
  while(path){
   if(files.has(path))throw Error('File and folder paths collide');
   const separator=path.lastIndexOf('/');if(separator<0)break;
   path=path.slice(0,separator);
  }
 }
}
