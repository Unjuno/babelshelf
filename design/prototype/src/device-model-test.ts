import type {GenerationFormat,GenerationResult} from './text-inference.ts';
import {parseDeviceModelSmokeAnswer} from './device-diagnostics.ts';
export type DeviceTestMode='quick'|'performance';
export function deviceModelTestProfile(mode:DeviceTestMode){
 if(mode==='quick')return {workload:'ready-v1' as const,maxTokens:64,format:'dialogue-answer' as GenerationFormat,messages:[{role:'system',content:'Return exactly one JSON object with no additional properties. Set the answer field to the exact string READY.'},{role:'user',content:'Return the required answer now.'}]};
 if(mode!=='performance')throw Error('Unknown device test mode');
 return {workload:'prose-128-v1' as const,maxTokens:128,format:'prose' as GenerationFormat,messages:[{role:'system',content:'You are running a local generation timing sample. Answer directly in plain English. Do not use tools.'},{role:'user',content:'Explain how sorting a list of numbers works. Write a detailed explanation of at least 200 words.'}]};
}
export function validateDeviceModelTest(mode:DeviceTestMode,result:Pick<GenerationResult,'text'|'stopped'|'finishReason'>){
 if(result.stopped)throw Error('Stopped');
 if(mode==='quick')return parseDeviceModelSmokeAnswer(result.text).length;
 if(mode!=='performance')throw Error('Unknown device test mode');
 if(!result.text.trim())throw Error('Empty generation');return result.text.length;
}
