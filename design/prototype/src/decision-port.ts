import type {DecisionQuestion} from './decision.ts';
// App-owned adapter identity. Model output cannot declare runtime capabilities.
export type DecisionIdentity={model:string;revision:string;inputLimit:number;scope:'text-only'};
export type DecisionRuntime={readonly identity:DecisionIdentity;classify:(state:string,question:DecisionQuestion)=>Promise<any>};
export function pinDecisionIdentity(value:DecisionIdentity):Readonly<DecisionIdentity>{
 if(!value||typeof value.model!=='string'||!value.model||value.model.length>128||typeof value.revision!=='string'||!value.revision||value.revision.length>256||!Number.isSafeInteger(value.inputLimit)||value.inputLimit<1||value.inputLimit>1000000||value.scope!=='text-only')throw Error('Invalid decision runtime identity');
 return Object.freeze({model:value.model,revision:value.revision,inputLimit:value.inputLimit,scope:value.scope});
}
