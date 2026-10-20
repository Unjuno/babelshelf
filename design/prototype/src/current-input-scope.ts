import type {DialogueContext} from './conversation.ts';
import {requestNamesEarlierDialogue} from './conversation.ts';
// A single self-contained question about the submitted originals already has
// its subject. It needs read-only answering, not another model-selected action.
// This finite route neither grants writes nor repairs a failed planner output.
export function explicitInputQuestion(question:string,currentInputs:boolean){
 const text=question.trim();
 if(!currentInputs||text.length>500||/[\r\n;；]/u.test(text)||requestNamesEarlierDialogue(text)||!/[?？]$/u.test(text)||/[?？]/u.test(text.slice(0,-1)))return null;
 const english=/^(?:what|which|where|when|who|why|how)\b/iu.test(text)&&/\b(?:this|these|attached|current)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,3}(?:images?|photos?|pictures?|files?|attachments?|documents?|recordings?|audio|videos?)\b/iu.test(text);
 const japanese=/^(?:この|これらの|添付(?:した|された)?).*(?:画像|写真|ファイル|文書|資料|録音|音声|動画).*(?:何|どこ|なぜ|どう|どれ|いつ)/u.test(text);
 return english||japanese?{action:'answer' as const,query:question,target:'inputs' as const}:null;
}
// Current attachments are already selected by canonical ID/revision. A planner's
// history-derived search hint cannot introduce prior attachment facts here.
// Keep that proposal in its activity receipt; this selects the execution query.
export function groundingQuery(question:string,proposed:string,currentInputs:boolean){return currentInputs?question:proposed||question;}
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
