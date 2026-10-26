import {groundedAnswer,type GroundedAnswerRequest} from './grounded-answer.ts';
import type {KnowledgeStore,NoteView} from './knowledge-store.ts';
import type {TextRuntime} from './text-inference.ts';
import type {DialogueContext} from './conversation.ts';
import type {createTurnActivityTracer} from './harness-activity.ts';
import {proposeTask} from './task-proposals.ts';
import {proposeCorrection,resolveCorrectionTarget} from './note-corrections.ts';
import type {builtinToolRegistry} from './tool-package-records.ts';
import {runBuiltinTool} from './tools/builtin-tool-results.ts';
import {resolveToolNotes} from './tools/tool-host.ts';
import {openUniqueSavedMemory} from './saved-memory-open.ts';
import {isMemoryPassageResult,type MemorySearchResult} from './memory-search-types.ts';
import {searchMemoryWithQuestionFallback} from './memory-search-fallback.ts';
import {resolveReadCompletion,resolveSearchCompletion} from './read-completion.ts';
import {resolveReadIntent} from './read-intent.ts';
import type {CurrentInputRef} from './input-readings.ts';
import {validVisionModelIdentity} from './vision-model-identity.ts';
// @ts-expect-error Shared canonical source validation is JavaScript.
import {validateGroundingRefs} from '../../../dist/core.js';

type Dependencies={
 store:KnowledgeStore;engine:TextRuntime;model:string;question:string;registry:typeof builtinToolRegistry;
 check:()=>void;trace:ReturnType<typeof createTurnActivityTracer>;
 snapshot:()=>Promise<NoteView[]>;
 acquireModel?:()=>Promise<TextRuntime>;
};

/** A reader may already have answered the exact current question. Reuse only
 * that immutable single-image result; never reinterpret it as tool authority,
 * a response to a different question, or a combined answer across files. */
export async function answerCurrentVisionInput({store,check,trace}:Pick<Dependencies,'store'|'check'|'trace'>,question:string,readings:CurrentInputRef[]){
 check();if(readings.length!==1||readings[0].kind!=='vision')return null;
 const select=(records:any[])=>{
  const ref=readings[0],note=records.find(note=>note.id===ref.noteId),value=note?.visionText,version=note?.revisions?.at(-1);
  if(value?.schema!==1||value.scope!=='single-image'||value.prompt!==question.trim()||ref.revision!==1||version?.version!==1)return null;
  const source={noteId:note.id,revision:1,start:0,end:version.body.length,quote:version.body,title:version.title};
  if(typeof value.model!=='string'||!validVisionModelIdentity(value)||typeof value.text!=='string'||!value.text.trim()||value.text.length>50000||version.body!==value.text||
   !note.mediaSource?.id||!value.original||note.mediaSource.revision!==1||!/^[a-f0-9]{64}$/.test(note.mediaSource.sha256)||
   !['id','revision','sha256'].every(key=>note.mediaSource?.[key]===value.original?.[key])||!validateGroundingRefs(records,[source]).ok)throw Error('Source changed · retry');
  return {answer:value.text,sources:[source],model:{id:value.model,revision:value.revision,runtime:value.runtime}};
 };
 const result=select(await store.all());check();if(!result)return null;
 return trace('knowledge.answer',{model:result.model.id,question,mode:'answer',execution:'current-vision-result',inputReadings:readings},async()=>{
  const fresh=select(await store.all());check();if(!fresh||JSON.stringify(fresh)!==JSON.stringify(result))throw Error('Source changed · retry');return result;
 });
}

