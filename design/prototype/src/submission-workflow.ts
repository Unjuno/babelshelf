import {newNoteSourceRef} from './note-creation.ts';
import {createResolvedActions,answerCurrentVisionInput} from './resolved-actions.ts';
import {makeDialogueCopyReview,type DialogueCopyReview} from './dialogue-copy.ts';
import {resolveReadCompletion} from './read-completion.ts';
import {resolveReadIntent} from './read-intent.ts';
import {createInputSubmission} from './input-submission.ts';
import {createModelExecutionManager} from './model-execution.ts';
import type {SubmissionOutcome} from './execution-result.ts';
import {explicitCalculationInput} from './explicit-calculation.ts';
import {runCalculationAction,formatCalculation,continuedCalculationInput,continuedYenCalculation,needsSourcedCalculationReview,isSourcedArithmeticQuestion} from './calculation-action.ts';
import {executeReviewedSourcedCalculation,proposeSourcedCalculation} from './sourced-calculation.ts';
import type {CalculationReview} from './SourcedCalculationSheet';
import {planningContextForInputs,groundingQuery,constrainAudioOnlyInputs,audioOnlySuffix} from './current-input-scope.ts';
import {workingFileNote,workingFileMetadata} from './working-file.ts';
import {resolveSubmittedTurnIntent,resolveTurnRoute,scopeResolvedTurnRequest,searchScopeFailure,unspecifiedSavedSearch,clarifiedSavedSearch,cancelClarifiedSavedSearch} from './turn-router.ts';
import {routeWithDecision} from './decision-routing.ts';
import {readInputOriginal} from './automatic-reading.ts';
import {createAutomaticReadingAdapters} from './automatic-reading-adapters.ts';
import {decisionAssetInput} from './asset-activity.ts';
import {appendDiagnosticLog} from './diagnostic-logs.ts';
import {recordUnclassifiedTurnFailure} from './turn-failure-log.ts';
import {resolveToolNotes} from './tools/tool-host.ts';
import {coordinateAgentTurn,type AgentBudgetReason} from './agent-coordinator.ts';
import {createTurnActivityTracer,persistTurnActivity,MAX_ACTIVITY_EVENTS_PER_TURN,RESERVED_AGENT_COMPLETION_EVENTS} from './harness-activity.ts';
import {inspectDialogueText} from './text-transform.ts';
import {plannerContextFits,resolveDialogueTarget,dialogueTargetInput,type Dialogue,type DialogueTurn,type DialogueContext} from './conversation.ts';
import {prepareTurnContext} from './turn-context-preparation.ts';
import {PENDING_CORRECTION_STATE} from './pending-correction.ts';
import {agentCorrectionTarget} from './agent-correction-target.ts';
import {discoverCorrectionTarget,type CorrectionTargetOption} from './saved-correction-target.ts';
import {projectNote,type NoteView} from './knowledge-store.ts';
// @ts-expect-error Shared baseline is plain JavaScript.
import {localRequest} from '../../../dist/requests.js';
import type {builtinToolPackages,builtinToolRegistry} from './tool-package-records.ts';
import {agentAnswerEvidenceFromCalls,agentEvidenceFromCalls,agentCustomResultsFromCalls,agentToolInfoFromCalls,agentCalculationsFromCalls,agentClockReadingsFromCalls} from './agent-evidence.ts';
import {captureTurnExecutionSnapshot} from './turn-execution-snapshot.ts';
import {decisionMayRouteRequest,requestsImplicitSearchReadAnswer} from './saved-knowledge-reference.ts';

import type {SubmissionRun} from './submission-controller.ts';
import type {KnowledgeStore} from './knowledge-store.ts';
import type {TextRuntime} from './text-inference.ts';
import type {Preferences,HarnessProfile} from './preference-records.ts';
import type {DecisionRuntime} from './decision-port.ts';

