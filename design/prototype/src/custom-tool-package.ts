import {validateCustomToolPackageSources} from './custom-tool-validation.ts';
import type {CustomToolCapability,CustomToolPackage,CustomToolSourceRecord} from './custom-tool-types.ts';
export {validateCustomToolPackageSources} from './custom-tool-validation.ts';
export type {CustomInputField,CustomInputSchema,CustomToolPackage,CustomToolSourceRecord} from './custom-tool-types.ts';

const utf8=new TextEncoder();
const byteLength=(value:string)=>utf8.encode(value).byteLength;
const safeText=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&byteLength(value)<=max;
export const CUSTOM_TOOL_STARTER_CODE='({ input }) => ({ value: input.query })';
export const CUSTOM_TOOL_STARTER_INPUT_SCHEMA={type:'object',required:['query'],additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:2000}}};

/** Creates an inert package pair; the caller owns persistence and profile activation. */
export function createCustomToolPackageFiles(input:{id:string;title:string;instructions:string;code:string;capabilities:readonly CustomToolCapability[];inputSchema?:unknown}):CustomToolSourceRecord[]{
 if(!input||typeof input.id!=='string'||!/^user\.[a-z][a-z0-9-]{0,47}$/.test(input.id)||!safeText(input.title,120)||!safeText(input.instructions,8000)||typeof input.code!=='string'||!input.code.trim()||byteLength(input.code)>32_000||!Array.isArray(input.capabilities)||input.capabilities.length>4||input.capabilities.some(value=>value!=='memory.search'&&value!=='memory.list'&&value!=='memory.read'&&value!=='math.calculate')||new Set(input.capabilities).size!==input.capabilities.length)throw Error('Invalid tool package draft');
 const metadata={id:input.id,version:1,title:input.title.trim(),inputSchema:input.inputSchema??CUSTOM_TOOL_STARTER_INPUT_SCHEMA,capabilities:[...input.capabilities].sort()};
 const records=[{path:`Tools/${input.id}/SKILL.md`,body:`---\n${JSON.stringify(metadata)}\n---\n\n${input.instructions.trim()}\n`},{path:`Tools/${input.id}/tool.js`,body:input.code.trim()}];
 validateCustomToolPackageSources(records);
 return records;
}

/** Inspects user code as data only. This function never parses or evaluates JavaScript. */
export async function inspectCustomToolPackage(records:CustomToolSourceRecord[]):Promise<CustomToolPackage>{
 const checked=validateCustomToolPackageSources(records),{id,version,title,entry,capabilities,inputSchema,skill,skillSource,code}=checked;
 const envelope=JSON.stringify({schema:1,id,version,title,entry,capabilities:[...capabilities].sort(),inputSchema,skill:skillSource,code});
 const digest=await crypto.subtle.digest('SHA-256',utf8.encode(envelope)),sha256=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
 return Object.freeze({...checked,sha256});
}

/** Inspects a selected local SKILL.md/tool.js pair as data and assigns its protected Memory paths. */
export async function inspectImportedCustomToolFiles(files:readonly {name:string;body:string}[]):Promise<CustomToolPackage&{files:CustomToolSourceRecord[]}>{
 if(!Array.isArray(files)||files.length!==2||files.some(file=>!file||typeof file.name!=='string'||typeof file.body!=='string'))throw Error('Select exactly two tool files');
 const skills=files.filter(file=>file.name==='SKILL.md'),entries=files.filter(file=>file.name==='tool.js');
 if(skills.length!==1||entries.length!==1)throw Error('A tool package needs one SKILL.md and one tool.js');
 if(byteLength(skills[0].body)>12_000||byteLength(entries[0].body)>32_000)throw Error('Tool package source too large');
 const header=/^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(skills[0].body);
 if(!header)throw Error('Invalid tool package metadata');
 let metadata:unknown;try{metadata=JSON.parse(header[1]);}catch{throw Error('Invalid tool package metadata');}
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||typeof (metadata as Record<string,unknown>).id!=='string'||!/^user\.[a-z][a-z0-9-]{0,47}$/.test((metadata as Record<string,string>).id))throw Error('Invalid tool package metadata');
 const records=[{path:`Tools/${(metadata as Record<string,string>).id}/SKILL.md`,body:skills[0].body},{path:`Tools/${(metadata as Record<string,string>).id}/tool.js`,body:entries[0].body}];
 const inspected=await inspectCustomToolPackage(records);
 return Object.freeze({...inspected,files:Object.freeze(records.map(record=>Object.freeze({...record}))) as unknown as CustomToolSourceRecord[]});
}
