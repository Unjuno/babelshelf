// Application routing policy for one submitted turn. Model adapters, UI state,
// activity persistence and action execution remain behind caller-owned ports.
import {contextIndependentConversation,dialogueContext,requestNamesEarlierDialogue,type Dialogue,type DialogueContext,type DialoguePlan} from './conversation.ts';
import {explicitInputQuestion} from './current-input-scope.ts';
import {bindCurrentInputRequest} from './current-input-scope.ts';
import {routeInputRequest,type CurrentInputRef} from './input-readings.ts';
import {namedSavedSubject,namesDeicticFile,namesExplicitSavedKnowledge,namesSavedKnowledge} from './saved-knowledge-reference.ts';
import {bindExplicitCurrentFileQuestion,bindWorkingFileRequest,scopeLiteralRequest,type WorkingFile} from './working-file.ts';

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
/** Select one submitted turn's read-only scope before model planning. */
export function resolveSubmittedTurnIntent<LiteralRequest>(input:{
 question:string;
 literalRequest:LiteralRequest;
 hasAttachments:boolean;
 hasCurrentInputReadings:boolean;
 prior:Dialogue;
 attachments:{name:string;kind:string;status:string}[];
}){
 const {question,literalRequest,hasAttachments,hasCurrentInputReadings,prior,attachments}=input;
 const directSavedSearch=explicitSavedKnowledgeSearch(question,hasAttachments||hasCurrentInputReadings),directSavedOpen=explicitSavedKnowledgeOpen(question,hasAttachments||hasCurrentInputReadings);
 const explicitSavedRequest=directSavedSearch??directSavedOpen??(literalRequest?null:explicitSavedKnowledgeQuestion(question,hasAttachments,!!prior.currentFile));
 const inputQuestion=literalRequest?null:explicitInputQuestion(question,hasCurrentInputReadings);
 const priorContext:DialogueContext=explicitSavedRequest||inputQuestion?{summary:'',recent:[],refs:[],turnCount:0}:dialogueContext(prior,question);
 const contextIndependent=!literalRequest&&!inputQuestion&&!explicitSavedRequest?contextIndependentConversation(question,attachments,priorContext):null;
 // All unmatched inputs share the route coordinator's explicit null sentinel.
 // Optional chaining otherwise produces undefined, which is not a selected route.
 const request=(explicitSavedRequest as LiteralRequest)??(scopeLiteralRequest(literalRequest as {action:string;query:string}|null,hasCurrentInputReadings) as LiteralRequest)??inputQuestion??contextIndependent?.request??null;
 const context=contextIndependent?.context??priorContext;
 return {literalRequest,explicitSavedRequest,inputQuestion,priorContext,contextIndependent,request,context};
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
