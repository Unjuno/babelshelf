export type FontFormat='woff2'|'woff'|'ttf'|'otf';
export type LocalFontFile={id:string;label:string;format:FontFormat;bytes:number;sha256:string};
type FontIo={directory:()=>Promise<FileSystemDirectoryHandle>};
const MAX_BYTES=20*1024*1024;
const defaultIo:FontIo={directory:async()=>await(await navigator.storage.getDirectory()).getDirectoryHandle('babelshelf-local-fonts-v1',{create:true})};

function formatFromBytes(bytes:Uint8Array):FontFormat{
 const tag=String.fromCharCode(...bytes.subarray(0,4));
 if(tag==='wOF2')return 'woff2';
 if(tag==='wOFF')return 'woff';
 if(tag==='OTTO')return 'otf';
 if(bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0)return 'ttf';
 throw Error('Unsupported font file');
}
function labelFromName(name:string){return name.replace(/\.[^.]+$/,'').replace(/[\u0000-\u001f<>"'`]/g,' ').replace(/\s+/g,' ').trim().slice(0,128)||'Local font';}
async function sha256(file:Blob){const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export function createLocalFontStore(io:FontIo=defaultIo){
 return {
  async import(file:File){
   if(!(file instanceof Blob)||file.size<4||file.size>MAX_BYTES)throw Error('Font must be 4 bytes to 20 MB');
   const bytes=new Uint8Array(await file.slice(0,4).arrayBuffer()),format=formatFromBytes(bytes),hash=await sha256(file),id='font-'+hash;
   const dir=await io.directory(),handle=await dir.getFileHandle(hash,{create:true}),writer=await handle.createWritable();
   try{await file.stream().pipeTo(writer);}catch(error){await writer.abort().catch(()=>{});throw error;}
   const stored=await(await dir.getFileHandle(hash)).getFile();
   if(stored.size!==file.size||await sha256(stored)!==hash){await dir.removeEntry(hash).catch(()=>{});throw Error('Font verification failed');}
   return {id,label:labelFromName(file.name),format,bytes:file.size,sha256:hash} satisfies LocalFontFile;
  },
  async read(font:LocalFontFile){
   if(!/^font-[a-f0-9]{64}$/.test(font.id)||font.sha256!==font.id.slice(5))throw Error('Invalid font reference');
   const dir=await io.directory(),file=await(await dir.getFileHandle(font.sha256)).getFile();
   if(file.size!==font.bytes||await sha256(file)!==font.sha256)throw Error('Font verification failed');
   return file.arrayBuffer();
  },
  async remove(font:LocalFontFile){
   if(!/^font-[a-f0-9]{64}$/.test(font.id)||font.sha256!==font.id.slice(5))throw Error('Invalid font reference');
   await(await io.directory()).removeEntry(font.sha256);
  },
 };
}
export const localFontStore=createLocalFontStore();

export function applyLocalFont(font:LocalFontFile|undefined,bytes?:ArrayBuffer){
 const key='babelshelf-'+(font?.sha256??'system');
 const root=document.documentElement;
 for(const existing of [...document.fonts])if(existing.family.startsWith('babelshelf-'))document.fonts.delete(existing);
 if(font&&bytes){const face=new FontFace(key,bytes);document.fonts.add(face);void face.load().catch(()=>document.fonts.delete(face));}
 root.style.setProperty('--app-font-family',font?`"${key}", Inter, ui-sans-serif, system-ui, sans-serif`:'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
}
