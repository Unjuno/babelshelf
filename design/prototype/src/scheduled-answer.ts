import {groundedAnswer,type GroundedAnswerDependencies} from './grounded-answer.ts';
import type {TextRuntime} from './text-inference.ts';
import type {Preferences} from './preference-records.ts';
import {explicitCalculationInput} from './explicit-calculation.ts';
import {formatCalculation} from './calculation-action.ts';
import {validateScheduledCalculation} from './scheduled-calculation.ts';
import {validateDecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';
import {isSourceFreeConversationRequest} from './dialogue-planner.ts';
// @ts-expect-error Shared literal request parser is JavaScript.
import {localRequest} from '../../../dist/requests.js';

type Dependencies={store:GroundedAnswerDependencies['store'];models:{text:(model:string,check:()=>void)=>Promise<TextRuntime>};calculate?:(expression:string,check:()=>void)=>Promise<unknown>};
type Request={prompt:string;model:string;signal:AbortSignal;replyStyle:Preferences['harness']['replyStyle'];userGuidance:string};

function schedulePromptBody(prompt:string){
 const trimmed=prompt.trim();
 // Audit labels are metadata, not part of the task. Keep this grammar narrow
 // so arbitrary user instructions are never stripped or reinterpreted.
 const labelled=trimmed.match(/^(?:R\d{1,3}\s+)?run\s+(?:test\s+\d{1,3}|[a-z])\s*[—–:-]\s*(.{1,160})$/iu)
  ??trimmed.match(/^(?:R\d{1,3}\s*[—–:-]\s*)(.{1,160})$/iu);
 return labelled?.[1]?.trim()||prompt;
}

function rejectRecoveredScheduleAnswer<T extends {recovery?:string}>(result:T):T{
 if(result.recovery==='verbatim-source')throw Error('Could not verify a schedule answer · edit the prompt and retry');
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
 const engine=await dependencies.models.text(model,check);check();
 if(conversationRequest){
  const result=await groundedAnswer({store:dependencies.store,engine},{model,question,query:'',mode:'chat',scope:{kind:'conversation'},context:{summary:'',recent:[],refs:[],turnCount:0},check,replyStyle,userGuidance});
  return rejectRecoveredScheduleAnswer(result);
 }
 const result=await groundedAnswer({store:dependencies.store,engine},{model,question,query:request?.query??question,mode:request?.action==='summary'?'summary':'answer',check,scope:{kind:'knowledge'},replyStyle,userGuidance});
 if(result.status==='insufficient_evidence')throw Error('Not enough evidence · '+result.answer);
 // A verbatim-source recovery is useful in an interactive answer, where its
 // provenance is shown. A scheduled run exposes only the answer text; storing
 // that recovery as success would hide that the model's answer failed shape
 // validation and could turn the saved prompt into a false successful result.
 return rejectRecoveredScheduleAnswer(result);
}
