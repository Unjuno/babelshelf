// Adapted prompt/readout protocol from LiquidAI/d1-omni-600M prompt.py,
// revision02b55d7076f15129e59ab3f94783f32c4b088674, LFM Open License1.0.
// Modified: strict bounded inputs, no silent state/instruction/option truncation,
// portable typed output and no execution authority. See licenses/decision-model-*.
export type DecisionQuestion={type:'choice';instructions:string;criteria:Record<string,string>}|{type:'score';instructions:string;criteria:string[]}|{type:'noul';instructions:string;criteria?:Record<string,string>};
export class DecisionContextError extends Error {code='decision_context_limit';}
type Tokenizer={encode:(text:string,options:{add_special_tokens:boolean})=>number[]};
const plain=(value:any)=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
export function validateDecisionQuestion(q:DecisionQuestion){
 if(!plain(q)||Object.keys(q).some(k=>!['type','instructions','criteria'].includes(k))||!['choice','score','noul'].includes(q.type)||typeof q.instructions!=='string'||!q.instructions.trim()||q.instructions.length>2048)throw Error('Invalid decision question');
 if(q.type==='choice'&&(!plain(q.criteria)||Object.keys(q.criteria).length<2||Object.keys(q.criteria).length>16))throw Error('Decision needs 2–16 options');
 if(q.type==='score'&&(!Array.isArray(q.criteria)||q.criteria.length<2||q.criteria.length>10))throw Error('Decision needs 2–10 levels');
 if(q.type==='noul'&&q.criteria!==undefined&&(!plain(q.criteria)||Object.keys(q.criteria).some(k=>!['false','true','no','yes'].includes(k))))throw Error('Invalid binary decision question');
 for(const [key,value] of Object.entries(q.criteria??{}))if(!key||key.length>128||typeof value!=='string'||!value.trim()||value.length>1024)throw Error('Invalid decision options');
 return q;
}
const escape=(text:string)=>text.replace(/<\|([A-Za-z0-9_]+)\|>/g,'<¦$1¦>');
export function decisionOptions(q:DecisionQuestion){validateDecisionQuestion(q);return q.type==='choice'?Object.entries(q.criteria).map(([k,v])=>k+': '+v):q.type==='score'?q.criteria.map((v,i)=>'level '+i+': '+v):['false: '+(q.criteria?.false??q.criteria?.no??'no, the statement does not hold'),'true: '+(q.criteria?.true??q.criteria?.yes??'yes, the statement holds')];}
export function encodeDecision(tok:Tokenizer,state:string,q:DecisionQuestion,maxLength=2048){
 validateDecisionQuestion(q);if(typeof state!=='string'||state.length>128000||!Number.isInteger(maxLength)||maxLength<128||maxLength>2048)throw new DecisionContextError('Decision context limit');
 const enc=(text:string)=>{const ids=tok.encode(text,{add_special_tokens:false});if(!Array.isArray(ids)||ids.some(n=>!Number.isInteger(n)||n<0||n>=65536))throw Error('Decision tokenizer invalid');return ids;};
 const markersSpec:[string,number][]=[['<|startoftext|>',1],['<|reserved_7|>',17],['<|reserved_8|>',18],['<|reserved_9|>',19],['<|reserved_10|>',20],['<|reserved_11|>',21],['<|mask|>',16]];
 for(const [token,id] of markersSpec){const ids=enc(token);if(ids.length!==1||ids[0]!==id)throw Error('Decision tokenizer markers incompatible');}
 // Upstream apportions an option budget and truncates each option. Keep complete
 // meanings instead: unequal options share the actual sequence budget. Reserve
 // BOS/state and the final decide marker even before adding the state tokens.
 const opts=decisionOptions(q),instructions=enc(escape(q.instructions));
 if(instructions.length+4>maxLength)throw new DecisionContextError('Decision context limit');
 const branch=[18,...instructions],markers:number[]=[];
 for(const option of opts){const ids=enc(escape(' '+option));if(branch.length+ids.length+6>maxLength)throw new DecisionContextError('Decision context limit');markers.push(branch.length+1);branch.push(19,16,...ids,20);}
 branch.push(21);const stateIds=enc(escape(state)),room=maxLength-branch.length-2;if(stateIds.length>room)throw new DecisionContextError('Decision context limit');
 const prefix=[1,17,...stateIds],ids=[...prefix,...branch],positions=markers.map(p=>p+prefix.length);if(ids.length>maxLength||positions.some(p=>ids[p]!==16))throw Error('Decision marker positions invalid');
 return {ids,markers:positions,qtype:q.type==='choice'?0:q.type==='score'?1:2,stateTokens:stateIds.length,stateTruncated:false};
}
export function decisionAnswer(q:DecisionQuestion,logits:number[],temperatures:Record<string,number>){
 validateDecisionQuestion(q);const names=q.type==='choice'?Object.keys(q.criteria):q.type==='score'?q.criteria.map((_,i)=>String(i)):['false','true'];
 if(logits.length!==names.length||logits.some(n=>!Number.isFinite(n)))throw Error('Decision logits invalid');
 const k=names.length,key=q.type+':'+(k<=2?'2':k<=5?'3-5':k<=10?'6-10':'11+'),temperature=temperatures[key]??temperatures[q.type]??1;
 if(!Number.isFinite(temperature)||temperature<=0)throw Error('Decision temperature invalid');const peak=Math.max(...logits),exps=logits.map(n=>Math.exp((n-peak)/temperature)),total=exps.reduce((a,b)=>a+b,0),probs=exps.map(n=>n/total),best=probs.indexOf(Math.max(...probs)),probabilities=Object.fromEntries(names.map((name,i)=>[name,probs[i]]));
 if(q.type==='noul')return {type:q.type,answer:probs[1]>=.5,probability:probs[1],confidence:Math.max(...probs),probabilities};
 if(q.type==='choice')return {type:q.type,choice:names[best],confidence:probs[best],probabilities};
 return {type:q.type,score:probs.reduce((a,p,i)=>a+p*i,0),confidence:probs[best],probabilities};
}
