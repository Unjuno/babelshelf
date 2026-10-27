import type {DialogueContext} from './conversation.ts';
import {requestNamesEarlierDialogue} from './conversation.ts';
import type {CurrentInputRef} from './input-readings.ts';
export const audioOnlySuffix=(text:string)=>/^[^?？\r\n;；]+[?？]\s*use only the audio[.!]?$/iu.test(text.trim());
/** Select only the embedded transcript range of a mixed video observation. */
export function constrainAudioOnlyInputs(question:string,inputs:CurrentInputRef[],attachments:{kind:string}[]):CurrentInputRef[]{
 if(!audioOnlySuffix(question))return inputs;
 if(attachments.length!==1||!['audio','video'].includes(attachments[0].kind)||inputs.length!==1)throw Error('Audio-only transcript unavailable');
 if(attachments[0].kind==='video'&&inputs[0].kind==='vision')return [{...inputs[0],kind:'video-audio'}];
 if(inputs[0].kind!=='speech')throw Error('Audio-only transcript unavailable');
 return inputs;
}
// A single self-contained question about the submitted originals already has
// its subject. It needs read-only answering, not another model-selected action.
// This finite route neither grants writes nor repairs a failed planner output.
export function explicitInputQuestion(question:string,currentInputs:boolean){
 const text=question.trim();
 if(!currentInputs||text.length>500||/[\r\n;；]/u.test(text)||requestNamesEarlierDialogue(text))return null;
 const parts=text.split(/[?？]/u);if(parts.length!==2)return null;
 // A bounded output-format suffix does not turn a file question into a write
 // request. Mixed actions and second questions still go through normal planning.
 const tail=parts[1].trim();
 if(tail&&!/^(?:(?:reply|respond|answer)(?:\s+with)?|return)\s+(?:the\s+)?(?:code|number|answer|text|value|name|date|time|result|phrase)(?:\s+only)?[.!]?$/iu.test(tail)&&!audioOnlySuffix(text))return null;
 // A question can contain a second imperative before its question mark. Do not
 // silently drop that operation by treating the whole request as read-only.
 if(/\b(?:delete|remove|edit|change|save|write|create|send|schedule|update|modify|replace|rename|search|find|open|run|execute)\b|(?:削除|消して|編集|修正|訂正|変更|保存|書き込|作成|送信|検索|探して|実行|移動|改名|置き換)/iu.test(parts[0]))return null;
 const english=/^(?:what|which|where|when|who|why|how)\b/iu.test(text)&&/\b(?:this|these|attached|current)\s+(?:(?:[\p{L}\p{N}-]+)\s+){0,3}(?:images?|photos?|pictures?|files?|attachments?|documents?|pdfs?|recordings?|audio|videos?|text)\b/iu.test(text);
 const explicitTextPrefix=/^using\s+only\s+the\s+attached\s+(?:text|pdf|document|image|audio|video)\s*,\s*(?:what|which|where|when|who|why|how)\b[^?？]*\?/iu.test(text);
 const japanese=/^(?:この|これらの|添付(?:した|された)?).*(?:画像|写真|ファイル|文書|テキスト|文章|PDF|資料|録音|音声|動画).*(?:何|どこ|なぜ|どう|どれ|いつ)/u.test(text);
 return english||explicitTextPrefix||japanese?{action:'answer' as const,query:question,target:'inputs' as const}:null;
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
