import {createStructuredSchema} from './structured-grammar.ts';
import type {GenerationFormat} from './text-inference.ts';
import {HARNESS_ACTIONS,plannerRoutingInstruction} from './harness-actions.ts';
// @ts-expect-error Shared browser transport is a plain JavaScript module.
import {nativeActionBinding} from '../../../dist/native-response.js';

// Compact transport hint, derived from the authoritative scoped schema. Cross-field
// semantic validation, authorization and reviewed writes remain in the harness.
function compact(branches:any[],omit:string[]=[]){
 const properties:Record<string,any>={};
 for(const key of new Set<string>(branches.flatMap(b=>Object.keys(b.properties)))){
  if(omit.includes(key))continue;
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
 const required=branches[0].required.filter((key:string)=>!omit.includes(key)&&branches.every(b=>b.required.includes(key)));
 return {type:'object',properties,required,additionalProperties:false};
}
function nativePurpose(name:string){
 const binding=nativeActionBinding(name),action=HARNESS_ACTIONS.find(action=>action.id===binding.action);
 if(!action)throw Error('Unknown native action purpose');
 if(action.id!=='capture')return action.purpose;
 if(!binding.target)return action.purpose+' from new content only, never existing dialogue';
 if(binding.target==='history')return 'Propose saving ONE earlier '+binding.historyPart+' message by historyIndex using original bytes';
 return binding.target==='current'?'Propose saving the latest assistant result using original bytes':'Propose saving current attachments using original bytes';
}
export function nativeOutputRequest(messages:any[],format?:GenerationFormat){
 if(!format||format==='prose')return {messages};
 const schema:any=createStructuredSchema(format),branches:any[]=schema.anyOf??[schema],parameters=compact(branches);
 const groups=new Map<string,any[]>();
 if(schema.anyOf)for(const branch of branches){
  let name=branch.properties.action.enum[0];
  if(name==='tool-create')name='toolcreate';
  if(name==='capture'){
   const target=branch.properties.target?.enum?.[0],part=branch.properties.historyPart?.enum?.[0];
   name=target===undefined?'capturetext':target==='current'?'capturecurrent':target==='inputs'?'captureinputs':target==='history'&&part==='assistant'?'captureassistant':target==='history'&&part==='user'?'captureuser':undefined;
   if(!name)throw Error('Unsupported native capture scope');
  }
  const group=groups.get(name)??[];group.push(branch);groups.set(name,group);
 }
 const actions=schema.anyOf?Object.fromEntries([...groups].map(([name,group])=>[name,compact(group,Object.keys(nativeActionBinding(name)))])):undefined;
 const name=(typeof format==='string'?format:format.type)==='dialogue-answer'?'babelshelf_answer':'babelshelf_plan';
 const purposes=actions?Object.keys(actions).map(id=>({id,purpose:nativePurpose(id)})):undefined;
 const copy=structuredClone(messages),instruction=actions?'Call exactly one offered function with only its argument fields and no assistant text. Original selectors reuse stored bytes, never supply a body. All original scope and authorization rules still apply.':`Submit the required JSON object once as arguments to the ${name} tool instead of writing JSON in assistant text. All original scope and authorization rules still apply.`;
 const system=copy.find(m=>m.role==='system'&&typeof m.content==='string');
 if(system&&typeof format==='object'&&format.type==='dialogue-plan'){
  const prefix=plannerRoutingInstruction(format.scope);
  if(system.content.startsWith(prefix))system.content=plannerRoutingInstruction(format.scope,purposes)+system.content.slice(prefix.length);
 }
 if(system)system.content+='\n'+instruction;else copy.unshift({role:'system',content:instruction});
 return {messages:copy,responseTool:{name,parameters,...(actions?{actions}:{})}};
}
