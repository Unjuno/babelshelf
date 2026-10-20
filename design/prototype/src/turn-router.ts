// Application routing policy for one submitted turn. Model adapters, UI state,
// activity persistence and action execution remain behind caller-owned ports.
import {requestNamesEarlierDialogue} from './conversation.ts';
import {namesDeicticFile,namesExplicitSavedKnowledge,namesSavedKnowledge} from './saved-knowledge-reference.ts';

// The rest of a question can overwhelm the lexical index. Keep a named saved
// file's descriptor as the query; the full request is still used for answering.
export function savedKnowledgeSearchQuery(question:string){
 const named=/\b(?:saved|stored)\s+((?:(?:[\p{L}\p{N}-]+)\s+){1,8})(?:notes?|files?|documents?|records?)\b/iu.exec(question);
 return named?.[1].trim()||question;
}

// A question explicitly anchored to saved knowledge needs only the read-only
// answer path. This narrow route is independent of the selected text engine:
// small models need not choose between unrelated dialogue and write actions.
// The user's full words remain the retrieval query and the grounded answer
// still needs a current source citation. Ambiguous requests keep the planner.
export function explicitSavedKnowledgeQuestion(question:string,currentInputs=false,workingFile=false){
 const text=question.trim();
 if(currentInputs||workingFile&&(!namesExplicitSavedKnowledge(text)||namesDeicticFile(text))||text.length>500||requestNamesEarlierDialogue(text))return null;
 const englishQuestion=/\b(?:what|when|where|who|which|how\s+(?:many|much))\b/i;
 const japaneseQuestion=/(?:何|いつ|どこ|誰|どれ|いくつ|何時|何日|何件|何について)/u;
 if(namesSavedKnowledge(text)&&(englishQuestion.test(text)||japaneseQuestion.test(text))&&/[?？。.]\s*$|\b(?:recorded|written|saved|stored)\s*$|(?:ですか|ますか)\s*$/iu.test(text))return {action:'answer' as const,query:savedKnowledgeSearchQuery(text),target:'knowledge' as const};
 return null;
}
export type TurnSelection<Request>={request:Request|null;reason:string};
export type TurnRoute<Request>=
 |{request:Request;source:'explicit'}
 |{request:Request;source:'decision';reason:string}
 |{request:Request;source:'planner';decisionReason?:string}
 |{request:null;source:'none';decisionReason?:string};

export async function resolveTurnRoute<Request>(input:{
 current:Request|null;
 question:string;
 select?:()=>Promise<TurnSelection<Request>>;
 plan?:()=>Promise<Request>;
 check:()=>void;
}):Promise<TurnRoute<Request>>{
 input.check();
 if(input.current!==null)return {request:input.current,source:'explicit'};
 if(!input.question)return {request:null,source:'none'};
 let decisionReason:string|undefined;
 if(input.select){
  const selected=await input.select();input.check();decisionReason=selected.reason;
  if(selected.request!==null)return {request:selected.request,source:'decision',reason:selected.reason};
 }
 if(!input.plan)return {request:null,source:'none',...(decisionReason?{decisionReason}:{})};
 const request=await input.plan();input.check();return {request,source:'planner',...(decisionReason?{decisionReason}:{})};
}
