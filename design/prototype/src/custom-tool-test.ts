import {inspectCustomToolPackage} from './custom-tool-package.ts';
import {customToolRegistration,validateCustomToolArguments} from './custom-tool-adapter.ts';
import type {ToolHost} from './tools/tool-host.ts';

export type ToolTestSource={id:string;path:string;version:number;body:string};
export function toolTestSources(records:readonly ToolTestSource[],id:string):ToolTestSource[]{
 if(!/^user\.[a-z][a-z0-9-]{0,47}$/.test(id))throw Error('Invalid tool ID');
 return records.filter(record=>record.path===`Tools/${id}/SKILL.md`||record.path===`Tools/${id}/tool.js`).map(({id,path,version,body})=>({id,path,version,body})).sort((a,b)=>a.path.localeCompare(b.path));
}

/** A deliberate read-only trial; never registers a profile, saves a receipt or writes Memory. */
export async function testCustomTool(options:{sources:ToolTestSource[];input:string;loadSources:()=>Promise<ToolTestSource[]>;ensureRuntime:()=>Promise<void>;host:ToolHost}){
 const sources=structuredClone(options.sources),check=()=>options.host.check();check();
 const pkg=await inspectCustomToolPackage(sources);check();
 if(new TextEncoder().encode(options.input).byteLength>8000)throw Error('Test input exceeds its size limit');
 let value:unknown;try{value=JSON.parse(options.input);}catch{throw Error('Enter valid JSON input');}
 const input=validateCustomToolArguments(pkg,value);
 const unchanged=async()=>{check();const current=toolTestSources(await options.loadSources(),pkg.id);check();if(JSON.stringify(current)!==JSON.stringify(toolTestSources(sources,pkg.id)))throw Error('Tool files changed · close and reopen the test');};
 await unchanged();await options.ensureRuntime();check();await unchanged();
 const tool=await customToolRegistration(pkg);check();
 const result=await tool.run(input,options.host);check();await unchanged();
 return {packageSha256:pkg.sha256,value:result};
}
