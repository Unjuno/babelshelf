import {groundedAnswer,type GroundedAnswerDependencies} from './grounded-answer.ts';
import type {TextRuntime} from './text-inference.ts';
import type {Preferences} from './preference-records.ts';
import {explicitCalculationInput} from './explicit-calculation.ts';
import {formatCalculation} from './calculation-action.ts';
import {validateScheduledCalculation} from './scheduled-calculation.ts';
import {validateDecimalReceipt} from './tools/math.calculate/decimal-receipt.ts';
// @ts-expect-error Shared literal request parser is JavaScript.
import {localRequest} from '../../../dist/requests.js';

type Dependencies={store:GroundedAnswerDependencies['store'];models:{text:(model:string,check:()=>void)=>Promise<TextRuntime>};calculate?:(expression:string,check:()=>void)=>Promise<unknown>};
type Request={prompt:string;model:string;signal:AbortSignal;replyStyle:Preferences['harness']['replyStyle'];userGuidance:string};

/** Scheduled execution shares local acquisition and grounded answering, but has
 * no planner/tool registry, navigation, proposal or knowledge-write port. */
export async function executeScheduledAnswer(dependencies:Dependencies,input:Request){
 const {prompt,model,signal,replyStyle,userGuidance}=input;
 const check=()=>{if(signal.aborted)throw Error('Stopped');};check();
 const request=localRequest(prompt);
 if(request?.action==='capture')throw Error('Scheduled work is read-only');
 const calculation=explicitCalculationInput(prompt);
 if(calculation&&dependencies.calculate){const receipt=validateDecimalReceipt(await dependencies.calculate(calculation.expression,check));check();const answer=formatCalculation(receipt,calculation.showExpression?calculation.expression:undefined,calculation.unit);return {answer,sources:[],calculation:validateScheduledCalculation(prompt,answer,receipt)};}
 const engine=await dependencies.models.text(model,check);check();
 return groundedAnswer({store:dependencies.store,engine},{model,question:prompt,query:request?.query??prompt,mode:request?.action==='summary'?'summary':'answer',check,scope:{kind:'knowledge'},replyStyle,userGuidance});
}
