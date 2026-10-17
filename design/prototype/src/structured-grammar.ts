import {HARNESS_ACTIONS,scopedHarnessActions,validatePlannerScope,type PlannerScope} from './harness-actions.ts';
export type StructuredFormat='dialogue-plan'|'dialogue-answer'|{type:'dialogue-plan';scope:PlannerScope};
type State={nodes:number[];remaining:number;min:number;max:number};
type Node={epsilon:number[];edges:{accept:(byte:number)=>boolean;to:number}[]};
type Fragment={start:number;end:number};
export function createStructuredGrammar(format:StructuredFormat){
 const kind=typeof format==='string'?format:format?.type;
 if(!['dialogue-plan','dialogue-answer'].includes(kind))throw Error('Unsupported output format');
 const scope=typeof format==='object'?validatePlannerScope(format.scope):undefined;
 const nodes:Node[]=[];
 const node=()=>{nodes.push({epsilon:[],edges:[]});return nodes.length-1;};
 const edge=(from:number,to:number,accept:(byte:number)=>boolean)=>nodes[from].edges.push({to,accept});
 const literal=(value:string):Fragment=>{const start=node();let end=start;for(const byte of new TextEncoder().encode(value)){const next=node();edge(end,next,b=>b===byte);end=next;}return {start,end};};
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
 if(kind==='dialogue-answer')root=seq(literal('{"answer":'),string(),literal('}'));
 else{
  const alternatives:Fragment[]=[];
  for(const action of scope?scopedHarnessActions(scope):HARNESS_ACTIONS){
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
