import {cleanReasoningMarkup,dialogueAnswerMessages,groundedAnswer,type GroundedAnswerDependencies,type AnswerInference} from './grounded-answer.ts';
import type {TextRuntime} from './text-inference.ts';
import type {RunDiagnostic} from './task-records.ts';
import type {Preferences} from './preference-records.ts';
import {addMeasurement,observeInference} from './inference-measurements.ts';
import {hasInternalImplementationLeak} from './agent-evidence.ts';
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
function mergeInference(total:AnswerInference|undefined,next:Readonly<AnswerInference>):AnswerInference{
 if(!total)return {...next};
 total.measuredModelCalls=addMeasurement(total.measuredModelCalls,next.measuredModelCalls,true)??total.measuredModelCalls;
 for(const key of ['promptTokens','outputTokens','countMs','generationWallMs','runtimeTtftMs','runtimePrefillMs','runtimeDecodeMs','runtimeCachedTokens'] as const){
  const value=addMeasurement(total[key],next[key],key==='promptTokens'||key==='outputTokens'||key==='runtimeCachedTokens');if(value!==undefined)total[key]=value;
 }
 return total;
}
function scheduledProse(text:string,question:string){
 const raw=text.slice(0,4000);
 // A GGUF template can leak an orphan </think> between reasoning and final
 // prose. Remove the prefix only when the post-marker answer duplicates it;
 // otherwise preserve useful text on both sides of the boundary.
 const orphan=/<\/think\s*>/iu.exec(text);
 let normalized=cleanReasoningMarkup(text);
 if(orphan){
  const prefix=text.slice(0,orphan.index),suffix=text.slice(orphan.index+orphan[0].length);
  const comparable=(value:string)=>value.replace(/<think\b[^>]*>[\s\S]*?(?:<\/think\s*>|$)/giu,'').replace(/<\|(?:analysis|final)\|>/giu,'').replace(/\s+/gu,' ').trim().replace(/[.!?。！？]+$/gu,'').toLocaleLowerCase();
  if(comparable(prefix)&&comparable(suffix)&&comparable(prefix)===comparable(suffix))normalized=suffix;
 }
 const visible=normalized.replace(/<\|(?:analysis|final)\|>/giu,'').trim();
 if(!visible)return {answer:'',reason:'empty-answer',candidate:raw};
 let answer=visible;
 if(/^\s*\{/u.test(visible)){
  try{const parsed=JSON.parse(visible) as Record<string,unknown>;if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)&&typeof parsed.answer==='string'&&(!('status'in parsed)||parsed.status==='answered')&&Array.isArray(parsed.sources)&&parsed.sources.length===0&&Object.keys(parsed).every(key=>['status','answer','sources'].includes(key)))answer=parsed.answer.trim();else return {answer:'',reason:'answer-shape',candidate:raw};}
  catch{return {answer:'',reason:'answer-shape',candidate:raw};}
 }
 const requestedLabels=new Set(question.match(/\bS\d+\b/gu)??[]);
 if([...(answer.match(/\bS\d+\b/gu)??[])].some(label=>!requestedLabels.has(label)))return {answer:'',reason:'internal-source-label',candidate:raw};
 if(hasInternalImplementationLeak(answer,'',[]))return {answer:'',reason:'internal-implementation-leak',candidate:raw};
 return {answer,reason:'',candidate:raw};
}
async function scheduledConversation(engine:TextRuntime,input:{question:string;model:string;signal:AbortSignal;replyStyle:Preferences['harness']['replyStyle'];userGuidance:string}){
 const {question,model,signal,replyStyle,userGuidance}=input,check=()=>{if(signal.aborted)throw Error('Stopped');},manifest=engine.manifest,modelInfo={id:model,revision:manifest.models.find(item=>item.id===model)?.revision,runtime:manifest.runtime.revision};
 const inference:AnswerInference={measuredModelCalls:0};let candidate='';
 try{
  check();if(engine.loaded!==model)throw Error('Text model did not load');const pinned=engine.pin?.()??engine,measured=observeInference(pinned,inference);
  const base=dialogueAnswerMessages(question,undefined,replyStyle,userGuidance),protocol=' This is a scheduled, read-only response. Answer the current user request directly in its language. Do not repeat or quote the request, mention schedules, emit source labels, citations, tool calls, internal fields or an answer envelope. Do not claim that anything was saved, sent or executed. Give only the user-facing answer and honor the requested length or format.';
  const makeMessages=(retry=false)=>base.map(message=>message.role==='system'?{...message,content:message.content+protocol+(retry?' The previous response did not meet this format. Do not quote, restate, or explain the instruction. Rewrite a direct answer to the original request.':'')}:message);
  for(let attempt=0;attempt<2;attempt++){
   check();const messages=makeMessages(attempt>0),count=await measured.count(messages,'prose');check();
   if(!Number.isSafeInteger(count.prompt_tokens)||count.prompt_tokens<0)throw Error('Invalid token count');
   const budget=Math.min(manifest.maxOutputTokens??256,manifest.contextTokens-count.prompt_tokens);if(budget<1)throw Error('Response exceeded model context limit');
   const result=await measured.generate(messages,budget,'prose');check();if(result.stopped)throw Error('Stopped');candidate=result.text.slice(0,4000);
   const parsed=scheduledProse(result.text,question);
   if(parsed.answer&&!repeatsSchedulePrompt(parsed.answer,question))return {answer:parsed.answer,sources:[],model:modelInfo,inference};
   const reason=parsed.reason||'prompt-echo';
   if(attempt===1)throw new ScheduleAnswerError('Could not verify a schedule answer · edit the prompt and retry',{stage:'answer-validation',reason:reason==='prompt-echo'?'prompt-echo-after-repair':reason,candidate:parsed.candidate||candidate,model:modelInfo,inference:{...inference}});
  }
  throw new ScheduleAnswerError('Could not verify a schedule answer · edit the prompt and retry',{stage:'answer-validation',reason:'empty-answer',candidate,model:modelInfo,inference:{...inference}});
 }catch(error){if(error instanceof ScheduleAnswerError)throw error;throw new ScheduleAnswerError((error as Error).message,{stage:'generation',reason:(error as Error).message,...(candidate?{candidate}:{}),model:modelInfo,...(inference.measuredModelCalls?{inference:{...inference}}:{})});}
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
 const observeEngine=(runtime:TextRuntime):TextRuntime=>new Proxy(runtime,{get(target,property){if(property==='generate'){const generate=Reflect.get(target,property,target) as TextRuntime['generate'];return async(...args:Parameters<TextRuntime['generate']>)=>{const result=await generate.apply(target,args);if(typeof result.text==='string')candidate=result.text.slice(0,4000);return result;};}if(property==='pin'){const pin=Reflect.get(target,property,target) as TextRuntime['pin'];return typeof pin==='function'?()=>{const pinned=pin.call(target);return pinned?observeEngine(pinned):pinned;}:undefined;}return Reflect.get(target,property,target);}});
 const observedEngine=observeEngine(engine);
 const answer=(request:Parameters<typeof groundedAnswer>[1])=>groundedAnswer({store:dependencies.store,engine:observedEngine},{...request,onInference:metrics=>{inference=mergeInference(inference,metrics);}}).catch(error=>{
  const message=(error as Error).message,sourceLeak=['InternalSourceLabelLeakError','InternalImplementationLeakError'].includes((error as Error).name)||message==='Invalid answer or sources'||message==='Citation mismatch';
  throw new ScheduleAnswerError(message,{stage:sourceLeak?'answer-validation':'generation',reason:message,...(candidate?{candidate}:{}),model:{id:model,revision:engine.manifest.models.find(item=>item.id===model)?.revision,runtime:engine.manifest.runtime.revision},...(inference?{inference}:{})});
 });
 if(conversationRequest){
  return scheduledConversation(engine,{question,model,signal,replyStyle,userGuidance});
 }
 const result=await answer({model,question,query:request?.query??question,mode:request?.action==='summary'?'summary':'answer',check,scope:{kind:'knowledge'},replyStyle,userGuidance});
 if(result.status==='insufficient_evidence')throw new ScheduleAnswerError('Not enough evidence · '+result.answer,{stage:'answer-validation',reason:'The saved sources do not support an answer',candidate:result.answer.slice(0,4000),model:{id:model,revision:engine.manifest.models.find(item=>item.id===model)?.revision,runtime:engine.manifest.runtime.revision},...(inference?{inference}:{})});
 // A verbatim-source recovery is useful in an interactive answer, where its
 // provenance is shown. A scheduled run exposes only the answer text; storing
 // that recovery as success would hide that the model's answer failed shape
 // validation and could turn the saved prompt into a false successful result.
 return rejectRecoveredScheduleAnswer(result,inference);
}
