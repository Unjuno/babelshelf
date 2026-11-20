import {groundedAnswer,type GroundedAnswerDependencies,type AnswerInference} from './grounded-answer.ts';
import type {TextRuntime} from './text-inference.ts';
import type {RunDiagnostic} from './task-records.ts';
import type {Preferences} from './preference-records.ts';
import {explicitCalculationInput} from './explicit-calculation.ts';
import {formatCalculation} from './calculation-action.ts';
import {validateScheduledCalculation} from './scheduled-calculation.ts';
import {validateDecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';
import {isSourceFreeConversationRequest} from './dialogue-planner.ts';
import {schedulePromptBody} from './scheduled-prompt.ts';
// @ts-expect-error Shared literal request parser is JavaScript.
import {localRequest} from '../../../dist/requests.js';

type Dependencies={store:GroundedAnswerDependencies['store'];models:{text:(model:string,check:()=>void)=>Promise<TextRuntime>};calculate?:(expression:string,check:()=>void)=>Promise<unknown>};
type Request={prompt:string;model:string;signal:AbortSignal;replyStyle:Preferences['harness']['replyStyle'];userGuidance:string};

export class ScheduleAnswerError extends Error{
 readonly diagnostic:RunDiagnostic;
 constructor(message:string,diagnostic:RunDiagnostic){super(message);this.name='ScheduleAnswerError';this.diagnostic=diagnostic;}
}
function repeatsSchedulePrompt(answer:string,prompt:string){
 const comparable=(value:string)=>value.normalize('NFKC').replace(/^#{1,6}\s*Prompt\s*\n/iu,'').replace(/^Prompt\s*:\s*/iu,'').replace(/\s+/gu,' ').trim().replace(/[.!?。！？]+$/gu,'').toLowerCase();
 const output=comparable(answer);
 return output===comparable(prompt)||output===comparable(schedulePromptBody(prompt));
}
function rejectRecoveredScheduleAnswer<T extends {answer:string;recovery?:string;recoveryReason?:string;model?:RunDiagnostic['model']}>(result:T,inference?:AnswerInference):T{
 if(result.recovery==='verbatim-source')throw new ScheduleAnswerError('Could not verify a schedule answer · edit the prompt and retry',{stage:'answer-validation',reason:result.recoveryReason??'verbatim-source-recovery',candidate:result.answer.slice(0,4000),model:result.model,...(inference?{inference}:{})});
 return result;
}

/** Scheduled execution shares local acquisition and grounded answering, but has
 * no planner/tool registry, navigation, proposal or knowledge-write port. */
export async function executeScheduledAnswer(dependencies:Dependencies,input:Request){
 const {prompt,model,signal,replyStyle,userGuidance}=input;
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 const question=schedulePromptBody(prompt);
 const request=localRequest(question);
 if(request?.action==='capture')throw Error('Scheduled work is read-only');
 const calculation=explicitCalculationInput(question);
 if(calculation&&dependencies.calculate){const receipt=validateDecimalReceipt(await dependencies.calculate(calculation.expression,check));check();const answer=formatCalculation(receipt,calculation.showExpression?calculation.expression:undefined,calculation.unit);return {answer,sources:[],calculation:validateScheduledCalculation(question,answer,receipt)};}
 const conversationRequest=isSourceFreeConversationRequest(question);
 let engine:TextRuntime;try{engine=await dependencies.models.text(model,check);check();}catch(error){throw new ScheduleAnswerError((error as Error).message,{stage:'model-acquisition',reason:(error as Error).message,model:{id:model}});}
 let inference:AnswerInference|undefined,candidate='';
 const observedEngine=new Proxy(engine,{get(target,property){if(property==='generate'){const generate=Reflect.get(target,property,target) as TextRuntime['generate'];return async(...args:Parameters<TextRuntime['generate']>)=>{const result=await generate.apply(target,args);if(typeof result.text==='string')candidate=result.text.slice(0,4000);return result;};}return Reflect.get(target,property,target);}});
 const answer=(request:Parameters<typeof groundedAnswer>[1])=>groundedAnswer({store:dependencies.store,engine:observedEngine},{...request,onInference:metrics=>{inference={...metrics};}}).catch(error=>{
  const message=(error as Error).message,sourceLeak=['InternalSourceLabelLeakError','InternalImplementationLeakError'].includes((error as Error).name)||message==='Invalid answer or sources'||message==='Citation mismatch';
  throw new ScheduleAnswerError(message,{stage:sourceLeak?'answer-validation':'generation',reason:message,...(candidate?{candidate}:{}),model:{id:model,revision:engine.manifest.models.find(item=>item.id===model)?.revision,runtime:engine.manifest.runtime.revision},...(inference?{inference}:{})});
 });
 if(conversationRequest){
  const request={model,question,query:'',mode:'chat' as const,scope:{kind:'conversation' as const},context:{summary:'',recent:[],refs:[],turnCount:0},check,replyStyle,userGuidance};
  let result=await answer(request);
  // Small local models occasionally echo a short scheduled instruction. Give
  // that exact failure one bounded repair while preserving the original task.
  if(repeatsSchedulePrompt(result.answer,question)){
   result=await answer({...request,userGuidance:[userGuidance,'For this scheduled task, provide the requested result directly. Do not quote, restate, or explain the instruction.'].filter(Boolean).join('\n')});
   if(repeatsSchedulePrompt(result.answer,question))throw new ScheduleAnswerError('Could not verify a schedule answer · edit the prompt and retry',{stage:'answer-validation',reason:'prompt-echo-after-repair',candidate:result.answer.slice(0,4000),model:result.model,...(inference?{inference}:{})});
  }
  return rejectRecoveredScheduleAnswer(result,inference);
 }
 const result=await answer({model,question,query:request?.query??question,mode:request?.action==='summary'?'summary':'answer',check,scope:{kind:'knowledge'},replyStyle,userGuidance});
 if(result.status==='insufficient_evidence')throw new ScheduleAnswerError('Not enough evidence · '+result.answer,{stage:'answer-validation',reason:'The saved sources do not support an answer',candidate:result.answer.slice(0,4000),model:{id:model,revision:engine.manifest.models.find(item=>item.id===model)?.revision,runtime:engine.manifest.runtime.revision},...(inference?{inference}:{})});
 // A verbatim-source recovery is useful in an interactive answer, where its
 // provenance is shown. A scheduled run exposes only the answer text; storing
 // that recovery as success would hide that the model's answer failed shape
 // validation and could turn the saved prompt into a false successful result.
 return rejectRecoveredScheduleAnswer(result,inference);
}
