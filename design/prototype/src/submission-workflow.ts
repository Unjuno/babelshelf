import {createResolvedActions,answerCurrentVisionInput} from './resolved-actions.ts';
import {makeDialogueCopyReview,type DialogueCopyReview} from './dialogue-copy.ts';
import {resolveReadCompletion} from './read-completion.ts';
import {resolveReadIntent} from './read-intent.ts';
import {createInputSubmission} from './input-submission.ts';
import {prepareTextRuntime} from './text-runtime-preparation.ts';
import {explicitCalculationInput} from './explicit-calculation.ts';
import {runCalculationAction} from './calculation-action.ts';
import {planningContextForInputs,groundingQuery} from './current-input-scope.ts';
import {workingFileNote,workingFileMetadata} from './working-file.ts';
import {resolveSubmittedTurnIntent,resolveTurnRoute,scopeResolvedTurnRequest} from './turn-router.ts';
import {routeWithDecision} from './decision-routing.ts';
import {readInputOriginal} from './automatic-reading.ts';
import {createAutomaticReadingAdapters} from './automatic-reading-adapters.ts';
import {decisionAssetInput} from './asset-activity.ts';
import {appendDiagnosticLog} from './diagnostic-logs.ts';
import {recordUnclassifiedTurnFailure} from './turn-failure-log.ts';
import {resolveToolNotes} from './tools/tool-host.ts';
import {coordinateAgentTurn} from './agent-coordinator.ts';
import {createTurnActivityTracer} from './harness-activity.ts';
import {releaseIdleInference} from './inference-ownership.ts';
import {inspectDialogueText} from './text-transform.ts';
import {plannerContextFits,resolveDialogueTarget,dialogueTargetInput,type Dialogue,type DialogueTurn,type DialogueContext} from './conversation.ts';
import {prepareTurnContext} from './turn-context-preparation.ts';
import {projectNote,type NoteView} from './knowledge-store.ts';
// @ts-expect-error Shared baseline is plain JavaScript.
import {localRequest} from '../../../dist/requests.js';
import type {builtinToolPackages,builtinToolRegistry} from './tool-package-records.ts';
import {agentEvidenceFromCalls,agentCalculationsFromCalls} from './agent-evidence.ts';

import type {SubmissionRun} from './submission-controller.ts';
import type {KnowledgeStore} from './knowledge-store.ts';
import type {TextRuntime} from './text-inference.ts';
import type {Preferences,HarnessProfile} from './preference-records.ts';
import type {DecisionRuntime} from './decision-port.ts';

