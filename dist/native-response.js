// Tool-shaped output transport only. This module cannot execute a tool or write.
const fields={babelshelf_answer:['answer'],babelshelf_plan:['action','query','target','body','historyIndex','historyPart']};
const captureBindings={
 capturetext:{action:'capture',query:''},
 capturecurrent:{action:'capture',query:'',target:'current'},
 captureinputs:{action:'capture',query:'',target:'inputs'},
 captureuser:{action:'capture',query:'',target:'history',historyPart:'user'},
 captureassistant:{action:'capture',query:'',target:'history',historyPart:'assistant'},
 toolcreate:{action:'tool-create'}
};
export function nativeActionBinding(name){return Object.hasOwn(captureBindings,name)?{...captureBindings[name]}:{action:name};}
function validateParameters(p,allowed,allowEmpty=false){
 if(!p||p.type!=='object'||p.additionalProperties!==false||!p.properties||typeof p.properties!=='object'||Array.isArray(p.properties)||!Array.isArray(p.required)||!allowEmpty&&!p.required.length||p.required.some(k=>!Object.hasOwn(p.properties,k))||Object.keys(p.properties).some(k=>!allowed.includes(k)))throw Error('Invalid native response format');
 for(const value of Object.values(p.properties))if(!value||!['string','integer'].includes(value.type)||value.enum!==undefined&&(!Array.isArray(value.enum)||!value.enum.length||value.enum.length>128)||Object.keys(value).some(k=>!['type','enum','minimum','maximum'].includes(k)))throw Error('Invalid native response format');
}
export function nativeResponseTools(spec){
 if(!spec||!Object.hasOwn(fields,spec.name)||Object.keys(spec).some(k=>!['name','parameters','actions'].includes(k))||JSON.stringify(spec).length>16384)throw Error('Invalid native response format');
 validateParameters(spec.parameters,fields[spec.name]);
 const tool=(name,parameters)=>({type:'function',function:{name,description:'Propose only.',parameters:structuredClone(parameters)}});
 if(spec.actions!==undefined){
  const actions=spec.parameters.properties.action?.enum;
  if(spec.name!=='babelshelf_plan'||!actions||!spec.actions||typeof spec.actions!=='object'||Array.isArray(spec.actions))throw Error('Invalid native response format');
  const names=Object.keys(spec.actions),covered=new Set(names.map(name=>nativeActionBinding(name).action));
  if(names.length>16||new Set(actions).size!==actions.length||covered.size!==actions.length||actions.some(name=>!covered.has(name))||names.some(name=>!/^[a-z]{1,16}$/.test(name)||!actions.includes(nativeActionBinding(name).action)))throw Error('Invalid native response format');
  return names.map(name=>{
   const binding=nativeActionBinding(name);
   for(const [key,value]of Object.entries(binding)){
    const rule=spec.parameters.properties[key];
    if(!rule||rule.type!==typeof value||rule.enum&&!rule.enum.includes(value))throw Error('Invalid native response format');
   }
   validateParameters(spec.actions[name],fields.babelshelf_plan.filter(k=>!Object.hasOwn(binding,k)),true);
   return tool(name,spec.actions[name]);
  });
 }
 return [tool(spec.name,spec.parameters)];
}
export function nativeResponseText(raw,spec,events){
 nativeResponseTools(spec);
 const invalid=reason=>{const evidence=JSON.stringify({finishReason:raw?.finish_reason,message:raw?.message,events}),error=Error('Invalid model tool response');error.diagnostic={raw:evidence.slice(0,8192),reason:'native:'+reason,truncated:evidence.length>8192};throw error;};
 if(raw?.finish_reason!=='tool_calls')invalid(raw?.finish_reason==='length'?'budget':'finish');
 const m=raw.message,calls=m?.tool_calls;
 if(m?.role!=='assistant'||typeof m.content!=='string'||m.content.trim()||!Array.isArray(calls)||calls.length!==1||!Array.isArray(events)||events.length!==1)invalid('shape');
 const call=calls[0],args=call?.function?.arguments;
 if(call?.type!=='function'||(spec.actions?!Object.hasOwn(spec.actions,call.function?.name):call.function?.name!==spec.name)||call.errors?.length||JSON.stringify(call)!==JSON.stringify(events[0])||!args||typeof args!=='object'||Array.isArray(args))invalid('call');
 const p=spec.actions?spec.actions[call.function.name]:spec.parameters;
 if(p.required.some(k=>!Object.hasOwn(args,k))||Object.keys(args).some(k=>!Object.hasOwn(p.properties,k)))invalid('fields');
 for(const [key,value]of Object.entries(args)){const rule=p.properties[key];if(rule.type==='string'?typeof value!=='string':!Number.isSafeInteger(value))invalid('type');if(rule.enum&&!rule.enum.includes(value)||rule.minimum!==undefined&&value<rule.minimum||rule.maximum!==undefined&&value>rule.maximum)invalid('value');}
 // A single complete parsed argument object is serialized, never a text prefix
 // salvaged from duplicated/truncated output. Harness semantic guards still run.
 return JSON.stringify(spec.actions?{...nativeActionBinding(call.function.name),...args}:args);
}
