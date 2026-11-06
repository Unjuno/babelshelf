export type ToolInputField={type:'string'|'number'|'integer'|'boolean';description?:string;minLength?:number;maxLength?:number;minimum?:number;maximum?:number};
export type ToolInputSchema={type:'object';required:string[];additionalProperties:false;properties:Record<string,ToolInputField>};

/** Validate arguments against an already validated, closed package contract. */
export function validateToolArguments(schema:ToolInputSchema,value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Tool arguments must be an object');
 const input=value as Record<string,unknown>,keys=Object.keys(input),allowed=Object.keys(schema.properties);
 if(keys.some(key=>!allowed.includes(key))||schema.required.some(key=>!Object.hasOwn(input,key)))throw Error('Tool arguments do not match the declared schema');
 for(const [key,field] of Object.entries(schema.properties)){
  if(!field||typeof field!=='object'||typeof field.type!=='string'||!['string','number','integer','boolean'].includes(field.type))throw Error('Invalid tool input schema');
  if(!Object.hasOwn(input,key))continue;
  const item=input[key];
  if(field.type==='string'&&(typeof item!=='string'||field.minLength!==undefined&&item.length<field.minLength||field.maxLength!==undefined&&item.length>field.maxLength)||field.type==='number'&&(typeof item!=='number'||!Number.isFinite(item)||field.minimum!==undefined&&item<field.minimum||field.maximum!==undefined&&item>field.maximum)||field.type==='integer'&&(typeof item!=='number'||!Number.isSafeInteger(item)||field.minimum!==undefined&&item<field.minimum||field.maximum!==undefined&&item>field.maximum)||field.type==='boolean'&&typeof item!=='boolean')throw Error(`Tool argument ${key} is invalid`);
 }
 return structuredClone(input);
}
