// IndexedDB is canonical. These paths are a faithful projection, not OPFS files.
export function normalizePath(path){
 if(typeof path!=='string'||path.length>500||path!==path.trim()||/[\\\u0000-\u001f\u007f:*?"<>|%]/.test(path))throw Error('Invalid Markdown path');
 const parts=path.normalize('NFC').split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||!path.endsWith('.md'))throw Error('Invalid Markdown path');
 return parts.join('/');
}
export function defaultPath(title,id){const name=title.normalize('NFC').replace(/[\\/:*?"<>|%\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').trim().slice(0,60)||'Untitled';return normalizePath('inbox/'+name+'-'+id+'.md');}
export function notePath(note,version){const v=version===undefined?note.revisions.at(-1):note.revisions.find(v=>v.version===version);if(!v)throw Error('Version unavailable');return v.path??defaultPath(note.revisions[0].title,note.id);}
export function assertPaths(notes){const seen=new Set(),paths=notes.map(n=>notePath(n).toLowerCase());for(const path of paths){if(seen.has(path))throw Error('Markdown path conflict');seen.add(path);}for(const path of paths){const parts=path.split('/');parts.pop();while(parts.length){if(seen.has(parts.join('/')))throw Error('Markdown path conflict');parts.pop();}}}
export function buildFileTree(notes){assertPaths(notes);const root={name:'',type:'folder',children:[]};for(const n of notes){let node=root;const parts=notePath(n).split('/');for(const [i,name]of parts.entries()){let child=node.children.find(c=>c.name===name);if(!child){child=i===parts.length-1?{name,type:'file',noteId:n.id}:{name,type:'folder',children:[]};node.children.push(child);}node=child;}}const sort=n=>{n.children?.sort((a,b)=>a.type===b.type?a.name.localeCompare(b.name):a.type==='folder'?-1:1);n.children?.forEach(sort);};sort(root);return root;}
export function markdownFile(note,version){const v=version===undefined?note.revisions.at(-1):note.revisions.find(v=>v.version===version);return '---\nbabelshelf: '+JSON.stringify({id:note.id,version:v.version,path:notePath(note,v.version),state:note.state,kind:note.kind,sources:note.sources})+'\n---\n'+v.body;}
