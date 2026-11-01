import {boundedDialogueContext,compactDialogue,dialogueContextFits,independentSavedKnowledgeContext,type ChatEngine,type Dialogue,type DialogueContext} from './conversation.ts';
import {addMeasurement,recordGenerationMeasurements,type InferenceMeasurements} from './inference-measurements.ts';
import type {ActivityTool} from './harness-activity.ts';

type Trace=<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,project?:(value:T)=>unknown,failureOf?:(value:T)=>unknown,failureProject?:(error:unknown)=>unknown)=>Promise<T>;
type ContextInference=InferenceMeasurements&{lastCountPromptTokens?:number;contextTokens?:number};
/** Observe context preparation without retaining prompt or generated text in the activity receipt. */
function observeContextInference(engine:ChatEngine,usage:ContextInference):ChatEngine{
 return new Proxy(engine,{get(target,property){
  if(property==='pin')return ()=>observeContextInference(target.pin?.()??target,usage);
  if(property==='count')return async(...args:Parameters<ChatEngine['count']>)=>{
   const started=performance.now();try{
    const result=await target.count(...args);
    // Record the last fit candidate, not a sum of mutually exclusive prompts.
    // A failed/invalid count must not leave an earlier candidate looking current.
    delete usage.lastCountPromptTokens;delete usage.contextTokens;
    if(Number.isSafeInteger(result.prompt_tokens)&&result.prompt_tokens>=0)usage.lastCountPromptTokens=result.prompt_tokens;
    if(Number.isSafeInteger(target.manifest.contextTokens)&&target.manifest.contextTokens>0)usage.contextTokens=target.manifest.contextTokens;
    return result;
   }catch(error){delete usage.lastCountPromptTokens;delete usage.contextTokens;throw error;}
   finally{usage.countMs=addMeasurement(usage.countMs,performance.now()-started);}
  };
  if(property==='generate')return async(...args:Parameters<ChatEngine['generate']>)=>{
   const started=performance.now();usage.measuredModelCalls++;
   try{
    const result=await target.generate(...args);
    recordGenerationMeasurements(usage,result);
    return result;
   }finally{usage.generationWallMs=addMeasurement(usage.generationWallMs,performance.now()-started);}
  };
  return Reflect.get(target,property,target);
 }});
}
function inferenceReceipt(usage:ContextInference){
 // usage is populated only by the bounded measurement collector and exact count.
 return {...usage};
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
  // Compaction and final packing often check the identical candidate in sequence.
  // Keep only one result for this preparation; never retain prompts across sends.
  let previousKey:string|undefined,previousFit=false;
  const fitsPlanner=input.fitsPlanner?async(context:DialogueContext)=>{
   input.check();const key=JSON.stringify(context);
   if(key===previousKey)return previousFit;
   const fits=await input.fitsPlanner!(context,engine);input.check();
   previousKey=key;previousFit=fits;return fits;
  }:undefined;
  const compact=await compactDialogue(input.prior,engine,input.question,()=>{input.check();input.setProgress('Compacting…');},fitsPlanner);
  return {compact,context:await boundedDialogueContext(compact,engine,input.question,fitsPlanner??(context=>dialogueContextFits(engine,input.question,context)))};
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