import type {AutomaticReadingAdapterPorts} from './automatic-reading-adapters.ts';
import type {ProcessingTool} from './processing-history.ts';
import type {ProductRuntimeRole} from './product-runtime-assets.ts';
import {resolveCorrectionTarget,type CorrectionProposal} from './note-corrections.ts';
import type {Task} from './task-records.ts';
import type {OriginalRef,OriginalAsset} from './original-assets.ts';
import type {ReviewedText,InputReadingRef,CurrentInputRef} from './input-readings.ts';
import type {VoiceInput,AudioRange} from './voice-input.ts';
import type {ocrCitationRegion} from './ocr-text.ts';
import type {pdfCitationPage} from './pdf-text.ts';
export type SubmissionAttachment = {id:string;name:string;mime?:string;url:string;kind:'image'|'audio'|'video'|'text'|'file';size:number;status:string;text?:string;asset?:OriginalRef;file?:File;prepared?:OriginalAsset;reviewedText?:ReviewedText;reading?:InputReadingRef;voice?:VoiceInput;range?:AudioRange;imageRegion?:ReturnType<typeof ocrCitationRegion>;pdfPage?:ReturnType<typeof pdfCitationPage>};
type Attachment=SubmissionAttachment;
type Note=NoteView;
export type CaptureInput={turnId:string;source:DialogueCopyReview|null;body:string;sources:NonNullable<DialogueTurn['refs']>;kind:'original'|'generated'};
export type SubmissionView={
 adopt:(next:Dialogue,sent:Attachment[])=>void;
 consume:(text:string)=>void;
 composer:()=>{text:string;attachments:unknown[]};
 restore:(input:{text:string;attachments:Attachment[]})=>void;
 toast:(message:string)=>void;
 failure:(message:string)=>void;
 openNote:(id:string,path:string)=>void;
 saveCapture:(capture:CaptureInput)=>void|Promise<void>;
 reviewCorrection:(proposal:CorrectionProposal,turnId:string)=>void|Promise<void>;
 reviewSourcedCalculation?:(candidate:CalculationReview)=>Promise<boolean>;
 chooseCorrectionTarget?:(options:CorrectionTargetOption[])=>Promise<{noteId:string;revision:number}|null>;
 reviewSchedule:(task:Task,turnId:string)=>void;
 startToolPackageFromChat:(idea:string)=>void;
 activityChanged?:(turnId:string)=>void;
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
 saveDialogue:(next:Dialogue)=>Promise<void>;finishTurn:(id:string,result:Partial<Omit<DialogueTurn,'id'|'user'>>,guardSources?:NonNullable<DialogueTurn['refs']>)=>Promise<void>;
 flushStorage:()=>Promise<unknown>;refreshStorage:()=>Promise<unknown>;refreshSnapshot:()=>Promise<NoteView[]>;
 ensureProductRuntime:(role:ProductRuntimeRole,acquire:boolean)=>Promise<void>;
 traceProcessing:<T>(tool:ProcessingTool,input:unknown,work:()=>Promise<T>,project:(value:T)=>unknown,stopped:()=>boolean)=>Promise<T>;
};

/** Application-owned Send pipeline. View ports present results; only existing storage
 * transactions write data. No React state, navigation implementation or network fallback. */
