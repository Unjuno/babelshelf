import {createStructuredSchema} from './structured-grammar.ts';
import type {GenerationFormat} from './text-inference.ts';

// Compact transport hint, derived from the authoritative scoped schema. Cross-field
// semantic validation, authorization and reviewed writes remain in the harness.
export function nativeOutputRequest(messages:any[],format?:GenerationFormat){
 if(!format||format==='prose')return {messages};
 const schema:any=createStructuredSchema(format),branches:any[]=schema.anyOf??[schema];
 const properties:Record<string,any>={};
 for(const key of new Set<string>(branches.flatMap(b=>Object.keys(b.properties)))){
  const rules=branches.map(b=>b.properties[key]).filter(Boolean),type=rules[0].type;
  if(rules.some(r=>r.type!==type))throw Error('Inconsistent native response schema');
  const rule:any={type};
  if(rules.every(r=>Array.isArray(r.enum)))rule.enum=[...new Set(rules.flatMap(r=>r.enum))];
  else if(type==='integer'){
   const lower=rules.map(r=>r.minimum??(r.enum?Math.min(...r.enum):undefined)),upper=rules.map(r=>r.maximum??(r.enum?Math.max(...r.enum):undefined));
   if(lower.every(Number.isSafeInteger))rule.minimum=Math.min(...lower);
   if(upper.every(Number.isSafeInteger))rule.maximum=Math.max(...upper);
  }
  properties[key]=rule;
 }
 const required=branches[0].required.filter((key:string)=>branches.every(b=>b.required.includes(key)));
 const name=(typeof format==='string'?format:format.type)==='dialogue-answer'?'babelshelf_answer':'babelshelf_plan';
 const copy=structuredClone(messages),instruction=`Submit the required JSON object once as arguments to the ${name} tool instead of writing JSON in assistant text. All original scope and authorization rules still apply.`;
 const system=copy.find(m=>m.role==='system'&&typeof m.content==='string');
 if(system)system.content+='\n'+instruction;else copy.unshift({role:'system',content:instruction});
 return {messages:copy,responseTool:{name,parameters:{type:'object',properties,required,additionalProperties:false}}};
}
