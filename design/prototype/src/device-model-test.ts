import type {GenerationFormat,GenerationResult} from './text-inference.ts';
import {parseDeviceModelSmokeAnswer} from './device-diagnostics.ts';
export type DeviceModelTestMode='quick'|'performance'|'full-cycle';
export type DeviceTestMode='app'|'model-readiness'|DeviceModelTestMode;
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
