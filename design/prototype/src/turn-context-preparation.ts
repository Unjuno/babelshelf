import {boundedDialogueContext,compactDialogue,independentSavedKnowledgeContext,type ChatEngine,type Dialogue,type DialogueContext} from './conversation.ts';
import type {ActivityTool} from './harness-activity.ts';

type Trace=<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,project?:(value:T)=>unknown,failureOf?:(value:T)=>unknown,failureProject?:(error:unknown)=>unknown)=>Promise<T>;
type ContextInference={measuredModelCalls:number;promptTokens?:number;outputTokens?:number;countMs?:number;generationWallMs?:number};
function addMeasurement(total:number|undefined,value:unknown,integer=false){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||integer&&!Number.isSafeInteger(value))return total;
 const next=(total??0)+value;return Number.isFinite(next)&&next<=Number.MAX_SAFE_INTEGER?next:total;
}
/** Observe context preparation without retaining prompt or generated text in the activity receipt. */
function observeContextInference(engine:ChatEngine,usage:ContextInference):ChatEngine{
 return new Proxy(engine,{get(target,property){
  if(property==='pin')return ()=>observeContextInference(target.pin?.()??target,usage);
  if(property==='count')return async(...args:Parameters<ChatEngine['count']>)=>{
   const started=performance.now();try{return await target.count(...args);}finally{usage.countMs=addMeasurement(usage.countMs,performance.now()-started);}
  };
  if(property==='generate')return async(...args:Parameters<ChatEngine['generate']>)=>{
   const started=performance.now();usage.measuredModelCalls++;
   try{
    const result=await target.generate(...args);
    const promptTokens=addMeasurement(usage.promptTokens,result.metrics?.runtimePromptTokens,true),outputTokens=addMeasurement(usage.outputTokens,result.outputTokens??result.metrics?.outputTokens,true),runtimeCountMs=addMeasurement(usage.countMs,result.metrics?.countMs);
    if(promptTokens!==undefined)usage.promptTokens=promptTokens;if(outputTokens!==undefined)usage.outputTokens=outputTokens;if(runtimeCountMs!==undefined)usage.countMs=runtimeCountMs;
    return result;
   }finally{usage.generationWallMs=addMeasurement(usage.generationWallMs,performance.now()-started);}
  };
  return Reflect.get(target,property,target);
 }});
}
function inferenceReceipt(usage:ContextInference){
 return {measuredModelCalls:usage.measuredModelCalls,...(usage.promptTokens!==undefined?{promptTokens:usage.promptTokens}:{}),...(usage.outputTokens!==undefined?{outputTokens:usage.outputTokens}:{}),...(usage.countMs!==undefined?{countMs:usage.countMs}:{}),...(usage.generationWallMs!==undefined?{generationWallMs:usage.generationWallMs}:{})};
}

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
 fitsPlanner?:(context:DialogueContext,engine?:ChatEngine)=>Promise<boolean>;
}):Promise<DialogueContext>{
 input.check();
 const saved=independentSavedKnowledgeContext(input.question,input.currentInputs);if(saved)return saved;
 const originalTurns=input.prior.turns.map(turn=>JSON.stringify(turn)),originalCompaction=JSON.stringify(input.prior.compaction);
 const usage:ContextInference={measuredModelCalls:0},engine=observeContextInference(input.engine,usage);
 const prepared=await input.trace('dialogue.compact',{model:input.model,priorTurns:input.prior.turns.length,through:input.prior.compaction?.through??0},async()=>{
  const fitsPlanner=input.fitsPlanner?(context:DialogueContext)=>input.fitsPlanner!(context,engine):undefined;
  const compact=await compactDialogue(input.prior,engine,input.question,()=>{input.check();input.setProgress('Compacting…');},fitsPlanner);
  return {compact,context:await boundedDialogueContext(compact,engine,input.question)};
 },value=>({compaction:value.compact.compaction?{through:value.compact.compaction.through,summaryCharacters:value.compact.compaction.summary.length}:null,inference:inferenceReceipt(usage)}),undefined,()=>({inference:inferenceReceipt(usage)}));
 input.check();
 const current=input.currentDialogue();
 if(JSON.stringify(current.compaction)!==originalCompaction||current.turns.length<originalTurns.length||originalTurns.some((turn,index)=>JSON.stringify(current.turns[index])!==turn))throw Error('Conversation changed · retry');
 if(prepared.compact.compaction!==input.prior.compaction){
  await input.saveDialogue({...current,revision:current.revision+1,compaction:prepared.compact.compaction});
 }
 input.check();input.setProgress('');
 return prepared.context;
}