import type {AutomaticReadingAdapterPorts} from './automatic-reading-adapters.ts';
import type {ProcessingTool} from './processing-history.ts';
import type {ProductRuntimeRole} from './product-runtime-assets.ts';
import type {CorrectionProposal} from './note-corrections.ts';
import type {Task} from './task-records.ts';
import type {OriginalRef,OriginalAsset} from './original-assets.ts';
import type {ReviewedText,InputReadingRef,CurrentInputRef} from './input-readings.ts';
import type {VoiceInput,AudioRange} from './voice-input.ts';
import type {ocrCitationRegion} from './ocr-text.ts';
import type {pdfCitationPage} from './pdf-text.ts';
export type SubmissionAttachment = {id:string;name:string;mime?:string;url:string;kind:'image'|'audio'|'video'|'text'|'file';size:number;status:string;text?:string;asset?:OriginalRef;file?:File;prepared?:OriginalAsset;reviewedText?:ReviewedText;reading?:InputReadingRef;voice?:VoiceInput;range?:AudioRange;imageRegion?:ReturnType<typeof ocrCitationRegion>;pdfPage?:ReturnType<typeof pdfCitationPage>};
type Attachment=SubmissionAttachment;
type Note=NoteView;
export type CaptureReview={turnId:string;source:DialogueCopyReview|null;body:string;sources:NonNullable<DialogueTurn['refs']>;kind:'original'|'generated'};
export type SubmissionView={
 adopt:(next:Dialogue,sent:Attachment[])=>void;
 consume:(text:string)=>void;
 composer:()=>{text:string;attachments:unknown[]};
 restore:(input:{text:string;attachments:Attachment[]})=>void;
 toast:(message:string)=>void;
 failure:(message:string)=>void;
 openNote:(id:string,path:string)=>void;
 reviewCapture:(review:CaptureReview)=>void;
 reviewCorrection:(proposal:CorrectionProposal,turnId:string)=>void;
 reviewSchedule:(task:Task,turnId:string)=>void;
 startToolPackageFromChat:(idea:string)=>void;
};
export type SubmissionServices={
 knowledge:KnowledgeStore;
 builtinToolRegistry:typeof builtinToolRegistry;builtinToolPackages:typeof builtinToolPackages;
 bonsai:TextRuntime&{readonly busy:boolean;unload:()=>Promise<unknown>};
 decision:DecisionRuntime&{readonly enabled:boolean;readonly ready:boolean;readonly loaded:boolean;readonly busy:boolean;load:()=>Promise<unknown>;unload:()=>Promise<unknown>};
 ocr:{ready:boolean};
 speech:{ready:boolean;transcribe:AutomaticReadingAdapterPorts['transcribe']};
 vision:AutomaticReadingAdapterPorts['vision'];
 model:string;ocrModel:string;ocrLanguage:AutomaticReadingAdapterPorts['ocrLanguage'];speechModel:string;visionModel:string;visionAvailable:boolean;decisionModel:string;
 modelPreferences:Preferences['models'];harnessPreferences:Preferences['harness'];activeHarnessProfile:HarnessProfile;connectionPreferences:Pick<Preferences['connection'],'diagnosticLogs'>;
 diagnostics:Pick<Storage,'getItem'|'setItem'>;
 currentDialogue:()=>Dialogue;storedDialogue:()=>Dialogue|undefined;settled:()=>Promise<void>;
 saveDialogue:(next:Dialogue)=>Promise<void>;finishTurn:(id:string,result:Partial<Omit<DialogueTurn,'id'|'user'>>)=>Promise<void>;
 flushStorage:()=>Promise<unknown>;refreshStorage:()=>Promise<unknown>;refreshSnapshot:()=>Promise<NoteView[]>;
 ensureProductRuntime:(role:ProductRuntimeRole,acquire:boolean)=>Promise<void>;
 loadSelectedTextModel:(model:string|undefined,check:()=>void)=>Promise<{loaded:string}>;
 traceProcessing:<T>(tool:ProcessingTool,input:unknown,work:()=>Promise<T>,project:(value:T)=>unknown,stopped:()=>boolean)=>Promise<T>;
};

/** Application-owned Send pipeline. View ports present results; only existing storage
 * transactions write data. No React state, navigation implementation or network fallback. */
