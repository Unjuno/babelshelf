import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
const packages=new Map();
for(const [location,pin] of Object.entries(lock.packages)){
 if(!location||pin.dev||pin.optional)continue;
 const directory=path.join(root,location),metadata=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
 if(metadata.version!==pin.version)throw Error('License inventory version mismatch: '+location);
 const key=metadata.name+'@'+metadata.version;
 if(packages.has(key))continue;
 const notices=[];
 for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  if(entry.isFile()&&/^(licen[cs]e|copying|notice|third.?party)([.\-_]|$)/i.test(entry.name)){
   notices.push({name:entry.name,text:await readFile(path.join(directory,entry.name),'utf8')});
  }
 }
 const license=typeof metadata.license==='string'?metadata.license:metadata.license?.type??pin.license??'Not stated';
 packages.set(key,{name:metadata.name,version:metadata.version,license,notices});
}
const bundledNotices=(await readdir(path.join(root,'licenses'))).filter(name=>name.endsWith('.txt')).sort();
const output={schema:2,scope:'Installed non-optional production dependencies, including transitive packages. Not every package runs in the browser.',packages:[...packages.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.version.localeCompare(b.version)),bundledNotices};
const directory=path.join(root,'src/generated');await mkdir(directory,{recursive:true});
const target=path.join(directory,'package-notices.json'),content=JSON.stringify(output,null,2)+'\n';
// Keep Vite and source watchers quiet when the locked inventory is unchanged.
if(await readFile(target,'utf8').catch(()=>null)!==content)await writeFile(target,content);
console.log('License inventory: '+output.packages.length+' pinned packages');
