// Exact-tokenizer probe only. Captures the first admitted summary request,
// never generates a fake summary or supplies a knowledge/write port.
import {emptyDialogue,appendTurn,compactDialogue,compactionMessages} from '../../design/prototype/src/conversation.ts';
export async function checkCompactionCount(engine:any,notify:(item:any)=>void){
 const load=await engine.load('2B'),state=Array.from({length:128},(_,i)=>({id:'count-'+i,user:'Item '+i,answer:'Seen '+i})).reduce(appendTurn,emptyDialogue()),before=JSON.stringify(state);
 const counted:any[]=[],captured:{messages:any[];budget:number}|null=null,stop=Error('Count-only boundary');let first:any;
 const started=performance.now();
 try{await compactDialogue(state,{manifest:engine.manifest,count:async messages=>{const value=await engine.call('count',{messages});if(messages[0].content.startsWith('Summarize earlier dialogue'))counted.push({messages,tokens:value.prompt_tokens});return value;},generate:async(messages,budget)=>{first={messages,budget};throw stop;}},'Next');}
 catch(error){if(error!==stop)throw error;}
 if(!first)throw Error('Expected an admitted compaction batch');
 const currentMs=performance.now()-started,linear:any[]=[];let prior:any;
 const baselineStarted=performance.now();
 for(let size=1;size<state.turns.length;size++){const messages=compactionMessages('',{turns:state.turns.slice(0,size)}),value=await engine.call('count',{messages});linear.push({size,tokens:value.prompt_tokens});if(value.prompt_tokens+first.budget>engine.manifest.contextTokens)break;prior={size,tokens:value.prompt_tokens};}
 const linearMs=performance.now()-baselineStarted,body=first.messages.at(-1).content,selected=JSON.parse(body.slice(body.indexOf('\n')+1)),match=counted.find(item=>JSON.stringify(item.messages)===JSON.stringify(first.messages));
 if(!match||match.tokens+first.budget>engine.manifest.contextTokens||!prior||JSON.stringify(state)!==before)throw Error('Invalid batch admission');
 const result={scope:'Actual pinned runtime tokenization, count-only; no generation, no store writes',load,contextTokens:engine.manifest.contextTokens,outputBudget:first.budget,historyTurns:state.turns.length,current:{countCalls:counted.length,selectedTurns:selected.length,promptTokens:match.tokens,elapsedMs:currentMs,counts:counted.map(item=>({turns:JSON.parse(item.messages.at(-1).content.split('\n').slice(1).join('\n')).length,tokens:item.tokens}))},linear:{countCalls:linear.length,selectedTurns:prior.size,promptTokens:prior.tokens,elapsedMs:linearMs,counts:linear},originalsUnchanged:JSON.stringify(state)===before,passed:counted.length<linear.length};notify(result);return result;
}