export async function executeSubmission(input:{text:string;attachments:Attachment[]},services:SubmissionServices,view:SubmissionView,run:SubmissionRun):Promise<SubmissionOutcome>{
 const {knowledge,builtinToolRegistry,builtinToolPackages,bonsai,decision,ocr,speech,vision,model:serviceModel,ocrModel:serviceOcrModel,ocrLanguage,speechModel:serviceSpeechModel,visionModel:serviceVisionModel,visionAvailable,decisionModel:serviceDecisionModel,modelPreferences,harnessPreferences:serviceHarnessPreferences,activeHarnessProfile:serviceHarnessProfile,connectionPreferences,diagnostics,currentDialogue,storedDialogue,settled,saveDialogue,finishTurn,flushStorage,refreshStorage,refreshSnapshot,ensureProductRuntime,traceProcessing}=services;
 const {openNote,startToolPackageFromChat}=view;
 const models=createModelExecutionManager({text:bonsai,decision,ensureRuntime:ensureProductRuntime});
 const {text}=input,items=input.attachments.map(a=>({...a})),id=run.id,checkSend=run.check;
 const snapshot=captureTurnExecutionSnapshot({turnId:id,textModel:serviceModel,textManifest:bonsai.manifest,decisionModel:serviceDecisionModel,decisionIdentity:decision.identity,speechModel:serviceSpeechModel,ocrModel:serviceOcrModel,visionModel:serviceVisionModel,profile:serviceHarnessProfile,replyStyle:serviceHarnessPreferences.replyStyle,userGuidance:serviceHarnessPreferences.userGuidance,attachments:items.map(({id,kind,status,asset,reading})=>({id,kind,status,...(asset?{asset}:{}),...(reading?{reading}:{})}))});
 const model=snapshot.models.text.id,decisionModel=snapshot.models.decision.id,ocrModel=snapshot.models.ocr,speechModel=snapshot.models.speech,visionModel=snapshot.models.vision,harnessPreferences={replyStyle:snapshot.response.style,userGuidance:snapshot.response.userGuidance};
 const activeHarnessProfile={...serviceHarnessProfile,enabledTools:[...snapshot.harness.enabledTools],maxToolCalls:snapshot.harness.maxToolCalls,maxResultChars:snapshot.harness.maxResultChars};
 const setChatProgress=(value:string)=>run.progress(value);
 let inference:TextRuntime=bonsai,prior=currentDialogue(),activityFailureRecorded=false;
 let deferredContext:(()=>Promise<DialogueContext>)|undefined;
  const submission=createInputSubmission(id,text,items,checkSend);
  const recoverDraft=()=>{const recovered=submission.recover(view.composer());if(recovered)view.restore(recovered);};
  const readActivities=()=>{const turn=currentDialogue().turns.find(t=>t.id===id);return turn?turn.activity??[]:undefined;};
  const pagingAvailable=typeof knowledge.recordTurnActivity==='function';
  const trace=createTurnActivityTracer({check:checkSend,readActivities,persistActivities:activity=>finishTurn(id,{activity}),...(pagingAvailable?{persistActivity:async activity=>{const paged=await persistTurnActivity({turnId:id,readActivities,readStored:storedDialogue,persistInline:items=>finishTurn(id,{activity:items}),persistPaged:(turnId,item,expected)=>knowledge.recordTurnActivity(turnId,item,expected)},activity);if(paged)try{view.activityChanged?.(id);}catch{/* Presentation must not change the committed receipt. */}}}:{}),onFailureRecorded:()=>{activityFailureRecorded=true;},diagnosticsEnabled:connectionPreferences.diagnosticLogs,writeDiagnostic:event=>appendDiagnosticLog(diagnostics,event)});
   const ensureText=async()=>{
    if(bonsai.loaded!==model)run.progress('Loading model…','planning');
    inference=await models.text(model,checkSend,work=>trace('model.load',{model},work));
    run.progress('','planning');
   };
  const prepareContext=(fitsPlanner?:(candidate:DialogueContext)=>Promise<boolean>)=>prepareTurnContext({prior,engine:inference,model,question:text,currentInputs:items.length>0,check:checkSend,setProgress:setChatProgress,currentDialogue:()=>currentDialogue(),saveDialogue,trace,fitsPlanner});
  const reviewedCalculation=async():Promise<SubmissionOutcome>=>{
   if(!view.reviewSourcedCalculation)throw Error('Check source values · enter the calculation explicitly');
   const sources=prior.turns.at(-1)!.refs!,records=await knowledge.all();checkSend();setChatProgress('Preparing calculation…');
   const proposal=await trace('dialogue.plan',{stage:'sourced-calculation',model},()=>proposeSourcedCalculation({engine:inference,records,question:text,sources,check:checkSend}),()=>({status:'proposal validated'}));checkSend();setChatProgress('');
   const result=await executeReviewedSourcedCalculation({question:text,proposal,allowedSources:sources,currentRecords:()=>knowledge.all(),review:view.reviewSourcedCalculation,calculate:async expression=>(await runCalculationAction(expression,builtinToolRegistry,{search:q=>knowledge.search(q),resolve:q=>refreshSnapshot().then(notes=>resolveToolNotes(notes,q)),check:checkSend},trace))[0],check:checkSend});
   if(result.kind==='cancelled'){await finishTurn(id,{status:'Calculation cancelled'});recoverDraft();return {kind:'cancelled'};}
   await finishTurn(id,{answer:formatCalculation(result.receipt,result.receipt.expression),status:'Calculated',refs:result.sources},result.sources);return {kind:'answered'};
  };
   const readingAdapters=createAutomaticReadingAdapters({
    prompt:text,ocrModel,ocrReady:ocr.ready,ocrLanguage,
    speechModel,speechReady:speech.ready,speechLanguage:modelPreferences.transcriptionLanguage,customSpeechModels:modelPreferences.customSpeechModels,
    ensureRuntime:(role,allowNetwork)=>ensureProductRuntime(role,allowNetwork),
    releaseInference:signal=>models.releaseForReader(()=>signal.throwIfAborted()),
    vision:{describe:vision.describe,describeFrames:vision.describeFrames},transcribe:speech.transcribe,
   });
  try{
   const submissionResult=await submission.run({
    snapshot:async()=>{await settled();checkSend();await flushStorage();checkSend();setChatProgress(items.length?'Saving originals…':'');return {prior:currentDialogue(),expected:storedDialogue()};},
    original:ref=>knowledge.original(ref),
     read:async(asset,item)=>{const result=await readInputOriginal(asset,{ocrModel,ocrReady:ocr.ready,ocrLanguage,visionModel,visionReady:visionAvailable,videoAudioOnly:items.length===1&&audioOnlySuffix(text),speechModel,speechReady:speech.ready,speechLanguage:modelPreferences.transcriptionLanguage,customSpeechModels:modelPreferences.customSpeechModels,customVisionModels:modelPreferences.customVisionModels},readingAdapters,run.signal,label=>{run.progress(item.name+' · '+label,'reading',{id:item.id,label});},(tool,input,work,project)=>traceProcessing(tool,input,work,project,()=>run.signal.aborted));run.progress('');return result;},
    commit:async({expected,next,originals,readings})=>{if(items.length)return knowledge.submitInput(expected,next,originals,readings);await saveDialogue(next);return [];},
   });
   const {sent,saved,next}=submissionResult;prior=submissionResult.prior;
   if(items.length)view.adopt(next,sent);
   const imported:Note[]=saved.map(projectNote);
   view.consume(text);if(items.length)await refreshStorage();run.progress('','planning');checkSend();
   if(unspecifiedSavedSearch(text,items.length>0)){await finishTurn(id,{status:'What should I search for?',refs:[]});return {kind:'displayed'};}
   if(cancelClarifiedSavedSearch(text,prior,items.length>0)){await finishTurn(id,{status:'Search cancelled',refs:[]});return {kind:'displayed'};}
   let inputReadings:CurrentInputRef[]=sent.flatMap<CurrentInputRef>(a=>a.reading?[a.reading]:a.status==='Text available'?[{kind:'text',noteId:a.id,revision:1}]:[]);const intent=resolveSubmittedTurnIntent({question:text,literalRequest:localRequest(text.trimStart()),hasAttachments:items.length>0,hasCurrentInputReadings:inputReadings.length>0,prior,attachments:sent.map(({name,kind,status})=>({name,kind,status}))});const {literalRequest,explicitSavedRequest,sourceFile,inputQuestion}=intent;let {request,context}=intent;
   if(!request)request=clarifiedSavedSearch(text,prior,items.length>0);
   if(context.outcomeOnly){await trace('dialogue.read',{scope:'recorded-outcomes',source:'submitted-dialogue-snapshot'},async()=>structuredClone(context.recalled??[]));checkSend();}
   const importedRefs=imported.filter(n=>n.body.length).map(n=>newNoteSourceRef(n));
   const unread=sent.find(a=>a.status!=='Text available'&&!a.voice&&!a.reading);if(unread&&text&&(!request||['answer','summary'].includes(request.action)||request.action==='capture'&&inputReadings.length>0)){await finishTurn(id,{refs:importedRefs,status:'Original saved · '+unread.status});recoverDraft();return {kind:'partial',reason:'unread-input'};}
   inputReadings=constrainAudioOnlyInputs(text,inputReadings,sent);
   if(inputQuestion?.action==='answer'&&harnessPreferences.replyStyle==='balanced'&&!harnessPreferences.userGuidance.trim()){const readyAnswer=await answerCurrentVisionInput({store:knowledge,check:checkSend,trace},text,inputReadings);checkSend();if(readyAnswer){await finishTurn(id,{answer:readyAnswer.answer,refs:readyAnswer.sources});return {kind:'answered'};}}
   let previousCalculationTurn=prior.turns.at(-1);
   if(!items.length&&previousCalculationTurn?.activity?.length===MAX_ACTIVITY_EVENTS_PER_TURN&&typeof knowledge.turnActivities==='function'&&/(?:その結果|\b(?:divide|split|add|subtract|multiply)\b)/iu.test(text)){
    const paged=await knowledge.turnActivities(previousCalculationTurn.id);checkSend();if(paged.length)previousCalculationTurn={...previousCalculationTurn,activity:[...previousCalculationTurn.activity,...paged]};
   }
   const continued=items.length?null:continuedCalculationInput(text,previousCalculationTurn);
   const yenContinuation=items.length?null:continuedYenCalculation(text,previousCalculationTurn);
   const calculation=items.length?null:explicitCalculationInput(text)??(continued?{expression:continued,showExpression:true,unit:undefined}:yenContinuation?{...yenContinuation,showExpression:true}:null);
   if(calculation){const {expression,showExpression}=calculation;const result=await runCalculationAction(expression,builtinToolRegistry,{search:q=>knowledge.search(q),resolve:q=>refreshSnapshot().then(notes=>resolveToolNotes(notes,q)),check:checkSend},trace);checkSend();await finishTurn(id,{answer:formatCalculation(result[0],showExpression?expression:undefined,calculation.unit),status:'Calculated',refs:[]});return {kind:'answered'};}
   if(!items.length&&view.reviewSourcedCalculation&&isSourcedArithmeticQuestion(text,prior.turns.at(-1))){
    if(prior.currentFile&&!prior.turns.at(-1)!.refs!.some(ref=>ref.noteId===prior.currentFile!.noteId&&ref.revision===prior.currentFile!.revision))throw Error('Source changed · retry');
    await ensureText();return await reviewedCalculation();
   }
   const decisionCanRoute=decisionMayRouteRequest(decision.enabled,decision.ready,text,bonsai.protocolForModel?.(model)??'json',{textResident:bonsai.loaded===model,textFilesPresent:bonsai.assets[model]?.filesPresent===true});
   const decisionFirst=!request&&decisionCanRoute;
   const activityEventCount=currentDialogue().turns.find(turn=>turn.id===id)?.activity?.length??0;
   const preplannerReserve=decisionFirst?4:2; // model/Decision loads and one context-fit/compaction receipt
   if(!pagingAvailable&&text&&!request&&activityEventCount+preplannerReserve+RESERVED_AGENT_COMPLETION_EVENTS>MAX_ACTIVITY_EVENTS_PER_TURN){await finishTurn(id,{status:'Work limit reached · split request'});recoverDraft();return {kind:'needsInput',reason:'activity-capacity'};}
   const deferredKnowledge=!!(literalRequest||explicitSavedRequest)&&request?.target==='knowledge'&&['answer','summary'].includes(request.action)&&!inputReadings.length;
   const deferredFile=request?.target==='file'&&['answer','summary'].includes(request.action)&&!inputReadings.length;
   if(text&&!decisionFirst&&(!request||['answer','summary','recall','transform'].includes(request.action))){
    // A bound file answer uses only its validated revision. Grounding drops
    // dialogue for this scope, so counting/compacting it here is wasted work.
    if(deferredKnowledge)deferredContext=prepareContext;else if(!deferredFile){await ensureText();if(request&&['answer','summary'].includes(request.action)&&request.target!=='file'&&!explicitSavedRequest&&!inputQuestion)context=await prepareContext();}
   }
   context=planningContextForInputs({...context,refs:[...context.refs,...importedRefs]},inputReadings.length>0);
   const descriptors=sent.filter(a=>a.reading||a.status==='Text available').map(({name,kind,status})=>({name,kind,status}));
   let agentToolCalls:{tool:string;arguments:Record<string,unknown>;result:unknown}[]=[],customAccessEvidence:ReturnType<typeof agentEvidenceFromCalls>=[],agentBudgetExhausted=false,agentBudgetReason:AgentBudgetReason|undefined;
   run.progress('','planning');
   const resolution=await resolveTurnRoute({current:request,question:text,check:checkSend,
    prepareContinuation:decisionFirst?async source=>{
     await ensureText();if(source==='decision'){const prepared=await prepareContext();checkSend();
     context=planningContextForInputs({...prepared,refs:[...prepared.refs,...importedRefs]},inputReadings.length>0);}
    }:undefined,
    select:decisionCanRoute?async()=>{
     await models.decision(checkSend,work=>{setChatProgress('Loading decision model…');return trace('decision.load',decisionAssetInput(false,modelPreferences.customDecisionModels.find(m=>m.id===decisionModel)),work);});
     checkSend();setChatProgress('Selecting action…');return routeWithDecision(decision,text,context,descriptors,trace,checkSend);
    }:undefined,
    plan:async()=>{
     setChatProgress('Selecting action…');
     const coordinated=await coordinateAgentTurn({onPreview:run.preview,
      engine:inference,snapshot,model,question:text,context,attachments:descriptors,excludedTools:needsSourcedCalculationReview(text,prior.turns.at(-1))?['math.calculate']:[],
      prepareContext:async allowedTools=>{
       const withInputs=(value:DialogueContext)=>planningContextForInputs({...value,refs:[...value.refs,...importedRefs]},inputReadings.length>0);
       const prepared=await prepareContext(candidate=>plannerContextFits(inference,text,withInputs(candidate),descriptors,{allowedTools,history:[],maxToolCalls:activeHarnessProfile.maxToolCalls,userGuidance:harnessPreferences.userGuidance,replyStyle:snapshot.response.style}));
       return withInputs(prepared);
      },
       builtinPackages:builtinToolPackages,
      readToolSources:async()=>(await refreshSnapshot()).map(note=>({path:note.path,body:note.body})),
      // Tool discovery includes exact file metadata. Citable passages are
      // separately validated when evidence is selected for the final answer.
      search:(query,signal)=>knowledge.search(query,true,signal),searchPage:(query,options,signal)=>knowledge.searchPage(query,options,signal),views:signal=>knowledge.views(signal),listFolders:async()=>await knowledge.getState<string[]>('folders')??[],
      ensureCustomRuntime:()=>ensureProductRuntime('custom-tools',false),check:checkSend,signal:run.signal,trace,
      activityEventCount:pagingAvailable?undefined:currentDialogue().turns.find(turn=>turn.id===id)?.activity?.length??activityEventCount,
       });context=coordinated.context;agentToolCalls=[...coordinated.calls];customAccessEvidence=coordinated.customEvidence;agentBudgetExhausted=coordinated.budgetExhausted;agentBudgetReason=coordinated.budgetReason;return coordinated.final;
    }
   });
   request=resolution.request;if(resolution.source==='decision'||resolution.source==='planner')setChatProgress('');
   if(request?.action==='tool-create'){
    if(items.length||inputReadings.length||prior.currentFile){await finishTurn(id,{status:'Tool drafts are available only from an unscoped chat request'});return {kind:'needsInput',reason:'unscoped-request-required'};}
    if(!request.query.trim())throw Error('Describe the tool you want to create');
    await finishTurn(id,{status:'Tool draft requested · review before saving'});startToolPackageFromChat(request.query);return {kind:'awaitingApproval'};
   }
   if(request?.action==='answer'&&!inputReadings.length&&!prior.currentFile&&agentToolCalls.length&&agentToolCalls.every(call=>call.tool==='math.calculate')){
    if(needsSourcedCalculationReview(text,prior.turns.at(-1)))throw Error('Check source values · enter the calculation explicitly');
    const calculations=agentCalculationsFromCalls(agentToolCalls);
    await finishTurn(id,{answer:calculations.map(item=>formatCalculation(item,item.expression)).join('\n'),status:'Calculated',refs:[]});return {kind:'answered'};
   }
    const scoped=scopeResolvedTurnRequest({request,question:text,literal:!!literalRequest,literalAction:literalRequest?.action,inputs:inputReadings,currentFile:sourceFile??prior.currentFile});
    request=scoped.request;inputReadings=scoped.inputs;const fileBinding=scoped.fileBinding;
   const actions=()=>createResolvedActions({store:knowledge,engine:inference,model,question:text,check:checkSend,trace,snapshot:refreshSnapshot,registry:builtinToolRegistry,acquireModel:async()=>{await ensureText();return inference;}});
   let selectedFile:any;let workingFile=request?.target==='file'?(sourceFile??prior.currentFile):undefined;
   if(request?.target==='file'){
    if(!workingFile)throw Error('No working file · open a file first');const filePin=workingFile;
    selectedFile=await trace('memory.read',{target:'file',binding:fileBinding?.binding??'explicit',...workingFile},async()=>{try{return workingFileNote(await knowledge.all(),filePin);}catch(error){if(sourceFile&&error instanceof Error&&['Working file original unavailable','Working file changed · reopen the file'].includes(error.message))throw Error('Source changed · retry');throw error;}},workingFileMetadata);checkSend();
     if(request.action==='read'){const completion=literalRequest?.action==='read'||explicitSavedRequest?.action==='read'?'open':await trace('dialogue.plan',{stage:'read-completion',model,question:text,...workingFile},()=>resolveReadCompletion(inference,text,checkSend));checkSend();const metadata=workingFileMetadata(selectedFile),resolution=resolveReadIntent(text,completion,{noteId:selectedFile.id,path:metadata.path,revision:workingFile.revision,body:selectedFile.revisions.at(-1).body});if(resolution.kind==='continue'){request={...request,action:resolution.action,target:'file',query:resolution.query};workingFile=resolution.workingFile;}else{await finishTurn(id,{status:resolution.status,refs:resolution.refs});openNote(selectedFile.id,resolution.path);return {kind:'displayed'};}}
   }
   if(request?.action==='calculate'){
    if(needsSourcedCalculationReview(text,prior.turns.at(-1)))return await reviewedCalculation();
    const expression=request.query;const result=await runCalculationAction(expression,builtinToolRegistry,{search:q=>knowledge.search(q),resolve:q=>refreshSnapshot().then(notes=>resolveToolNotes(notes,q)),check:checkSend},trace);checkSend();await finishTurn(id,{answer:formatCalculation(result[0],expression),status:'Calculated',refs:[]});return {kind:'answered'};
   }
   if(request?.action==='schedule'){
    const result=await actions().schedule(context);checkSend();
    if(result.kind==='clarify'){await finishTurn(id,{answer:result.question,status:'Schedule details needed'});return {kind:'needsInput',reason:'schedule-details'};}
    await finishTurn(id,{status:'Review schedule · Paused'});checkSend();view.reviewSchedule(result.task,id);return {kind:'awaitingApproval'};
   }
   if(request?.action==='edit'){
    // Existing reviews are inert but exclusive. Do not spend a model run on a
    // proposal that staging would refuse. The transaction still checks races.
    const pending=await knowledge.getState(PENDING_CORRECTION_STATE);checkSend();
    if(pending!==undefined){await refreshStorage();checkSend();await finishTurn(id,{status:'Review pending changes first'});recoverDraft();view.toast('Review pending changes first');return {kind:'needsInput',reason:'pending-correction'};}
    if(intent.namedCorrection){
     const selected=await discoverCorrectionTarget({query:intent.namedCorrection.query,search:query=>trace('memory.search',{query},()=>knowledge.search(query)),all:()=>knowledge.all(),choose:view.chooseCorrectionTarget,check:checkSend});checkSend();
     if(!selected){await finishTurn(id,{status:'Edit cancelled'});recoverDraft();return {kind:'cancelled'};}
     selectedFile=await trace('memory.read',{target:'path',binding:'named-correction',...selected},async()=>{
      const records=await knowledge.all(),target=resolveCorrectionTarget(records,selected.path);
      if(target.id!==selected.noteId)throw Error('Discovered file changed · search again');
      return workingFileNote(records,{noteId:selected.noteId,revision:selected.revision});
     },workingFileMetadata);checkSend();request={...request,query:selected.path};
    }
    if(agentToolCalls.length){
     const pin=agentCorrectionTarget(request,agentToolCalls);
     const query=request.query;
     selectedFile=await trace('memory.read',{target:'path',binding:'agent-discovery',query,...pin},async()=>{
      const records=await knowledge.all(),target=resolveCorrectionTarget(records,query);
      if(target.id!==pin.noteId)throw Error('Discovered file changed · search again');
      return workingFileNote(records,pin);
     },workingFileMetadata);checkSend();
    }
    const {proposal}=await actions().correction(request.query,selectedFile);checkSend();
    await finishTurn(id,{status:'Review correction · '+proposal.path+' · v'+proposal.expected.revisions.at(-1).version});checkSend();await view.reviewCorrection(proposal,id);return {kind:'awaitingApproval'};
   }
   let captureSource:DialogueCopyReview|null=null;
   let selectedDialogueSources:NonNullable<DialogueTurn['refs']>|undefined;
   if(request&&(request.target==='current'||request.historyIndex!=null)&&['recall','capture','transform'].includes(request.action)){
    // Keep the original selector stable when the resolved index is added to
    // the mutable request below. A current-result selector cannot also carry
    // a history index when the review resolves its source.
    const selection=request.target?{...request}:{...request,target:'history' as const};
    const original=await trace('dialogue.read',dialogueTargetInput(prior,selection),async()=>resolveDialogueTarget(prior,selection));checkSend();
    if(request.action==='capture'){request.historyIndex=original.turnIndex;request.historyPart=original.speaker as 'user'|'assistant';captureSource=makeDialogueCopyReview(prior,selection);}
    inputReadings=[];context={summary:'',recent:[],refs:[],turnCount:prior.turns.length,selectedOriginal:{speaker:original.speaker==='assistant'?'assistant':'user',text:original.quote}};
    await finishTurn(id,{readTurn:{turnId:original.turnId,index:original.turnIndex,speaker:original.speaker},status:'Reading earlier message'});
    if(request.action==='recall'||request.action==='transform'){const inspected=await trace('text.inspect',{model,question:text,target:{turnId:original.turnId,index:original.turnIndex,speaker:original.speaker},text:original.quote},()=>inspectDialogueText(inference,text,original,checkSend),value=>value,value=>value.operation==='transform'&&value.result.status?Error(value.result.status):undefined);checkSend();if(inspected.operation==='transform'){const result=inspected.result;await finishTurn(id,{...result,status:result.status,refs:original.refs});return result.status?{kind:'failed',reason:'text-operation'}:{kind:'answered'};}request.action='recall';}
    if(request.action==='capture')request.body=original.quote;else{request.action='chat';selectedDialogueSources=structuredClone(original.refs);}
   }
   // A native reply may cite an exact search range even after a longer read.
   // Preserve the observed ranges; only legacy generation reselects evidence.
   const toolEvidence=agentToolCalls.length?{used:true as const,refs:agentBudgetReason==='source-capacity'?agentAnswerEvidenceFromCalls(agentToolCalls,customAccessEvidence,true):(request?.reply?agentEvidenceFromCalls:agentAnswerEvidenceFromCalls)(agentToolCalls,customAccessEvidence),calculations:agentCalculationsFromCalls(agentToolCalls),clockReadings:agentClockReadingsFromCalls(agentToolCalls),customResults:agentCustomResultsFromCalls(agentToolCalls),toolInfo:agentToolInfoFromCalls(agentToolCalls),completedToolIds:[...new Set(agentToolCalls.map(call=>call.tool))],memoryUsed:agentToolCalls.some(call=>call.tool.startsWith('memory.'))||customAccessEvidence.length>0,...(agentBudgetExhausted?{budgetExhausted:true}:{})}:undefined;
   if(request?.action==='capture'){
    const previous=request.historyIndex!=null&&request.historyPart==='assistant'?prior.turns[request.historyIndex]:undefined;
    let sources=previous?.refs??[],kind:'original'|'generated'=previous?'generated':'original';
    // When the agent inspected Memory or current inputs before choosing to
    // create a note, ground the new content once and carry those exact source
    // revisions into the capture. Saving an already generated dialogue answer
    // still copies its existing bytes without another inference.
    if(request.historyIndex==null&&(inputReadings.length||agentToolCalls.length)){
     await ensureText();
     const captureQuery=groundingQuery(text,request.query,inputReadings.length>0);
     const scope=inputReadings.length?{kind:'attachments' as const,readings:inputReadings}:{kind:'knowledge' as const};
     const parsed=await actions().answer({model,question:text,query:captureQuery,mode:'summary',context,check:checkSend,scope,toolEvidence,reply:request.reply,replyStyle:harnessPreferences.replyStyle,userGuidance:harnessPreferences.userGuidance},{mode:'capture',toolCalls:agentToolCalls.map(call=>call.tool),budgetReason:agentBudgetReason});
     checkSend();
     if(parsed.status==='insufficient_evidence'){
      await finishTurn(id,{answer:parsed.answer,refs:[],status:'Not enough evidence'},parsed.checkedSources);
      return {kind:'needsInput',reason:'insufficient-evidence'};
     }
     request.body=parsed.answer;sources=parsed.sources.map(source=>({noteId:source.noteId,revision:source.revision,start:source.start,end:source.end,quote:source.quote,...(source.citedQuote?{citedQuote:source.citedQuote}:{})}));kind='generated';await finishTurn(id,{answer:parsed.answer,status:'Saving note',refs:sources});
    }else await finishTurn(id,{status:'Saving note',refs:importedRefs});
    await view.saveCapture({turnId:id,source:captureSource,body:request.body!,sources,kind});return captureSource||kind==='generated'?{kind:'awaitingApproval'}:{kind:'answered'};
   }
   if(request?.action==='read'){
    const result=await actions().read(request.query,{explicitSavedOpen:request.target==='knowledge'&&explicitSavedRequest?.action==='read',literalRead:literalRequest?.action==='read'||explicitSavedRequest?.action==='read'});checkSend();
    if(result.kind==='open'){await finishTurn(id,{status:result.status,refs:result.refs});openNote(result.noteId,result.path);return {kind:'displayed'};}
    if(result.kind==='search'){await finishTurn(id,{results:result.results,files:result.files,status:result.status,refs:importedRefs});return {kind:'displayed'};}
    workingFile=result.workingFile;request={...request,action:result.action,target:'file',query:result.query};
   }
   if(request?.action==='search'){
    if(resolution.source!=='explicit')await ensureText();
    const result=await actions().search(request.query,{complete:resolution.source!=='explicit'});checkSend();
    if(result.kind==='search'){
     // Legacy single-action planners may return `search` even when the user
     // also asks for an answer. Preserve the search result as retrieval input
     // and continue through grounded answer generation instead of ending at a
     // results-only card. Ambiguous evidence is resolved by the answer layer.
     if(requestsImplicitSearchReadAnswer(text)){request={...request,action:'answer',query:request.query,target:'knowledge'};}
     else{await finishTurn(id,{results:result.results,files:result.files,status:result.status,refs:importedRefs});return {kind:'displayed'};}
    }
    if(result.kind==='continue'){request={...request,action:result.action,query:result.query,target:'knowledge'};}
   }
   if(text&&request){if(!deferredKnowledge&&!deferredFile)await ensureText();run.progress('','generating');if(request.action!=='answer'&&request.action!=='summary'&&request.action!=='chat')throw Error('Unresolved answer action');const answerQuery=groundingQuery(text,request.query,inputReadings.length>0),answerMode=request.action==='chat'&&agentToolCalls.some(call=>call.tool==='time.now')?'answer':request.action,parsed=await actions().answer({model:model,question:text,query:answerQuery,mode:answerMode,context:context,check:checkSend,scope:(workingFile?{kind:'file',file:workingFile}:(inputReadings.length?{kind:'attachments',readings:inputReadings}:(answerMode==='chat'?{kind:'conversation'}:{kind:'knowledge'}))),prepareContext:deferredContext,toolEvidence:toolEvidence,reply:request.reply,replyStyle:harnessPreferences.replyStyle,userGuidance:harnessPreferences.userGuidance},{toolCalls:agentToolCalls.map(call=>call.tool),budgetReason:agentBudgetReason});checkSend();
    if(parsed.status==='insufficient_evidence'){
     await finishTurn(id,{answer:parsed.answer,refs:[],status:'Not enough evidence'},parsed.checkedSources);
     return {kind:'needsInput',reason:'insufficient-evidence'};
    }
    const guard=!selectedDialogueSources&&parsed.sources.length&&parsed.sources.every(ref=>ref.groundingEligible!==false)?parsed.sources:undefined;await finishTurn(id,{answer:parsed.answer,refs:selectedDialogueSources??parsed.sources,status:agentBudgetExhausted?'Partial · incomplete inspection':parsed.recovery==='verbatim-source'?'Source excerpt · partial answer':request.action==='summary'?'Summary · selected excerpts':undefined},guard);return {kind:'answered'};}
   await finishTurn(id,{refs:importedRefs,status:items.length&&!text?(items.some(a=>a.reviewedText||a.kind==='text'&&a.text!==undefined)?'Text imported':'Analysis not prepared'):'Model not prepared'});
   return items.length?(sent.every(a=>a.reading||a.voice||a.status==='Text available')?{kind:'imported'}:{kind:'partial',reason:'unread-input'}):{kind:'needsPreparation',reason:'model-unavailable'};
  }catch(e){try{recordUnclassifiedTurnFailure(diagnostics,connectionPreferences.diagnosticLogs,activityFailureRecorded,e);}catch{/* Diagnostics must never change the operation result. */}recoverDraft();try{if(currentDialogue().turns.some(t=>t.id===id))await finishTurn(id,{status:searchScopeFailure((e as Error).message,text,!!prior.currentFile,items.length>0)});else view.toast((e as Error).message);}catch(failure){view.failure((failure as Error).message);view.toast((failure as Error).message);}throw e;}
}