// Application execution returns data. The caller owns turn persistence,
// navigation and explicit review/approval; these methods cannot commit edits.
export function createResolvedActions({store,engine,model,question,check,trace,snapshot,registry:builtinToolRegistry,acquireModel}:Dependencies){
 const host={search:(query:string)=>store.search(query),resolve:(query:string)=>snapshot().then(notes=>resolveToolNotes(notes,query)),check};
 const search=async(query:string)=>trace('memory.search',{query,...await builtinToolRegistry.identity('memory.search')},()=>runBuiltinTool(builtinToolRegistry,'memory.search',{query},{...host,search:q=>store.search(q,true)}));
 const searchResult=(results:MemorySearchResult[])=>({kind:'search' as const,results:results.filter(isMemoryPassageResult),files:results.filter((result):result is Extract<MemorySearchResult,{kind:'file'}>=>result.kind==='file'),status:results.length?'Found · '+results.length:'No matching notes'});
 return {
  async answer(request:GroundedAnswerRequest,metadata:{mode?:'capture';toolCalls?:string[]}={}){
   const parsed=await trace('knowledge.answer',{model:request.model,question:request.question,query:request.query,mode:metadata.mode??request.mode,...(request.scope.kind==='attachments'?{inputReadings:request.scope.readings}:{}),...(metadata.toolCalls?.length?{toolCalls:metadata.toolCalls}:{})},()=>groundedAnswer({store,engine,acquireModel},{...request,check}));
   check();return {kind:'answer' as const,...parsed};
  },
  async schedule(context:DialogueContext){
   const proposal=await trace('schedule.propose',{model,instruction:question},()=>proposeTask(engine,question,context,check),value=>({...value,reviewRequired:!!value.task}));check();
   return proposal.question?{kind:'clarify' as const,question:proposal.question}:{kind:'schedule' as const,task:proposal.task!};
  },
  async correction(query:string,selectedFile?:Parameters<typeof proposeCorrection>[2]){
   const proposal=await trace('memory.propose_correction',{model,question,query},async()=>{const records=await store.all(),target=selectedFile??resolveCorrectionTarget(records,query);return proposeCorrection(engine,question,target,check,records);},value=>({id:value.id,path:value.path,revision:value.expected.revisions.at(-1).version,before:value.before,after:value.after,operation:value.operation}));
   check();return {kind:'correction' as const,proposal};
  },
  async search(query:string,options:{complete?:boolean}={}){
   const result=await searchMemoryWithQuestionFallback(query,question,search);check();
   if(options.complete&&result.results.some(isMemoryPassageResult)){
    const completion=await trace('dialogue.plan',{stage:'search-completion',model,question},()=>resolveSearchCompletion(engine,question,check));check();
    if(completion!=='search')return {kind:'continue' as const,action:completion,query:result.query};
   }
   return searchResult(result.results);
  },
  async read(query:string,options:{explicitSavedOpen:boolean;literalRead:boolean}){
   if(options.explicitSavedOpen){
    const opening=await openUniqueSavedMemory<NoteView,MemorySearchResult>({question,query,search,snapshot,check});
    if(opening.kind==='opened')return {kind:'open' as const,noteId:opening.note.id,path:opening.resolution.path,status:opening.resolution.status,refs:opening.resolution.refs};
    return searchResult(opening.results);
   }
   const found=await trace('memory.read',{query,...await builtinToolRegistry.identity('memory.read')},()=>runBuiltinTool(builtinToolRegistry,'memory.read',{query},host),value=>value.map(n=>({id:n.id,path:n.path,version:n.version,excerpt:n.body.slice(0,700)})));
   if(found.length===1){
    const note=found[0],completion=options.literalRead?'open':await trace('dialogue.plan',{stage:'read-completion',model,question,noteId:note.id,revision:note.version},()=>resolveReadCompletion(engine,question,check));check();
    const resolution=resolveReadIntent(question,completion,{noteId:note.id,path:note.path,revision:note.version,body:note.body});
    if(resolution.kind==='continue')return resolution;
    return {kind:'open' as const,noteId:note.id,path:resolution.path,status:resolution.status,refs:resolution.refs};
   }
   const result=await searchMemoryWithQuestionFallback(query,question,search);check();return searchResult(result.results);
  },
 };
}