export async function executeSubmission(input:{text:string;attachments:Attachment[]},services:SubmissionServices,view:SubmissionView,run:SubmissionRun):Promise<'awaitingApproval'|void>{
 const {knowledge,builtinToolRegistry,builtinToolPackages,bonsai,decision,ocr,speech,vision,model,ocrModel,ocrLanguage,speechModel,visionModel,visionAvailable,decisionModel,modelPreferences,harnessPreferences,activeHarnessProfile,connectionPreferences,diagnostics,currentDialogue,storedDialogue,settled,saveDialogue,finishTurn,flushStorage,refreshStorage,refreshSnapshot,ensureProductRuntime,loadSelectedTextModel,traceProcessing}=services;
 const {openNote,startToolPackageFromChat}=view;
 const {text}=input,items=input.attachments.map(a=>({...a})),id=run.id,checkSend=run.check;
 const setChatProgress=(value:string)=>run.progress(value);
 let inference:TextRuntime=bonsai,prior=currentDialogue(),activityFailureRecorded=false;
 let deferredContext:(()=>Promise<DialogueContext>)|undefined;
  const submission=createInputSubmission(id,text,items,checkSend);
  const recoverDraft=()=>{const recovered=submission.recover(view.composer());if(recovered)view.restore(recovered);};
  const trace=createTurnActivityTracer({check:checkSend,readActivities:()=>{const turn=currentDialogue().turns.find(t=>t.id===id);return turn?turn.activity??[]:undefined;},persistActivities:activity=>finishTurn(id,{activity}),onFailureRecorded:()=>{activityFailureRecorded=true;},diagnosticsEnabled:connectionPreferences.diagnosticLogs,writeDiagnostic:event=>appendDiagnosticLog(diagnostics,event)});
   const ensureText=async()=>{
    inference=await prepareTextRuntime({model,loadedModel:bonsai.loaded,check:checkSend,releaseCompeting:()=>releaseIdleInference([decision],checkSend),prepareSelected:()=>trace('model.load',{model},()=>loadSelectedTextModel(model,checkSend)),pin:()=>bonsai.pin!()});
   };
  const prepareContext=(fitsPlanner?:(candidate:DialogueContext)=>Promise<boolean>)=>prepareTurnContext({prior,engine:inference,model,question:text,check:checkSend,setProgress:setChatProgress,currentDialogue:()=>currentDialogue(),saveDialogue,trace,fitsPlanner});
   const readingAdapters=createAutomaticReadingAdapters({
    prompt:text,ocrModel,ocrReady:ocr.ready,ocrLanguage,
    speechModel,speechReady:speech.ready,speechLanguage:modelPreferences.transcriptionLanguage,customSpeechModels:modelPreferences.customSpeechModels,
    ensureRuntime:(role,allowNetwork)=>ensureProductRuntime(role,allowNetwork),
    releaseInference:signal=>releaseIdleInference([bonsai,decision],()=>signal.throwIfAborted()),
    vision:{describe:vision.describe,describeFrames:vision.describeFrames},transcribe:speech.transcribe,
   });
  try{
   const submissionResult=await submission.run({
    snapshot:async()=>{await settled();checkSend();await flushStorage();checkSend();setChatProgress(items.length?'Saving originals…':'');return {prior:currentDialogue(),expected:storedDialogue()};},
    original:ref=>knowledge.original(ref),
     read:async(asset,item)=>{const result=await readInputOriginal(asset,{ocrModel,ocrReady:ocr.ready,ocrLanguage,visionModel,visionReady:visionAvailable,speechModel,speechReady:speech.ready,speechLanguage:modelPreferences.transcriptionLanguage,customSpeechModels:modelPreferences.customSpeechModels,customVisionModels:modelPreferences.customVisionModels},readingAdapters,run.signal,label=>{run.progress(item.name+' · '+label,'reading',{id:item.id,label});},(tool,input,work,project)=>traceProcessing(tool,input,work,project,()=>run.signal.aborted));run.progress('');return result;},
    commit:async({expected,next,originals,readings})=>{if(items.length)return knowledge.submitInput(expected,next,originals,readings);await saveDialogue(next);return [];},
   });
   const {sent,saved,next}=submissionResult;prior=submissionResult.prior;
   if(items.length)view.adopt(next,sent);
   const imported:Note[]=saved.map(projectNote);
   view.consume(text);if(items.length)await refreshStorage();setChatProgress('');checkSend();let inputReadings:CurrentInputRef[]=sent.flatMap<CurrentInputRef>(a=>a.reading?[a.reading]:a.status==='Text available'?[{kind:'text',noteId:a.id,revision:1}]:[]);const intent=resolveSubmittedTurnIntent({question:text,literalRequest:localRequest(text.trimStart()),hasAttachments:items.length>0,hasCurrentInputReadings:inputReadings.length>0,prior,attachments:sent.map(({name,kind,status})=>({name,kind,status}))});const {literalRequest,explicitSavedRequest,inputQuestion}=intent;let {request,context}=intent;
   const importedRefs=imported.filter(n=>n.body.length).map(n=>({noteId:n.id,revision:1,start:0,end:Math.min(700,n.body.length),quote:n.body.slice(0,700),title:n.path}));
   const unread=sent.find(a=>a.status!=='Text available'&&!a.voice&&!a.reading);if(unread&&text&&(!request||['answer','summary'].includes(request.action)||request.action==='capture'&&inputReadings.length>0)){await finishTurn(id,{refs:importedRefs,status:'Original saved · '+unread.status});recoverDraft();return;}
   if(inputQuestion?.action==='answer'&&harnessPreferences.replyStyle==='balanced'&&!harnessPreferences.userGuidance.trim()){const readyAnswer=await answerCurrentVisionInput({store:knowledge,check:checkSend,trace},text,inputReadings);checkSend();if(readyAnswer){await finishTurn(id,{answer:readyAnswer.answer,refs:readyAnswer.sources});return;}}
   const calculation=items.length?null:explicitCalculationInput(text);
   if(calculation){const {expression,showExpression}=calculation;const result=await runCalculationAction(expression,builtinToolRegistry,{search:q=>knowledge.search(q),resolve:q=>refreshSnapshot().then(notes=>resolveToolNotes(notes,q)),check:checkSend},trace);checkSend();await finishTurn(id,{answer:showExpression?expression+' = '+String(result[0].result):String(result[0].result),status:'Calculated',refs:[]});return;}
   const decisionFirst=!request&&decision.enabled&&decision.ready;
   if(text&&!decisionFirst&&(!request||['answer','summary'].includes(request.action))){
    await ensureText();
    if(literalRequest&&request?.target==='knowledge'&&!inputReadings.length)deferredContext=prepareContext;else if(request&&!explicitSavedRequest&&!inputQuestion)context=await prepareContext();
   }
   context=planningContextForInputs({...context,refs:[...context.refs,...importedRefs]},inputReadings.length>0);
   const descriptors=sent.filter(a=>a.reading||a.status==='Text available').map(({name,kind,status})=>({name,kind,status}));
   let agentToolCalls:{tool:string;arguments:Record<string,unknown>;result:unknown}[]=[],customAccessEvidence:ReturnType<typeof agentEvidenceFromCalls>=[];
   run.progress('','planning');
   const resolution=await resolveTurnRoute({current:request,question:text,check:checkSend,
    prepareContinuation:decisionFirst?async source=>{
     await ensureText();if(source==='decision'){const prepared=await prepareContext();checkSend();
     context=planningContextForInputs({...prepared,refs:[...prepared.refs,...importedRefs]},inputReadings.length>0);}
    }:undefined,
    select:decision.enabled&&decision.ready?async()=>{
     await releaseIdleInference([bonsai],checkSend);
     if(!decision.loaded){setChatProgress('Loading decision model…');await trace('decision.load',decisionAssetInput(false,modelPreferences.customDecisionModels.find(m=>m.id===decisionModel)),async()=>{await ensureProductRuntime('decision',false);return decision.load();});}
     checkSend();setChatProgress('Selecting action…');return routeWithDecision(decision,text,context,descriptors,trace,checkSend);
    }:undefined,
    plan:async()=>{
     setChatProgress('Selecting action…');
     const coordinated=await coordinateAgentTurn({
      engine:inference,model,question:text,context,attachments:descriptors,
      prepareContext:async allowedTools=>{
       const withInputs=(value:DialogueContext)=>planningContextForInputs({...value,refs:[...value.refs,...importedRefs]},inputReadings.length>0);
       const prepared=await prepareContext(candidate=>plannerContextFits(inference,text,withInputs(candidate),descriptors,{allowedTools,history:[],maxToolCalls:activeHarnessProfile.maxToolCalls,userGuidance:harnessPreferences.userGuidance}));
       return withInputs(prepared);
      },
       enabledTools:activeHarnessProfile.enabledTools,builtinPackages:builtinToolPackages,maxToolCalls:activeHarnessProfile.maxToolCalls,maxResultChars:activeHarnessProfile.maxResultChars,userGuidance:harnessPreferences.userGuidance,
      scopedAwayFromCustomTools:!!inputReadings.length||!!context.currentFile,
      readToolSources:async()=>(await refreshSnapshot()).map(note=>({path:note.path,body:note.body})),
      search:(query,signal)=>knowledge.search(query,false,signal),views:signal=>knowledge.views(signal),
      ensureCustomRuntime:()=>ensureProductRuntime('custom-tools',false),check:checkSend,signal:run.signal,trace,
     });context=coordinated.context;agentToolCalls=[...coordinated.calls];customAccessEvidence=coordinated.customEvidence;return coordinated.final;
    }
   });
   request=resolution.request;if(resolution.source==='decision'||resolution.source==='planner')setChatProgress('');
   if(request?.action==='tool-create'){
    if(items.length||inputReadings.length||prior.currentFile){await finishTurn(id,{status:'Tool drafts are available only from an unscoped chat request'});return;}
    if(!request.query.trim())throw Error('Describe the tool you want to create');
    await finishTurn(id,{status:'Tool draft requested · review before saving'});startToolPackageFromChat(request.query);return 'awaitingApproval';
   }
   if(request?.action==='answer'&&!inputReadings.length&&!prior.currentFile&&agentToolCalls.length&&agentToolCalls.every(call=>call.tool==='math.calculate')){
    const calculations=agentCalculationsFromCalls(agentToolCalls);
    await finishTurn(id,{answer:calculations.map(item=>item.expression+' = '+String(item.result)).join('\n'),status:'Calculated',refs:[]});return;
   }
    const scoped=scopeResolvedTurnRequest({request,question:text,literal:!!literalRequest,literalAction:literalRequest?.action,inputs:inputReadings,currentFile:prior.currentFile});
    request=scoped.request;inputReadings=scoped.inputs;const fileBinding=scoped.fileBinding;
   const actions=createResolvedActions({store:knowledge,engine:inference,model,question:text,check:checkSend,trace,snapshot:refreshSnapshot,registry:builtinToolRegistry});
   let selectedFile:any;let workingFile=request?.target==='file'?prior.currentFile:undefined;
   if(request?.target==='file'){
    if(!workingFile)throw Error('No working file · open a file first');const filePin=workingFile;
    selectedFile=await trace('memory.read',{target:'file',binding:fileBinding?.binding??'explicit',...workingFile},async()=>workingFileNote(await knowledge.all(),filePin),workingFileMetadata);checkSend();
     if(request.action==='read'){const completion=literalRequest?.action==='read'||explicitSavedRequest?.action==='read'?'open':await trace('dialogue.plan',{stage:'read-completion',model,question:text,...workingFile},()=>resolveReadCompletion(inference,text,checkSend));checkSend();const metadata=workingFileMetadata(selectedFile),resolution=resolveReadIntent(text,completion,{noteId:selectedFile.id,path:metadata.path,revision:workingFile.revision,body:selectedFile.revisions.at(-1).body});if(resolution.kind==='continue'){request={...request,action:resolution.action,target:'file',query:resolution.query};workingFile=resolution.workingFile;}else{await finishTurn(id,{status:resolution.status,refs:resolution.refs});openNote(selectedFile.id,resolution.path);return;}}
   }
   if(request?.action==='calculate'){
    const expression=request.query;const result=await runCalculationAction(expression,builtinToolRegistry,{search:q=>knowledge.search(q),resolve:q=>refreshSnapshot().then(notes=>resolveToolNotes(notes,q)),check:checkSend},trace);checkSend();await finishTurn(id,{answer:expression+' = '+String(result[0].result),status:'Calculated',refs:[]});return;
   }
   if(request?.action==='schedule'){
    const result=await actions.schedule(context);checkSend();
    if(result.kind==='clarify'){await finishTurn(id,{answer:result.question,status:'Schedule details needed'});return;}
    await finishTurn(id,{status:'Review schedule · Paused'});checkSend();view.reviewSchedule(result.task,id);return 'awaitingApproval';
   }
   if(request?.action==='edit'){
    const {proposal}=await actions.correction(request.query,selectedFile);checkSend();
    await finishTurn(id,{status:'Review correction · '+proposal.path+' · v'+proposal.expected.revisions.at(-1).version});checkSend();view.reviewCorrection(proposal,id);return 'awaitingApproval';
   }
   let captureSource:DialogueCopyReview|null=null;
   if(request&&(request.target==='current'||request.historyIndex!=null)&&['recall','capture','transform'].includes(request.action)){
    const selection=request.target?request:{...request,target:'history' as const};
    const original=await trace('dialogue.read',dialogueTargetInput(prior,selection),async()=>resolveDialogueTarget(prior,selection));checkSend();
    if(request.action==='capture'){request.historyIndex=original.turnIndex;request.historyPart=original.speaker as 'user'|'assistant';captureSource=makeDialogueCopyReview(prior,selection);}
    inputReadings=[];context={summary:'',recent:[],refs:[],turnCount:prior.turns.length,recalled:[original]};
    await finishTurn(id,{readTurn:{turnId:original.turnId,index:original.turnIndex,speaker:original.speaker},status:'Reading earlier message'});
    if(request.action==='recall'||request.action==='transform'){const inspected=await trace('text.inspect',{model,question:text,target:{turnId:original.turnId,index:original.turnIndex,speaker:original.speaker},text:original.quote},()=>inspectDialogueText(inference,text,original,checkSend),value=>value,value=>value.operation==='transform'&&value.result.status?Error(value.result.status):undefined);checkSend();if(inspected.operation==='transform'){const result=inspected.result;await finishTurn(id,{...result,status:result.status,refs:original.refs});return;}request.action='recall';}
    if(request.action==='capture')request.body=original.quote;else request.action='chat';
   }
   if(request?.action==='capture'){const previous=request.historyIndex!=null&&request.historyPart==='assistant'?prior.turns[request.historyIndex]:undefined;let sources=previous?.refs??[],kind:'original'|'generated'=previous?'generated':'original';if(request.historyIndex==null&&inputReadings.length){const captureQuery=groundingQuery(text,request.query,true),parsed=await actions.answer({model:model,question:text,query:captureQuery,mode:'summary',context:context,check:checkSend,scope:(inputReadings.length?{kind:'attachments',readings:inputReadings}:{kind:'knowledge'}),replyStyle:harnessPreferences.replyStyle,userGuidance:harnessPreferences.userGuidance},{mode:'capture'});checkSend();request.body=parsed.answer;sources=parsed.sources;kind='generated';await finishTurn(id,{answer:parsed.answer,status:'Review before saving',refs:sources});}else await finishTurn(id,{status:'Review before saving',refs:importedRefs});view.reviewCapture({turnId:id,source:captureSource,body:request.body!,sources,kind});return 'awaitingApproval';}
   if(request?.action==='read'){
    const result=await actions.read(request.query,{explicitSavedOpen:request.target==='knowledge'&&explicitSavedRequest?.action==='read',literalRead:literalRequest?.action==='read'||explicitSavedRequest?.action==='read'});checkSend();
    if(result.kind==='open'){await finishTurn(id,{status:result.status,refs:result.refs});openNote(result.noteId,result.path);return;}
    if(result.kind==='search'){await finishTurn(id,{results:result.results,files:result.files,status:result.status,refs:importedRefs});return;}
    workingFile=result.workingFile;request={...request,action:result.action,target:'file',query:result.query};
   }
   if(request?.action==='search'){
    const result=await actions.search(request.query);checkSend();await finishTurn(id,{results:result.results,files:result.files,status:result.status,refs:importedRefs});return;
   }
   if(text&&request){run.progress('','generating');if(request.action!=='answer'&&request.action!=='summary'&&request.action!=='chat')throw Error('Unresolved answer action');const answerQuery=groundingQuery(text,request.query,inputReadings.length>0),answerMode=request.action,toolEvidence=agentToolCalls.length?{used:true as const,refs:agentEvidenceFromCalls(agentToolCalls,customAccessEvidence),calculations:agentCalculationsFromCalls(agentToolCalls),memoryUsed:agentToolCalls.some(call=>call.tool.startsWith('memory.'))||customAccessEvidence.length>0}:undefined,parsed=await actions.answer({model:model,question:text,query:answerQuery,mode:answerMode,context:context,check:checkSend,scope:(workingFile?{kind:'file',file:workingFile}:(inputReadings.length?{kind:'attachments',readings:inputReadings}:(answerMode==='chat'?{kind:'conversation'}:{kind:'knowledge'}))),prepareContext:deferredContext,toolEvidence:toolEvidence,replyStyle:harnessPreferences.replyStyle,userGuidance:harnessPreferences.userGuidance},{toolCalls:agentToolCalls.map(call=>call.tool)});checkSend();await finishTurn(id,{answer:parsed.answer,refs:parsed.sources,status:request.action==='summary'?'Summary · selected excerpts':undefined});return;}
   await finishTurn(id,{refs:importedRefs,status:items.length&&!text?(items.some(a=>a.reviewedText||a.kind==='text'&&a.text!==undefined)?'Text imported':'Analysis not prepared'):'Model not prepared'});
  }catch(e){try{recordUnclassifiedTurnFailure(diagnostics,connectionPreferences.diagnosticLogs,activityFailureRecorded,e);}catch{/* Diagnostics must never change the operation result. */}recoverDraft();try{if(currentDialogue().turns.some(t=>t.id===id))await finishTurn(id,{status:(e as Error).message});else view.toast((e as Error).message);}catch(failure){view.failure((failure as Error).message);view.toast((failure as Error).message);}throw e;}
}
