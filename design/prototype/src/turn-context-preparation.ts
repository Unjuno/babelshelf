import {boundedDialogueContext,compactDialogue,independentSavedKnowledgeContext,type ChatEngine,type Dialogue,type DialogueContext} from './conversation.ts';
import type {ActivityTool} from './harness-activity.ts';

type Trace=<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,project?:(value:T)=>unknown)=>Promise<T>;

/** Prepare one planner context from a pinned dialogue, persisting only a changed compaction. */
export async function prepareTurnContext(input:{
 prior:Dialogue;
 engine:ChatEngine;
 model:string|undefined;
 question:string;
 currentInputs?:boolean;
 check:()=>void;
 setProgress:(value:string)=>void;
 currentDialogue:()=>Dialogue;
 saveDialogue:(dialogue:Dialogue)=>Promise<void>;
 trace:Trace;
 fitsPlanner?:(context:DialogueContext)=>Promise<boolean>;
}):Promise<DialogueContext>{
 input.check();
 const saved=independentSavedKnowledgeContext(input.question,input.currentInputs);if(saved)return saved;
 const originalTurns=input.prior.turns.map(turn=>JSON.stringify(turn)),originalCompaction=JSON.stringify(input.prior.compaction);
 const prepared=await input.trace('dialogue.compact',{model:input.model,question:input.question,priorTurns:input.prior.turns.length,through:input.prior.compaction?.through??0},async()=>{
  const compact=await compactDialogue(input.prior,input.engine,input.question,()=>{input.check();input.setProgress('Compacting…');},input.fitsPlanner);
  return {compact,context:await boundedDialogueContext(compact,input.engine,input.question)};
 },value=>({compaction:value.compact.compaction}));
 input.check();
 const current=input.currentDialogue();
 if(JSON.stringify(current.compaction)!==originalCompaction||current.turns.length<originalTurns.length||originalTurns.some((turn,index)=>JSON.stringify(current.turns[index])!==turn))throw Error('Conversation changed · retry');
 if(prepared.compact.compaction!==input.prior.compaction){
  await input.saveDialogue({...current,revision:current.revision+1,compaction:prepared.compact.compaction});
 }
 input.check();input.setProgress('');
 return prepared.context;
}
