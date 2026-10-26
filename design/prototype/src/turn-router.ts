// Application routing policy for one submitted turn. Model adapters, UI state,
// activity persistence and action execution remain behind caller-owned ports.
import {contextIndependentConversation,currentDialogueResult,dialogueContext,requestNamesEarlierDialogue,requestNamesWorkingFile,type Dialogue,type DialogueContext,type DialoguePlan} from './conversation.ts';
import {explicitInputQuestion} from './current-input-scope.ts';
import {bindCurrentInputRequest} from './current-input-scope.ts';
import {routeInputRequest,type CurrentInputRef} from './input-readings.ts';
import {namedSavedSubject,namesDeicticFile,namesExplicitSavedKnowledge,namesSavedKnowledge} from './saved-knowledge-reference.ts';
import {bindExplicitCurrentFileQuestion,bindWorkingFileRequest,scopeLiteralRequest,type WorkingFile} from './working-file.ts';
import {earlierOperationContext} from './dialogue-outcomes.ts';

/** The user names the current assistant answer, not a Memory search subject.
 * Bind only a single read-only rewrite; the model still performs the rewrite.
 * The canonical dialogue resolver owns its exact turn/speaker and missing target.
 */
export function explicitCurrentAnswerRewrite(question:string){
 const text=question.trim();if(!text||text.length>500||/[\r\n;；"“”「」『』`]/u.test(text))return null;
 if(/\b(?:save|store|record|remember|delete|remove|overwrite|edit|update|schedule|notify|search|find|open|read|compare|tools?|mcp|execute|run|call|files?|notes?|documents?|images?|attachments?|recordings?|videos?)\b|(?:保存|記録|削除|上書|訂正|更新|予定|通知|検索|探して|比較|ツール|実行|呼び出|ファイル|メモ|ノート|文書|画像|添付|録音|動画)/iu.test(text))return null;
 const english=/^(?:(?:please|can you|could you|would you)\s+)?(?:summari[sz]e|translate|rephrase|rewrite|shorten|format|reformat|convert|put|turn|make)\b.*\b(?:your\s+(?:(?:last|previous|latest|current)\s+)?(?:answer|reply|response)|the\s+(?:last|previous|latest|current)\s+(?:answer|reply|response))\b/iu.test(text);
 const japanese=/^(?:今の|直前の)(?:あなたの)?(?:回答|返答|応答)(?:を|について).*(?:まとめ|要約|翻訳|訳して|言い換え|書き直|短く|に(?:して|変えて|変換して)|整形して)/u.test(text);
 return english||japanese?{action:'recall' as const,query:question,target:'current' as const}:null;
}

// The rest of a question can overwhelm the lexical index. Keep a named saved
// file's descriptor as the query; the full request is still used for answering.
export function savedKnowledgeSearchQuery(question:string){
 const named=/\b(?:saved|stored)\s+((?:(?:[\p{L}\p{N}-]+)\s+){1,8})(?:notes?|files?|documents?|records?)\b/iu.exec(question);
 return named?.[1].trim()||namedSavedSubject(question)?.trim()||question;
}

/** Only an imperative search that names saved Memory and a concrete topic is
 * deterministic. Questions, writes, attachments and vague searches keep their
 * existing routes so this optimization cannot guess the user's source. */
export function explicitSavedKnowledgeSearch(question:string,currentInputs=false){
 const text=question.trim();if(currentInputs||text.length>300||requestNamesEarlierDialogue(text))return null;
 const english=/^(?:please\s+)?(?:find|search|look\s+(?:for|up))\s+(?:(?:for|in|through)\s+)?(?:(?:my|saved|stored)\s+)?(?:notes?|files?|documents?|records?)\s+(?:about|on|for|containing)\s+(.+?)[?.!]*$/iu;
 const englishReverse=/^(?:please\s+)?(?:find|search|look\s+(?:for|up))\s+(?:for\s+)?(.{2,140}?)\s+in\s+(?:(?:my|saved|stored)\s+)?(?:notes?|files?|documents?|records?)[?.!]*$/iu;
 const japanese=/(?:^|\s)(.{2,120}?)(?:について|に関する)\s*(?:(?:保存した|保存済み|自分の|私の)\s*)?(?:メモ|ノート|ファイル|文書)(?:を)?(?:探して|検索して|検索|見つけて)[。！？?！]*$/u;
 const japaneseReverse=/^(?:(?:保存した|保存済み|自分の|私の)\s*)?(?:メモ|ノート|ファイル|文書)(?:から|で)\s*(.{2,120}?)(?:を)?(?:探して|検索して|見つけて)[。！？?！]*$/u;
 const found=english.exec(text)??englishReverse.exec(text)??japanese.exec(text)??japaneseReverse.exec(text);if(!found)return null;
 const query=found[1].trim().replace(/^["'“”‘’`]+|["'“”‘’`]+$/gu,'').replace(/^(?:the|a|an)\s+/iu,'').trim();
 if(query.length<2||query.length>140||/[\r\n\0]/u.test(query)||/\s+(?:and|then)\s+(?:summari[sz]e|open|read|answer|explain|tell|show|compare|list|edit|delete|save|write)\b/iu.test(query))return null;
 return {action:'search' as const,query,target:'knowledge' as const};
}

/** An exact saved-file open/read command can go straight to the read-only
 * Memory path. Keep questions and compound requests on the planner route. */
export function explicitSavedKnowledgeOpen(question:string,currentInputs=false){
 const text=question.trim();if(currentInputs||text.length>300||requestNamesEarlierDialogue(text))return null;
 const english=/^(?:please\s+)?(?:open|read|show)\s+(?:(?:my|saved|stored)\s+)?(?:the\s+)?(?:(?:saved|stored)\s+)?(?:notes?|files?|documents?|records?)\s+(?:about|on|for|named|titled)\s+(.+?)[?.!]*$/iu;
 const japanese=/(?:^|\s)(.{2,120}?)(?:について|に関する)\s*(?:(?:保存した|保存済み|自分の|私の)\s*)?(?:メモ|ノート|ファイル|文書)(?:を)?(?:開いて|読んで|表示して)[。！？?！]*$/u;
 const japaneseReverse=/^(?:(?:保存した|保存済み|自分の|私の)\s*)?(?:メモ|ノート|ファイル|文書)(?:から|で|について)?\s*(.{2,120}?)(?:を)?(?:開いて|読んで|表示して)[。！？?！]*$/u;
 const found=english.exec(text)??japanese.exec(text)??japaneseReverse.exec(text);if(!found)return null;
 const query=found[1].trim().replace(/^['"“”‘’`]+|['"“”‘’`]+$/gu,'').replace(/^(?:the|a|an)\s+/iu,'').trim();
 if(query.length<2||query.length>140||/[\r\n\0?？]/u.test(query)||/\s+(?:and|then)\s+(?:summari[sz]e|open|read|answer|explain|tell|show|compare|list|edit|delete|save|write)\b/iu.test(query))return null;
 return {action:'read' as const,query,target:'knowledge' as const};
}

/** A single summary command naming saved Memory needs retrieval and generation,
 * not dialogue planning. The descriptor selects evidence; the full user request
 * still reaches the grounded summarizer. No write or implicit file selection. */
export function explicitSavedKnowledgeSummary(question:string,currentInputs=false){
 const text=question.trim();if(currentInputs||text.length>500||/[\r\n\0;；]/u.test(text)||requestNamesEarlierDialogue(text))return null;
 const englishNamed=/^(?:(?:please|can you|could you|would you)\s+)?(?:(?:briefly|concisely)\s+)?summari[sz]e\s+(?:(?:my|the)\s+)?(?:saved|stored)\s+(.{2,120}?)\s+(?:notes?|files?|documents?|records?)(?:\s+(?:briefly|concisely))?[.!?]*$/iu;
 const englishAbout=/^(?:(?:please|can you|could you|would you)\s+)?(?:(?:briefly|concisely)\s+)?summari[sz]e\s+(?:(?:my|the)\s+)?(?:saved|stored)\s+(?:notes?|files?|documents?|records?)\s+(?:about|on|for|named|titled)\s+(.{2,120}?)(?:\s+(?:briefly|concisely))?[.!?]*$/iu;
 const japanese=/^(?:保存した|保存済みの?|私の|自分の)(.{2,120}?)(?:についての|に関する|の)?(?:メモ|ノート|ファイル|文書)(?:を)?(?:短く|簡潔に|手短に)?(?:要約して|まとめて)(?:ください)?[。！？?!]*$/u;
 const found=englishNamed.exec(text)??englishAbout.exec(text)??japanese.exec(text);if(!found)return null;
 const query=found[1].trim().replace(/^["'“”‘’`]+|["'“”‘’`]+$/gu,'').replace(/^(?:the|a|an)\s+/iu,'').trim();
 if(query.length<2||query.length>140||/[?？。.!！,、]/u.test(query)||/\b(?:and|then|also|send|email|upload|download|install|call)\b|(?:して|ください)/iu.test(query)||/^(?:これ|それ|あれ|この|その|あの|今の)$|^(?:this|that|these|those|it|them|current)\b/iu.test(query)||/\b(?:save|store|delete|remove|edit|update|rewrite|translate|execute|run|search|find|open|read|compare|schedule|notify|tools?|mcp)\b|(?:保存して|削除|上書|訂正|修正|実行|検索|比較|翻訳|ツール)/iu.test(query))return null;
 return {action:'summary' as const,query,target:'knowledge' as const};
}

// A question explicitly anchored to saved knowledge needs only the read-only
// answer path. This narrow route is independent of the selected text engine:
// small models need not choose between unrelated dialogue and write actions.
// The user's full words remain the retrieval query and the grounded answer
// still needs a current source citation. Ambiguous requests keep the planner.
export function explicitSavedKnowledgeQuestion(question:string,currentInputs=false,workingFile=false){
 const text=question.trim();
 const savedSubject=namedSavedSubject(text);
 if(currentInputs||workingFile&&(!(namesExplicitSavedKnowledge(text)||savedSubject)||namesDeicticFile(text))||text.length>500||requestNamesEarlierDialogue(text))return null;
 const englishQuestion=/\b(?:what|when|where|who|which|how\s+(?:many|much))\b/i;
 const japaneseQuestion=/(?:何|いつ|どこ|誰|どれ|いくつ|何時|何日|何件|何について)/u;
 if((namesSavedKnowledge(text)||savedSubject)&&(englishQuestion.test(text)||japaneseQuestion.test(text))&&/[?？。.]\s*$|\b(?:recorded|written|saved|stored)\s*$|(?:ですか|ますか)\s*$/iu.test(text))return {action:'answer' as const,query:savedKnowledgeSearchQuery(text),target:'knowledge' as const};
 return null;
}
/** A question that explicitly names the already opened file has one safe
 * evidence scope. Resolve it before Decision/Text planning so unrelated chat
 * history cannot redirect a small model to a recall action. */
export function explicitWorkingFileQuestion(question:string,hasWorkingFile:boolean,hasOtherInput=false){
 const text=question.trim();
 if(!hasWorkingFile||hasOtherInput||!text||text.length>500||requestNamesEarlierDialogue(text)||!requestNamesWorkingFile(text))return null;
 if(namesExplicitSavedKnowledge(text)||namedSavedSubject(text))return null;
 const asks=/\b(?:what|when|where|who|which|why|how|is|are|does|do|did|can|could|would)\b/iu.test(text)||/[?？]/u.test(text)||/(?:何|いつ|どこ|誰|どれ|なぜ|どう|いくつ|何時|何日|ですか|ますか)/u.test(text);
 if(!asks)return null;
 return {action:'answer' as const,query:text,target:'file' as const};
}
/** A question about the sole cited source of the immediate answer has a
 * read-only target even when the user has not opened/pinned that file. */
export function explicitCurrentSourceQuestion(question:string,prior:Dialogue,hasInputs=false){
 const text=question.trim();
 if(hasInputs||prior.currentFile||!namesDeicticFile(text)||/["“”「」『』`]/u.test(text)||/(?:^|\s)'[^']+'(?:\s|[?.!]|$)/u.test(text)||/\b(?:other|another|all|files|notes|documents|edit|delete|save|write|replace|change|summari[sz]e|translate|execute|run|search|compare)\b|(?:他の|別の|複数|全部|すべて|全て|削除|保存|変更|訂正|修正|直して|要約|翻訳|実行|検索|比較)/iu.test(text))return null;
 const request=explicitWorkingFileQuestion(text,true);if(!request)return null;
 let result;try{result=currentDialogueResult(prior);}catch{return null;}if(!result)return null;
 const following=prior.turns.slice(result.turnIndex+1);
 if(following.some(turn=>turn.user.trim()!==text||turn.answer?.trim()||!['Invalid model action','Stopped','Model not prepared','Source changed · retry'].includes(turn.status??'')))return null;
 const refs=result.refs.filter(ref=>ref.groundingEligible!==false),pins=new Map(refs.map(ref=>[ref.noteId+':'+ref.revision,{noteId:ref.noteId,revision:ref.revision}]));
 if(pins.size!==1)return null;const file=[...pins.values()][0];
 if(!file.noteId||!Number.isSafeInteger(file.revision)||file.revision<1)return null;
 return {request,file};
}

/** A single explicit correction uses the user's already opened file. This only
 * selects a proposal route; it cannot choose replacement bytes or commit them. */
export function explicitWorkingFileCorrection(question:string,hasWorkingFile:boolean,hasOtherInput=false){
 const text=question.trim();
 if(!hasWorkingFile||hasOtherInput||!text||text.length>500||/[\r\n;；?？]/u.test(text)||requestNamesEarlierDialogue(text)||namesExplicitSavedKnowledge(text)||namedSavedSubject(text))return null;
 if(/\b(?:another|other|different|all)\b|\b(?:files|notes|documents)\b|(?:別の|他の|すべての|全ての)/iu.test(text)||(text.match(/直して|変更して|訂正して|修正して|変えて/gu)?.length??0)>1)return null;
 if(/\b(?:and|then|answer|reply|response|message|timer|alarm|schedule|notification|settings|model|theme|download)\b|(?:回答|返答|応答|発言|メッセージ|タイマー|通知|設定|モデル|テーマ|それから)/iu.test(text)||/[\w.-]+\.(?:md|txt|json)\b|[\\/]/iu.test(text))return null;
 const english=/^(?:(?:in|within)\s+(?:this|the\s+current)\s+(?:file|note|document)[,\s]+)?(?:please\s+)?(?:change|correct|update|set|replace)\s+[^.!?]{1,180}\s+(?:to|with)\s+[^.!?]{1,180}[.!]?$/iu.test(text);
 const japanese=/^[^。！？!?]{1,160}を[^。！？!?]{1,160}に(?:直して|変更して|訂正して|修正して|変えて)(?:ください|下さい)?[。！!]?$/u.test(text);
 return english||japanese?{action:'edit' as const,query:question,target:'file' as const}:null;
}
/** A supplied statement plus a separate, literal note command needs no model
 * rewrite. This only opens review; ambiguous references/operations keep planning. */
export function explicitNewTextCapture(question:string,scoped=false){
 if(scoped||question.length>30050||requestNamesEarlierDialogue(question))return null;
 const found=/^([\s\S]+[。.!！])\s*(?:メモして|記録して)(?:ください)?[。.!！]?$/u.exec(question.trim());
 if(!found)return null;const body=found[1];
 if(body.length>30000||/(?:これ|それ|この|その|あの|上記|前述|ファイル|添付|回答|返答|ツール|実行|計算|検索|要約|翻訳|修正|直して|削除|置き換|まとめて|調べて|取得|して|ください|教えて|答えて|説明|見せて|表示|作って|作成|比較|探して|読んで|開いて|[?？]|```)|\b(?:explain|calculate|search|summari[sz]e|translate|rewrite|run|execute|open|read|show|compare|create)\b/iu.test(body))return null;
 return {action:'capture' as const,query:'',body};
}

/** Select one submitted turn's scope before model planning. */
export function resolveSubmittedTurnIntent<LiteralRequest>(input:{
 question:string;
 literalRequest:LiteralRequest;
 hasAttachments:boolean;
 hasCurrentInputReadings:boolean;
 prior:Dialogue;
 attachments:{name:string;kind:string;status:string}[];
}){
 const {question,literalRequest,hasAttachments,hasCurrentInputReadings,prior,attachments}=input;
 const operationContext=literalRequest?null:earlierOperationContext(prior,question,hasAttachments||hasCurrentInputReadings);
 const noteCapture=literalRequest?null:explicitNewTextCapture(question,hasAttachments||hasCurrentInputReadings);
 const directSavedSearch=explicitSavedKnowledgeSearch(question,hasAttachments||hasCurrentInputReadings),directSavedOpen=explicitSavedKnowledgeOpen(question,hasAttachments||hasCurrentInputReadings);
 const explicitSavedRequest=directSavedSearch??directSavedOpen??(literalRequest?null:explicitSavedKnowledgeSummary(question,hasAttachments||hasCurrentInputReadings)??explicitSavedKnowledgeQuestion(question,hasAttachments,!!prior.currentFile));
 const source=literalRequest?null:explicitCurrentSourceQuestion(question,prior,hasAttachments||hasCurrentInputReadings),sourceFile=source?.file;
 const explicitFileQuestion=literalRequest?null:explicitWorkingFileQuestion(question,!!prior.currentFile,hasAttachments||hasCurrentInputReadings)??source?.request??null;
 const fileCorrection=literalRequest?null:explicitWorkingFileCorrection(question,!!prior.currentFile,hasAttachments||hasCurrentInputReadings);
 const inputQuestion=literalRequest?null:explicitInputQuestion(question,hasCurrentInputReadings);
 const answerRewrite=!literalRequest||(literalRequest as {action?:string}).action==='summary'?explicitCurrentAnswerRewrite(question):null;
 const priorContext:DialogueContext=noteCapture||explicitSavedRequest||explicitFileQuestion||fileCorrection||inputQuestion||answerRewrite?{summary:'',recent:[],refs:[],turnCount:0}:dialogueContext(prior,question);
 const contextIndependent=!operationContext&&!literalRequest&&!inputQuestion&&!explicitSavedRequest&&!explicitFileQuestion&&!fileCorrection&&!answerRewrite&&!noteCapture?contextIndependentConversation(question,attachments,priorContext):null;
 // All unmatched inputs share the route coordinator's explicit null sentinel.
 // Optional chaining otherwise produces undefined, which is not a selected route.
 const request=noteCapture??answerRewrite??(operationContext?{action:'chat',query:question}:null)??(explicitSavedRequest as LiteralRequest)??(scopeLiteralRequest(literalRequest as {action:string;query:string}|null,hasCurrentInputReadings) as LiteralRequest)??fileCorrection??(explicitFileQuestion as LiteralRequest)??inputQuestion??contextIndependent?.request??null;
 const context=operationContext??contextIndependent?.context??priorContext;
 return {literalRequest,explicitSavedRequest,explicitFileQuestion,sourceFile,inputQuestion,priorContext,contextIndependent,request,context};
}
export type TurnSelection<Request>={request:Request|null;reason:string};
export type TurnRoute<Request>=
 |{request:Request;source:'explicit'}
 |{request:Request;source:'decision';reason:string}
 |{request:Request;source:'planner';decisionReason?:string}
 |{request:null;source:'none';decisionReason?:string};

export async function resolveTurnRoute<Request>(input:{
 current:Request|null|undefined;
 question:string;
 select?:()=>Promise<TurnSelection<Request>>;
 plan?:()=>Promise<Request>;
 prepareContinuation?:(source:'decision'|'planner')=>Promise<void>;
 check:()=>void;
}):Promise<TurnRoute<Request>>{
 input.check();
 if(input.current!=null)return {request:input.current,source:'explicit'};
 if(!input.question)return {request:null,source:'none'};
 let decisionReason:string|undefined;
 if(input.select){
  const selected=await input.select();input.check();decisionReason=selected.reason;
  if(selected.request!==null){if(input.prepareContinuation){await input.prepareContinuation('decision');input.check();}return {request:selected.request,source:'decision',reason:selected.reason};}
 }
 if(!input.plan)return {request:null,source:'none',...(decisionReason?{decisionReason}:{})};
 if(input.prepareContinuation){await input.prepareContinuation('planner');input.check();}
 const request=await input.plan();input.check();return {request,source:'planner',...(decisionReason?{decisionReason}:{})};
}

/** Apply the user-input/file boundaries to a resolved intent before dispatch. */
export function scopeResolvedTurnRequest<Request extends {action:string;query:string;target?:string;historyIndex?:number|null}>(input:{
 request:Request|undefined;
 question:string;
 literal:boolean;
 literalAction?:string;
 inputs:CurrentInputRef[];
 currentFile?:WorkingFile;
 }):{request:Request|undefined;inputs:CurrentInputRef[];fileBinding:{request:Request;binding:'explicit'|'default-working-file'|undefined}|undefined}{
 let {request}=input;
 const inputs=['read','search'].includes(input.literalAction??'')?[]:input.inputs;
 if(request&&!input.literal&&!inputs.length)request=bindExplicitCurrentFileQuestion(request,input.question,input.currentFile);
 if(request?.target&&['file','path','knowledge'].includes(request.target)&&inputs.length)throw Error('Choose the opened file or current attachments');
 if(request&&inputs.length)request=routeInputRequest(request,inputs,input.literal);
 if(request)request=bindCurrentInputRequest(request,inputs.length>0);
 let fileBinding:{request:Request;binding:'explicit'|'default-working-file'|undefined}|undefined;
 if(request){fileBinding=bindWorkingFileRequest(request,input.currentFile,inputs.length>0);request=fileBinding.request;}
 return {request,inputs,fileBinding};
}
