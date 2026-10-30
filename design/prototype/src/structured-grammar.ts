import {HARNESS_ACTIONS,scopedHarnessActions,validatePlannerScope,type PlannerScope} from './harness-actions.ts';
export type StructuredFormat='dialogue-plan'|'dialogue-answer'|{type:'dialogue-answer';allowInsufficientEvidence:true}|{type:'grounded-answer';sourceCount:number}|{type:'dialogue-plan';scope:PlannerScope}|{type:'sourced-calculation';sourceCount:number};
function sourceLabels(format:StructuredFormat){
 const count=(format as {sourceCount:number}).sourceCount;
 if(!Number.isSafeInteger(count)||count<0||count>64)throw Error('Invalid grounded answer schema');
 return Array.from({length:count},(_,index)=>'S'+(index+1));
}
type JsonSchema=Record<string,unknown>;
export function createStructuredSchema(format:StructuredFormat):JsonSchema{
 const kind=typeof format==='string'?format:format?.type;
 if(kind==='grounded-answer'){
  const labels=sourceLabels(format);
  return {type:'object',properties:{status:{type:'string',enum:['answered','insufficient_evidence']},answer:{type:'string'},sources:{type:'array',items:{type:'string',...(labels.length?{enum:labels}:{})},minItems:0,maxItems:labels.length,uniqueItems:true}},required:['status','answer','sources'],additionalProperties:false};
 }
 if(kind==='dialogue-answer')return {type:'object',properties:{answer:{type:'string'},...(typeof format==='object'&&format.type==='dialogue-answer'&&format.allowInsufficientEvidence?{status:{type:'string',enum:['insufficient_evidence']}}:{})},required:['answer'],additionalProperties:false};
 if(kind==='sourced-calculation'){
  const count=(format as {sourceCount:number}).sourceCount;if(!Number.isSafeInteger(count)||count<1||count>8)throw Error('Invalid sourced calculation schema');
  return {type:'object',properties:{operation:{type:'string',enum:['add','subtract','multiply','divide']},sourceOperandIndex:{type:'integer',enum:[0,1]},sourceIndex:{type:'integer',minimum:0,maximum:count-1},sourceQuote:{type:'string'},sourceUnit:{type:'string'},requestQuote:{type:'string'}},required:['operation','sourceOperandIndex','sourceIndex','sourceQuote','sourceUnit','requestQuote'],additionalProperties:false};
 }
 if(kind!=='dialogue-plan')throw Error('Unsupported output format');
 const scope=typeof format==='object'&&format.type==='dialogue-plan'?validatePlannerScope(format.scope):undefined;
 const actions=scope?scopedHarnessActions(scope):HARNESS_ACTIONS.filter(action=>action.id!=='tool');
 const branches:JsonSchema[]=[];
 const add=(action:string,target?:string,historyPart?:'user'|'assistant')=>{
  const properties:Record<string,unknown>={action:{type:'string',enum:[action]},query:{type:'string'}};
  const required=['action','query'];
  if(target){properties.target={type:'string',enum:[target]};required.push('target');}
  if(historyPart){
   const count=scope?.historyCount;
   let index:JsonSchema={type:'integer',minimum:0,...(count===undefined?{}:{maximum:count-1})};
   if(historyPart==='assistant'&&scope?.assistantIndices)index={type:'integer',enum:scope.assistantIndices};
   properties.historyIndex=index;properties.historyPart={type:'string',enum:[historyPart]};required.push('historyIndex','historyPart');
  }
  if(action==='capture'&&!target){properties.body={type:'string'};required.push('body');}
  branches.push({type:'object',properties,required,additionalProperties:false});
 };
 for(const action of actions){
  if(action.id==='tool'){
   const toolIds=scope?.requiredToolIds??scope?.toolIds;
   if(toolIds?.length)branches.push({type:'object',properties:{action:{type:'string',enum:['tool']},query:{type:'string',enum:toolIds},body:{type:'string'}},required:['action','query','body'],additionalProperties:false});
   continue;
  }
  if(action.id==='capture'&&!scope?.inputs){
   branches.push({type:'object',properties:{action:{type:'string',enum:['capture']},body:{type:'string'}},required:['action','body'],additionalProperties:false});
  }
  const targets:(string|undefined)[]=[...action.targets];if(!['recall','transform'].includes(action.id))targets.unshift(undefined);
  for(const target of targets){
   if(target==='history'){
    add(action.id,target,'user');
    if(!scope?.assistantIndices||scope.assistantIndices.length)add(action.id,target,'assistant');
   }else add(action.id,target);
  }
 }
 if(!branches.length)throw Error('Empty structured output schema');
 return {type:'object',anyOf:branches};
}
type State={nodes:number[];remaining:number;min:number;max:number};
type Node={epsilon:number[];edges:{accept:(byte:number)=>boolean;to:number}[]};
type Fragment={start:number;end:number};
export function createStructuredGrammar(format:StructuredFormat){
 const kind=typeof format==='string'?format:format?.type;
 if(!['dialogue-plan','dialogue-answer','grounded-answer','sourced-calculation'].includes(kind))throw Error('Unsupported output format');
 const scope=typeof format==='object'&&format.type==='dialogue-plan'?validatePlannerScope(format.scope):undefined;
 const nodes:Node[]=[];
 const node=()=>{nodes.push({epsilon:[],edges:[]});return nodes.length-1;};
 const edge=(from:number,to:number,accept:(byte:number)=>boolean)=>nodes[from].edges.push({to,accept});
 const literal=(value:string):Fragment=>{const start=node();let end=start;for(const byte of new TextEncoder().encode(value)){if([123,125,91,93,58,44].includes(byte)){for(const space of [9,10,13,32])edge(end,end,b=>b===space);}const next=node();edge(end,next,b=>b===byte);end=next;if([123,125,91,93,58,44].includes(byte))for(const space of [9,10,13,32])edge(end,end,b=>b===space);}return {start,end};};
 const seq=(...parts:Fragment[]):Fragment=>{for(let i=1;i<parts.length;i++)nodes[parts[i-1].end].epsilon.push(parts[i].start);return {start:parts[0].start,end:parts.at(-1)!.end};};
 const alt=(parts:Fragment[]):Fragment=>{const start=node(),end=node();for(const p of parts){nodes[start].epsilon.push(p.start);nodes[p.end].epsilon.push(end);}return {start,end};};
 const string=():Fragment=>{
  const start=node(),body=node(),escape=node(),end=node();edge(start,body,b=>b===34);edge(body,end,b=>b===34);
  edge(body,body,b=>b>=32&&b!==34&&b!==92);edge(body,escape,b=>b===92);edge(escape,body,b=>[34,92,47,98,102,110,114,116].includes(b));
  let from=node();edge(escape,from,b=>b===117);
  for(let i=0;i<4;i++){const to=i===3?body:node();edge(from,to,b=>b>=48&&b<=57||b>=65&&b<=70||b>=97&&b<=102);from=to;}
  return {start,end};
 };
 const integer=():Fragment=>{const start=node(),digits=node(),end=node();edge(start,end,b=>b===48);edge(start,digits,b=>b>=49&&b<=57);edge(digits,digits,b=>b>=48&&b<=57);nodes[digits].epsilon.push(end);return {start,end};};
 // States scale with decimal width, not turn count; no leading zeroes.
 const boundedInteger=(max:number):Fragment=>{
  const branches:Fragment[]=[];
  for(let length=1;length<=String(max).length;length++){
   const bound=length===String(max).length?String(max):'9'.repeat(length),start=node(),end=node();
   let states=new Map([[true,start]]);
   for(let pos=0;pos<length;pos++){
    const next=new Map<boolean,number>();
    for(const [tight,from]of states)for(let digit=pos===0&&length>1?1:0;digit<=(tight?Number(bound[pos]):9);digit++){
     const nextTight=tight&&digit===Number(bound[pos]);let to=next.get(nextTight);if(to===undefined){to=pos===length-1?end:node();next.set(nextTight,to);}edge(from,to,b=>b===48+digit);
    }states=next;
   }branches.push({start,end});
  }return alt(branches);
 };
 const field=(name:string,value:Fragment)=>seq(literal(','+JSON.stringify(name)+':'),value);
 let root:Fragment;
 if(kind==='dialogue-answer'){
  const answer=seq(literal('{"answer":'),string(),literal('}'));
  root=typeof format==='object'&&format.type==='dialogue-answer'&&format.allowInsufficientEvidence
   ?alt([answer,seq(literal('{"status":"insufficient_evidence","answer":'),string(),literal('}')),seq(literal('{"answer":'),string(),literal(',"status":"insufficient_evidence"}'))]):answer;
 }
 else if(kind==='grounded-answer'){
  const labels=sourceLabels(format),open=literal('['),close=literal(']');let end=open.end;
  nodes[end].epsilon.push(close.start);
  for(let index=0;index<labels.length;index++){
   const item=alt(labels.map(label=>literal(JSON.stringify(label)))),part=index?seq(literal(','),item):item;
   nodes[end].epsilon.push(part.start);end=part.end;nodes[end].epsilon.push(close.start);
  }
  const sources={start:open.start,end:close.end};
  root=seq(literal('{"status":'),alt(['answered','insufficient_evidence'].map(value=>literal(JSON.stringify(value)))),field('answer',string()),field('sources',sources),literal('}'));
 }
 else if(kind==='sourced-calculation'){
  const sourceCount=(format as {sourceCount:number}).sourceCount;if(!Number.isSafeInteger(sourceCount)||sourceCount<1||sourceCount>8)throw Error('Invalid sourced calculation schema');
  root=seq(literal('{"operation":'),alt(['add','subtract','multiply','divide'].map(value=>literal(JSON.stringify(value)))),field('sourceOperandIndex',alt([literal('0'),literal('1')])),field('sourceIndex',boundedInteger(sourceCount-1)),field('sourceQuote',string()),field('sourceUnit',string()),field('requestQuote',string()),literal('}'));
 }
 else{
  const alternatives:Fragment[]=[];
  for(const action of scope?scopedHarnessActions(scope):HARNESS_ACTIONS.filter(action=>action.id!=='tool')){
   if(action.id==='tool'){
    const toolIds=scope?.requiredToolIds??scope?.toolIds;
    if(toolIds?.length)alternatives.push(seq(literal('{"action":"tool","query":'),alt(toolIds.map(id=>literal(JSON.stringify(id)))),field('body',string()),literal('}')));
    continue;
   }
   if(action.id==='capture'&&!scope?.inputs)alternatives.push(seq(literal('{"action":"capture","body":'),string(),literal('}')));
   const targets:(string|undefined)[]=[...action.targets];if(!['recall','transform'].includes(action.id))targets.unshift(undefined);
   for(const target of targets){
    const parts=[literal('{"action":'+JSON.stringify(action.id)+',"query":'),string()];
    if(target)parts.push(field('target',literal(JSON.stringify(target))));
    if(target==='history'){
     if(scope?.assistantIndices){
      const selectors=[seq(field('historyIndex',boundedInteger(scope.historyCount-1)),field('historyPart',literal('"user"')))];
      if(scope.assistantIndices.length)selectors.push(seq(field('historyIndex',alt(scope.assistantIndices.map(index=>literal(String(index))))),field('historyPart',literal('"assistant"'))));
      parts.push(alt(selectors));
     }else parts.push(field('historyIndex',scope?boundedInteger(scope.historyCount-1):integer()),field('historyPart',alt([literal('"user"'),literal('"assistant"')])));
    }
    if(action.id==='capture'&&!target)parts.push(field('body',string()));
    parts.push(literal('}'));alternatives.push(seq(...parts));
   }
  }root=alt(alternatives);
 }
 function closure(input:number[]){const found=new Set(input),stack=[...found];while(stack.length){for(const next of nodes[stack.pop()!].epsilon)if(!found.has(next)){found.add(next);stack.push(next);}}return [...found];}
 const initial:State={nodes:closure([root.start]),remaining:0,min:128,max:191};
 function advance(state:State,bytes:Uint8Array):State|null{
  let current=state.nodes,remaining=state.remaining,min=state.min,max=state.max;
  for(const byte of bytes){
   if(remaining){if(byte<min||byte>max)return null;remaining--;min=128;max=191;}
   else if(byte>=128){
    if(byte>=194&&byte<=223)remaining=1;
    else if(byte>=224&&byte<=239){remaining=2;min=byte===224?160:128;max=byte===237?159:191;}
    else if(byte>=240&&byte<=244){remaining=3;min=byte===240?144:128;max=byte===244?143:191;}
    else return null;
   }
   const next=new Set<number>();for(const id of current)for(const edge of nodes[id].edges)if(edge.accept(byte))next.add(edge.to);
   if(!next.size)return null;current=closure([...next]);
  }
  return {nodes:current,remaining,min,max};
 }
 return {initial,advance,complete:(state:State)=>!state.remaining&&state.nodes.includes(root.end)};
}
