import path from 'node:path';

/** Prevent a pinned upstream runtime without a redistribution grant entering the shipped PWA asset list. */
export function assertPinnedRuntimeExcluded(manifest,files){
 const runtime=manifest?.runtime,file=runtime?.file,revision=runtime?.revision;
 if(!file||typeof file.url!=='string'||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256)||typeof revision!=='string'||!/^[a-f0-9]{40}$/.test(revision)||!Array.isArray(files))throw Error('Pinned runtime pin is unavailable');
 let filename;
 try{
  const url=new URL(file.url);
  if(url.protocol!=='https:'||!url.pathname.includes(`/resolve/${revision}/`))throw Error();
  filename=path.posix.basename(decodeURIComponent(url.pathname));
  if(!filename||filename==='.'||filename==='/')throw Error();
 }catch{throw Error('Pinned runtime pin is unavailable');}
 for(const asset of files){
  if(!asset||typeof asset.path!=='string'||typeof asset.sha256!=='string')throw Error('Invalid product asset manifest');
  const emittedName=path.posix.basename(asset.path.replaceAll('\\','/'));
  if(asset.sha256===file.sha256||emittedName===filename)throw Error(`Pinned runtime redistribution blocked: ${filename}`);
 }
}
