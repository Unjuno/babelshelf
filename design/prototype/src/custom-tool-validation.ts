import type {CustomInputField,CustomInputSchema,CustomToolCapability,CustomToolPackage,CustomToolSourceRecord} from './custom-tool-types.ts';

const utf8=new TextEncoder();
const byteLength=(value:string)=>utf8.encode(value).byteLength;
const exactKeys=(value:Record<string,unknown>,allowed:string[])=>Object.keys(value).every(key=>allowed.includes(key));
const safeText=(value:unknown,max:number)=>typeof value==='string'&&value.trim().length>0&&byteLength(value)<=max;

export function validateCustomToolInputSchema(value:unknown):CustomInputSchema{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid tool input schema');
 const schema=value as Record<string,unknown>;
 if(!exactKeys(schema,['type','required','additionalProperties','properties'])||schema.type!=='object'||schema.additionalProperties!==false||!Array.isArray(schema.required)||!schema.properties||typeof schema.properties!=='object'||Array.isArray(schema.properties))throw Error('Invalid tool input schema');
 const properties=schema.properties as Record<string,unknown>,names=Object.keys(properties);
 if(names.length<1||names.length>8||names.some(name=>!/^[a-z][a-zA-Z0-9_]{0,31}$/.test(name))||schema.required.length>names.length||new Set(schema.required).size!==schema.required.length||schema.required.some(name=>typeof name!=='string'||!names.includes(name)))throw Error('Invalid tool input schema');
 const validated:Record<string,CustomInputField>={};
 for(const [name,raw] of Object.entries(properties)){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid tool input schema');
  const field=raw as Record<string,unknown>,type=field.type;
  if(!['string','number','integer','boolean'].includes(String(type))||!exactKeys(field,['type','description','minLength','maxLength','minimum','maximum']))throw Error('Unsupported tool input field');
  if(field.description!==undefined&&!safeText(field.description,240))throw Error('Invalid tool input field');
  if(type!=='string'&&(field.minLength!==undefined||field.maxLength!==undefined)||type==='string'&&(field.minimum!==undefined||field.maximum!==undefined)||type==='boolean'&&(field.minLength!==undefined||field.maxLength!==undefined||field.minimum!==undefined||field.maximum!==undefined))throw Error('Invalid tool input field');
  if(field.minLength!==undefined&&(!Number.isSafeInteger(field.minLength)||Number(field.minLength)<0)||field.maxLength!==undefined&&(!Number.isSafeInteger(field.maxLength)||Number(field.maxLength)<1||Number(field.maxLength)>2000)||field.minLength!==undefined&&field.maxLength!==undefined&&Number(field.minLength)>Number(field.maxLength))throw Error('Invalid tool input field bounds');
  if(field.minimum!==undefined&&!Number.isFinite(field.minimum)||field.maximum!==undefined&&!Number.isFinite(field.maximum)||field.minimum!==undefined&&field.maximum!==undefined&&Number(field.minimum)>Number(field.maximum))throw Error('Invalid tool input field bounds');
  validated[name]=Object.freeze({...field}) as CustomInputField;
 }
 return Object.freeze({type:'object',required:Object.freeze([...schema.required]) as unknown as string[],additionalProperties:false,properties:Object.freeze(validated)});
}

function metadataFrom(skillFile:CustomToolSourceRecord){
 const match=/^---\r?\n([\s\S]*?)\r?\n---\r?\n+([\s\S]+)$/.exec(skillFile.body);
 if(!match||!safeText(match[2],8000))throw Error('Tool SKILL.md must include JSON metadata and usage instructions');
 let metadata:unknown;try{metadata=JSON.parse(match[1]);}catch{throw Error('Invalid tool package metadata');}
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))throw Error('Invalid tool package metadata');
 const record=metadata as Record<string,unknown>;
 if(!exactKeys(record,['id','version','title','inputSchema','capabilities'])||typeof record.id!=='string'||!/^user\.[a-z][a-z0-9-]{0,47}$/.test(record.id)||!Number.isSafeInteger(record.version)||Number(record.version)<1||!safeText(record.title,120)||!Array.isArray(record.capabilities)||record.capabilities.length>3||record.capabilities.some(capability=>!['memory.search','memory.read','math.calculate'].includes(String(capability)))||new Set(record.capabilities).size!==record.capabilities.length)throw Error('Invalid tool package metadata');
 return {id:record.id,version:Number(record.version),title:record.title as string,inputSchema:validateCustomToolInputSchema(record.inputSchema),capabilities:[...record.capabilities].sort() as CustomToolCapability[] ,instructions:match[2]};
}

/** Performs bounded structural checks without executing or hashing source. Safe inside a storage transaction. */
export function validateCustomToolPackageSources(records:CustomToolSourceRecord[]):Omit<CustomToolPackage,'sha256'>{
 if(!Array.isArray(records)||records.length!==2||records.some(record=>!record||typeof record.path!=='string'||typeof record.body!=='string'))throw Error('A tool package needs one SKILL.md and one tool.js');
 const skills=records.filter(record=>record.path.endsWith('/SKILL.md')),entries=records.filter(record=>record.path.endsWith('/tool.js'));
 if(skills.length!==1||entries.length!==1||new Set(records.map(record=>record.path)).size!==2)throw Error('A tool package needs one SKILL.md and one tool.js');
 const skillFile=skills[0],entryFile=entries[0];
 if(byteLength(skillFile.body)>12_000||byteLength(entryFile.body)>32_000)throw Error('Tool package source too large');
 const metadata=metadataFrom(skillFile),directory=`Tools/${metadata.id}`;
 if(skillFile.path!==`${directory}/SKILL.md`||entryFile.path!==`${directory}/tool.js`)throw Error('Tool package paths do not match its ID');
 if(!safeText(entryFile.body,32_000))throw Error('Tool code is empty or too large');
 return {id:metadata.id,version:metadata.version,title:metadata.title,entry:entryFile.path,capabilities:Object.freeze(metadata.capabilities),inputSchema:metadata.inputSchema,skill:metadata.instructions,skillSource:skillFile.body,code:entryFile.body};
}
