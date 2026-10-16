export type MemoryScope = 'home' | 'root' | 'folder';
export const USER_ROOTS = Object.freeze([
 {path:'Inbox',label:'Inbox'}, {path:'Notes',label:'Notes'}, {path:'Attachments',label:'Files'},
]);
export function memoryBreadcrumbs(scope:MemoryScope,path=''){
 const crumbs:{label:string;scope:MemoryScope;path:string}[]=[{label:'Memory',scope:'root',path:''}];
 if(scope==='root')return crumbs;
 const parts=path.split('/').filter(Boolean),userRoot=USER_ROOTS.find(root=>root.path===parts[0]);
 if(scope==='home'||userRoot)crumbs.push({label:'Home',scope:'home',path:''});
 if(scope==='folder')parts.forEach((part,i)=>crumbs.push({label:i===0&&userRoot?userRoot.label:part,scope:'folder',path:parts.slice(0,i+1).join('/')}));
 return crumbs;
}
export function memoryFolderEntries(scope:MemoryScope,path:string,folders:string[]){
 if(scope==='home')return USER_ROOTS.map(root=>({...root,scope:'folder' as MemoryScope}));
 if(scope==='root')return [{label:'Home',path:'',scope:'home' as MemoryScope},...folders.filter(p=>!p.includes('/')&&!USER_ROOTS.some(r=>r.path===p)).map(p=>({label:p,path:p,scope:'folder' as MemoryScope}))];
 return folders.filter(p=>p.split('/').slice(0,-1).join('/')===path).map(p=>({label:p.split('/').at(-1)!,path:p,scope:'folder' as MemoryScope}));
}
export function memoryCreationFolder(scope:MemoryScope,path:string,kind:'file'|'folder'){
 return scope==='folder'?path:kind==='file'?'Inbox':'Notes';
}
