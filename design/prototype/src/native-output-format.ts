import {createStructuredSchema} from './structured-grammar.ts';
import type {GenerationFormat,NativeToolDefinition} from './text-inference.ts';
import {HARNESS_ACTIONS,plannerRoutingInstruction,validAgentResultAction,type PlannerScope} from './harness-actions.ts';
// @ts-expect-error Shared browser transport is a plain JavaScript module.
import {nativeActionBinding} from '../../../dist/native-response.js';

// These actions navigate the UI and end the request. Distinguish them from the
// registered Memory operations which return evidence and let the agent continue.
const navigationFunctions=[
 {action:'read',suffix:'open_file',purpose:'End this request and open one file in the Memory screen. To read contents for an answer, comparison or another operation, use memory.read or the requested registered tool instead.'},
 {action:'search',suffix:'show_search_results',purpose:'End this request and show matching files to the user. To find evidence and continue working, use memory.search instead.'},
] as const;

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
/** One completion shape, with citation arguments bound to currently visible
 * originals. A constant S1..S64 pattern invites citations when none exist. */
export function nativeFinalPlanTools(scope:PlannerScope,sourceLabels:readonly string[]=[],afterToolCall=false):NativeToolDefinition[]{
 if(!Array.isArray(sourceLabels)||sourceLabels.length>64||new Set(sourceLabels).size!==sourceLabels.length||sourceLabels.some(label=>typeof label!=='string'||!/^S([1-9]|[1-5][0-9]|6[0-4])$/.test(label)))throw Error('Invalid native source labels');
 const {responseTool}=nativeOutputRequest([],{type:'dialogue-plan',scope:{...scope,toolIds:[]}});
 return Object.entries(responseTool!.actions!).flatMap(([name,original])=>{
  if(afterToolCall&&!validAgentResultAction(nativeActionBinding(name).action))return [];
  // Native agents calculate through the registered math.calculate operation.
  // Offering a second, terminal calculator lets a successful tool result end
  // in a legacy dispatch that cannot consume that result or its provenance.
  // The explicit calculator shortcut and legacy JSON transport stay separate.
  if(name==='calculate')return [];
  const navigation=navigationFunctions.find(entry=>entry.action===name);
  let parameters=original,description=navigation?.purpose??nativePurpose(name);
  if(!scope.inputs&&['answer','summary','capturetext'].includes(name)){
   const reply={type:'object',properties:{status:{type:'string',enum:['answered','insufficient_evidence']},answer:{type:'string'},sources:{type:'array',items:{type:'string',...(sourceLabels.length?{enum:[...sourceLabels]}:{})},maxItems:sourceLabels.length,uniqueItems:true}},required:['status','answer','sources'],additionalProperties:false};
   const {body:_body,...properties}=original.properties;
   parameters={...original,properties:{...properties,reply},required:[...original.required.filter((key:string)=>key!=='body'&&key!=='query'),'reply']};
   description=name==='capturetext'?'Only when the CURRENT request asks to save or create a NEW note: propose its exact content for review. Otherwise use finish_answer. Nothing is saved yet.':name==='summary'?'Return the requested summary. This does not create a file.':'Return the final answer to the current request, including results of successful tools. This does not create a file.';
   description+=' Put the complete content in reply; query is optional. Cite only offered source labels; no labels means sources=[]. Report absent details as unknown. If the request cannot be answered from available evidence, use insufficient_evidence with sources=[].';
  }
  const suffix=navigation?.suffix??name;
  return [{type:'function',function:{name:'finish_'+suffix,description,parameters}}];
 });
}
export function nativeFinalActionBinding(name:string):Record<string,unknown>|undefined{
 if(!name.startsWith('finish_'))return;
 const suffix=name.slice(7);
 const binding=nativeActionBinding(navigationFunctions.find(entry=>entry.suffix===suffix)?.action??suffix);
 if(!HARNESS_ACTIONS.some(action=>action.id===binding.action&&action.id!=='tool')||suffix==='capture'||suffix==='tool-create')throw Error('Unknown native final action');
 return binding;
}
export function nativeOutputRequest(messages:any[],format?:GenerationFormat){
 if(!format||format==='prose')return {messages};
 const schema:any=createStructuredSchema(format),branches:any[]=schema.anyOf??[schema],parameters=typeof format==='object'&&format.type==='grounded-answer'?schema:compact(branches);
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
 const kind=typeof format==='string'?format:format.type,name=kind==='dialogue-answer'?'babelshelf_answer':kind==='grounded-answer'?'babelshelf_grounded':kind==='sourced-calculation'?'babelshelf_calculation':'babelshelf_plan';
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
