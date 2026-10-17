import type {ToolHost} from './tool-host.ts';
export type PackageDefinition={id:string;version:number;readOnly:boolean;network:string};
export type PackageSource={path:string;body:string};
export type ToolPackage={definition:PackageDefinition;entry:string;sources:PackageSource[];run:(args:unknown,host:ToolHost)=>Promise<any[]>};
export type PackageIdentity={package:string;packageVersion:number;packageSha256:string;entry:string};
export function createToolRegistry(packages:ToolPackage[]){
 const registry=new Map<string,ToolPackage>();
 for(const candidate of packages){
  const d=candidate.definition;
  if(!d||typeof d.id!=='string'||!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(d.id)||!Number.isSafeInteger(d.version)||d.version<1||d.readOnly!==true||d.network!=='none'||typeof candidate.run!=='function'||registry.has(d.id))throw Error('Invalid bundled tool registration');
  if(!Array.isArray(candidate.sources)||candidate.sources.length<2||candidate.sources.length>32)throw Error('Invalid tool sources');
  const paths=new Set<string>();
  for(const s of candidate.sources){if(!s||typeof s.path!=='string'||s.path.length>200||!/^Tools\/(?:[a-z][a-z0-9.-]*\/)?(?:SKILL\.md|[a-z][a-z0-9-]*\.ts)$/.test(s.path)||s.path.split('/').some(p=>p==='.'||p==='..')||typeof s.body!=='string'||s.body.length>100000||paths.has(s.path))throw Error('Invalid tool sources');paths.add(s.path);}
  if(candidate.entry!=='Tools/'+d.id+'/tool.ts'||!paths.has(candidate.entry)||!paths.has('Tools/'+d.id+'/SKILL.md'))throw Error('Tool entry or skill unavailable');
  const frozen=Object.freeze({definition:Object.freeze({...d}),entry:candidate.entry,sources:Object.freeze(candidate.sources.map(s=>Object.freeze({...s}))),run:candidate.run});
  registry.set(d.id,frozen as unknown as ToolPackage);
 }
 const get=(id:string)=>{const pkg=registry.get(id);if(!pkg)throw Error('Tool not registered');return pkg;};
 async function identity(id:string):Promise<PackageIdentity>{
  const pkg=get(id),text=JSON.stringify({id:pkg.definition.id,version:pkg.definition.version,entry:pkg.entry,sources:[...pkg.sources].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)});
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return {package:pkg.definition.id,packageVersion:pkg.definition.version,packageSha256:[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),entry:pkg.entry};
 }
 return Object.freeze({identity,async run(id:string,args:unknown,host:ToolHost){host.check();const result=await get(id).run(args,host);host.check();return result;}});
}
