import type {DialogueContext} from './conversation.ts';
// Current submitted originals own this scope. Prior focus remains durable but is
// not a competing input to the planner for a new attachment request.
export function planningContextForInputs(context:DialogueContext,currentInputs:boolean):DialogueContext{if(!currentInputs)return context;const {currentFile,...rest}=context;return rest;}
export function bindCurrentInputRequest<T extends {action:string;target?:string;historyIndex?:number|null}>(request:T,currentInputs:boolean):T&{target?:string}{
 if(!currentInputs){if(request.target==='inputs')throw Error('Current inputs unavailable');return request;}
 if(request.action==='capture'&&request.historyIndex!=null&&request.target===undefined)return request;
 if(['current','history'].includes(request.target??'')&&['recall','transform','capture'].includes(request.action))return request;
 if(request.target!==undefined&&request.target!=='inputs')throw Error('Choose the opened file or current attachments');
 if(['answer','summary','capture'].includes(request.action))return {...request,target:'inputs'};
 if(request.target==='inputs')throw Error('Invalid current input action');return request;
}
