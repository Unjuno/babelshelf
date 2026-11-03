import type {GenerationFormat,GenerationResult} from './text-inference.ts';
import {parseDeviceModelSmokeAnswer} from './device-diagnostics.ts';
export type DeviceModelTestMode='quick'|'performance'|'full-cycle';
export type DeviceTestMode='app'|'offline-readiness'|'storage-health'|'runtime-support'|'model-readiness'|DeviceModelTestMode;
export type DeviceModelTestFailureStage='runtime-setup'|'model-preparation'|'model-load'|'count'|'generation'|'warm-generation'|'output-validation'|'unload';
const knownFailureCodes=new Set(['stopped','incomplete-output','empty-output','model-files-not-ready','restart-pending','return-attempt-interrupted','another-model-loaded','model-test-not-run','no-model-selected','selected-model-changed','downloads-off','offline-signal','runtime-unavailable','runtime-messaging-unavailable','runtime-invalid-response','runtime-timeout','runtime-assets-unavailable','runtime-not-prepared','runtime-http-error','runtime-network-error','runtime-integrity-error','runtime-storage-error','runtime-setup-error']);
/** Keep device reports useful without retaining raw exception text or user data. */
export function deviceModelTestFailureType(error:unknown,stage:DeviceModelTestFailureStage){
 const value=error&&typeof error==='object'?error as {code?:unknown;message?:unknown;name?:unknown}:{};
 if(typeof value.code==='string'&&knownFailureCodes.has(value.code))return value.code;
 const message=typeof value.message==='string'?value.message:'';
 if(message==='Runtime not prepared · switch Online to prepare')return 'runtime-not-prepared';
 if(message==='Runtime check timed out · retry')return 'runtime-timeout';
 if(message==='App runtime unavailable · reopen the installed app')return 'runtime-unavailable';
 if(message==='App runtime messaging unavailable'||message==='Could not start app runtime preparation')return 'runtime-messaging-unavailable';
 if(message==='Invalid app runtime response')return 'runtime-invalid-response';
 if(message==='Runtime assets unavailable for this feature')return 'runtime-assets-unavailable';
 if(message==='Downloads are off')return 'downloads-off';
 if(message==='Stopped')return 'stopped';
 if(stage==='runtime-setup'&&value.name==='TypeError')return 'runtime-network-error';
 return `${stage}-error`;
}
export class DeviceModelTestError extends Error{
 readonly code:'stopped'|'incomplete-output'|'empty-output';
 constructor(code:'stopped'|'incomplete-output'|'empty-output',message:string){super(message);this.name='DeviceModelTestError';this.code=code;}
}
export function deviceModelTestProfile(mode:DeviceModelTestMode){
 if(mode==='quick')return {workload:'ready-v1' as const,maxTokens:64,format:'dialogue-answer' as GenerationFormat,messages:[{role:'system',content:'Return exactly one JSON object with no additional properties. Set the answer field to the exact string READY.'},{role:'user',content:'Return the required answer now.'}]};
 if(mode!=='performance'&&mode!=='full-cycle')throw Error('Unknown device test mode');
 return {workload:'prose-128-v2' as const,maxTokens:128,format:'prose' as GenerationFormat,messages:[{role:'system',content:'You are running a local generation timing sample. Answer directly in plain English. Do not use tools.'},{role:'user',content:'Explain how sorting a list of numbers works in about 50 words.'}]};
}
export function deviceWarmModelTestProfile(){return {workload:'warm-64-v1' as const,maxTokens:64,format:'prose' as GenerationFormat,messages:[{role:'system',content:'You are running a local generation timing sample. Answer directly in plain English. Do not use tools.'},{role:'user',content:'Give one practical example of sorting a short list of numbers in about 25 words.'}]};}
export function validateDeviceModelTest(mode:DeviceModelTestMode,result:Pick<GenerationResult,'text'|'stopped'|'finishReason'>){
 if(result.stopped)throw new DeviceModelTestError('stopped','Stopped');
 if(mode==='quick')return parseDeviceModelSmokeAnswer(result.text).length;
 if(mode!=='performance'&&mode!=='full-cycle')throw Error('Unknown device test mode');
 if(result.finishReason==='length')throw new DeviceModelTestError('incomplete-output','Generation reached the output limit before it was complete');
 if(!result.text.trim())throw new DeviceModelTestError('empty-output','Empty generation');return result.text.length;
}
