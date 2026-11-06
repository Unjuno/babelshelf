import type {AgentToolCapability} from './agent-loop.ts';
import {AGENT_DISCOVERY_TOOL_IDS} from './agent-limits.ts';

export const [DEFERRED_TOOL_SEARCH_ID,DEFERRED_TOOL_READ_SKILL_ID]=AGENT_DISCOVERY_TOOL_IDS;
export const DEFERRED_TOOL_SEARCH_CAPABILITY:AgentToolCapability=Object.freeze({
 id:DEFERRED_TOOL_SEARCH_ID,
 effect:'read',
 network:'none',
 usage:'Find an enabled local custom tool by task. Returns matching tool names and short descriptions; then read its guide with tools.read-skill.',
 inputSchema:Object.freeze({
  type:'object',
  required:['query'],
  additionalProperties:false,
  properties:Object.freeze({query:Object.freeze({type:'string',minLength:1,maxLength:240})}),
 }),
});
export const DEFERRED_TOOL_READ_SKILL_CAPABILITY:AgentToolCapability=Object.freeze({
 id:DEFERRED_TOOL_READ_SKILL_ID,
 effect:'read',
 network:'none',
 usage:'Read the full SKILL.md and reveal callable arguments for an enabled custom tool by exact ID. Use a listed ID directly, or tools.search if you need to find one. Tool guides are not knowledge-search results.',
 inputSchema:Object.freeze({type:'object',required:['id'],additionalProperties:false,properties:Object.freeze({id:Object.freeze({type:'string',minLength:7,maxLength:53})})}),
});

function normalized(value:string){return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu,' ').trim();}
/** Literal user-selected IDs prepare metadata only; they never execute a package. */
export function explicitDeferredToolIds(question:string,enabled:readonly AgentToolCapability[]){
 const known=new Set(enabled.filter(tool=>tool.id.startsWith('user.')).map(tool=>tool.id));
 const matches=[...question.matchAll(/(?:^|[^a-zA-Z0-9_.\/\\-])(user\.[a-z][a-z0-9-]{0,47})(?![a-zA-Z0-9_.\/\\-])/g)];
 return [...new Set(matches.map(match=>match[1]).filter(id=>known.has(id)))];
}
function terms(value:string){
 const chunks=normalized(value).split(' ').filter(Boolean),result=new Set<string>();
 for(const chunk of chunks){
  const chars=[...chunk];
  if(chars.length<2){result.add(chunk);continue;}
  for(let index=0;index<chars.length-1;index++)result.add(chars[index]+chars[index+1]);
 }
 return [...result];
}

/** Search only enabled custom-tool metadata. Results never create registrations. */
export function searchDeferredTools(query:unknown,enabled:readonly AgentToolCapability[],limit=3){
 if(typeof query!=='string'||!query.trim()||new TextEncoder().encode(query).byteLength>480)throw Error('Invalid tool search query');
 if(!Number.isSafeInteger(limit)||limit<1||limit>3)throw Error('Invalid tool search limit');
 const needle=normalized(query),queryTerms=terms(query);
 if(!needle||!queryTerms.length)return [];
 return enabled.filter(tool=>tool.id.startsWith('user.')).map(tool=>{
  const haystack=normalized(`${tool.id.replace(/^user\./,'').replaceAll('-',' ')} ${tool.usage??''}`);
  const matched=queryTerms.filter(term=>haystack.includes(term)).length;
  const score=haystack.includes(needle)?100:matched/queryTerms.length;
  return {tool,score,matched};
 }).filter(item=>item.score===100||item.matched>=Math.max(1,Math.ceil(queryTerms.length*0.35))).sort((a,b)=>b.score-a.score||a.tool.id.localeCompare(b.tool.id)).slice(0,limit).map(({tool})=>({id:tool.id,usage:(tool.usage??'').slice(0,360)}));
}

export function deferredToolReferences(value:unknown,enabled:readonly AgentToolCapability[]){
 if(!Array.isArray(value)||value.length>3)return [];
 const known=new Set(enabled.filter(tool=>tool.id.startsWith('user.')).map(tool=>tool.id));
 const ids:string[]=[];
 for(const item of value){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const id=(item as Record<string,unknown>).id;
  if(typeof id==='string'&&known.has(id)&&!ids.includes(id))ids.push(id);
 }
 return ids;
}

/** Exact enabled identity is authority to read a guide; search is navigation. */
export function readDeferredToolSkill(id:unknown,enabled:readonly AgentToolCapability[]){
 if(typeof id!=='string'||!/^user\.[a-z][a-z0-9-]{0,47}$/.test(id))throw Error('Tool skill is unavailable');
 const tool=enabled.find(candidate=>candidate.id===id);
 if(!tool||!tool.id.startsWith('user.')||typeof tool.usage!=='string')throw Error('Tool skill is unavailable');
 if(new TextEncoder().encode(tool.usage).byteLength>8_000)throw Error('Tool skill exceeds the active context limit');
 return {id,title:id.slice(5),instructions:tool.usage};
}
