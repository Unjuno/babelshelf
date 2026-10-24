import { settings } from './app-settings.ts';
export const MAX_FOLDER_DEPTH = settings.storage.maxFolderDepth;
function segment(value:string){const name=value.trim().normalize('NFC');if(!name||name==='.'||name==='..'||/[\\/:*?"<>|\u0000-\u001f]/.test(name)||/[. ]$/.test(name))throw Error('Enter a name without slashes');return name;}
function customToolSourcePath(path:string){return /^Tools\/user\.[a-z][a-z0-9-]{0,47}\/tool\.js$/.test(path);}
function folder(value:string){if(!value)return '';const parts=value.split('/').map(segment);if(parts.length>MAX_FOLDER_DEPTH)throw Error('Maximum 5 folder levels');return parts.join('/');}
function available(path:string,occupied:string[]){if(occupied.some(p=>p.toLowerCase()===path.toLowerCase()))throw Error('Name already exists');return path;}
export function folderPath(parent:string,name:string,occupied:string[]=[]){return available(folder([folder(parent),segment(name)].filter(Boolean).join('/')),occupied);}
export function validateFilePath(path:string){const parts=path.split('/');const name=segment(parts.pop()??'');const parent=folder(parts.join('/')),candidate=[parent,name].filter(Boolean).join('/');if(name.toLowerCase().endsWith('.md'))return candidate;if(customToolSourcePath(candidate))return candidate;throw Error('Use a .md file name; only Tools/user.<id>/tool.js is executable source');}
export function filePath(parent:string,name:string,occupied:string[]=[]){const clean=segment(name),base=folder(parent),candidate=[base,clean].filter(Boolean).join('/'),withExtension=clean.toLowerCase().endsWith('.md')||customToolSourcePath(candidate)?clean:clean+'.md';return available(validateFilePath([base,withExtension].filter(Boolean).join('/')),occupied);}
export function suggestedNoteName(body:string){
 const first=(body.split(/\r?\n/,1)[0]??'').replace(/[\\/:*?"<>|%\u0000-\u001f]/g,'-').trim().replace(/[. ]+$/g,'');
 if(!first)return 'Note';
 const max=80,points=Array.from(first);
 if(points.length<=max)return first;
 const prefix=points.slice(0,max).join(''),boundary=prefix.lastIndexOf(' ');
 return (boundary>=32?prefix.slice(0,boundary):prefix).replace(/[. ]+$/g,'')||'Note';
}

export const SYSTEM_FOLDERS:readonly string[]=settings.storage.protectedRoots;
export function isSystemFolder(path:string){return SYSTEM_FOLDERS.some(name=>name.toLowerCase()===path.toLowerCase());}
function memoryParent(path:string){const clean=folder(path);if(!SYSTEM_FOLDERS.includes(clean.split('/')[0]))throw Error('Choose a system folder');return clean;}
export function memoryFolderPath(parent:string,name:string,occupied:string[]=[]){return folderPath(memoryParent(parent),name,[...SYSTEM_FOLDERS,...occupied]);}
export function memoryFilePath(parent:string,name:string,occupied:string[]=[]){return filePath(memoryParent(parent),name,[...SYSTEM_FOLDERS,...occupied]);}
export function validateMemoryFilePath(path:string){const clean=validateFilePath(path);memoryParent(clean.split('/').slice(0,-1).join('/'));return clean;}
export function assertMutableFolder(path:string){if(!path||isSystemFolder(path))throw Error('System folder is protected');memoryParent(path);}
