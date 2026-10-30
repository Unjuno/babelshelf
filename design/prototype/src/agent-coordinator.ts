import {buildActiveToolRegistry,type ToolSourceRecord} from './active-tool-registry.ts';
import {agentCalculationsFromCalls,agentClockReadingsFromCalls,agentCustomResultsFromCalls,agentToolInfoFromCalls,agentEvidenceFromCalls,beginCustomEvidence,projectAgentActivityInput,projectAgentActivityResult,projectAgentToolResult} from './agent-evidence.ts';
import {planDialogueAgent} from './dialogue-agent.ts';
import type {ChatEngine,DialogueContext,DialoguePlan} from './conversation.ts';
import {listMemoryEntries,resolveToolNotes} from './tools/tool-host.ts';
import {SYSTEM_FOLDERS} from './memory-paths.ts';
import type {ToolPackage} from './tools/tool-registry.ts';
import {AgentToolExecutionError,AgentToolInputError,type AgentToolCall,type AgentToolResult,type AgentToolCapability} from './agent-loop.ts';
import {AgentToolResultTooLargeError} from './agent-tool-errors.ts';
import {validateToolArguments,type ToolInputSchema} from './tools/tool-input.ts';
import type {ActivityTool} from './harness-activity.ts';
import {activityBoundedToolBudget} from './harness-activity.ts';
import type {ToolHost,ToolNote} from './tools/tool-host.ts';
import type {MemorySearchResult} from './memory-search-types.ts';
import {turnExecutionReceipt,type TurnExecutionSnapshot} from './turn-execution-snapshot.ts';
import {explicitlyNamedSearchResultIds,requestsCompoundSearchTask,requestsImplicitSearchReadAnswer,requestsLocalSearchReadAnswer,requestsMoreToolWorkAfterRead,requestsSynthesisWithoutMoreTools} from './saved-knowledge-reference.ts';
import {DEFERRED_TOOL_READ_SKILL_CAPABILITY,DEFERRED_TOOL_READ_SKILL_ID,DEFERRED_TOOL_SEARCH_CAPABILITY,DEFERRED_TOOL_SEARCH_ID,explicitDeferredToolIds,readDeferredToolSkill,searchDeferredTools} from './deferred-tool-search.ts';

type AgentAttachment={name:string;kind:string;status:string};
type Trace=<T>(tool:ActivityTool,input:unknown,work:()=>Promise<T>,project?:(result:T)=>unknown)=>Promise<T>;

function explicitlyNamesReadTarget(query:string,question:string){
 if(!question.includes(query))return false;
 if(query.includes('/')||/\.[a-z0-9]{1,10}$/i.test(query)||/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(query))return true;
 if(['"','\'','`','“','‘'].some(open=>question.includes(open+query+({ '“':'”','‘':'’' }[open]??open))))return true;
 const lowerQuestion=question.toLocaleLowerCase(),lowerQuery=query.toLocaleLowerCase();
 return ['file','document','note','record','path','filename','id','identifier'].some(label=>[
  `${label} ${lowerQuery}`,`${label}: ${lowerQuery}`,`${label}=${lowerQuery}`,
  `${label} is ${lowerQuery}`,`${label} named ${lowerQuery}`,`${label} called ${lowerQuery}`,`${label} at ${lowerQuery}`,
 ].some(reference=>lowerQuestion.includes(reference)));
}

function rememberExactReadTargets(targets:Set<string>,result:unknown){
 const rows=Array.isArray(result)?result:result&&typeof result==='object'&&!Array.isArray(result)&&Array.isArray((result as Record<string,unknown>).entries)?(result as {entries:unknown[]}).entries:[];
 for(const item of rows){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const row=item as Record<string,unknown>;
  if(typeof row.noteId==='string'&&row.noteId)targets.add(row.noteId);
  if(row.kind==='file'&&typeof row.id==='string'&&row.id)targets.add(row.id);
  const path=(row.kind==='file'||typeof row.noteId==='string')&&typeof row.path==='string'?row.path:typeof row.title==='string'&&(row.title.includes('/')||/\.[a-z0-9]{1,10}$/i.test(row.title))?row.title:null;
  if(path){targets.add(path);const filename=path.split('/').at(-1);if(filename)targets.add(filename);}
 }
}

