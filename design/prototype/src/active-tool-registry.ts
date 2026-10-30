import {MAX_CONFIGURED_AGENT_TOOLS,SAFE_AGENT_TOOL_IDS} from './agent-loop.ts';
import {createToolRegistry} from './tools/tool-registry.ts';
import type {CustomToolPackage} from './custom-tool-types.ts';
import type {ToolPackage} from './tools/tool-registry.ts';

export type ToolSourceRecord={path:string;body:string};
const customEntry=/^Tools\/(user\.[a-z][a-z0-9-]{0,47})\/(SKILL\.md|tool\.js)$/;

/** Build one explicit profile's registry from protected app modules and paired Memory files. */
export async function buildActiveToolRegistry(records:readonly ToolSourceRecord[],enabledIds:readonly string[],builtinPackages:readonly ToolPackage[]=[],register?:(pkg:CustomToolPackage)=>Promise<ToolPackage>){
 if(!Array.isArray(records)||!Array.isArray(enabledIds)||enabledIds.length>MAX_CONFIGURED_AGENT_TOOLS||new Set(enabledIds).size!==enabledIds.length||enabledIds.some(id=>typeof id!=='string'||(!SAFE_AGENT_TOOL_IDS.includes(id as typeof SAFE_AGENT_TOOL_IDS[number])&&!/^user\.[a-z][a-z0-9-]{0,47}$/.test(id))))throw Error('Invalid active tool selection');
 const chosen=enabledIds.filter(id=>id.startsWith('user.'));
 const chosenIds=new Set(chosen);
 const grouped=new Map<string,Map<string,string>>();
 for(const record of records){
  const match=record&&typeof record.path==='string'?customEntry.exec(record.path):null;if(!match||!chosenIds.has(match[1]))continue;
  if(typeof record.body!=='string')throw Error('Invalid custom tool source');
  const group=grouped.get(match[1])??new Map<string,string>();if(group.has(match[2]))throw Error('Duplicate custom tool source');group.set(match[2],record.body);grouped.set(match[1],group);
 }
 const packages:ToolPackage[]=[...builtinPackages];
 const customPackageModule=chosen.length?await import('./custom-tool-package.ts'):undefined;
 const customRegistrationModule=chosen.length&&!register?await import('./custom-tool-adapter.ts'):undefined;
 for(const id of chosen){
  const source=grouped.get(id);if(!source?.has('SKILL.md')||!source.has('tool.js'))throw Error(`Custom tool package is incomplete: ${id}`);
  const pkg:CustomToolPackage=await customPackageModule!.inspectCustomToolPackage([{path:`Tools/${id}/SKILL.md`,body:source.get('SKILL.md')!},{path:`Tools/${id}/tool.js`,body:source.get('tool.js')!}]);
  packages.push(await (register??customRegistrationModule!.customToolRegistration)(pkg));
 }
 const registry=createToolRegistry(packages),available=new Set(registry.capabilities().map(tool=>tool.id));
 if(enabledIds.some(id=>!available.has(id)))throw Error('Selected tool is not registered');
 return Object.freeze({registry,capabilities:Object.freeze(registry.capabilities().filter(tool=>enabledIds.includes(tool.id)))});
}
