import {buildActiveToolRegistry,type ToolSourceRecord} from './active-tool-registry.ts';
import {agentEvidenceFromCalls,observeCustomToolHost,projectAgentActivityInput,projectAgentActivityResult,projectAgentToolResult} from './agent-evidence.ts';
import {planDialogueAgent,type ChatEngine,type DialogueContext,type DialoguePlan} from './conversation.ts';
import {resolveToolNotes} from './tools/tool-host.ts';
import type {ToolPackage} from './tools/tool-registry.ts';
import {AgentToolExecutionError,AgentToolInputError,type AgentToolCall,type AgentToolResult,type AgentToolCapability} from './agent-loop.ts';
import {validateToolArguments,type ToolInputSchema} from './tools/tool-input.ts';
import type {ActivityTool} from './harness-activity.ts';
import type {ToolHost,ToolNote} from './tools/tool-host.ts';
import type {MemorySearchResult} from './memory-search-types.ts';

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
 if(!Array.isArray(result))return;
 for(const item of result){
  if(!item||typeof item!=='object'||Array.isArray(item))continue;
  const row=item as Record<string,unknown>;
  if(typeof row.noteId==='string'&&row.noteId)targets.add(row.noteId);
  const path=row.kind==='file'&&typeof row.path==='string'?row.path:typeof row.title==='string'&&(row.title.includes('/')||/\.[a-z0-9]{1,10}$/i.test(row.title))?row.title:null;
  if(path){targets.add(path);const filename=path.split('/').at(-1);if(filename)targets.add(filename);}
 }
}

/** Application boundary for registry selection, audited tool execution and source observation. */
export async function coordinateAgentTurn(input:{
 engine:ChatEngine;
 model:string|undefined;
 question:string;
 context:DialogueContext;
 prepareContext?:(tools:readonly AgentToolCapability[])=>Promise<DialogueContext>;
 attachments:AgentAttachment[];
 enabledTools:readonly string[];
 builtinPackages:readonly ToolPackage[];
 maxToolCalls:number;
 maxResultChars:number;
 userGuidance?:string;
 scopedAwayFromCustomTools:boolean;
 readToolSources:()=>Promise<ToolSourceRecord[]>;
 search:(query:string,signal?:AbortSignal)=>Promise<MemorySearchResult[]>;
 views:(signal?:AbortSignal)=>Promise<ToolNote[]>;
 ensureCustomRuntime:()=>Promise<unknown>;
 check:()=>void;
 signal:AbortSignal;
 trace:Trace;
}) : Promise<{final:DialoguePlan;calls:readonly AgentToolResult[];customEvidence:ReturnType<typeof agentEvidenceFromCalls>;context:DialogueContext}> {
 const safePackages=input.scopedAwayFromCustomTools?input.builtinPackages.filter(pkg=>pkg.definition.id==='math.calculate'):input.builtinPackages;
 const safeTools=input.scopedAwayFromCustomTools?input.enabledTools.filter(id=>id==='math.calculate'):input.enabledTools;
 const sources=input.scopedAwayFromCustomTools?[]:await input.readToolSources();
 const selected=await buildActiveToolRegistry(sources,safeTools,[...safePackages]);
 const registry=selected.registry,allowedTools=selected.capabilities;
 const context=input.prepareContext?await input.prepareContext(allowedTools):input.context;input.check();
 if(JSON.stringify(context.currentFile??null)!==JSON.stringify(input.context.currentFile??null))throw Error('Context file selection changed');
 let customEvidence:ReturnType<typeof agentEvidenceFromCalls>=[];
 const exactReadTargets=new Set<string>();
 const loop=await planDialogueAgent({
  engine:input.engine,question:input.question,context,attachments:input.attachments,
  allowedTools,maxToolCalls:input.maxToolCalls,maxResultChars:input.maxResultChars,userGuidance:input.userGuidance,check:input.check,
  tracePlan:(step,work,readMetrics)=>input.trace('dialogue.plan',{model:input.model,question:input.question,step},work,plan=>{const inference=readMetrics();return {...plan,...(inference?{inference}:{})};}),
  traceTool:async(call:AgentToolCall,work)=>{
   const identity=await registry.identity(call.tool);
   const result=await input.trace(call.tool as ActivityTool,projectAgentActivityInput(call.tool,call.arguments,identity),work,value=>projectAgentActivityResult(call.tool,value));
   return projectAgentToolResult(call.tool,result);
  },
  execute:async(call:AgentToolCall)=>{
   input.check();
   const schema=allowedTools.find(tool=>tool.id===call.tool)?.inputSchema;
   if(schema){
    // Preflight happens before any runtime or host operation. Adapter exceptions
    // remain terminal even if they resemble an input-validation error.
    try{validateToolArguments(schema as ToolInputSchema,call.arguments);}catch{throw new AgentToolInputError();}
   }
   if(call.tool==='memory.read'&&typeof call.arguments.query==='string'&&!explicitlyNamesReadTarget(call.arguments.query,input.question)&&!exactReadTargets.has(call.arguments.query))throw new AgentToolInputError();
   try{
    const isCustom=call.tool.startsWith('user.');
    if(isCustom)await input.ensureCustomRuntime();
    const host:ToolHost={
     search:(query,signal)=>input.search(query,signal),
     resolve:async(query,signal)=>{const notes=await input.views(signal);signal?.throwIfAborted();return resolveToolNotes(notes,query);},
     check:input.check,signal:input.signal,
    };
    const observed=isCustom?observeCustomToolHost(host,refs=>{customEvidence=agentEvidenceFromCalls([],[...customEvidence,...refs]);}):host;
    const result=await registry.run(call.tool,call.arguments,observed);
    if(call.tool==='memory.search')rememberExactReadTargets(exactReadTargets,result);
    return result;
   }catch(error){if(error instanceof Error&&error.message==='Stopped')throw error;if(input.signal.aborted){input.check();throw Error('Stopped');}throw new AgentToolExecutionError(call.tool,error);}
  },
 });
 return {final:loop.final,calls:loop.calls,customEvidence,context};
}
