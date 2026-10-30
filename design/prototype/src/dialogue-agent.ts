import {AgentProtocolError,runReadOnlyAgentLoop,type AgentToolCapability,type AgentToolAttempt,type AgentToolCall} from './agent-loop.ts';
import {agentCorrectionTarget} from './agent-correction-target.ts';
import {planDialogue,type ChatEngine,type DialogueContext,type DialoguePlan,type PlannerInferenceMetrics,type AgentPlannerContext} from './conversation.ts';
import {PlannerOutputError} from './planner-error.ts';
import {DEFERRED_TOOL_SEARCH_ID} from './deferred-tool-search.ts';
import {requestsImplicitSearchReadAnswer} from './saved-knowledge-reference.ts';
import {validAgentResultAction} from './harness-actions.ts';
import type {ReplyStyle} from './reply-style.ts';
export async function planDialogueAgent(input:{onPreview?:(text:string)=>void;engine:ChatEngine;question:string;context:DialogueContext;attachments:{name:string;kind:string;status:string}[];allowedTools:readonly AgentToolCapability[];maxToolCalls?:number|null;maxResultChars?:number;userGuidance?:string;replyStyle?:ReplyStyle;readObservedSources?:()=>AgentPlannerContext['observedSources'];hasUsefulEvidence?:(history:readonly AgentToolAttempt[])=>boolean;selectNextPlan?:(history:readonly AgentToolAttempt[])=>DialoguePlan|null;normalizeToolArguments?:(tool:string,args:Record<string,unknown>,history:readonly AgentToolAttempt[])=>Record<string,unknown>;execute:(call:AgentToolCall)=>Promise<unknown>;check:()=>void;tracePlan?:(step:number,work:()=>Promise<DialoguePlan>,metrics:()=>PlannerInferenceMetrics|undefined)=>Promise<DialoguePlan>;traceTool?:(call:AgentToolCall,work:()=>Promise<unknown>,attemptIndex:number)=>Promise<unknown>}){
 let historyRepairUsed=false,deferredToolRepairUsed=false,nativeCallRepairUsed=false;
 const loop=await runReadOnlyAgentLoop({allowedTools:input.allowedTools,maxToolCalls:input.maxToolCalls,maxResultChars:input.maxResultChars,check:input.check,
  plan:async history=>{
   let inference:PlannerInferenceMetrics|undefined;
   const attempt=(historySelectorRejected=false,deferredToolRejected=false,nativeCallRejected:boolean|'mixed-final'|'source-label-leak'=false)=>{
    inference=undefined;
    input.onPreview?.('');
    const work=()=>planDialogue(input.engine,input.question,input.context,input.attachments,{allowedTools:input.allowedTools,history,observedSources:input.readObservedSources?.(),maxToolCalls:input.maxToolCalls,userGuidance:input.userGuidance,replyStyle:input.replyStyle,historySelectorRejected,deferredToolRejected,nativeCallRejected,onPreview:input.onPreview,onInference:value=>{inference=value;}});
    return input.tracePlan?input.tracePlan(history.length,work,()=>inference):work();
   };
   let raw:DialoguePlan;
   const selected=input.selectNextPlan?.(history);
   if(selected){
    const work=async()=>selected;
    raw=input.tracePlan?await input.tracePlan(history.length,work,()=>undefined):selected;
   }else{
    try{raw=await attempt();}catch(error){
     input.check();
     // Only the fixed validator category is feedback. Diagnostic/raw model text
     // never becomes a new instruction, inferred selector or execution input.
     if(!(error instanceof PlannerOutputError))throw error;
     if(!historyRepairUsed&&error.diagnostic.reason==='history target'){historyRepairUsed=true;raw=await attempt(true);}
     else if(!deferredToolRepairUsed&&error.diagnostic.reason==='tool call'&&input.allowedTools.some(tool=>tool.id.startsWith('user.'))&&input.allowedTools.some(tool=>tool.id===DEFERRED_TOOL_SEARCH_ID)){deferredToolRepairUsed=true;raw=await attempt(false,true);}
     else if(!nativeCallRepairUsed&&input.engine.plannerProtocol==='native-tool-calls'&&['native-tool-call','native-final-mixed','agent final action','terminal answer source-label leak'].includes(error.diagnostic.reason)){nativeCallRepairUsed=true;raw=await attempt(false,false,error.diagnostic.reason==='native-final-mixed'?'mixed-final':error.diagnostic.reason==='terminal answer source-label leak'?'source-label-leak':true);}
     else throw error;
    }
   }
   input.check();
   // The planner's legacy `search` action normally ends in a results preview.
   // When the user also asks for an answer, keep it inside the agent loop as
   // the registered Memory search tool so the coordinator can read and ground
   // the unique hit before answering.
   if(raw?.action==='search'&&requestsImplicitSearchReadAnswer(input.question)&&input.allowedTools.some(tool=>tool.id==='memory.search'))raw={action:'tool',tool:'memory.search',arguments:{query:raw.query}};
   if(raw?.action==='tool'){
    const args=input.normalizeToolArguments?input.normalizeToolArguments(raw.tool,raw.arguments,history):raw.arguments;input.check();
    return {kind:'tool' as const,tool:raw.tool,arguments:args,...(raw.assistantContent?{assistantContent:raw.assistantContent}:{})};
   }
   if(raw?.action==='tool_batch'){
    const calls=raw.calls.map(call=>({kind:'tool' as const,tool:call.tool,arguments:input.normalizeToolArguments?input.normalizeToolArguments(call.tool,call.arguments,history):call.arguments}));input.check();
    return {kind:'tools' as const,calls,...(raw.assistantContent?{assistantContent:raw.assistantContent}:{})};
   }
   return {kind:'final' as const,value:raw};
  },
  execute:(call,attemptIndex)=>input.traceTool?input.traceTool(call,()=>input.execute(call),attemptIndex):input.execute(call),
  onBudgetExhausted:history=>{
   const useful=input.hasUsefulEvidence?input.hasUsefulEvidence(history):history.some(item=>{
    if(item.error||item.result==null)return false;
    if(Array.isArray(item.result))return item.result.length>0;
    if(typeof item.result==='object')return Object.keys(item.result as object).length>0;
    return typeof item.result==='string'?item.result.length>0:true;
   });
   if(!useful)throw new AgentProtocolError('Agent could not find useful evidence before the optional call limit or model context capacity');
   // Keep already-read, source-pinned evidence and let the answer stage report
   // the incomplete coverage. Never execute the planner's over-budget action.
   return {action:'answer',query:''} as DialoguePlan;
  }
 });
 if(loop.attempts.length&&loop.final?.action==='edit')agentCorrectionTarget(loop.final,loop.calls);
 else if(loop.attempts.length&&!validAgentResultAction(loop.final?.action))throw Error('Read-only tool results require a grounded answer or a source-grounded new note');
 return loop;
}
