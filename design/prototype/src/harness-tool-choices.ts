import {validateCustomToolPackageSources} from './custom-tool-validation.ts';
import type {CustomToolSourceRecord} from './custom-tool-types.ts';
// @ts-expect-error Shared canonical record projection is JavaScript.
import {notePath} from '../../../dist/files.js';
// @ts-expect-error Shared canonical record projection is JavaScript.
import {latest} from '../../../dist/core.js';

const toolPath=/^Tools\/(user\.[a-z][a-z0-9-]{0,47})\/(SKILL\.md|tool\.js)$/;

/** Snapshot only active tool sources before inference; never copy ordinary knowledge. */
export function snapshotHarnessToolSources(records:readonly any[]){
 return records.filter(record=>record?.state==='active'&&toolPath.test(notePath(record))).map(record=>structuredClone(record));
}

/** Discover inert choices, not executable registrations or readiness claims. */
export function harnessToolChoices(records:readonly any[]=[]){
 const groups=new Map<string,CustomToolSourceRecord[]>();
 for(const record of records){
  if(record?.state!=='active')continue;
  const path=notePath(record),match=toolPath.exec(path);if(!match)continue;
  const sources=groups.get(match[1])??[];
  sources.push({path,body:latest(record).body});groups.set(match[1],sources);
 }
 const customTools:Array<{id:string;title:string;capabilities:readonly ('memory.search'|'memory.list'|'memory.read'|'math.calculate')[]}>=[],unavailableCustomTools:string[]=[];
 for(const [id,sources] of [...groups].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  try{
   const pkg=validateCustomToolPackageSources(sources);
   customTools.push({id:pkg.id,title:pkg.title,capabilities:[...pkg.capabilities]});
  }catch{unavailableCustomTools.push(id);}
 }
 return {customTools,unavailableCustomTools};
}