// If the user explicitly names files, a search returning only a subset must
// not cause the coordinator to bypass the model's next planning step.
function namedFileResultsComplete(question:string,results:readonly unknown[]){
 const names=[...question.matchAll(/[\p{L}\p{N}_-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b/giu)].map(match=>match[0].normalize('NFKC').toLocaleLowerCase());
 if(!names.length)return true;
 return names.every(name=>{
  const ids=new Set<string>();
  for(const item of results){
   if(!item||typeof item!=='object'||Array.isArray(item))continue;
   const row=item as Record<string,unknown>;
   if(typeof row.noteId!=='string')continue;
   if([row.path,row.title].some(path=>typeof path==='string'&&path.split(/[\\/]/).at(-1)?.normalize('NFKC').toLocaleLowerCase()===name))ids.add(row.noteId);
  }
  return ids.size===1;
 });
}

function allNamedSourcesFullyRead(history:readonly {tool:string;arguments:Record<string,unknown>;result?:unknown;error?:unknown}[],ids:readonly string[]){
 if(ids.length<2)return false;
 return ids.every(id=>{
  const slices:{revision:number;start:number;end:number;total:number;partial:boolean;excerpt:string}[]=[];
  for(const item of history){
   if(item.tool!=='memory.read'||item.error||!Array.isArray(item.result))continue;
   for(const value of item.result){
    if(!value||typeof value!=='object'||Array.isArray(value))continue;
    const row=value as Record<string,unknown>;
    if(row.noteId!==id||!Number.isSafeInteger(row.revision)||!Number.isSafeInteger(row.start)||!Number.isSafeInteger(row.totalChars)||typeof row.excerpt!=='string'||typeof row.partial!=='boolean')continue;
    const start=row.start as number,excerpt=row.excerpt as string,total=row.totalChars as number;
    if(total<1||start<0||start+excerpt.length>total||row.partial!==(start+excerpt.length<total))continue;
    slices.push({revision:row.revision as number,start,end:start+excerpt.length,total,partial:row.partial,excerpt});
   }
  }
  if(!slices.length||slices.some(slice=>slice.total!==slices[0].total||slice.revision!==slices[0].revision))return false;
  let covered=0;for(const slice of slices.sort((a,b)=>a.start-b.start)){if(slice.start>covered)return false;covered=Math.max(covered,slice.end);}
  return covered>=slices[0].total;
 });
}

function namedFilesReadCompletely(question:string,history:readonly {tool:string;arguments:Record<string,unknown>;result?:unknown;error?:unknown}[]){
 const matches=[...question.matchAll(/[\p{L}\p{N}_-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b/giu)];if(matches.some(match=>['/','\\'].includes(question[(match.index??0)-1]??'')))return false;
 const names=[...new Set(matches.map(match=>match[0]))];
 if(names.length<2)return false;
 const ids:string[]=[];
 for(const name of names){const found=new Set<string>();for(const item of history){if(item.tool!=='memory.read'||item.error||!Array.isArray(item.result))continue;for(const row of item.result){if(row&&typeof row==='object'&&typeof row.path==='string'&&row.path.split('/').at(-1)===name&&typeof row.noteId==='string')found.add(row.noteId);}}if(found.size!==1)return false;ids.push([...found][0]);}
 return new Set(ids).size===names.length&&allNamedSourcesFullyRead(history,ids);
}

export type AgentBudgetReason='context'|'source-capacity'|'activity-capacity'|'profile-limit'|'both-limits';

/** Application boundary for registry selection, audited tool execution and source observation. */
export async function coordinateAgentTurn(input:{
 onPreview?:(text:string)=>void;
 engine:ChatEngine;
 snapshot:TurnExecutionSnapshot;
 model:string|undefined;
 question:string;
 context:DialogueContext;
 prepareContext?:(tools:readonly AgentToolCapability[])=>Promise<DialogueContext>;
 attachments:AgentAttachment[];
 excludedTools?:readonly string[];
 builtinPackages:readonly ToolPackage[];
 readToolSources:()=>Promise<ToolSourceRecord[]>;
 search:(query:string,signal?:AbortSignal)=>Promise<MemorySearchResult[]>;
 views:(signal?:AbortSignal)=>Promise<ToolNote[]>;
 listFolders?:()=>Promise<string[]>;
 ensureCustomRuntime:()=>Promise<unknown>;
 check:()=>void;
 signal:AbortSignal;
 trace:Trace;
 activityEventCount?:number;
}) : Promise<{final:DialoguePlan;calls:readonly AgentToolResult[];customEvidence:ReturnType<typeof agentEvidenceFromCalls>;context:DialogueContext;budgetExhausted:boolean;budgetReason?:AgentBudgetReason;snapshot:TurnExecutionSnapshot}> {
 if(input.snapshot.models.text.id!==input.model)throw Error('Execution snapshot model mismatch');
 const execution=turnExecutionReceipt(input.snapshot);
 const profileLimit=input.snapshot.harness.maxToolCalls;
 const activityLimit=input.activityEventCount===undefined?null:activityBoundedToolBudget(input.activityEventCount,null);
 const maxToolCalls=activityLimit===null?profileLimit:profileLimit===null?activityLimit:Math.min(activityLimit,profileLimit);
 const excludedTools=new Set(input.excludedTools??[]);
 const configuredTools=input.snapshot.harness.enabledTools.filter(id=>!excludedTools.has(id));
 const sources=await input.readToolSources();
 const selected=await buildActiveToolRegistry(sources,configuredTools,[...input.builtinPackages]);
 const registry=selected.registry,registeredTools=selected.capabilities;
 // Keep the always-used built-ins visible. Custom tools are discovered through
 // the same local search/skill flow for every planner protocol. A schema is
 // offered only after the guide is read; the runtime needs only plain tool JSON.
 const canDeferCustom=registeredTools.some(tool=>tool.id.startsWith('user.'));
 const allowedTools=canDeferCustom?[...registeredTools,DEFERRED_TOOL_SEARCH_CAPABILITY,DEFERRED_TOOL_READ_SKILL_CAPABILITY]:registeredTools;
 // Context fitting applies the same discovery projection as actual planning.
 // The two host discovery tools never displace configured custom-tool slots.
 const context=input.prepareContext?await input.prepareContext(allowedTools):input.context;input.check();
 if(JSON.stringify(context.currentFile??null)!==JSON.stringify(input.context.currentFile??null))throw Error('Context file selection changed');
 let customEvidence:ReturnType<typeof agentEvidenceFromCalls>=[];
 let pendingCustomCommit:(()=>typeof customEvidence)|null=null;
 let pendingCustomSources:(()=>typeof customEvidence)|null=null;
 // Host observations are scoped to an exact attempt, outside custom JSON.
 // Failed, skipped or omitted calls cannot inherit another call's sources.
 const customSourcesByAttempt=new Map<number,typeof customEvidence>();
 const exactReadTargets=new Set<string>();
 let searchedMemory=false;
 let latestSearchNoteIds:string[]=[];
 let latestSearchQuotes=new Set<string>();
 // A user can name several files and the model may search them one at a time.
 // Keep only successfully projected results from this turn so exact names can
 // be resolved together after the final search, without another planner pass.
 const explicitSearchResults:unknown[]=[];
 let latestExplicitReadIds:string[]=[];
 let namedFileResultsCompleteForSynthesis=false;
 const readSkillIds=new Set<string>();
 const namedGuides=explicitDeferredToolIds(input.question,registeredTools).slice(0,maxToolCalls??registeredTools.length);
 let bridge:Promise<Awaited<ReturnType<typeof import('./mcp-agent-bridge.ts').createAgentMcpBridge>>>|undefined;
 const toolBridge=()=>bridge??=import('./mcp-agent-bridge.ts').then(module=>module.createAgentMcpBridge(allowedTools,input.signal));
 try{
 const loop=await planDialogueAgent({
  onPreview:input.onPreview,engine:input.engine,question:input.question,context,attachments:input.attachments,
  allowedTools,maxToolCalls,maxResultChars:input.snapshot.harness.maxResultChars,userGuidance:input.snapshot.response.userGuidance,replyStyle:input.snapshot.response.style,check:input.check,
  readObservedSources:()=>customSourcesByAttempt,
  tracePlan:(step,work,readMetrics)=>input.trace('dialogue.plan',{execution,activeToolIds:allowedTools.map(tool=>tool.id),effectiveToolBudget:maxToolCalls,model:input.model,step},work,plan=>{
   const inference=readMetrics();let receipt=plan;
   if(plan.action==='tool'||plan.action==='tool_batch'){
    // Native assistant content is required for the current tool round trip,
    // not for durable action receipts or the next conversation's context.
    const {assistantContent:_transient,...operation}=plan;receipt=operation;
   }
   return {...receipt,...(inference?{inference}:{})};
  }),
  hasUsefulEvidence:history=>{
   const calls=history.filter(item=>!item.error);
   return customEvidence.length>0||calls.some(call=>agentEvidenceFromCalls([call]).length>0||agentCalculationsFromCalls([call]).length>0||agentClockReadingsFromCalls([call]).length>0||agentCustomResultsFromCalls([call]).length>0||agentToolInfoFromCalls([call]).length>0);
  },
  selectNextPlan:history=>{
   // A literal selected package ID is already resolved. Prepare its current
   // guide through the normal audited reader before asking the model to act.
   // This reveals metadata, not execution or knowledge contents. It avoids
   // relying on stale remembered descriptions or spending a model call on lookup.
   if(!history.length&&namedGuides.length){
    const calls=namedGuides.map(id=>({tool:DEFERRED_TOOL_READ_SKILL_ID,arguments:{id}}));
    return calls.length===1?{action:'tool',...calls[0]}:{action:'tool_batch',calls};
   }
   // Native function models own their continuation. Legacy intent shortcuts
   // must not replace a requested skill workflow after a model-selected search.
   if(input.engine.plannerProtocol==='native-tool-calls')return null;
   const latest=history.at(-1);
   // A request to search and answer implies reading the sole matching source.
   // Do not ask a small planner to remember an unstated internal step, and do
   // not guess when search is empty or ambiguous.
   if(latest?.tool==='memory.search'&&!latest.error&&requestsImplicitSearchReadAnswer(input.question)&&allowedTools.some(tool=>tool.id==='memory.read')){
    const ids=[...new Set(latestSearchNoteIds)];
    if(ids.length===1)return {action:'tool' as const,tool:'memory.read',arguments:{query:ids[0]}};
   }
   if(latest?.tool==='memory.search'&&!latest.error&&Array.isArray(latest.result)&&requestsCompoundSearchTask(input.question)&&allowedTools.some(tool=>tool.id==='memory.read')){
    const ids=explicitlyNamedSearchResultIds(input.question,explicitSearchResults);
    if(ids.length>=2){latestExplicitReadIds=ids;namedFileResultsCompleteForSynthesis=namedFileResultsComplete(input.question,explicitSearchResults);return {action:'tool_batch',calls:ids.map(id=>({tool:'memory.read',arguments:{query:id}}))};}
   }
   // Native function models finish with their answer and source labels in the
   // same agent turn. Only legacy planners need a separate answer generation.
   if(latest?.tool==='memory.read'&&requestsSynthesisWithoutMoreTools(input.question)&&((namedFileResultsCompleteForSynthesis&&allNamedSourcesFullyRead(history,latestExplicitReadIds))||namedFilesReadCompletely(input.question,history))){
    return {action:'answer',query:input.question,target:'knowledge'};
   }
   if(latest?.tool==='memory.read'&&!latest.error&&requestsLocalSearchReadAnswer(input.question)&&!requestsMoreToolWorkAfterRead(input.question)&&latestSearchNoteIds.length===1&&Array.isArray(latest.result)&&latest.result.length===1){
    const source=latest.result[0] as Record<string,unknown>;
    const start=typeof source.start==='number'?source.start:0,excerpt=typeof source.excerpt==='string'?source.excerpt:typeof source.body==='string'?source.body:'',total=typeof source.totalChars==='number'?source.totalChars:start+excerpt.length;
    if(source.noteId===latestSearchNoteIds[0]&&source.partial!==true&&start+excerpt.length>=total)return {action:'answer',query:input.question,target:'knowledge'};
   }
   return null;
  },
  normalizeToolArguments:(tool,args)=>{
   // The user may name a complete filename while a model supplies its stem.
   // Restore only an unambiguous exact basename from the user's own request;
   // path-qualified names remain untouched and duplicate basenames still go
   // through the ordinary resolver rather than picking an arbitrary record.
   if(tool==='memory.read'&&typeof args.query==='string'&&!args.query.includes('/')&&!args.query.includes('\\')){
    const names=[...input.question.matchAll(/[\p{L}\p{N}_-]+\.(?:md|markdown|txt|pdf|docx?|rtf)\b/giu)].filter(match=>!['/','\\'].includes(input.question[(match.index??0)-1]??'')).map(match=>match[0]);
    const matches=[...new Set(names.filter(name=>name.slice(0,name.lastIndexOf('.'))===args.query))];
    if(matches.length===1)return {...args,query:matches[0]};
   }
   // Small local models sometimes copy the quoted search result into the
   // memory.read selector instead of using its stable note ID. For the
   // explicit search → read → answer workflow only, bind that mistake when
   // the most recent search returned exactly one unique record. Never guess
   // when search is ambiguous, and preserve user-named/exact selectors.
   if(tool!=='memory.read'||!requestsLocalSearchReadAnswer(input.question)||typeof args.query!=='string'||!latestSearchNoteIds.length)return args;
   if(exactReadTargets.has(args.query)||explicitlyNamesReadTarget(args.query,input.question))return args;
   if(latestSearchNoteIds.length===1&&latestSearchQuotes.has(args.query))return {...args,query:latestSearchNoteIds[0]};
   return args;
  },
  traceTool:async(call:AgentToolCall,work,attemptIndex)=>{
   const audited=async()=>{
   const synthetic=call.tool===DEFERRED_TOOL_SEARCH_ID||call.tool===DEFERRED_TOOL_READ_SKILL_ID;
   const identity=synthetic?{builtin:call.tool,version:1}:await registry.identity(call.tool);
   const activityInput=projectAgentActivityInput(call.tool,call.arguments,identity);
   pendingCustomCommit=null;pendingCustomSources=null;let projected:unknown,projectedReady=false,acceptedEvidence:typeof customEvidence|undefined,acceptedSources:typeof customEvidence|undefined;
   const project=(value:unknown)=>{
    const result=projectAgentToolResult(call.tool,value,input.snapshot.harness.maxResultChars),serialized=JSON.stringify(result);
    if(typeof serialized!=='string'||serialized.length>input.snapshot.harness.maxResultChars)throw new AgentToolResultTooLargeError();
    const evidence=pendingCustomCommit?.();
    const activity=projectAgentActivityResult(call.tool,value,input.snapshot.harness.maxResultChars);
    projected=result;projectedReady=true;acceptedEvidence=evidence;acceptedSources=pendingCustomSources?.();return activity;
   };
   const result=await input.trace(call.tool as ActivityTool,{execution,activeToolIds:allowedTools.map(tool=>tool.id),...(activityInput&&typeof activityInput==='object'&&!Array.isArray(activityInput)?activityInput as Record<string,unknown>:{input:activityInput})},work,project);
   if(!projectedReady)project(result);
   input.check();if(acceptedEvidence)customEvidence=acceptedEvidence;
   if(acceptedSources?.length)customSourcesByAttempt.set(attemptIndex,structuredClone(acceptedSources));
   // Guide reading reveals execution schema only after projection and receipt
   // persistence. Names come from the active registry, not search history.
   if(call.tool===DEFERRED_TOOL_READ_SKILL_ID){
    const id=(projected as {id:string}).id;
    if(id===call.arguments.id&&registeredTools.some(tool=>tool.id===id))readSkillIds.add(id);
   }
   if(call.tool==='memory.search'||call.tool==='memory.list'||call.tool==='memory.read'){
    // Only results accepted by projection and activity persistence were shown
    // to the planner and may introduce new implicit read targets.
    rememberExactReadTargets(exactReadTargets,projected);
    if(call.tool==='memory.search'){
     latestSearchNoteIds=Array.isArray(projected)?[...new Set(projected.flatMap(item=>item&&typeof item==='object'&&!Array.isArray(item)&&typeof (item as Record<string,unknown>).noteId==='string'?[(item as Record<string,string>).noteId]:[]))]:[];
     latestSearchQuotes=new Set(Array.isArray(projected)?projected.flatMap(item=>item&&typeof item==='object'&&!Array.isArray(item)&&typeof (item as Record<string,unknown>).quote==='string'&&((item as Record<string,string>).quote).trim()?[(item as Record<string,string>).quote]:[]):[]);
     if(Array.isArray(projected))explicitSearchResults.push(...projected);
    }
   }
   return projected;
   };
   // Malformed model arguments are rejected and recorded by the existing
   // audited host preflight. They must not be sent as an invalid MCP request,
   // which would bypass that receipt and its recoverable error category.
   const schema=allowedTools.find(tool=>tool.id===call.tool)?.inputSchema;
   if(schema)try{validateToolArguments(schema as ToolInputSchema,call.arguments);}catch{return audited();}
   return (await toolBridge()).call(call,audited);
  },
  execute:async(call:AgentToolCall)=>{
   input.check();
   const schema=allowedTools.find(tool=>tool.id===call.tool)?.inputSchema;
   if(schema){
    // Preflight happens before any runtime or host operation. Adapter exceptions
    // remain terminal even if they resemble an input-validation error.
    try{validateToolArguments(schema as ToolInputSchema,call.arguments);}catch{throw new AgentToolInputError();}
   }
   if(canDeferCustom&&call.tool.startsWith('user.')&&!readSkillIds.has(call.tool))throw new AgentToolInputError();
   if(call.tool==='memory.read'&&searchedMemory&&typeof call.arguments.query==='string'&&!explicitlyNamesReadTarget(call.arguments.query,input.question)&&!exactReadTargets.has(call.arguments.query))throw new AgentToolInputError();
   // Discovery selectors are checked by the host before any package executes.
   // An adapter cannot impersonate this category by throwing the same class.
   if(call.tool===DEFERRED_TOOL_SEARCH_ID){if(!canDeferCustom)throw new AgentToolInputError();return searchDeferredTools(call.arguments.query,registeredTools);}
   if(call.tool===DEFERRED_TOOL_READ_SKILL_ID){if(!canDeferCustom)throw new AgentToolInputError();try{return readDeferredToolSkill(call.arguments.id,registeredTools);}catch{throw new AgentToolInputError();}}
   try{
    // Discovered records remain valid read targets for this turn, even when
    // the model searches again before comparing earlier results. Latest-search
    // shortcuts still use only the newest search and must be reset separately.
    if(call.tool==='memory.search'){searchedMemory=true;latestSearchNoteIds=[];latestSearchQuotes.clear();latestExplicitReadIds=[];namedFileResultsCompleteForSynthesis=false;}
    const isCustom=call.tool.startsWith('user.');
    if(isCustom)await input.ensureCustomRuntime();
    const host:ToolHost={
     search:(query,signal)=>input.search(query,signal),
     resolve:async(query,signal)=>{const notes=await input.views(signal);signal?.throwIfAborted();return resolveToolNotes(notes,query);},
     list:async(path,offset,limit,signal)=>{const [notes,folders]=await Promise.all([input.views(signal),input.listFolders?.()??Promise.resolve([])]);signal?.throwIfAborted();return listMemoryEntries(path,notes,[...SYSTEM_FOLDERS,...folders],offset,limit);},
     check:input.check,signal:input.signal,
    };
    const transaction=isCustom?beginCustomEvidence(host,customEvidence):null;
    const result=await registry.run(call.tool,call.arguments,transaction?.host??host);
    if(transaction){input.check();pendingCustomCommit=transaction.commit;pendingCustomSources=transaction.observed;}
    return result;
   }catch(error){if(error instanceof Error&&error.message==='Stopped')throw error;if(input.signal.aborted){input.check();throw Error('Stopped');}if(error instanceof AgentToolResultTooLargeError)throw error;throw new AgentToolExecutionError(call.tool,error);}
  },
 });
 const budgetReason=loop.budgetCause==='context'?'context':loop.budgetCause==='source-capacity'?'source-capacity':loop.budgetCause==='tool-limit'?(activityLimit===null?'profile-limit':profileLimit===null||activityLimit<profileLimit?'activity-capacity':profileLimit<activityLimit?'profile-limit':'both-limits'):undefined;
 return {final:loop.final,calls:loop.calls,customEvidence,context,budgetExhausted:loop.budgetExhausted===true,...(budgetReason?{budgetReason}:{}),snapshot:input.snapshot};
 }finally{if(bridge)await bridge.then(connection=>connection.close()).catch(()=>{});}
}
